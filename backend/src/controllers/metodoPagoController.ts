import { Response } from 'express';
import { query, transaction } from '../config/database';
import { AuthRequest } from '../middlewares/auth';

export const listarMetodosPago = async (req: AuthRequest, res: Response) => {
  try {
    const result = await query(
      `SELECT m.*,
              false AS requiere_referencia,
              COALESCE(
                jsonb_agg(
                  jsonb_build_object(
                    'id_cuenta_pago', c.id_cuenta_pago,
                    'nombre_titular', c.nombre_titular,
                    'numero_destino', c.numero_destino,
                    'activo', c.activo,
                    'es_predeterminado', c.es_predeterminado,
                    'orden', c.orden
                  ) ORDER BY c.es_predeterminado DESC, c.orden ASC, c.id_cuenta_pago ASC
                ) FILTER (WHERE c.id_cuenta_pago IS NOT NULL),
                '[]'::jsonb
              ) AS cuentas_receptoras
       FROM metodos_pago_evento m
       LEFT JOIN metodos_pago_cuentas c
         ON c.id_metodo_pago = m.id_metodo_pago
        AND c.id_evento = m.id_evento
        AND c.activo = true
       WHERE m.id_evento = $1
       GROUP BY m.id_metodo_pago
       ORDER BY m.orden ASC`,
      [req.id_evento]
    );
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: 'Error al listar métodos de pago' });
  }
};

const esMetodoTransferencia = (tipo: string) =>
  ['TRANSFERENCIA', 'BILLETERA_DIGITAL'].includes(tipo);

const normalizarNumeroDestino = (value: unknown) => String(value ?? '').replace(/\D/g, '');

export const crearCuentaPago = async (req: AuthRequest, res: Response) => {
  const idMetodoPago = Number(req.params.id);
  const numeroDestino = normalizarNumeroDestino(req.body.numero_destino);
  const nombreTitular = String(req.body.nombre_titular ?? '').trim();
  const marcarPredeterminada = Boolean(req.body.es_predeterminado);

  if (!Number.isInteger(idMetodoPago) || idMetodoPago <= 0) {
    return res.status(400).json({ error: 'MÃ©todo de pago invÃ¡lido' });
  }
  if (numeroDestino.length < 6 || numeroDestino.length > 30) {
    return res.status(400).json({ error: 'El nÃºmero de destino debe tener entre 6 y 30 dÃ­gitos' });
  }
  if (nombreTitular.length > 120) {
    return res.status(400).json({ error: 'El nombre del titular es demasiado largo' });
  }

  try {
    const cuenta = await transaction(async (client) => {
      const metodoRes = await client.query(
        `SELECT tipo
         FROM metodos_pago_evento
         WHERE id_metodo_pago = $1 AND id_evento = $2
         FOR UPDATE`,
        [idMetodoPago, req.id_evento]
      );
      if (metodoRes.rowCount === 0) throw new Error('MÃ©todo de pago no encontrado');
      if (!esMetodoTransferencia(metodoRes.rows[0].tipo)) {
        throw new Error('Solo los mÃ©todos de transferencia pueden tener cuentas receptoras');
      }

      const defaultRes = await client.query(
        `SELECT 1 FROM metodos_pago_cuentas
         WHERE id_metodo_pago = $1 AND id_evento = $2 AND activo = true AND es_predeterminado = true
         LIMIT 1`,
        [idMetodoPago, req.id_evento]
      );
      const seraPredeterminada = marcarPredeterminada || defaultRes.rowCount === 0;

      if (seraPredeterminada) {
        await client.query(
          `UPDATE metodos_pago_cuentas
           SET es_predeterminado = false
           WHERE id_metodo_pago = $1 AND id_evento = $2`,
          [idMetodoPago, req.id_evento]
        );
      }

      const result = await client.query(
        `INSERT INTO metodos_pago_cuentas
           (id_evento, id_metodo_pago, nombre_titular, numero_destino, activo, es_predeterminado, orden)
         VALUES ($1, $2, $3, $4, true, $5, $6)
         RETURNING *`,
        [req.id_evento, idMetodoPago, nombreTitular || null, numeroDestino, seraPredeterminada, Number(req.body.orden) || 0]
      );
      return result.rows[0];
    });

    res.status(201).json(cuenta);
  } catch (error: any) {
    if (error.code === '23505') {
      return res.status(400).json({ error: 'Ese nÃºmero ya estÃ¡ registrado en este mÃ©todo' });
    }
    const message = error.message || 'Error al agregar la cuenta receptora';
    res.status(message.includes('no encontrado') ? 404 : 400).json({ error: message });
  }
};

