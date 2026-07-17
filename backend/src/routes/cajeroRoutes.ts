import { Router } from 'express';
import { listarCajeros, crearCajero, actualizarCajero, resetPin } from '../controllers/cajeroController';
import { verificarToken } from '../middlewares/auth';
import { tenantAdmin } from '../middlewares/tenant';
import { soloAdminEvento } from '../middlewares/roles';

const router = Router();

router.use(verificarToken, tenantAdmin, soloAdminEvento);

/**
 * @swagger
 * /api/v1/cajeros:
 *   get:
 *     summary: Listar cajeros del evento
 *     tags: [Cajeros]
 *     security:
 *       - bearerAuth: []
 */
router.get('/', listarCajeros);

/**
 * @swagger
 * /api/v1/cajeros:
 *   post:
 *     summary: Crear un cajero para el evento
 *     tags: [Cajeros]
 *     security:
 *       - bearerAuth: []
 */
router.post('/', crearCajero);

/**
 * @swagger
 * /api/v1/cajeros/{id}:
 *   put:
 *     summary: Actualizar información de un cajero
 *     tags: [Cajeros]
 *     security:
 *       - bearerAuth: []
 */
router.put('/:id', actualizarCajero);

/**
 * @swagger
 * /api/v1/cajeros/{id}/reset-pin:
 *   post:
 *     summary: Resetear el PIN de un cajero
 *     tags: [Cajeros]
 *     security:
 *       - bearerAuth: []
 */
router.post('/:id/reset-pin', resetPin);

export default router;
