import { Router } from 'express';
import { listarCombos, crearCombo, obtenerCombo, actualizarCombo, toggleEstadoCombo, eliminarCombo } from '../controllers/comboController';
import { verificarToken } from '../middlewares/auth';
import { tenantAdmin } from '../middlewares/tenant';
import { soloAdminEvento } from '../middlewares/roles';

const router = Router();

router.use(verificarToken, tenantAdmin);

/**
 * @swagger
 * /api/v1/combos:
 *   get:
 *     summary: Listar combos del evento
 *     tags: [Combos]
 *     security:
 *       - bearerAuth: []
 */
router.get('/', listarCombos);

/**
 * @swagger
 * /api/v1/combos:
 *   post:
 *     summary: Crear un combo
 *     tags: [Combos]
 *     security:
 *       - bearerAuth: []
 */
router.post('/', soloAdminEvento, crearCombo);

/**
 * @swagger
 * /api/v1/combos/{id}:
 *   get:
 *     summary: Obtener detalle de un combo
 *     tags: [Combos]
 *     security:
 *       - bearerAuth: []
 */
router.get('/:id', obtenerCombo);

/**
 * @swagger
 * /api/v1/combos/{id}:
 *   put:
 *     summary: Actualizar combo
 *     tags: [Combos]
 *     security:
 *       - bearerAuth: []
 */
router.put('/:id', soloAdminEvento, actualizarCombo);

/**
 * @swagger
 * /api/v1/combos/{id}/estado:
 *   patch:
 *     summary: Activar o Desactivar combo
 *     tags: [Combos]
 *     security:
 *       - bearerAuth: []
 */
router.patch('/:id/estado', soloAdminEvento, toggleEstadoCombo);

/**
 * @swagger
 * /api/v1/combos/{id}:
 *   delete:
 *     summary: Eliminar un combo sin ventas registradas
 *     tags: [Combos]
 *     security:
 *       - bearerAuth: []
 */
router.delete('/:id', soloAdminEvento, eliminarCombo);

export default router;
