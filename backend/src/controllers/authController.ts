import { Request, Response } from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { query } from '../config/database';
import { generarPaletaCompleta } from '../utils/generarColores';

const JWT_SECRET = process.env.JWT_SECRET || 'clave_super_secreta_2026';
const JWT_CAJA_SECRET = process.env.JWT_CAJA_SECRET || 'clave_caja_secreta_2026';

export const login = async (req: Request, res: Response) => {
  const { email, password } = req.body;

  try {
    const result = await query('SELECT * FROM usuarios WHERE email = $1', [email]);
    if (result.rowCount === 0) return res.status(401).json({ error: 'Credenciales inválidas' });

    const usuario = result.rows[0];
    const isMatch = await bcrypt.compare(password, usuario.password_hash);
    
    if (!isMatch) return res.status(401).json({ error: 'Credenciales inválidas' });

    let evento_activo = null;
    let eventoObj = null;
    let paletaObj = null;

    if (usuario.rol === 'ADMIN_EVENTO') {
      // eventos references the admin as id_admin, not id_usuario
      const eventoRes = await query("SELECT id_evento FROM eventos WHERE id_admin = $1 AND estado = 'ACTIVO'", [usuario.id_usuario]);
      if ((eventoRes.rowCount ?? 0) > 0) {
        evento_activo = eventoRes.rows[0].id_evento;

}
    }

    // If there is an active event, fetch its palette details and generate full palette
    if (evento_activo) {
      const ev = await query(
        `SELECT e.id_evento, e.nombre as evento_nombre, p.color_primario_base, p.color_secundario_base, p.color_acento_base
         FROM eventos e
         JOIN paletas p ON e.id_paleta = p.id_paleta
         WHERE e.id_evento = $1`,
        [evento_activo]
      );
      if ((ev.rowCount ?? 0) > 0) {
        eventoObj = ev.rows[0];
        try {
          paletaObj = generarPaletaCompleta(eventoObj.color_primario_base, eventoObj.color_secundario_base, eventoObj.color_acento_base);
        } catch (palErr) {
          console.error('Error generando paleta:', palErr);
        }
      }
    }

    const token = jwt.sign(
      { id_usuario: usuario.id_usuario, rol: usuario.rol, id_evento: evento_activo },
      JWT_SECRET,
      { expiresIn: '24h' }
    );

    const usuarioResponse = { id_usuario: usuario.id_usuario, nombre: usuario.nombre, email: usuario.email, rol: usuario.rol, id_evento: evento_activo };

    res.json({ token, usuario: usuarioResponse, evento: eventoObj, paleta: paletaObj });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error en el servidor' });
  }
};

export const registro = async (req: Request, res: Response) => {
  const { nombre, email, password, rol } = req.body;
  if (!nombre || !email || !password || !rol) return res.status(400).json({ error: 'Faltan campos' });
  
  if (password.length < 6) return res.status(400).json({ error: 'La contraseña debe tener al menos 6 caracteres' });

  try {
    const password_hash = await bcrypt.hash(password, 10);
    const result = await query(
      'INSERT INTO usuarios (nombre, email, password_hash, rol) VALUES ($1, $2, $3, $4) RETURNING id_usuario, nombre, email, rol',
      [nombre, email, password_hash, rol]
    );
    res.status(201).json(result.rows[0]);
  } catch (error: any) {
    console.error(error);
    if (error.code === '23505') {
      return res.status(400).json({ error: 'El email ya está registrado' });
    }
    res.status(500).json({ error: 'Error al registrar usuario' });
  }
};

export const loginCajero = async (req: Request, res: Response) => {
  const { codigo_evento, pin } = req.body;

  if (!codigo_evento || !pin) {
    return res.status(400).json({ error: 'Código de evento y PIN son requeridos' });
  }

  try {
    // 1. Validar evento
    const eventoRes = await query(
      `SELECT e.id_evento, e.nombre, e.logo_url, p.*
       FROM eventos e
       LEFT JOIN paletas p ON e.id_paleta = p.id_paleta
       WHERE e.codigo_caja = $1 AND e.estado = 'ACTIVO'`,
      [codigo_evento]
    );

    if (eventoRes.rowCount === 0) {
      return res.status(404).json({ error: 'Evento no encontrado o inactivo' });
    }
    
    const evento = eventoRes.rows[0];

    // 2. Validar cajero
    const cajeroRes = await query(
      `SELECT id_cajero_evento, nombre, estado 
       FROM cajeros_evento 
       WHERE id_evento = $1 AND pin = $2`,
      [evento.id_evento, pin]
    );

    if (cajeroRes.rowCount === 0) {
      return res.status(401).json({ error: 'PIN incorrecto' });
    }

    const cajero = cajeroRes.rows[0];
    // Normalize estado: DB may store boolean (true/false) or string ('ACTIVO'/'INACTIVO').
    const cajeroActivo = cajero.estado === true || cajero.estado === 'ACTIVO' || String(cajero.estado).toLowerCase() === 't' || String(cajero.estado).toLowerCase() === 'true';
    if (!cajeroActivo) {
      return res.status(403).json({ error: 'Cajero inactivo' });
    }

    // 3. Verificar sesión abierta
    const sesionRes = await query(
      `SELECT id_sesion, hora_apertura 
       FROM cajas_sesiones 
       WHERE id_cajero_evento = $1 AND id_evento = $2 AND estado = 'ABIERTA'`,
      [cajero.id_cajero_evento, evento.id_evento]
    );

    let id_sesion;
    let hora_apertura;

    if ((sesionRes.rowCount ?? 0) > 0) {
      id_sesion = sesionRes.rows[0].id_sesion;
      hora_apertura = sesionRes.rows[0].hora_apertura;
    } else {
      // Crear nueva sesión
      const insertSesion = await query(
        `INSERT INTO cajas_sesiones (id_evento, id_cajero_evento) 
         VALUES ($1, $2) RETURNING id_sesion, hora_apertura`,
        [evento.id_evento, cajero.id_cajero_evento]
      );
      id_sesion = insertSesion.rows[0].id_sesion;
      hora_apertura = insertSesion.rows[0].hora_apertura;
    }

    // 4. Generar token
    const token = jwt.sign(
      {
        id_cajero_evento: cajero.id_cajero_evento,
        id_evento: evento.id_evento,
        id_sesion
      },
      process.env.JWT_CAJA_SECRET || 'secret_caja',
      { expiresIn: '12h' }
    );

    res.json({
      token,
      evento: {
        id_evento: evento.id_evento,
        nombre: evento.nombre,
        logo_url: evento.logo_url,
        paleta: evento
      },
      sesion: {
        id_sesion,
        cajero: cajero.nombre,
        hora_apertura
      }
    });

  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al iniciar sesión en caja' });
  }
};

// loginCajero movido a cajaController para el login en 2 pasos
