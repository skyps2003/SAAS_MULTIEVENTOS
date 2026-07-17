import { Response } from 'express';
import { query } from '../config/database';
import { AuthRequest } from '../middlewares/auth';

export const getReporteVentas = async (req: AuthRequest, res: Response) => {
  const { fecha_inicio, fecha_fin } = req.query;
  try {
    let q = `
      SELECT v.id_venta, v.fecha_hora, v.total, m.nombre as metodo_pago, c.nombre as cajero
      FROM ventas v
      JOIN cajas_sesiones cs ON v.id_sesion = cs.id_sesion
      JOIN metodos_pago_evento m ON v.id_metodo_pago = m.id_metodo_pago
      JOIN cajeros_evento c ON cs.id_cajero_evento = c.id_cajero_evento
      WHERE cs.id_evento = $1
    `;
    const params: any[] = [req.id_evento];
    let paramIndex = 2;

    if (fecha_inicio) {
      q += ` AND v.fecha_hora >= $${paramIndex}`;
      params.push(fecha_inicio);
      paramIndex++;
    }
    if (fecha_fin) {
      q += ` AND v.fecha_hora <= $${paramIndex}`;
      params.push(fecha_fin);
    }
    
    q += ' ORDER BY v.fecha_hora DESC';

    const result = await query(q, params);
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: 'Error al generar reporte de ventas' });
  }
};

export const getReporteArqueo = async (req: AuthRequest, res: Response) => {
  try {
    const result = await query(
      `SELECT cs.id_sesion, cs.hora_apertura, cs.hora_cierre, cs.monto_apertura, 
              cs.total_ventas, cs.total_efectivo_esperado, cs.total_efectivo_real, cs.diferencia,
              c.nombre as cajero
       FROM cajas_sesiones cs
       JOIN cajeros_evento c ON cs.id_cajero_evento = c.id_cajero_evento
       WHERE cs.id_evento = $1 AND cs.estado = 'CERRADA'
       ORDER BY cs.hora_cierre DESC`,
      [req.id_evento]
    );
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: 'Error al generar reporte de arqueos' });
  }
};

export const getReporteInventario = async (req: AuthRequest, res: Response) => {
  const { id_producto } = req.query;
  try {
    let q = `
      SELECT m.id_movimiento, p.nombre as producto, m.tipo_movimiento, m.cantidad, 
             m.stock_antes, m.stock_despues, m.motivo, m.referencia, m.fecha_hora
      FROM movimientos_inventario m
      JOIN productos p ON m.id_producto = p.id_producto
      WHERE p.id_evento = $1
    `;
    const params: any[] = [req.id_evento];

    if (id_producto) {
      q += ` AND m.id_producto = $2`;
      params.push(id_producto);
    }
    
    q += ' ORDER BY m.fecha_hora DESC';

    const result = await query(q, params);
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: 'Error al generar kardex de inventario' });
  }
};
