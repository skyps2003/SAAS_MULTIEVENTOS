import express, { Application, Request, Response } from 'express';
import cors from 'cors';
import swaggerUi from 'swagger-ui-express';
import swaggerJsDoc from 'swagger-jsdoc';
import path from 'path';

import authRoutes from './routes/authRoutes';
import usuarioRoutes from './routes/usuarioRoutes';
import paletaRoutes from './routes/paletaRoutes';
import eventoRoutes from './routes/eventoRoutes';
import categoriaRoutes from './routes/categoriaRoutes';
import productoRoutes from './routes/productoRoutes';
import comboRoutes from './routes/comboRoutes';
import cajeroRoutes from './routes/cajeroRoutes';
import cajaRoutes from './routes/cajaRoutes';
import ventaRoutes from './routes/ventaRoutes';
import dashboardRoutes from './routes/dashboardRoutes';
import metodoPagoRoutes from './routes/metodoPagoRoutes';
import descuentoRoutes from './routes/descuentoRoutes';
import reporteRoutes from './routes/reporteRoutes';

const app: Application = express();

app.use(cors());
// Aumentar el límite de tamaño de payload para permitir imágenes en base64 en desarrollo
app.use(express.json({ limit: '20mb' }));
app.use(express.urlencoded({ limit: '20mb', extended: true }));

// Servir archivos subidos (uploads) en desarrollo
const uploadsPath = path.join(__dirname, '..', 'uploads');
app.use('/uploads', express.static(uploadsPath));

// Configuración de Swagger
const swaggerOptions = {
  swaggerDefinition: {
    openapi: '3.0.0',
    info: {
      title: 'POS Multi-Evento API',
      version: '1.0.0',
      description: 'API Documentada para el Sistema POS Multi-Evento',
    },
    servers: [
      {
        url: 'http://localhost:3001',
        description: 'Servidor de Desarrollo',
      },
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
        },
      },
    },
    security: [{ bearerAuth: [] }],
  },
  apis: ['./src/routes/*.ts'], // Buscará anotaciones de swagger en las rutas
};

const swaggerDocs = swaggerJsDoc(swaggerOptions);
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerDocs));

// Montaje de rutas
app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/usuarios', usuarioRoutes);
app.use('/api/v1/paletas', paletaRoutes);
app.use('/api/v1', eventoRoutes); // Ya contiene /eventos y /evento/...
app.use('/api/v1/categorias', categoriaRoutes);
app.use('/api/v1/productos', productoRoutes);
app.use('/api/v1/combos', comboRoutes);
app.use('/api/v1/cajeros', cajeroRoutes);
app.use('/api/v1/caja', cajaRoutes);
app.use('/api/v1/ventas', ventaRoutes);
app.use('/api/v1/dashboard', dashboardRoutes);
app.use('/api/v1/evento/metodos-pago', metodoPagoRoutes);
app.use('/api/v1/evento/descuentos', descuentoRoutes);
app.use('/api/v1/evento', reporteRoutes);

// Ruta de salud de la API
/**
 * @swagger
 * /health:
 *   get:
 *     summary: Verifica que la API esté funcionando
 *     responses:
 *       200:
 *         description: OK
 */
app.get('/health', (req: Request, res: Response) => {
  res.json({ status: 'API is running', version: '1.0.0' });
});

export default app;
