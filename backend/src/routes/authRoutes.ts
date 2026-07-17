import { Router } from 'express';
import { login, registro, loginCajero } from '../controllers/authController';

const router = Router();

/**
 * @swagger
 * /api/v1/auth/login:
 *   post:
 *     summary: Iniciar sesión como Administrador (Super Admin o Admin Evento)
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               email:
 *                 type: string
 *               password:
 *                 type: string
 *     responses:
 *       200:
 *         description: Login exitoso
 *       401:
 *         description: Credenciales inválidas
 */
router.post('/login', login);

/**
 * @swagger
 * /api/v1/auth/registro:
 *   post:
 *     summary: Registrar un nuevo usuario (Super Admin / Admin Evento)
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               nombre:
 *                 type: string
 *               email:
 *                 type: string
 *               password:
 *                 type: string
 *               rol:
 *                 type: string
 *     responses:
 *       201:
 *         description: Usuario registrado exitosamente
 */
router.post('/registro', registro);

/**
 * @swagger
 * /api/v1/auth/login-cajero:
 *   post:
 *     summary: Iniciar sesión como cajero (Unificado en 1 solo paso)
 *     tags: [Auth]
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
 *         description: Sesión de caja iniciada con éxito
 */
router.post('/login-cajero', loginCajero);

export default router;
