const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

async function main() {
  try {
    await pool.query('ALTER TABLE categorias ALTER COLUMN imagen_url TYPE text;');
    await pool.query('ALTER TABLE productos ALTER COLUMN imagen_url TYPE text;');
    await pool.query('ALTER TABLE combos ALTER COLUMN imagen_url TYPE text;');
    await pool.query('ALTER TABLE eventos ALTER COLUMN logo_url TYPE text;');
    console.log('Columns altered successfully');
  } catch (err) {
    console.error('Error altering columns:', err);
  } finally {
    pool.end();
  }
}

main();
