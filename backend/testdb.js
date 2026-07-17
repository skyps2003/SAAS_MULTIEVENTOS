const { query } = require('./src/config/database');
async function test() {
  try {
    const r1 = await query(`SELECT COUNT(*) as total FROM productos WHERE id_evento = 2 AND activo = true`);
    console.log('Productos:', r1.rows);
    const r2 = await query(`SELECT COUNT(*) as total FROM combos WHERE id_evento = 2 AND activo = true`);
    console.log('Combos:', r2.rows);
    const r3 = await query(`SELECT COUNT(*) as total FROM cajeros_evento WHERE id_evento = 2 AND estado = true`);
    console.log('Cajeros:', r3.rows);
    const r4 = await query(`SELECT COUNT(id_venta) as ordenes, COALESCE(SUM(total), 0) as ingresos 
       FROM ventas 
       WHERE id_sesion IN (SELECT id_sesion FROM cajas_sesiones WHERE id_evento = 2)`);
    console.log('Ventas:', r4.rows);
  } catch (e) {
    console.error('ERROR DB:', e.message);
  }
  process.exit();
}
test();
