const { query } = require('./src/config/database');
async function test() {
  try {
    await query(`ALTER TABLE metodos_pago_evento ADD COLUMN color VARCHAR(20) DEFAULT '#E2E8F0'`);
    console.log('Column added');
  } catch (e) {
    console.error('ERROR DB:', e.message);
  }
  process.exit();
}
test();
