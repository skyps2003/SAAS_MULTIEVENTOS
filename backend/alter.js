const { Client } = require('pg');

async function test() {
  const client = new Client({ connectionString: 'postgresql://postgres:Luis12hadoop_@db.roagcobxobamewlcvnee.supabase.co:5432/postgres' });
  try {
    await client.connect();
    
    // Check if column exists
    const check = await client.query(`SELECT column_name FROM information_schema.columns WHERE table_name='metodos_pago_evento' AND column_name='color_hex'`);
    if (check.rowCount === 0) {
      await client.query(`ALTER TABLE metodos_pago_evento ADD COLUMN color_hex VARCHAR(255) DEFAULT 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 border-slate-200 dark:border-slate-700'`);
      console.log('Column added');
    } else {
      console.log('Column already exists');
    }
  } catch (e) {
    console.error('ERROR DB:', e.message);
  } finally {
    await client.end();
  }
}
test();
