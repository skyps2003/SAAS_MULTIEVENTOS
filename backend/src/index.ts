import app from './app';
import pool from './config/database';

const port = process.env.PORT || 3001;

// Iniciar el servidor y probar la conexión a PostgreSQL
const startServer = async () => {
  try {
    // Prueba de conexión básica a la BD (PostgreSQL) usando pg
    const client = await pool.connect();
    console.log('✅ Conexión a la base de datos (PostgreSQL) establecida con éxito.');
    client.release();
  } catch (err) {
    console.error('❌ Error al conectar con PostgreSQL:', err);
    // Si no hay conexión a la BD, detener el proceso para evitar comportamientos inconsistentes
    process.exit(1);
  }

  app.listen(port, () => {
    console.log(`🚀 Server is running on port ${port}`);
    console.log(`📚 Swagger Docs disponibles en http://localhost:${port}/api-docs`);
  });
};

startServer();
