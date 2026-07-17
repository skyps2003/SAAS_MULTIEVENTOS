import { Router } from 'express';
import { procesarVenta, listarVentas, obtenerVenta } from '../controllers/ventaController';
import { verificarTokenFlexible } from '../middlewares/auth';

const router = Router();

router.use(verificarTokenFlexible);

/**
 * @swagger
 * /api/v1/ventas:
 *   get:
 *     summary: Listar últimas ventas de la sesión activa
 *     tags: [Ventas]
 *     security:
 *       - bearerAuth: []
 */
router.get('/', listarVentas);

/**
 * @swagger
 * /api/v1/ventas/{id}:
 *   get:
 *     summary: Ver detalle de una venta específica
 *     tags: [Ventas]
 *     security:
 *       - bearerAuth: []
 */
router.get('/:id', obtenerVenta);

/**
 * @swagger
 * /api/v1/ventas:
 *   post:
 *     summary: Procesar una nueva venta
 *     tags: [Ventas]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               id_metodo_pago:
 *                 type: integer
 *               id_cuenta_pago:
 *                 type: integer
 *               detalles:
 *                 type: array
 *                 items:
 *                   type: object
 *                   properties:
 *                     id_producto:
 *                       type: integer
 *                     cantidad:
 *                       type: integer
 *               combos:
 *                 type: array
 *                 items:
 *                   type: object
 *                   properties:
 *                     id_combo:
 *                       type: integer
 *                     cantidad:
 *                       type: integer
 */
router.post('/', procesarVenta);

export default router;
