import { Router } from 'express';
import { getResumenDashboard, getDashboardGlobal, getEstadisticas, getResumenDashboardSuperAdmin, getEstadisticasSuperAdmin } from '../controllers/dashboardController';
import { verificarToken } from '../middlewares/auth';
import { tenantAdmin } from '../middlewares/tenant';
import { soloAdminEvento, soloSuperAdmin } from '../middlewares/roles';

const router = Router();

router.use(verificarToken);

/**
 * @swagger
 * /api/v1/dashboard/resumen:
 *   get:
 *     summary: Obtener métricas y resumen del evento actual para el admin
 *     tags: [Dashboard y Reportes]
 *     security:
 *       - bearerAuth: []
 */
router.get('/resumen', soloAdminEvento, tenantAdmin, getResumenDashboard);

/**
 * @swagger
 * /api/v1/dashboard/estadisticas:
 *   get:
 *     summary: Estadísticas para gráficos (ventas por hora, top productos)
 *     tags: [Dashboard y Reportes]
 *     security:
 *       - bearerAuth: []
 */
router.get('/estadisticas', soloAdminEvento, tenantAdmin, getEstadisticas);

/**
 * @swagger
 * /api/v1/dashboard/global:
 *   get:
 *     summary: Obtener métricas globales del sistema (Solo Super Admin)
 *     tags: [Dashboard y Reportes]
 *     security:
 *       - bearerAuth: []
 */
router.get('/global', soloSuperAdmin, getDashboardGlobal);

// Nuevas rutas para Super Admin para ver detalles de eventos específicos
router.get('/superadmin/evento/:id/resumen', soloSuperAdmin, getResumenDashboardSuperAdmin);
router.get('/superadmin/evento/:id/estadisticas', soloSuperAdmin, getEstadisticasSuperAdmin);

export default router;
