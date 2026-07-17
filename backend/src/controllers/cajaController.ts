import { Request, Response } from 'express';
import { query, transaction } from '../config/database';
import { AuthRequest } from '../middlewares/auth';
import jwt from 'jsonwebtoken';

const JWT_CAJA_SECRET = process.env.JWT_CAJA_SECRET || 'clave_caja_secreta_2026';

// ---------------------------------------------------------
// FLUJO DE LOGIN CAJERO (2 Pasos)
// ---------------------------------------------------------

export const validarCodigo = async (req: Request, res: Response) => {
  const { codigo_evento } = req.body;
  try {
    const eventoRes = await query('SELECT * FROM eventos WHERE codigo_caja = $1', [codigo_evento]);
    if (eventoRes.rowCount === 0) return res.status(401).json({ error: 'Código de evento inválido' });
    
    const evento = eventoRes.rows[0];
    if (evento.estado !== 'ACTIVO') return res.status(400).json({ error: 'El evento no está activo' });

    const paletaRes = await query('SELECT * FROM paletas WHERE id_paleta = $1', [evento.id_paleta]);

    const paleta = paletaRes.rows[0] || null;
    res.json({
      evento: {
        id_evento: evento.id_evento,
        nombre: evento.nombre,
        logo_url: evento.logo_url,
        codigo_caja: evento.codigo_caja,
        estado: evento.estado,
        fecha_evento: evento.fecha_evento,
        paleta,
      },
      paleta,
    });
  } catch (error) {
    res.status(500).json({ error: 'Error validando código' });
  }
};

export const abrirCaja = async (req: Request, res: Response) => {
  const { codigo_evento, pin } = req.body;
  try {
    const eventoRes = await query('SELECT * FROM eventos WHERE codigo_caja = $1 AND estado = $2', [codigo_evento, 'ACTIVO']);
    if (eventoRes.rowCount === 0) return res.status(401).json({ error: 'Código inválido o evento inactivo' });
    
    const evento = eventoRes.rows[0];

    const cajeroRes = await query('SELECT * FROM cajeros_evento WHERE id_evento = $1 AND pin = $2 AND estado = true', [evento.id_evento, pin]);
    if (cajeroRes.rowCount === 0) return res.status(401).json({ error: 'PIN inválido o cajero inactivo' });

    const cajero = cajeroRes.rows[0];

    const sesionAbiertaRes = await query("SELECT id_sesion FROM cajas_sesiones WHERE id_cajero_evento = $1 AND estado = 'ABIERTA'", [cajero.id_cajero_evento]);
    
    let id_sesion;
    if ((sesionAbiertaRes.rowCount ?? 0) > 0) {
      id_sesion = sesionAbiertaRes.rows[0].id_sesion;
    } else {
      const insertSesion = await query(
        `INSERT INTO cajas_sesiones (id_evento, id_cajero_evento, monto_apertura) VALUES ($1, $2, 0) RETURNING id_sesion`,
        [evento.id_evento, cajero.id_cajero_evento]
      );
      id_sesion = insertSesion.rows[0].id_sesion;
    }

    const token = jwt.sign({ id_sesion, id_evento: evento.id_evento, id_cajero_evento: cajero.id_cajero_evento }, JWT_CAJA_SECRET, { expiresIn: '12h' });

    res.json({
      token,
      cajero: { nombre: cajero.nombre, id_cajero_evento: cajero.id_cajero_evento },
      sesion: { id_sesion }
    });
  } catch (error) {
    res.status(500).json({ error: 'Error al abrir caja' });
  }
};

// ---------------------------------------------------------
// QUERYS PARA EL FRONTEND DEL POS
// ---------------------------------------------------------

