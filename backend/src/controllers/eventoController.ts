import { Request, Response } from 'express';
import bcrypt from 'bcrypt';
import { query, transaction } from '../config/database';
import { AuthRequest } from '../middlewares/auth';
import { generarSlug } from '../utils/generarSlug';
import { generarCodigoCaja } from '../utils/generarCodigo';

export const crearEvento = async (req: AuthRequest, res: Response) => {
  const { nombre, id_admin, id_paleta, fecha_evento, logo_url, codigo_caja, slug: providedSlug } = req.body;
  if (typeof nombre !== 'string' || nombre.trim().length < 2) return res.status(400).json({ error: 'Nombre de evento inválido' });
  if (!Number.isInteger(Number(id_admin)) || Number(id_admin) < 1) return res.status(400).json({ error: 'Administrador inválido' });
  if (!Number.isInteger(Number(id_paleta)) || Number(id_paleta) < 1) return res.status(400).json({ error: 'Paleta inválida' });
  if (typeof fecha_evento !== 'string' || Number.isNaN(Date.parse(fecha_evento))) return res.status(400).json({ error: 'Fecha de evento inválida' });

  try {
    const nombreNormalizado = nombre.trim();
    const slug = providedSlug || generarSlug(nombreNormalizado);
    const codigoCajaFinal = codigo_caja || await generarCodigoCaja(nombreNormalizado);

    const evento = await transaction(async (client) => {
      // 1. Verificar que el administrador existe y es ADMIN_EVENTO
      const userRes = await client.query('SELECT rol FROM usuarios WHERE id_usuario = $1', [id_admin]);
      
      if (userRes.rowCount === 0) {
        throw new Error('Administrador no encontrado');
      }
      if (userRes.rows[0].rol !== 'ADMIN_EVENTO') {
        throw new Error('El usuario asignado no tiene el rol de Administrador de Evento');
      }

      // 2. Crear evento
      const insertEvento = await client.query(
        `INSERT INTO eventos (nombre, id_admin, id_paleta, slug, codigo_caja, fecha_evento, logo_url)
         VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
        [nombreNormalizado, Number(id_admin), Number(id_paleta), slug, codigoCajaFinal, fecha_evento, logo_url || null]
      );
      const ev = insertEvento.rows[0];

      // 3. Crear métodos de pago por defecto
      const metodos = [
        { nombre: 'Efectivo', tipo: 'EFECTIVO', reqRef: false },
        { nombre: 'Yape', tipo: 'BILLETERA_DIGITAL', reqRef: true },
        { nombre: 'Plin', tipo: 'BILLETERA_DIGITAL', reqRef: true }
      ];

      for (let i = 0; i < metodos.length; i++) {
        await client.query(
          `INSERT INTO metodos_pago_evento (id_evento, nombre, tipo, orden, requiere_referencia)
           VALUES ($1, $2, $3, $4, $5)`,
          [ev.id_evento, metodos[i].nombre, metodos[i].tipo, i, metodos[i].reqRef]
        );
      }

      return ev;
    });

    res.status(201).json(evento);
  } catch (error: any) {
    console.error('[crearEvento] Error:', error.message, error.detail || '');
    res.status(500).json({ error: error.message || 'Error al crear evento' });
  }
};

export const listarEventos = async (req: AuthRequest, res: Response) => {
  try {
    let queryStr = `
      SELECT e.*, u.nombre as admin_nombre, u.email as admin_email, p.nombre as paleta_nombre,
             p.color_primario_base, p.color_secundario_base, p.color_acento_base
      FROM eventos e
      LEFT JOIN usuarios u ON e.id_admin = u.id_usuario
      LEFT JOIN paletas p ON e.id_paleta = p.id_paleta
    `;

    if (req.usuario?.rol === 'SUPER_ADMIN') {
      const result = await query(queryStr + ' ORDER BY e.id_evento DESC');
      return res.json(result.rows);
    } else if (req.usuario?.rol === 'ADMIN_EVENTO') {
      const result = await query(queryStr + ' WHERE e.id_admin = $1 ORDER BY e.id_evento DESC', [req.usuario.id_usuario]);
      return res.json(result.rows);
    }
    res.status(403).json({ error: 'No autorizado' });
  } catch (error) {
    res.status(500).json({ error: 'Error al listar eventos' });
  }
};

export const obtenerMiEvento = async (req: AuthRequest, res: Response) => {
  try {
    const result = await query(
      `SELECT e.*, row_to_json(p.*) as paleta 
       FROM eventos e 
       JOIN paletas p ON e.id_paleta = p.id_paleta 
       WHERE e.id_evento = $1`, 
      [req.id_evento]
    );
    if (result.rowCount === 0) return res.status(404).json({ error: 'Evento no encontrado' });
    
    const evento = result.rows[0];

    // Cajeros activos
    const cajerosRes = await query(`SELECT COUNT(*) as total FROM cajeros_evento WHERE id_evento = $1 AND estado = true`, [req.id_evento]);
    const cajeros = parseInt(cajerosRes.rows[0].total) || 0;

    // Productos y Combos
    const productosRes = await query(`SELECT COUNT(*) as total FROM productos WHERE id_evento = $1 AND estado = true`, [req.id_evento]);
    const combosRes = await query(`SELECT COUNT(*) as total FROM combos WHERE id_evento = $1 AND activo = true`, [req.id_evento]);

    // Ingresos y ordenes
    const ventasRes = await query(
      `SELECT COUNT(id_venta) as ordenes, COALESCE(SUM(total), 0) as ingresos 
       FROM ventas 
       WHERE id_sesion IN (SELECT id_sesion FROM cajas_sesiones WHERE id_evento = $1)`, 
      [req.id_evento]
    );
    
    const stats = {
      cajeros,
      productos: parseInt(productosRes.rows[0].total) || 0,
      combos: parseInt(combosRes.rows[0].total) || 0,
      ordenes: parseInt(ventasRes.rows[0].ordenes) || 0,
      ingresos: parseFloat(ventasRes.rows[0].ingresos) || 0
    };

    res.json({ ...evento, stats });
  } catch (error) {
    res.status(500).json({ error: 'Error al obtener evento' });
  }
};

export const actualizarConfiguracion = async (req: AuthRequest, res: Response) => {
  const { logo_url, id_paleta } = req.body;
  try {
    const result = await query(
      `UPDATE eventos SET logo_url = COALESCE($1, logo_url), id_paleta = COALESCE($2, id_paleta) 
       WHERE id_evento = $3 RETURNING *`,
      [logo_url, id_paleta, req.id_evento]
    );
    res.json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ error: 'Error al actualizar configuración' });
  }
};

export const finalizarEvento = async (req: AuthRequest, res: Response) => {
  try {
    // Verificar cajas abiertas
    const cajasAbiertas = await query(
      `SELECT id_sesion FROM cajas_sesiones WHERE id_evento = $1 AND estado = 'ABIERTA'`,
      [req.id_evento]
    );

    if ((cajasAbiertas.rowCount ?? 0) > 0) {
      return res.status(400).json({ error: 'No se puede finalizar el evento porque hay cajas abiertas' });
    }

    const result = await query(
      `UPDATE eventos SET estado = 'FINALIZADO' WHERE id_evento = $1 RETURNING *`,
      [req.id_evento]
    );

    res.json({ message: 'Evento finalizado exitosamente', evento: result.rows[0] });
  } catch (error) {
    res.status(500).json({ error: 'Error al finalizar evento' });
  }
};

export const obtenerEvento = async (req: Request, res: Response) => {
  try {
    const result = await query(
      `SELECT e.*, u.nombre as admin_nombre, u.email as admin_email, p.nombre as paleta_nombre,
              p.color_primario_base, p.color_secundario_base, p.color_acento_base
       FROM eventos e
       LEFT JOIN usuarios u ON e.id_admin = u.id_usuario
       LEFT JOIN paletas p ON e.id_paleta = p.id_paleta
       WHERE e.id_evento = $1`,
      [req.params.id]
    );
    if (result.rowCount === 0) return res.status(404).json({ error: 'Evento no encontrado' });
    res.json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ error: 'Error al obtener evento' });
  }
};

export const actualizarEvento = async (req: Request, res: Response) => {
  const { nombre, fecha_evento, id_admin, id_paleta, logo_url, codigo_caja, slug } = req.body;
  try {
    const result = await query(
      `UPDATE eventos 
       SET nombre = COALESCE($1, nombre), 
           fecha_evento = COALESCE($2, fecha_evento),
           id_admin = COALESCE($3, id_admin),
           id_paleta = COALESCE($4, id_paleta),
           logo_url = COALESCE($5, logo_url),
           codigo_caja = COALESCE($6, codigo_caja),
           slug = COALESCE($7, slug)
       WHERE id_evento = $8 RETURNING *`,
      [nombre, fecha_evento, id_admin, id_paleta, logo_url, codigo_caja, slug, req.params.id]
    );
    if (result.rowCount === 0) return res.status(404).json({ error: 'Evento no encontrado' });
    res.json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ error: 'Error al actualizar evento' });
  }
};

export const actualizarEstadoEvento = async (req: Request, res: Response) => {
  const { estado } = req.body;
  try {
    const result = await query(
      `UPDATE eventos SET estado = $1 WHERE id_evento = $2 RETURNING *`,
      [estado, req.params.id]
    );
    if (result.rowCount === 0) return res.status(404).json({ error: 'Evento no encontrado' });
    res.json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ error: 'Error al actualizar estado del evento' });
  }
};

export const eliminarEvento = async (req: Request, res: Response) => {
  const { id } = req.params;
  
  try {
    const result = await transaction(async (client) => {
      // 1. Verificar que existe
      const evento = await client.query('SELECT * FROM eventos WHERE id_evento = $1', [id]);
      if (evento.rowCount === 0) {
        throw new Error('Evento no encontrado');
      }
      
      // 2. Eliminar en orden (cascada completa)
      // — Detalles de ventas por sesión de caja
      await client.query('DELETE FROM arqueo_detalle WHERE id_sesion IN (SELECT id_sesion FROM cajas_sesiones WHERE id_evento = $1)', [id]);
      await client.query('DELETE FROM ventas_combo WHERE id_venta IN (SELECT id_venta FROM ventas WHERE id_sesion IN (SELECT id_sesion FROM cajas_sesiones WHERE id_evento = $1))', [id]);
      await client.query('DELETE FROM detalles_venta WHERE id_venta IN (SELECT id_venta FROM ventas WHERE id_sesion IN (SELECT id_sesion FROM cajas_sesiones WHERE id_evento = $1))', [id]);
      await client.query('DELETE FROM ventas WHERE id_sesion IN (SELECT id_sesion FROM cajas_sesiones WHERE id_evento = $1)', [id]);
      // — Ventas con referencia directa a id_evento (ventas admin / sin sesión)
      await client.query('DELETE FROM ventas_combo WHERE id_venta IN (SELECT id_venta FROM ventas WHERE id_evento = $1)', [id]);
      await client.query('DELETE FROM detalles_venta WHERE id_venta IN (SELECT id_venta FROM ventas WHERE id_evento = $1)', [id]);
      await client.query('DELETE FROM ventas WHERE id_evento = $1', [id]);
      // — Sesiones de caja
      await client.query('DELETE FROM cajas_sesiones WHERE id_evento = $1', [id]);
      // — Inventario y catálogo
      await client.query('DELETE FROM movimientos_inventario WHERE id_producto IN (SELECT id_producto FROM productos WHERE id_evento = $1)', [id]);
      await client.query('DELETE FROM combo_productos WHERE id_combo IN (SELECT id_combo FROM combos WHERE id_evento = $1)', [id]);
      await client.query('DELETE FROM descuentos_cantidad WHERE id_evento = $1', [id]);
      await client.query('DELETE FROM combos WHERE id_evento = $1', [id]);
      await client.query('DELETE FROM productos WHERE id_evento = $1', [id]);
      await client.query('DELETE FROM categorias WHERE id_evento = $1', [id]);
      // — Configuración del evento
      await client.query('DELETE FROM cajeros_evento WHERE id_evento = $1', [id]);
      await client.query('DELETE FROM metodos_pago_evento WHERE id_evento = $1', [id]);
      // — Evento
      await client.query('DELETE FROM eventos WHERE id_evento = $1', [id]);

      return true;
    });

    res.json({ mensaje: 'Evento eliminado completamente' });
  } catch (error: any) {
    if (error.message === 'Evento no encontrado') {
      return res.status(404).json({ error: error.message });
    }
    res.status(500).json({ error: 'Error al eliminar evento' });
  }
};

export const subirLogoBase64 = async (req: AuthRequest, res: Response) => {
  const { logo_base64 } = req.body;

  if (!logo_base64 || typeof logo_base64 !== 'string') {
    return res.status(400).json({ error: 'Debe enviar un string base64 válido' });
  }

  // Validación básica
  if (!logo_base64.startsWith('data:image/')) {
    return res.status(400).json({ error: 'Formato de imagen inválido' });
  }

  try {
    // Opción A: Guardar base64 directamente en la BD
    const result = await query(
      `UPDATE eventos SET logo_url = $1 WHERE id_evento = $2 RETURNING *`,
      [logo_base64, req.id_evento]
    );

    if (result.rowCount === 0) return res.status(404).json({ error: 'Evento no encontrado' });
    res.json({ message: 'Logo actualizado', logo_url: result.rows[0].logo_url });
  } catch (error) {
    res.status(500).json({ error: 'Error al subir logo' });
  }
};
export const obtenerDashboardGlobal = async (req: AuthRequest, res: Response) => {
  try {
    const eventosRes = await query(`
      SELECT e.id_evento, e.nombre, e.estado, e.logo_url, e.codigo_caja,
             u.nombre as admin_nombre, u.email as admin_email,
             p.color_primario_base, p.color_secundario_base, p.color_acento_base,
             (SELECT COUNT(*) FROM cajeros_evento ce WHERE ce.id_evento = e.id_evento AND ce.estado = true) as total_cajeros,
             (SELECT COUNT(*) FROM cajas_sesiones cs WHERE cs.id_evento = e.id_evento) as total_cajas,
             (SELECT COUNT(*) FROM productos p_prod WHERE p_prod.id_evento = e.id_evento) as total_productos,
             (SELECT COUNT(*) FROM categorias c WHERE c.id_evento = e.id_evento) as total_categorias
      FROM eventos e
      LEFT JOIN usuarios u ON e.id_admin = u.id_usuario
      LEFT JOIN paletas p ON e.id_paleta = p.id_paleta
      ORDER BY e.id_evento DESC
    `);
    
    // Get total sales across the whole system
    const ventasGlobales = await query(`SELECT COALESCE(SUM(total), 0) as total FROM ventas`);
    const totalVentas = parseFloat(ventasGlobales.rows[0].total) || 0;

    // Get total products sold across the whole system
    const productosVendidosGlobales = await query(`SELECT COALESCE(SUM(cantidad), 0) as total FROM detalles_venta`);
    const totalProductosVendidos = parseInt(productosVendidosGlobales.rows[0].total) || 0;

    res.json({
      eventos: eventosRes.rows,
      ventasTotales: totalVentas,
      productosVendidosTotales: totalProductosVendidos
    });
  } catch (error) {
    res.status(500).json({ error: 'Error al obtener dashboard global' });
  }
};
