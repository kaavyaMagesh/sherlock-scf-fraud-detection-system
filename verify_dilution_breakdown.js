const pool = require('./db/index');
async function run() {
    const res = await pool.query(`
        SELECT i.supplier_id, c.name, SUM(i.amount) as tot, SUM(s.actual_payment_amount) as paid
        FROM invoices i
        JOIN settlements s ON s.invoice_id = i.id
        JOIN companies c ON i.supplier_id = c.id
        WHERE i.lender_id = 1
        GROUP BY i.supplier_id, c.name
        HAVING SUM(i.amount - s.actual_payment_amount) > 0
    `);
    console.log('Diluted Suppliers:', res.rows);
    await pool.end();
}
run();
