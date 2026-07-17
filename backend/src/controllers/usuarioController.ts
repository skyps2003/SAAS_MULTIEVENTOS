import { Response } from 'express';
import bcrypt from 'bcrypt';
import { query } from '../config/database';
import { AuthRequest } from '../middlewares/auth';

export const listarAdministradores = async (req: AuthRequest, res: Response) => {
  try {
    const result = await query(
      `SELECT id_usuario, nombre, email, rol, fecha_creacion 
       FROM usuarios 
       WHERE rol = 'ADMIN_EVENTO' 
       ORDER BY id_usuario DESC`
    );
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: 'Error al listar administradores' });
  }
};

export const crearAdministrador = async (req: AuthRequest, res: Response) => {
  const { nombre, email, password } = req.body;
  if (typeof nombre !== 'string' || nombre.trim().length < 2) return res.status(400).json({ error: 'Nombre inválido' });
  if (typeof email !== 'string' || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return res.status(400).json({ error: 'Correo inválido' });
  if (typeof password !== 'string' || password.length < 8) return res.status(400).json({ error: 'La contraseña debe tener al menos 8 caracteres' });
  
  try {
    const emailCheck = await query('SELECT id_usuario FROM usuarios WHERE email = $1', [email]);
    if ((emailCheck.rowCount ?? 0) > 0) {
      return res.status(400).json({ error: 'El email ya está registrado' });
    }

    const hash = await bcrypt.hash(password, 10);
    const result = await query(
      `INSERT INTO usuarios (nombre, email, password_hash, rol) 
       VALUES ($1, $2, $3, 'ADMIN_EVENTO') RETURNING id_usuario, nombre, email, rol, fecha_creacion`,
      [nombre.trim(), email.trim().toLowerCase(), hash]
    );
    
    res.status(201).json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ error: 'Error al crear administrador' });
  }
};

export const actualizarAdministrador = async (req: AuthRequest, res: Response) => {
  const { id } = req.params;
  const { nombre, email, password } = req.body;
  if (typeof nombre !== 'string' || nombre.trim().length < 2) return res.status(400).json({ error: 'Nombre inválido' });
  if (typeof email !== 'string' || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return res.status(400).json({ error: 'Correo inválido' });
  if (password && (typeof password !== 'string' || password.length < 8)) return res.status(400).json({ error: 'La contraseña debe tener al menos 8 caracteres' });
  
  try {
    // Si envían un nuevo password, lo encriptamos
    let passwordQueryPart = '';
    let values = [nombre.trim(), email.trim().toLowerCase(), id];
    let queryIndex = 4;

    if (password) {
      const hash = await bcrypt.hash(password, 10);
      passwordQueryPart = `, password_hash = $${queryIndex}`;
      values.push(hash);
      queryIndex++;
    }

    const emailCheck = await query('SELECT id_usuario FROM usuarios WHERE email = $1 AND id_usuario != $2', [email, id]);
    if ((emailCheck.rowCount ?? 0) > 0) {
      return res.status(400).json({ error: 'El email ya está registrado por otro usuario' });
    }

    const result = await query(
      `UPDATE usuarios 
       SET nombre = $1, email = $2 ${passwordQueryPart}
       WHERE id_usuario = $3 RETURNING id_usuario, nombre, email, rol, fecha_creacion`,
      values
    );

    if (result.rowCount === 0) return res.status(404).json({ error: 'Administrador no encontrado' });
    res.json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ error: 'Error al actualizar administrador' });
  }
};

export const eliminarAdministrador = async (req: AuthRequest, res: Response) => {
  const { id } = req.params;
  
  try {
    // Verificar si el admin tiene eventos asociados
    const eventosAsociados = await query('SELECT id_evento FROM eventos WHERE id_admin = $1', [id]);
    
    if ((eventosAsociados.rowCount ?? 0) > 0) {
      return res.status(400).json({ error: 'No se puede eliminar el administrador porque tiene eventos asignados. Desactívalo o reasigna sus eventos.' });
    }

    const result = await query('DELETE FROM usuarios WHERE id_usuario = $1 AND rol = $2 RETURNING id_usuario', [id, 'ADMIN_EVENTO']);
    
    if (result.rowCount === 0) return res.status(404).json({ error: 'Administrador no encontrado' });
    res.json({ message: 'Administrador eliminado exitosamente' });
  } catch (error) {
    res.status(500).json({ error: 'Error al eliminar administrador' });
  }
};
