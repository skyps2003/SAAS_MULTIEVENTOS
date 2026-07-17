import { Router } from 'express';
import { listarDescuentos, crearDescuento, actualizarDescuento, eliminarDescuento } from '../controllers/descuentoController';
import { verificarToken } from '../middlewares/auth';
import { tenantAdmin } from '../middlewares/tenant';
import { soloAdminEvento } from '../middlewares/roles';

const router = Router();

router.use(verificarToken, tenantAdmin, soloAdminEvento);

/**
 * @swagger
 * /api/v1/evento/descuentos:
 *   get:
 *     summary: Listar descuentos por cantidad
 *     tags: [Descuentos]
 *     security:
 *       - bearerAuth: []
 */
router.get('/', listarDescuentos);

/**
 * @swagger
 * /api/v1/evento/descuentos:
 *   post:
 *     summary: Crear descuento por cantidad
 *     tags: [Descuentos]
 *     security:
 *       - bearerAuth: []
 */
router.post('/', crearDescuento);

/**
 * @swagger
 * /api/v1/evento/descuentos/{id}:
 *   put:
 *     summary: Actualizar descuento
 *     tags: [Descuentos]
 *     security:
 *       - bearerAuth: []
 */
router.put('/:id', actualizarDescuento);

/**
 * @swagger
 * /api/v1/evento/descuentos/{id}:
 *   delete:
 *     summary: Desactivar descuento
 *     tags: [Descuentos]
 *     security:
 *       - bearerAuth: []
 */
router.delete('/:id', eliminarDescuento);

export default router;
