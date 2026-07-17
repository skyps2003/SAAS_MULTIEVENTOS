import { Router } from 'express';
import { getReporteVentas, getReporteArqueo, getReporteInventario } from '../controllers/reporteController';
import { verificarToken } from '../middlewares/auth';
import { tenantAdmin } from '../middlewares/tenant';
import { soloAdminEvento } from '../middlewares/roles';

const router = Router();

router.use(verificarToken, tenantAdmin, soloAdminEvento);

/**
 * @swagger
 * /api/v1/evento/reporte-ventas:
 *   get:
 *     summary: Reporte de todas las ventas
 *     tags: [Reportes]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: fecha_inicio
 *         schema:
 *           type: string
 *           format: date
 *       - in: query
 *         name: fecha_fin
 *         schema:
 *           type: string
 *           format: date
 */
router.get('/reporte-ventas', getReporteVentas);

/**
 * @swagger
 * /api/v1/evento/reporte-arqueo:
 *   get:
 *     summary: Reporte de cierres de caja (arqueos)
 *     tags: [Reportes]
 *     security:
 *       - bearerAuth: []
 */
router.get('/reporte-arqueo', getReporteArqueo);

/**
 * @swagger
 * /api/v1/evento/reporte-inventario:
 *   get:
 *     summary: Kardex de movimientos de inventario
 *     tags: [Reportes]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: id_producto
 *         schema:
 *           type: integer
 */
router.get('/reporte-inventario', getReporteInventario);

export default router;
