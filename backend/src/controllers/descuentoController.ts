import { Response } from 'express';
import { query } from '../config/database';
import { AuthRequest } from '../middlewares/auth';

export const listarDescuentos = async (req: AuthRequest, res: Response) => {
  try {
    const result = await query(
      `SELECT d.*, p.nombre as producto_nombre 
       FROM descuentos_cantidad d 
       JOIN productos p ON d.id_producto = p.id_producto 
       WHERE d.id_evento = $1 ORDER BY d.id_descuento DESC`,
      [req.id_evento]
    );
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: 'Error al listar descuentos' });
  }
};

export const crearDescuento = async (req: AuthRequest, res: Response) => {
  const { id_producto, nombre, cantidad_minima, tipo_descuento, valor_descuento } = req.body;
  try {
    const result = await query(
      `INSERT INTO descuentos_cantidad (id_evento, id_producto, nombre, cantidad_minima, tipo_descuento, valor_descuento, activo) 
       VALUES ($1, $2, $3, $4, $5, $6, true) RETURNING *`,
      [req.id_evento, id_producto, nombre, cantidad_minima, tipo_descuento, valor_descuento]
    );
    res.status(201).json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ error: 'Error al crear descuento' });
  }
};

export const actualizarDescuento = async (req: AuthRequest, res: Response) => {
  const { id_producto, nombre, cantidad_minima, tipo_descuento, valor_descuento, activo } = req.body;
  const id_descuento = req.params.id;

  try {
    const result = await query(
      `UPDATE descuentos_cantidad 
       SET id_producto = COALESCE($1, id_producto),
           nombre = COALESCE($2, nombre),
           cantidad_minima = COALESCE($3, cantidad_minima),
           tipo_descuento = COALESCE($4, tipo_descuento),
           valor_descuento = COALESCE($5, valor_descuento),
           activo = COALESCE($6, activo)
       WHERE id_descuento = $7 AND id_evento = $8 RETURNING *`,
      [id_producto, nombre, cantidad_minima, tipo_descuento, valor_descuento, activo, id_descuento, req.id_evento]
    );
    if (result.rowCount === 0) return res.status(404).json({ error: 'Descuento no encontrado' });
    res.json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ error: 'Error al actualizar descuento' });
  }
};

export const eliminarDescuento = async (req: AuthRequest, res: Response) => {
  const id_descuento = req.params.id;
  try {
    const result = await query(
      `UPDATE descuentos_cantidad SET activo = false WHERE id_descuento = $1 AND id_evento = $2 RETURNING *`,
      [id_descuento, req.id_evento]
    );
    if (result.rowCount === 0) return res.status(404).json({ error: 'Descuento no encontrado' });
    res.json({ message: 'Descuento desactivado', descuento: result.rows[0] });
  } catch (error) {
    res.status(500).json({ error: 'Error al eliminar descuento' });
  }
};
