const pool = require('./db/index');
async function run() {
    const res = await pool.query("SELECT * FROM settlements WHERE invoice_id IN (SELECT id FROM invoices WHERE invoice_number LIKE 'GTC-%' OR invoice_number LIKE 'SPL-%')");
    console.log('Settlements Found:', res.rows.length);
    res.rows.forEach(r => console.log(r));
    await pool.end();
}
run();
