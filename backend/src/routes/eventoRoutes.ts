import { Router } from 'express';
import { listarEventos, crearEvento, obtenerEvento, actualizarEvento, actualizarEstadoEvento, obtenerMiEvento, actualizarConfiguracion, finalizarEvento, eliminarEvento, subirLogoBase64, obtenerDashboardGlobal } from '../controllers/eventoController';
import { verificarToken } from '../middlewares/auth';
import { soloSuperAdmin, soloAdminEvento } from '../middlewares/roles';
import { tenantAdmin } from '../middlewares/tenant';

const router = Router();

router.get('/superadmin/dashboard', verificarToken, soloSuperAdmin, obtenerDashboardGlobal);

/**
 * @swagger
 * /api/v1/eventos:
 *   get:
 *     summary: Listar eventos
 *     tags: [Eventos]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Lista de eventos
 */
router.get('/eventos', verificarToken, listarEventos);

/**
 * @swagger
 * /api/v1/eventos:
 *   post:
 *     summary: Crear un nuevo evento (Solo SUPER_ADMIN)
 *     tags: [Eventos]
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
 *               email_admin:
 *                 type: string
 *               id_paleta:
 *                 type: integer
 *               fecha_evento:
 *                 type: string
 *                 format: date
 *     responses:
 *       201:
 *         description: Evento creado
 */
router.post('/eventos', verificarToken, soloSuperAdmin, crearEvento);

/**
 * @swagger
 * /api/v1/evento/mi-evento:
 *   get:
 *     summary: Obtener configuración del evento del Admin actual
 *     tags: [Configuración Evento]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Configuración del evento
 */
router.get('/evento/mi-evento', verificarToken, soloAdminEvento, tenantAdmin, obtenerMiEvento);

/**
 * @swagger
 * /api/v1/evento/configuracion:
 *   put:
 *     summary: Actualizar logo o paleta del evento
 *     tags: [Configuración Evento]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               logo_url:
 *                 type: string
 *               id_paleta:
 *                 type: integer
 *     responses:
 *       200:
 *         description: Evento actualizado
 */
router.put('/evento/configuracion', verificarToken, soloAdminEvento, tenantAdmin, actualizarConfiguracion);

/**
 * @swagger
 * /api/v1/evento/finalizar:
 *   post:
 *     summary: Finalizar evento actual
 *     tags: [Configuración Evento]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Evento finalizado
 *       400:
 *         description: Hay cajas abiertas
 */
router.post('/evento/finalizar', verificarToken, soloAdminEvento, tenantAdmin, finalizarEvento);

/**
 * @swagger
 * /api/v1/eventos/{id}:
 *   get:
 *     summary: Ver detalle completo de un evento específico
 *     tags: [Eventos (Super Admin)]
 *     security:
 *       - bearerAuth: []
 */
router.get('/eventos/:id', verificarToken, soloSuperAdmin, obtenerEvento);

/**
 * @swagger
 * /api/v1/eventos/{id}:
 *   put:
 *     summary: Editar nombre o fecha del evento
 *     tags: [Eventos (Super Admin)]
 *     security:
 *       - bearerAuth: []
 */
router.put('/eventos/:id', verificarToken, soloSuperAdmin, actualizarEvento);

/**
 * @swagger
 * /api/v1/eventos/{id}/estado:
 *   put:
 *     summary: Cambiar estado manualmente del evento
 *     tags: [Eventos (Super Admin)]
 *     security:
 *       - bearerAuth: []
 */
router.put('/eventos/:id/estado', verificarToken, soloSuperAdmin, actualizarEstadoEvento);

/**
 * @swagger
 * /api/v1/eventos/{id}:
 *   delete:
 *     summary: Eliminar un evento completo con todos sus datos asociados
 *     tags: [Eventos (Super Admin)]
 *     security:
 *       - bearerAuth: []
 */
router.delete('/eventos/:id', verificarToken, soloSuperAdmin, eliminarEvento);

/**
 * @swagger
 * /api/v1/evento/configuracion/logo:
 *   post:
 *     summary: Subir logo del evento en base64
 *     tags: [Configuración Evento]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               logo_base64:
 *                 type: string
 */
router.post('/evento/configuracion/logo', verificarToken, soloAdminEvento, tenantAdmin, subirLogoBase64);

export default router;
