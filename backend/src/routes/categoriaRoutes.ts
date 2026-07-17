import { Router } from 'express';
import { listarCategorias, crearCategoria, actualizarCategoria, desactivarCategoria } from '../controllers/categoriaController';
import { verificarToken } from '../middlewares/auth';
import { tenantAdmin } from '../middlewares/tenant';
import { soloAdminEvento } from '../middlewares/roles';

const router = Router();

// Todas las rutas requieren token y tenantAdmin por defecto
router.use(verificarToken, tenantAdmin);

/**
 * @swagger
 * /api/v1/categorias:
 *   get:
 *     summary: Listar todas las categorías activas del evento
 *     tags: [Categorías]
 *     security:
 *       - bearerAuth: []
 */
router.get('/', listarCategorias);

/**
 * @swagger
 * /api/v1/categorias:
 *   post:
 *     summary: Crear una categoría
 *     tags: [Categorías]
 *     security:
 *       - bearerAuth: []
 */
router.post('/', soloAdminEvento, crearCategoria);

/**
 * @swagger
 * /api/v1/categorias/{id}:
 *   put:
 *     summary: Actualizar una categoría
 *     tags: [Categorías]
 *     security:
 *       - bearerAuth: []
 */
router.put('/:id', soloAdminEvento, actualizarCategoria);

/**
 * @swagger
 * /api/v1/categorias/{id}:
 *   delete:
 *     summary: Desactivar una categoría
 *     tags: [Categorías]
 *     security:
 *       - bearerAuth: []
 */
router.delete('/:id', soloAdminEvento, desactivarCategoria);

export default router;
