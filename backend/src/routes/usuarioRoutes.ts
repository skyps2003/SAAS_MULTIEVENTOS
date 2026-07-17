import { Router } from 'express';
import { 
  listarAdministradores, 
  crearAdministrador, 
  actualizarAdministrador, 
  eliminarAdministrador 
} from '../controllers/usuarioController';
import { verificarToken } from '../middlewares/auth';
import { soloSuperAdmin } from '../middlewares/roles';

const router = Router();

// Todas las rutas de usuarios (Administradores) requieren ser SUPER_ADMIN
router.use(verificarToken, soloSuperAdmin);

/**
 * @swagger
 * /api/v1/usuarios:
 *   get:
 *     summary: Obtener lista de administradores de eventos
 *     tags: [Usuarios]
 *     security:
 *       - bearerAuth: []
 */
router.get('/', listarAdministradores);

/**
 * @swagger
 * /api/v1/usuarios:
 *   post:
 *     summary: Crear un nuevo administrador de evento
 *     tags: [Usuarios]
 *     security:
 *       - bearerAuth: []
 */
router.post('/', crearAdministrador);

/**
 * @swagger
 * /api/v1/usuarios/{id}:
 *   put:
 *     summary: Actualizar un administrador existente
 *     tags: [Usuarios]
 *     security:
 *       - bearerAuth: []
 */
router.put('/:id', actualizarAdministrador);

/**
 * @swagger
 * /api/v1/usuarios/{id}:
 *   delete:
 *     summary: Eliminar un administrador
 *     tags: [Usuarios]
 *     security:
 *       - bearerAuth: []
 */
router.delete('/:id', eliminarAdministrador);

export default router;