export const getProductosCaja = async (req: AuthRequest, res: Response) => {
  const { id_categoria } = req.query;
  let q = `SELECT p.*, c.nombre AS categoria_nombre
           FROM productos p
           LEFT JOIN categorias c
             ON c.id_categoria = p.id_categoria AND c.id_evento = p.id_evento
           WHERE p.id_evento = $1 AND p.estado = true`;
  const params: any[] = [req.id_evento];
  
  if (id_categoria) {
    q += ' AND p.id_categoria = $2';
    params.push(id_categoria);
  }
  q += ' ORDER BY p.nombre';
  
  try {
    const result = await query(q, params);
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: 'Error obteniendo productos' });
  }
};

export const getCategoriasCaja = async (req: AuthRequest, res: Response) => {
  try {
    const result = await query('SELECT * FROM categorias WHERE id_evento = $1 AND estado = true ORDER BY orden ASC', [req.id_evento]);
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: 'Error obteniendo categorías' });
  }
};

export const getCombosCaja = async (req: AuthRequest, res: Response) => {
  try {
    const result = await query(
      `SELECT
         c.*,
         COALESCE(
           MIN(
             CASE
               WHEN p.id_producto IS NULL OR p.estado = false THEN 0
               ELSE FLOOR(p.stock_actual::numeric / NULLIF(cp.cantidad, 0))
             END
           ),
           0
         )::int AS capacidad_disponible,
         COALESCE(
           jsonb_agg(
             jsonb_build_object(
               'id_producto', p.id_producto,
               'nombre', p.nombre,
               'cantidad', cp.cantidad,
               'stock_actual', p.stock_actual,
               'imagen_url', p.imagen_url
             ) ORDER BY p.nombre
           ) FILTER (WHERE p.id_producto IS NOT NULL),
           '[]'::jsonb
         ) AS productos
       FROM combos c
       LEFT JOIN combo_productos cp ON cp.id_combo = c.id_combo
       LEFT JOIN productos p
         ON p.id_producto = cp.id_producto
        AND p.id_evento = c.id_evento
       WHERE c.id_evento = $1
         AND c.activo = true
         AND (c.fecha_inicio <= NOW() AND (c.fecha_fin IS NULL OR c.fecha_fin >= NOW()))
       GROUP BY c.id_combo
       ORDER BY c.orden ASC, c.id_combo DESC`,
      [req.id_evento]
    );
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: 'Error obteniendo combos' });
  }
};

