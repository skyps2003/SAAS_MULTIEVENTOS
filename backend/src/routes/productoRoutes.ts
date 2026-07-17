import { Router } from 'express';
import { listarProductos, crearProducto, actualizarProducto, ajustarStock, getAlertasStock, getKardex, eliminarProducto } from '../controllers/productoController';
import { verificarTokenFlexible } from '../middlewares/auth';
import { tenantAdmin } from '../middlewares/tenant';
import { soloAdminEvento } from '../middlewares/roles';

const router = Router();

// Permitir acceso tanto con token de admin como con token de caja (cajero)
// Nota: tenantAdmin exige usuario admin; para listar productos permitimos al cajero y al codigo_evento mediante verificarTokenFlexible
router.use(verificarTokenFlexible);

/**
 * @swagger
 * /api/v1/productos:
 *   get:
 *     summary: Listar productos del evento
 *     tags: [Productos]
 *     security:
 *       - bearerAuth: []
 */
router.get('/', listarProductos);

/**
 * @swagger
 * /api/v1/productos:
 *   post:
 *     summary: Crear un producto
 *     tags: [Productos]
 *     security:
 *       - bearerAuth: []
 */
router.post('/', soloAdminEvento, crearProducto);

/**
 * @swagger
 * /api/v1/productos/{id}:
 *   put:
 *     summary: Actualizar un producto
 *     tags: [Productos]
 *     security:
 *       - bearerAuth: []
 */
router.put('/:id', soloAdminEvento, actualizarProducto);

/**
 * @swagger
 * /api/v1/productos/{id}:
 *   delete:
 *     summary: Eliminar (desactivar) un producto
 *     tags: [Productos]
 *     security:
 *       - bearerAuth: []
 */
router.delete('/:id', soloAdminEvento, eliminarProducto);

/**
 * @swagger
 * /api/v1/productos/{id}/stock:
 *   patch:
 *     summary: Ajustar stock de un producto (manual)
 *     tags: [Productos]
 *     security:
 *       - bearerAuth: []
 */
router.patch('/:id/stock', soloAdminEvento, ajustarStock);

/**
 * @swagger
 * /api/v1/productos/alertas:
 *   get:
 *     summary: Obtener productos con stock bajo
 *     tags: [Productos]
 *     security:
 *       - bearerAuth: []
 */
router.get('/alertas', getAlertasStock);

/**
 * @swagger
 * /api/v1/productos/{id}/kardex:
 *   get:
 *     summary: Ver historial de movimientos de un producto
 *     tags: [Productos]
 *     security:
 *       - bearerAuth: []
 */
router.get('/:id/kardex', getKardex);

export default router;
