import { Response, NextFunction } from 'express';
import { AuthRequest } from './auth';
import { query } from '../config/database';

export const tenantAdmin = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.usuario?.id_usuario;
    if (!userId) return res.status(401).json({ error: 'No autorizado' });

    // Buscar el evento asignado a este admin
    const result = await query('SELECT id_evento FROM eventos WHERE id_admin = $1 AND estado = $2', [userId, 'ACTIVO']);
    
    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'No tienes ningún evento activo asignado' });
    }

    req.id_evento = result.rows[0].id_evento;
    next();
  } catch (error) {
    res.status(500).json({ error: 'Error verificando evento del admin' });
  }
};

export const tenantCaja = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const eventoId = req.sesion?.id_evento;
    if (!eventoId) return res.status(401).json({ error: 'Sesión de caja inválida' });

    // Verificar que el evento siga ACTIVO
    const result = await query('SELECT estado FROM eventos WHERE id_evento = $1', [eventoId]);
    
    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'Evento no encontrado' });
    }

    if (result.rows[0].estado === 'FINALIZADO') {
      return res.status(400).json({ error: 'El evento ya ha finalizado' });
    }

    req.id_evento = eventoId;
    next();
  } catch (error) {
    res.status(500).json({ error: 'Error verificando estado del evento' });
  }
};