export const establecerCuentaPredeterminada = async (req: AuthRequest, res: Response) => {
  const idMetodoPago = Number(req.params.id);
  const idCuentaPago = Number(req.params.idCuenta);

  if (!Number.isInteger(idMetodoPago) || !Number.isInteger(idCuentaPago)) {
    return res.status(400).json({ error: 'Cuenta receptora invÃ¡lida' });
  }

  try {
    const cuenta = await transaction(async (client) => {
      const metodoRes = await client.query(
        `SELECT tipo FROM metodos_pago_evento
         WHERE id_metodo_pago = $1 AND id_evento = $2
         FOR UPDATE`,
        [idMetodoPago, req.id_evento]
      );
      if (metodoRes.rowCount === 0) throw new Error('MÃ©todo de pago no encontrado');
      if (!esMetodoTransferencia(metodoRes.rows[0].tipo)) {
        throw new Error('El mÃ©todo seleccionado no admite cuentas receptoras');
      }

      const cuentaRes = await client.query(
        `SELECT * FROM metodos_pago_cuentas
         WHERE id_cuenta_pago = $1 AND id_metodo_pago = $2 AND id_evento = $3 AND activo = true`,
        [idCuentaPago, idMetodoPago, req.id_evento]
      );
      if (cuentaRes.rowCount === 0) throw new Error('Cuenta receptora no encontrada');

      await client.query(
        `UPDATE metodos_pago_cuentas SET es_predeterminado = false
         WHERE id_metodo_pago = $1 AND id_evento = $2`,
        [idMetodoPago, req.id_evento]
      );
      const result = await client.query(
        `UPDATE metodos_pago_cuentas
         SET es_predeterminado = true
         WHERE id_cuenta_pago = $1 AND id_metodo_pago = $2 AND id_evento = $3
         RETURNING *`,
        [idCuentaPago, idMetodoPago, req.id_evento]
      );
      return result.rows[0];
    });

    res.json(cuenta);
  } catch (error: any) {
    const message = error.message || 'Error al cambiar la cuenta predeterminada';
    res.status(message.includes('no encontrad') ? 404 : 400).json({ error: message });
  }
};

export const eliminarCuentaPago = async (req: AuthRequest, res: Response) => {
  const idMetodoPago = Number(req.params.id);
  const idCuentaPago = Number(req.params.idCuenta);

  try {
    await transaction(async (client) => {
      const cuentaRes = await client.query(
        `WITH cuenta_anterior AS (
           SELECT id_cuenta_pago, es_predeterminado
           FROM metodos_pago_cuentas
           WHERE id_cuenta_pago = $1 AND id_metodo_pago = $2 AND id_evento = $3 AND activo = true
         )
         UPDATE metodos_pago_cuentas AS cuenta
         SET activo = false, es_predeterminado = false
         FROM cuenta_anterior
         WHERE cuenta.id_cuenta_pago = cuenta_anterior.id_cuenta_pago
         RETURNING cuenta_anterior.es_predeterminado AS era_predeterminada`,
        [idCuentaPago, idMetodoPago, req.id_evento]
      );
      if (cuentaRes.rowCount === 0) throw new Error('Cuenta receptora no encontrada');

      if (cuentaRes.rows[0].era_predeterminada) {
        await client.query(
          `UPDATE metodos_pago_cuentas
           SET es_predeterminado = true
           WHERE id_cuenta_pago = (
             SELECT id_cuenta_pago FROM metodos_pago_cuentas
             WHERE id_metodo_pago = $1 AND id_evento = $2 AND activo = true
             ORDER BY orden ASC, id_cuenta_pago ASC
             LIMIT 1
           )`,
          [idMetodoPago, req.id_evento]
        );
      }
    });
    res.json({ message: 'Cuenta receptora eliminada' });
  } catch (error: any) {
    const message = error.message || 'Error al eliminar la cuenta receptora';
    res.status(message.includes('no encontrada') ? 404 : 400).json({ error: message });
  }
};

