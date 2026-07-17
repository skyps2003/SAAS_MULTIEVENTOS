import { Response } from 'express';
import { query } from '../config/database';
import { AuthRequest } from '../middlewares/auth';

export const getResumenDashboard = async (req: AuthRequest, res: Response) => {
  try {
    const id_evento = req.id_evento;

    // 1. Total Ventas (suma de todas las ventas del evento)
    const ventasTotalesRes = await query(
      `SELECT COALESCE(SUM(v.total), 0) as total_ventas 
       FROM ventas v 
       JOIN cajas_sesiones cs ON v.id_sesion = cs.id_sesion 
       WHERE cs.id_evento = $1`,
      [id_evento]
    );

    // 2. Transacciones
    const transaccionesRes = await query(
      `SELECT COUNT(v.id_venta) as total_transacciones 
       FROM ventas v 
       JOIN cajas_sesiones cs ON v.id_sesion = cs.id_sesion 
       WHERE cs.id_evento = $1`,
      [id_evento]
    );

    // 3. Productos vendidos hoy vs total
    const productosVendidosRes = await query(
      `SELECT COALESCE(SUM(dv.cantidad), 0) as total_productos_vendidos
       FROM detalles_venta dv
       JOIN ventas v ON dv.id_venta = v.id_venta
       JOIN cajas_sesiones cs ON v.id_sesion = cs.id_sesion
       WHERE cs.id_evento = $1`,
      [id_evento]
    );

    // 4. Desempeño por método de pago
    const pagosRes = await query(
      `SELECT m.nombre as metodo, m.color_hex, COALESCE(SUM(v.total), 0) as total
       FROM metodos_pago_evento m
       LEFT JOIN ventas v ON m.id_metodo_pago = v.id_metodo_pago
       LEFT JOIN cajas_sesiones cs ON v.id_sesion = cs.id_sesion AND cs.id_evento = $1
       WHERE m.id_evento = $1
       GROUP BY m.id_metodo_pago, m.nombre, m.color_hex`,
      [id_evento]
    );

    res.json({
      total_ingresos: Number(ventasTotalesRes.rows[0].total_ventas),
      transacciones: Number(transaccionesRes.rows[0].total_transacciones),
      productos_vendidos: Number(productosVendidosRes.rows[0].total_productos_vendidos),
      ventas_por_metodo: pagosRes.rows.map(r => ({ metodo: r.metodo, color_hex: r.color_hex, total: Number(r.total) }))
    });
  } catch (error) {
    res.status(500).json({ error: 'Error al cargar el dashboard' });
  }
};

export const getDashboardGlobal = async (req: AuthRequest, res: Response) => {
  try {
    // 1. Total Eventos
    const eventosRes = await query(`SELECT COUNT(*) as total FROM eventos`);
    
    // 2. Total Ingresos Globales
    const ingresosRes = await query(`SELECT COALESCE(SUM(total), 0) as total FROM ventas`);
    
    // 3. Total Cajeros Registrados Globalmente
    const cajerosRes = await query(`SELECT COUNT(*) as total FROM cajeros_evento`);

    // 4. Ingresos agrupados por Evento
    const ingresosPorEvento = await query(
      `SELECT e.nombre as evento, COALESCE(SUM(v.total), 0) as ingresos
       FROM eventos e
       LEFT JOIN cajas_sesiones cs ON e.id_evento = cs.id_evento
       LEFT JOIN ventas v ON cs.id_sesion = v.id_sesion
       GROUP BY e.id_evento, e.nombre
       ORDER BY ingresos DESC`
    );

    res.json({
      eventos_activos: Number(eventosRes.rows[0].total),
      ingresos_totales: Number(ingresosRes.rows[0].total),
      cajeros_registrados: Number(cajerosRes.rows[0].total),
      ingresos_por_evento: ingresosPorEvento.rows.map(r => ({ evento: r.evento, ingresos: Number(r.ingresos) }))
    });
  } catch (error) {
    res.status(500).json({ error: 'Error al cargar el dashboard global' });
  }
};