export const getMetodosPago = async (req: AuthRequest, res: Response) => {
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
                ) FILTER (WHERE c.id_cuenta_pago IS NOT NULL AND c.activo = true),
                '[]'::jsonb
              ) AS cuentas_receptoras
       FROM metodos_pago_evento m
       LEFT JOIN metodos_pago_cuentas c
         ON c.id_metodo_pago = m.id_metodo_pago
        AND c.id_evento = m.id_evento
       WHERE m.id_evento = $1 AND m.activo = true
       GROUP BY m.id_metodo_pago
       ORDER BY m.orden ASC`,
      [req.id_evento]
    );
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: 'Error obteniendo métodos de pago' });
  }
};

export const getResumenCierre = async (req: AuthRequest, res: Response) => {
  try {
    const id_sesion = req.sesion?.id_sesion;
    const ventas = await query(
      `SELECT m.nombre, m.tipo, COALESCE(SUM(v.total), 0) as total, COUNT(v.id_venta) as cantidad
       FROM metodos_pago_evento m
       LEFT JOIN ventas v ON m.id_metodo_pago = v.id_metodo_pago AND v.id_sesion = $1
       WHERE m.id_evento = $2
       GROUP BY m.id_metodo_pago, m.nombre, m.tipo`,
      [id_sesion, req.id_evento]
    );
    
    res.json(ventas.rows);
  } catch (error) {
    res.status(500).json({ error: 'Error obteniendo resumen' });
  }
};

// ---------------------------------------------------------
// OPERACIONES DE CAJA Y ARQUEO (Que ya estaban)
// ---------------------------------------------------------

export const estadoCaja = async (req: AuthRequest, res: Response) => {
  try {
    const result = await query(
      `SELECT * FROM cajas_sesiones WHERE id_sesion = $1`,
      [req.sesion?.id_sesion]
    );
    if (result.rowCount === 0) return res.status(404).json({ error: 'Sesión no encontrada' });
    res.json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ error: 'Error al obtener estado de caja' });
  }
};

export const cerrarCaja = async (req: AuthRequest, res: Response) => {
  const { total_efectivo_declarado, nota_arqueo } = req.body;
  const id_sesion = req.sesion?.id_sesion;

  try {
    const result = await transaction(async (client) => {
      // 1. Obtener todas las ventas de la sesión por método de pago
      const ventasAgrupadas = await client.query(
        `SELECT id_metodo_pago, SUM(total) as total_metodo, COUNT(id_venta) as cantidad 
         FROM ventas 
         WHERE id_sesion = $1
         GROUP BY id_metodo_pago`,
        [id_sesion]
      );

      let totalVentas = 0;
      let efectivoEsperado = 0; // Se asume que obtendremos esto de la apertura + ventas en efectivo

      // Obtener sesión actual
      const sesionRes = await client.query('SELECT monto_apertura FROM cajas_sesiones WHERE id_sesion = $1', [id_sesion]);
      const montoApertura = Number(sesionRes.rows[0].monto_apertura);
      efectivoEsperado += montoApertura;

      // Obtener info de los métodos de pago (para saber cuál es EFECTIVO)
      const metodosRes = await client.query('SELECT id_metodo_pago, tipo FROM metodos_pago_evento WHERE id_evento = $1', [req.id_evento]);
      const metodos = metodosRes.rows;

      // 2. Registrar arqueo por detalle
      for (const ag of ventasAgrupadas.rows) {
        const metodo = metodos.find(m => m.id_metodo_pago === ag.id_metodo_pago);
        const totalSistema = Number(ag.total_metodo);
        totalVentas += totalSistema;
        
        let declarado = totalSistema; // Por defecto asumimos que billeteras cuadran siempre (automático)
        let diferencia = 0;

        if (metodo && metodo.tipo === 'EFECTIVO') {
          efectivoEsperado += totalSistema;
          declarado = Number(total_efectivo_declarado);
          diferencia = declarado - efectivoEsperado;
        }

        await client.query(
          `INSERT INTO arqueo_detalle (id_sesion, id_metodo_pago, total_sistema, cantidad_transacciones, total_declarado, diferencia, nota)
           VALUES ($1, $2, $3, $4, $5, $6, $7)`,
          [id_sesion, ag.id_metodo_pago, totalSistema, ag.cantidad, declarado, diferencia, nota_arqueo]
        );
      }

      // Si no hubo ventas en efectivo pero hay monto de apertura
      if (ventasAgrupadas.rowCount === 0 || !metodos.find(m => m.tipo === 'EFECTIVO')) {
        const diferencia = Number(total_efectivo_declarado) - efectivoEsperado;
        // Podríamos registrar un arqueo especial o simplemente dejarlo en la tabla principal
      }

      const diferenciaGlobal = Number(total_efectivo_declarado) - efectivoEsperado;

      // 3. Cerrar sesión
      const cierreRes = await client.query(
        `UPDATE cajas_sesiones 
         SET hora_cierre = NOW(),
             estado = 'CERRADA',
             total_ventas = $1,
             total_efectivo_esperado = $2,
             total_efectivo_real = $3,
             diferencia = $4
         WHERE id_sesion = $5 RETURNING *`,
        [totalVentas, efectivoEsperado, total_efectivo_declarado, diferenciaGlobal, id_sesion]
      );

      return cierreRes.rows[0];
    });

    res.json({ message: 'Caja cerrada exitosamente', cierre: result });
  } catch (error) {
    res.status(500).json({ error: 'Error al cerrar caja' });
  }
};
