import { Pool, PoolClient, types } from 'pg';
import dotenv from 'dotenv';

dotenv.config();

// PostgreSQL stores the application's timestamps in UTC using columns without
// timezone metadata. Parse OID 1114 as UTC so clients can convert them to Lima
// (or any requested timezone) without adding the local offset twice.
types.setTypeParser(1114, (value) => new Date(`${value.replace(' ', 'T')}Z`));

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 10, // RNF-08: Máximo 10 conexiones simultáneas
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

pool.on('error', (err, client) => {
  console.error('Unexpected error on idle client', err);
});

/**
 * Ejecuta una consulta SQL simple usando el pool de conexiones
 */
export const query = async (text: string, params?: any[]) => {
  const start = Date.now();
  const res = await pool.query(text, params);
  const duration = Date.now() - start;
  // console.log('Executed query', { text, duration, rows: res.rowCount });
  return res;
};

/**
 * Obtiene un cliente directamente del pool (útil para transacciones manuales extendidas)
 */
export const getClient = async (): Promise<PoolClient> => {
  const client = await pool.connect();
  return client;
};

/**
 * Helper para ejecutar múltiples consultas dentro de una transacción atómica.
 * Si el callback se ejecuta sin lanzar errores, hace COMMIT.
 * Si el callback lanza un error, hace ROLLBACK automáticamente.
 */
export const transaction = async <T>(callback: (client: PoolClient) => Promise<T>): Promise<T> => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await callback(client);
    await client.query('COMMIT');
    return result;
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
};

export default pool;
