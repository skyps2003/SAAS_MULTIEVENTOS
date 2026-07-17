import { Router } from 'express';
import {
  listarMetodosPago,
  crearMetodoPago,
  actualizarMetodoPago,
  eliminarMetodoPago,
  crearCuentaPago,
  establecerCuentaPredeterminada,
  eliminarCuentaPago,
} from '../controllers/metodoPagoController';
import { verificarToken } from '../middlewares/auth';
import { tenantAdmin } from '../middlewares/tenant';
import { soloAdminEvento } from '../middlewares/roles';

const router = Router();

router.use(verificarToken, tenantAdmin, soloAdminEvento);

/**
 * @swagger
 * /api/v1/evento/metodos-pago:
 *   get:
 *     summary: Listar métodos de pago
 *     tags: [Métodos de Pago]
 *     security:
 *       - bearerAuth: []
 */
router.get('/', listarMetodosPago);

/**
 * @swagger
 * /api/v1/evento/metodos-pago:
 *   post:
 *     summary: Crear método de pago
 *     tags: [Métodos de Pago]
 *     security:
 *       - bearerAuth: []
 */
router.post('/', crearMetodoPago);
router.post('/:id/cuentas', crearCuentaPago);
router.put('/:id/cuentas/:idCuenta/predeterminada', establecerCuentaPredeterminada);
router.delete('/:id/cuentas/:idCuenta', eliminarCuentaPago);

/**
 * @swagger
 * /api/v1/evento/metodos-pago/{id}:
 *   put:
 *     summary: Actualizar método de pago
 *     tags: [Métodos de Pago]
 *     security:
 *       - bearerAuth: []
 */
router.put('/:id', actualizarMetodoPago);

/**
 * @swagger
 * /api/v1/evento/metodos-pago/{id}:
 *   delete:
 *     summary: Desactivar método de pago
 *     tags: [Métodos de Pago]
 *     security:
 *       - bearerAuth: []
 */
router.delete('/:id', eliminarMetodoPago);

export default router;
