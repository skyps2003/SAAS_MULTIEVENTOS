import { Response, NextFunction } from 'express';
import { AuthRequest } from './auth';

export const soloSuperAdmin = (req: AuthRequest, res: Response, next: NextFunction) => {
  if (req.usuario?.rol !== 'SUPER_ADMIN') {
    return res.status(403).json({ error: 'Acceso denegado. Se requiere rol de SUPER_ADMIN' });
  }
  next();
};

export const soloAdminEvento = (req: AuthRequest, res: Response, next: NextFunction) => {
  if (req.usuario?.rol !== 'ADMIN_EVENTO') {
    return res.status(403).json({ error: 'Acceso denegado. Se requiere rol de ADMIN_EVENTO' });
  }
  next();
};

export const soloCajero = (req: AuthRequest, res: Response, next: NextFunction) => {
  if (req.usuario?.rol !== 'CAJERO') {
    return res.status(403).json({ error: 'Acceso denegado. Se requiere rol de CAJERO' });
  }
  next();
};
