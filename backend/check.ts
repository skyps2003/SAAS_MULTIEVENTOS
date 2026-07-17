import { query } from './src/config/database';

async function checkAllSchemas() {
  const tables = ['usuarios', 'eventos', 'paletas'];
  for (const table of tables) {
    try {
      const res = await query(`
        SELECT column_name, data_type 
        FROM information_schema.columns 
        WHERE table_name = $1
        ORDER BY ordinal_position;
      `, [table]);
      console.log(`\n=== TABLA: ${table} ===`);
      console.log(res.rows.map((r: any) => `  ${r.column_name} (${r.data_type})`).join('\n'));
    } catch (err: any) {
      console.error(`Error en ${table}:`, err.message);
    }
  }
  process.exit(0);
}

checkAllSchemas();
