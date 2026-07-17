import { Router } from 'express';
import { crearPaleta, listarPaletas, obtenerPaleta, eliminarPaleta, actualizarPaleta } from '../controllers/paletaController';
import { verificarToken } from '../middlewares/auth';
import { soloSuperAdmin } from '../middlewares/roles';

const router = Router();

// El catálogo de paletas forma parte del panel privado de Super Admin.
router.use(verificarToken, soloSuperAdmin);

/**
 * @swagger
 * /api/v1/paletas:
 *   get:
 *     summary: Obtener todas las paletas
 *     tags: [Paletas]
 *     responses:
 *       200:
 *         description: Lista de paletas
 */
router.get('/', listarPaletas);

/**
 * @swagger
 * /api/v1/paletas/{id}:
 *   get:
 *     summary: Obtener el detalle de una paleta por ID
 *     tags: [Paletas]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Detalle de la paleta
 *       404:
 *         description: Paleta no encontrada
 */
router.get('/:id', obtenerPaleta);

/**
 * @swagger
 * /api/v1/paletas:
 *   post:
 *     summary: Crear una nueva paleta (Solo SUPER_ADMIN)
 *     tags: [Paletas]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               nombre:
 *                 type: string
 *               color_primario_base:
 *                 type: string
 *               color_secundario_base:
 *                 type: string
 *               color_acento_base:
 *                 type: string
 *     responses:
 *       201:
 *         description: Paleta creada exitosamente
 *       403:
 *         description: Acceso denegado
 */
router.post('/', crearPaleta);

/**
 * @swagger
 * /api/v1/paletas/{id}:
 *   delete:
 *     summary: Eliminar una paleta
 *     tags: [Paletas]
 *     security:
 *       - bearerAuth: []
 */
router.delete('/:id', eliminarPaleta);

/**
 * @swagger
 * /api/v1/paletas/{id}:
 *   put:
 *     summary: Actualizar una paleta existente
 *     tags: [Paletas]
 *     security:
 *       - bearerAuth: []
 */
router.put('/:id', actualizarPaleta);

export default router;
