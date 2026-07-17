import { Response } from 'express';
import { query } from '../config/database';
import { AuthRequest } from '../middlewares/auth';

export const listarCategorias = async (req: AuthRequest, res: Response) => {
  try {
    const result = await query(
      `SELECT c.*, 
        (SELECT COUNT(*) FROM productos p WHERE p.id_categoria = c.id_categoria AND p.estado = true) as total_productos 
       FROM categorias c 
       WHERE c.id_evento = $1 AND c.estado = true 
       ORDER BY c.orden ASC`,
      [req.id_evento]
    );
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: 'Error al listar categorías' });
  }
};

export const crearCategoria = async (req: AuthRequest, res: Response) => {
  const { nombre, imagen_url, orden } = req.body;
  try {
    const result = await query(
      'INSERT INTO categorias (id_evento, nombre, imagen_url, orden) VALUES ($1, $2, $3, $4) RETURNING *',
      [req.id_evento, nombre, imagen_url, orden || 0]
    );
    res.status(201).json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ error: 'Error al crear categoría' });
  }
};

export const actualizarCategoria = async (req: AuthRequest, res: Response) => {
  const { nombre, orden } = req.body;
  const id_categoria = req.params.id;
  try {
    const result = await query(
      'UPDATE categorias SET nombre = COALESCE($1, nombre), orden = COALESCE($2, orden) WHERE id_categoria = $3 AND id_evento = $4 RETURNING *',
      [nombre, orden, id_categoria, req.id_evento]
    );
    if (result.rowCount === 0) return res.status(404).json({ error: 'Categoría no encontrada' });
    res.json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ error: 'Error al actualizar categoría' });
  }
};

export const desactivarCategoria = async (req: AuthRequest, res: Response) => {
  const id_categoria = req.params.id;
  try {
    const result = await query(
      'UPDATE categorias SET estado = false WHERE id_categoria = $1 AND id_evento = $2 RETURNING *',
      [id_categoria, req.id_evento]
    );
    if (result.rowCount === 0) return res.status(404).json({ error: 'Categoría no encontrada' });
    res.json({ message: 'Categoría desactivada', categoria: result.rows[0] });
  } catch (error) {
    res.status(500).json({ error: 'Error al desactivar categoría' });
  }
};
