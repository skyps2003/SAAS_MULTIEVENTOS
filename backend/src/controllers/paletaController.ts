import { Request, Response } from 'express';
import { query } from '../config/database';
import { generarPaletaCompleta } from '../utils/generarColores';

export const crearPaleta = async (req: Request, res: Response) => {
  const { nombre, color_primario_base, color_secundario_base, color_acento_base } = req.body;
  const colores = [color_primario_base, color_secundario_base, color_acento_base];
  if (typeof nombre !== 'string' || nombre.trim().length < 2) return res.status(400).json({ error: 'Nombre de paleta inválido' });
  if (!colores.every((color) => typeof color === 'string' && /^#[0-9a-f]{6}$/i.test(color))) return res.status(400).json({ error: 'Los colores deben usar el formato hexadecimal #RRGGBB' });

  try {
    const paleta = generarPaletaCompleta(color_primario_base, color_secundario_base, color_acento_base);

    const keys = ['nombre', ...Object.keys(paleta)];
    const values = [nombre.trim(), ...Object.values(paleta)];
    
    const placeholders = keys.map((_, i) => `$${i + 1}`).join(', ');

    const result = await query(
      `INSERT INTO paletas (${keys.join(', ')}) VALUES (${placeholders}) RETURNING *`,
      values
    );

    res.status(201).json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ error: 'Error al crear la paleta' });
  }
};

export const listarPaletas = async (req: Request, res: Response) => {
  try {
    const result = await query('SELECT * FROM paletas ORDER BY id_paleta DESC');
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: 'Error al obtener paletas' });
  }
};

export const obtenerPaleta = async (req: Request, res: Response) => {
  try {
    const result = await query('SELECT * FROM paletas WHERE id_paleta = $1', [req.params.id]);
    if (result.rowCount === 0) return res.status(404).json({ error: 'Paleta no encontrada' });
    res.json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ error: 'Error al obtener la paleta' });
  }
};

export const eliminarPaleta = async (req: Request, res: Response) => {
  const id_paleta = req.params.id;
  try {
    const eventosUsando = await query("SELECT id_evento FROM eventos WHERE id_paleta = $1 AND estado = 'ACTIVO'", [id_paleta]);
    if ((eventosUsando.rowCount ?? 0) > 0) {
      return res.status(400).json({ error: 'No se puede eliminar la paleta porque está asignada a un evento activo' });
    }
    
    const result = await query('DELETE FROM paletas WHERE id_paleta = $1 RETURNING *', [id_paleta]);
    if (result.rowCount === 0) return res.status(404).json({ error: 'Paleta no encontrada' });
    
    res.json({ message: 'Paleta eliminada', paleta: result.rows[0] });
  } catch (error) {
    res.status(500).json({ error: 'Error al eliminar paleta' });
  }
};

export const actualizarPaleta = async (req: Request, res: Response) => {
  const id_paleta = req.params.id;
  const { nombre, color_primario_base, color_secundario_base, color_acento_base } = req.body;
  const colores = [color_primario_base, color_secundario_base, color_acento_base];
  if (typeof nombre !== 'string' || nombre.trim().length < 2) return res.status(400).json({ error: 'Nombre de paleta inválido' });
  if (!colores.every((color) => typeof color === 'string' && /^#[0-9a-f]{6}$/i.test(color))) return res.status(400).json({ error: 'Los colores deben usar el formato hexadecimal #RRGGBB' });

  try {
    const paleta = generarPaletaCompleta(color_primario_base, color_secundario_base, color_acento_base);

    const keys = ['nombre', ...Object.keys(paleta)];
    const values = [nombre.trim(), ...Object.values(paleta)];
    
    // UPDATE paletas SET k1 = $1, k2 = $2 WHERE id_paleta = $N
    const setClause = keys.map((key, i) => `${key} = $${i + 1}`).join(', ');
    
    const result = await query(
      `UPDATE paletas SET ${setClause} WHERE id_paleta = $${keys.length + 1} RETURNING *`,
      [...values, id_paleta]
    );

    if (result.rowCount === 0) return res.status(404).json({ error: 'Paleta no encontrada' });

    res.json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ error: 'Error al actualizar la paleta' });
  }
};
