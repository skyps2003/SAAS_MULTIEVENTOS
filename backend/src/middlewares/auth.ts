import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { query } from '../config/database';

const resolveSecret = (name: 'JWT_SECRET' | 'JWT_CAJA_SECRET', developmentFallback: string) => {
  const value = process.env[name];
  if (value) return value;
  if (process.env.NODE_ENV === 'production') throw new Error(`${name} es obligatorio en producción`);
  return developmentFallback;
};

const JWT_SECRET = resolveSecret('JWT_SECRET', 'clave_super_secreta_2026');
const JWT_CAJA_SECRET = resolveSecret('JWT_CAJA_SECRET', 'clave_caja_secreta_2026');

export interface AuthRequest extends Request {
  usuario?: { id_usuario: number; rol: string; id_evento?: number };
  sesion?: { id_sesion: number; id_evento: number; id_cajero_evento: number };
  id_evento?: number;
}

export const verificarToken = (req: AuthRequest, res: Response, next: NextFunction) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'No token provided' });
  }

  const token = authHeader.split(' ')[1];

  try {
    const decoded = jwt.verify(token, JWT_SECRET) as { id_usuario?: number; rol?: string; id_evento?: number };
    if (!decoded.id_usuario || !decoded.rol) return res.status(401).json({ error: 'Token sin identidad válida' });
    if (!['SUPER_ADMIN', 'ADMIN_EVENTO'].includes(decoded.rol)) return res.status(403).json({ error: 'Rol no autorizado' });
    req.usuario = { id_usuario: decoded.id_usuario, rol: decoded.rol, id_evento: decoded.id_evento };
    next();
  } catch (error) {
    return res.status(401).json({ error: 'Token inválido o vencido' });
  }
};

export const verificarTokenCaja = async (req: AuthRequest, res: Response, next: NextFunction) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'No token provided' });
  }

  const token = authHeader.split(' ')[1];

  try {
    const decoded = jwt.verify(token, JWT_CAJA_SECRET) as { id_sesion: number; id_evento: number; id_cajero_evento: number };
    
    // Verificar que la sesión siga ABIERTA
    const result = await query('SELECT estado FROM cajas_sesiones WHERE id_sesion = $1', [decoded.id_sesion]);
    if (result.rowCount === 0 || result.rows[0].estado !== 'ABIERTA') {
      return res.status(401).json({ error: 'Sesión cerrada o inválida' });
    }

    req.sesion = decoded;
    next();
  } catch (error) {
    return res.status(401).json({ error: 'Token de caja inválido o vencido' });
  }
};

export const verificarTokenFlexible = async (req: AuthRequest, res: Response, next: NextFunction) => {
  const authHeader = req.headers.authorization;
  // If no token, allow read-only access when codigo_evento is provided (POS public read)
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    if (req.query && req.query.codigo_evento) {
      const codigo = String(req.query.codigo_evento);
      try {
        const ev = await query('SELECT id_evento, estado FROM eventos WHERE codigo_caja = $1 LIMIT 1', [codigo]);
        if (ev.rowCount === 0 || ev.rows[0].estado !== 'ACTIVO') {
          return res.status(401).json({ error: 'Código de caja inválido o evento inactivo' });
        }
        req.id_evento = ev.rows[0].id_evento;
        return next();
      } catch (err: any) {
        console.error('Error validando el código de evento:', err.message);
        return res.status(500).json({ error: 'Server error' });
      }
    }

    return res.status(401).json({ error: 'No token provided' });
  }

  const token = authHeader.split(' ')[1];
  // Primero intentar con el JWT de usuarios (ADMIN/SUPER_ADMIN)
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as { id_usuario?: number; rol?: string; id_evento?: number };
    if (!decoded.id_usuario || !decoded.rol || !['SUPER_ADMIN', 'ADMIN_EVENTO'].includes(decoded.rol)) {
      throw new Error('Invalid user claims');
    }
    // Si el token incluye id_evento lo propagamos para tenantAdmin
    if (decoded.id_evento) req.id_evento = decoded.id_evento;
    req.usuario = { id_usuario: decoded.id_usuario, rol: decoded.rol, id_evento: decoded.id_evento };
    return next();
  } catch {
    // ignorar y probar con token de caja
  }

  // Intentar con token de caja
  try {
    const decodedCaja = jwt.verify(token, JWT_CAJA_SECRET) as { id_sesion?: number; id_evento?: number; id_cajero_evento?: number };
    if (!decodedCaja.id_sesion || !decodedCaja.id_evento || !decodedCaja.id_cajero_evento) {
      return res.status(401).json({ error: 'Token de caja sin datos válidos' });
    }
    // Verificar que la sesión esté ABIERTA
    const result = await query('SELECT estado FROM cajas_sesiones WHERE id_sesion = $1', [decodedCaja.id_sesion]);
    if (result.rowCount === 0 || result.rows[0].estado !== 'ABIERTA') {
      return res.status(401).json({ error: 'Sesión cerrada o inválida' });
    }
    // Propagar id_evento para que controllers usen el contexto de evento
    if (decodedCaja.id_evento) req.id_evento = decodedCaja.id_evento;
    req.sesion = {
      id_sesion: decodedCaja.id_sesion,
      id_evento: decodedCaja.id_evento,
      id_cajero_evento: decodedCaja.id_cajero_evento,
    };
    return next();
  } catch {
    return res.status(401).json({ error: 'Token inválido o vencido' });
  }
};
