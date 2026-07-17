import { Router } from 'express';
import { 
  validarCodigo, 
  abrirCaja, 
  estadoCaja, 
  cerrarCaja, 
  getProductosCaja, 
  getCategoriasCaja, 
  getCombosCaja, 
  getMetodosPago, 
  getResumenCierre 
} from '../controllers/cajaController';
import { verificarTokenCaja } from '../middlewares/auth';
import { tenantCaja } from '../middlewares/tenant';
import { crearCuentaPago, establecerCuentaPredeterminada } from '../controllers/metodoPagoController';

const router = Router();

// ---------------------------------------------------------
// RUTAS PÚBLICAS (Login de Cajero)
// ---------------------------------------------------------

/**
 * @swagger
 * /api/v1/caja/validar-codigo:
 *   post:
 *     summary: Validar código del evento para el POS
 *     tags: [Caja]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               codigo_evento:
 *                 type: string
 *     responses:
 *       200:
 *         description: Evento válido, retorna nombre, logo y paleta
 */
router.post('/validar-codigo', validarCodigo);

/**
 * @swagger
 * /api/v1/caja/abrir:
 *   post:
 *     summary: Abrir caja (Login Cajero Paso 2)
 *     tags: [Caja]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               codigo_evento:
 *                 type: string
 *               pin:
 *                 type: string
 *     responses:
 *       200:
 *         description: Sesión iniciada, retorna token
 */
router.post('/abrir', abrirCaja);

// ---------------------------------------------------------
// RUTAS PROTEGIDAS DE CAJA (Requieren Token de Cajero)
// ---------------------------------------------------------
router.use(verificarTokenCaja, tenantCaja);

/**
 * @swagger
 * /api/v1/caja/estado:
 *   get:
 *     summary: Obtener estado de la sesión actual
 *     tags: [Caja]
 *     security:
 *       - bearerAuth: []
 */
router.get('/estado', estadoCaja);

/**
 * @swagger
 * /api/v1/caja/cerrar:
 *   post:
 *     summary: Cerrar caja y registrar arqueo
 *     tags: [Caja]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               total_efectivo_declarado:
 *                 type: number
 *               nota_arqueo:
 *                 type: string
 */
router.post('/cerrar', cerrarCaja);

/**
 * @swagger
 * /api/v1/caja/productos:
 *   get:
 *     summary: Obtener productos activos para el POS
 *     tags: [Caja POS]
 *     security:
 *       - bearerAuth: []
 */
router.get('/productos', getProductosCaja);

/**
 * @swagger
 * /api/v1/caja/categorias:
 *   get:
 *     summary: Obtener categorías activas para el POS
 *     tags: [Caja POS]
 *     security:
 *       - bearerAuth: []
 */
router.get('/categorias', getCategoriasCaja);

/**
 * @swagger
 * /api/v1/caja/combos:
 *   get:
 *     summary: Obtener combos activos para el POS
 *     tags: [Caja POS]
 *     security:
 *       - bearerAuth: []
 */
router.get('/combos', getCombosCaja);

/**
 * @swagger
 * /api/v1/caja/metodos-pago:
 *   get:
 *     summary: Obtener métodos de pago activos para el POS
 *     tags: [Caja POS]
 *     security:
 *       - bearerAuth: []
 */
router.get('/metodos-pago', getMetodosPago);
router.post('/metodos-pago/:id/cuentas', crearCuentaPago);
router.put('/metodos-pago/:id/cuentas/:idCuenta/predeterminada', establecerCuentaPredeterminada);

/**
 * @swagger
 * /api/v1/caja/resumen-cierre:
 *   get:
 *     summary: Obtener resumen previo al cierre de caja
 *     tags: [Caja]
 *     security:
 *       - bearerAuth: []
 */
router.get('/resumen-cierre', getResumenCierre);

export default router;