export const getEstadisticas = async (req: AuthRequest, res: Response) => {
  try {
    const id_evento = req.id_evento;

    // Ventas por hora
    const ventasHora = await query(
      `SELECT EXTRACT(HOUR FROM v.fecha_hora) as hora, COUNT(*) as cantidad, COALESCE(SUM(v.total), 0) as total
       FROM ventas v
       JOIN cajas_sesiones cs ON v.id_sesion = cs.id_sesion
       WHERE cs.id_evento = $1
       GROUP BY EXTRACT(HOUR FROM v.fecha_hora)
       ORDER BY hora ASC`,
      [id_evento]
    );

    // Top 5 Productos más vendidos
    const topProductos = await query(
      `SELECT p.nombre, SUM(dv.cantidad) as cantidad_vendida, SUM(dv.subtotal) as total_generado
       FROM detalles_venta dv
       JOIN productos p ON dv.id_producto = p.id_producto
       JOIN ventas v ON dv.id_venta = v.id_venta
       JOIN cajas_sesiones cs ON v.id_sesion = cs.id_sesion
       WHERE cs.id_evento = $1
       GROUP BY p.id_producto, p.nombre
       ORDER BY cantidad_vendida DESC
       LIMIT 5`,
      [id_evento]
    );

    res.json({
      ventas_por_hora: ventasHora.rows.map(r => ({ hora: Number(r.hora), cantidad: Number(r.cantidad), total: Number(r.total) })),
      top_productos: topProductos.rows.map(r => ({ nombre: r.nombre, cantidad: Number(r.cantidad_vendida), total: Number(r.total_generado) }))
    });
  } catch (error) {
    res.status(500).json({ error: 'Error al obtener estadísticas' });
  }
};

export const getResumenDashboardSuperAdmin = async (req: AuthRequest, res: Response) => {
  try {
    const id_evento = req.params.id;

    const ventasTotalesRes = await query(
      `SELECT COALESCE(SUM(v.total), 0) as total_ventas FROM ventas v JOIN cajas_sesiones cs ON v.id_sesion = cs.id_sesion WHERE cs.id_evento = $1`,
      [id_evento]
    );

    const transaccionesRes = await query(
      `SELECT COUNT(v.id_venta) as total_transacciones FROM ventas v JOIN cajas_sesiones cs ON v.id_sesion = cs.id_sesion WHERE cs.id_evento = $1`,
      [id_evento]
    );

    const productosVendidosRes = await query(
      `SELECT COALESCE(SUM(dv.cantidad), 0) as total_productos_vendidos FROM detalles_venta dv JOIN ventas v ON dv.id_venta = v.id_venta JOIN cajas_sesiones cs ON v.id_sesion = cs.id_sesion WHERE cs.id_evento = $1`,
      [id_evento]
    );

    const pagosRes = await query(
      `SELECT m.nombre as metodo, m.color_hex, COALESCE(SUM(v.total), 0) as total FROM metodos_pago_evento m LEFT JOIN ventas v ON m.id_metodo_pago = v.id_metodo_pago LEFT JOIN cajas_sesiones cs ON v.id_sesion = cs.id_sesion AND cs.id_evento = $1 WHERE m.id_evento = $1 GROUP BY m.id_metodo_pago, m.nombre, m.color_hex`,
      [id_evento]
    );

    res.json({
      total_ingresos: Number(ventasTotalesRes.rows[0].total_ventas),
      transacciones: Number(transaccionesRes.rows[0].total_transacciones),
      productos_vendidos: Number(productosVendidosRes.rows[0].total_productos_vendidos),
      ventas_por_metodo: pagosRes.rows.map(r => ({ metodo: r.metodo, color_hex: r.color_hex, total: Number(r.total) }))
    });
  } catch (error) {
    res.status(500).json({ error: 'Error al cargar el dashboard' });
  }
};

export const getEstadisticasSuperAdmin = async (req: AuthRequest, res: Response) => {
  try {
    const id_evento = req.params.id;

    const ventasHora = await query(
      `SELECT EXTRACT(HOUR FROM v.fecha_hora) as hora, COUNT(*) as cantidad, COALESCE(SUM(v.total), 0) as total FROM ventas v JOIN cajas_sesiones cs ON v.id_sesion = cs.id_sesion WHERE cs.id_evento = $1 GROUP BY EXTRACT(HOUR FROM v.fecha_hora) ORDER BY hora ASC`,
      [id_evento]
    );

    const topProductos = await query(
      `SELECT p.nombre, SUM(dv.cantidad) as cantidad_vendida, SUM(dv.subtotal) as total_generado FROM detalles_venta dv JOIN productos p ON dv.id_producto = p.id_producto JOIN ventas v ON dv.id_venta = v.id_venta JOIN cajas_sesiones cs ON v.id_sesion = cs.id_sesion WHERE cs.id_evento = $1 GROUP BY p.id_producto, p.nombre ORDER BY cantidad_vendida DESC LIMIT 5`,
      [id_evento]
    );

    res.json({
      ventas_por_hora: ventasHora.rows.map(r => ({ hora: Number(r.hora), cantidad: Number(r.cantidad), total: Number(r.total) })),
      top_productos: topProductos.rows.map(r => ({ nombre: r.nombre, cantidad: Number(r.cantidad_vendida), total: Number(r.total_generado) }))
    });
  } catch (error) {
    res.status(500).json({ error: 'Error al obtener estadísticas' });
  }
};
