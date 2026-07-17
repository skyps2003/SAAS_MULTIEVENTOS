import { Response } from 'express';
import { query } from '../config/database';
import { AuthRequest } from '../middlewares/auth';

export const listarCajeros = async (req: AuthRequest, res: Response) => {
  try {
    const result = await query(
      'SELECT id_cajero_evento, id_evento, nombre, pin, estado, fecha_creacion FROM cajeros_evento WHERE id_evento = $1 ORDER BY id_cajero_evento DESC',
      [req.id_evento]
    );
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: 'Error al listar cajeros' });
  }
};

export const crearCajero = async (req: AuthRequest, res: Response) => {
  const { nombre, pin } = req.body;
  
  if (!pin || pin.length < 4) {
    return res.status(400).json({ error: 'El PIN debe tener al menos 4 caracteres' });
  }

  try {
    const result = await query(
      'INSERT INTO cajeros_evento (id_evento, nombre, pin) VALUES ($1, $2, $3) RETURNING id_cajero_evento, id_evento, nombre, pin, estado, fecha_creacion',
      [req.id_evento, nombre, pin]
    );
    res.status(201).json(result.rows[0]);
  } catch (error: any) {
    if (error.code === '23505') { // Unique violation
      return res.status(400).json({ error: 'Ya existe un cajero con este PIN en este evento' });
    }
    res.status(500).json({ error: 'Error al crear cajero' });
  }
};

export const actualizarCajero = async (req: AuthRequest, res: Response) => {
  const { nombre, pin, estado } = req.body;
  const id_cajero = req.params.id;

  try {
    const result = await query(
      `UPDATE cajeros_evento 
       SET nombre = COALESCE($1, nombre),
           pin = COALESCE($2, pin),
           estado = COALESCE($3, estado)
       WHERE id_cajero_evento = $4 AND id_evento = $5 
       RETURNING id_cajero_evento, id_evento, nombre, pin, estado, fecha_creacion`,
      [nombre, pin, estado, id_cajero, req.id_evento]
    );
    
    if (result.rowCount === 0) return res.status(404).json({ error: 'Cajero no encontrado' });
    res.json(result.rows[0]);
  } catch (error: any) {
    if (error.code === '23505') { 
      return res.status(400).json({ error: 'Ya existe un cajero con este PIN en este evento' });
    }
    res.status(500).json({ error: 'Error al actualizar cajero' });
  }
};

export const resetPin = async (req: AuthRequest, res: Response) => {
  const { nuevo_pin } = req.body;
  const id_cajero = req.params.id;

  if (!nuevo_pin || nuevo_pin.length < 4) {
    return res.status(400).json({ error: 'El PIN debe tener al menos 4 caracteres' });
  }

  try {
    const result = await query(
      `UPDATE cajeros_evento SET pin = $1 WHERE id_cajero_evento = $2 AND id_evento = $3 RETURNING id_cajero_evento, nombre`,
      [nuevo_pin, id_cajero, req.id_evento]
    );
    if (result.rowCount === 0) return res.status(404).json({ error: 'Cajero no encontrado' });
    res.json({ message: 'PIN actualizado exitosamente', cajero: result.rows[0] });
  } catch (error: any) {
    if (error.code === '23505') { 
      return res.status(400).json({ error: 'Ya existe un cajero con este PIN en este evento' });
    }
    res.status(500).json({ error: 'Error al resetear PIN' });
  }
};