export const crearMetodoPago = async (req: AuthRequest, res: Response) => {
  const { nombre, tipo, activo, orden, color_hex, cuenta_receptora } = req.body;
  const requiereReferenciaFinal = false;
  const numeroDestino = normalizarNumeroDestino(cuenta_receptora?.numero_destino);
  const nombreTitular = String(cuenta_receptora?.nombre_titular ?? '').trim();

  if (esMetodoTransferencia(tipo) && (numeroDestino.length < 6 || numeroDestino.length > 30)) {
    return res.status(400).json({ error: 'Ingresa un número receptor de entre 6 y 30 dígitos' });
  }
  if (nombreTitular.length > 120) {
    return res.status(400).json({ error: 'El titular o alias es demasiado largo' });
  }

  try {
    const metodoCreado = await transaction(async (client) => {
      const result = await client.query(
        `INSERT INTO metodos_pago_evento (id_evento, nombre, tipo, activo, orden, requiere_referencia, color_hex)
         VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
        [req.id_evento, nombre, tipo, activo ?? true, orden || 0, requiereReferenciaFinal, color_hex || 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 border-slate-200 dark:border-slate-700']
      );
      const metodo = result.rows[0];
      let cuentasReceptoras: any[] = [];

      if (esMetodoTransferencia(tipo)) {
        const cuentaRes = await client.query(
          `INSERT INTO metodos_pago_cuentas
             (id_evento, id_metodo_pago, nombre_titular, numero_destino, activo, es_predeterminado, orden)
           VALUES ($1, $2, $3, $4, true, true, 0)
           RETURNING *`,
          [req.id_evento, metodo.id_metodo_pago, nombreTitular || null, numeroDestino]
        );
        cuentasReceptoras = cuentaRes.rows;
      }

      return { ...metodo, cuentas_receptoras: cuentasReceptoras };
    });
    res.status(201).json(metodoCreado);
  } catch (error: any) {
    if (error.code === '23505') { 
      return res.status(400).json({ error: 'Ya existe un método de pago con ese nombre' });
    }
    res.status(500).json({ error: 'Error al crear método de pago' });
  }
};

export const actualizarMetodoPago = async (req: AuthRequest, res: Response) => {
  const { nombre, tipo, activo, orden, color_hex } = req.body;
  const id_metodo_pago = req.params.id;

  try {
    const result = await query(
      `UPDATE metodos_pago_evento 
       SET nombre = COALESCE($1, nombre),
           tipo = COALESCE($2, tipo),
           activo = COALESCE($3, activo),
           orden = COALESCE($4, orden),
           requiere_referencia = false,
           color_hex = COALESCE($5, color_hex)
       WHERE id_metodo_pago = $6 AND id_evento = $7 RETURNING *`,
      [nombre, tipo, activo, orden, color_hex, id_metodo_pago, req.id_evento]
    );
    
    if (result.rowCount === 0) return res.status(404).json({ error: 'Método de pago no encontrado' });
    res.json(result.rows[0]);
  } catch (error: any) {
    if (error.code === '23505') { 
      return res.status(400).json({ error: 'Ya existe un método de pago con ese nombre' });
    }
    res.status(500).json({ error: 'Error al actualizar método de pago' });
  }
};

export const eliminarMetodoPago = async (req: AuthRequest, res: Response) => {
  const id_metodo_pago = req.params.id;
  try {
    const result = await query(
      `DELETE FROM metodos_pago_evento WHERE id_metodo_pago = $1 AND id_evento = $2 RETURNING *`,
      [id_metodo_pago, req.id_evento]
    );
    if (result.rowCount === 0) return res.status(404).json({ error: 'Método de pago no encontrado' });
    res.json({ message: 'Método de pago eliminado exitosamente', metodo: result.rows[0] });
  } catch (error) {
    res.status(500).json({ error: 'Error al eliminar método de pago. Es posible que esté en uso.' });
  }
};
