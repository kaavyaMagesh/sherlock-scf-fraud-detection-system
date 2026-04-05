const pool = require('./db/index');
async function run() {
    const res = await pool.query("SELECT i.supplier_id, i.amount, s.actual_payment_amount FROM invoices i JOIN settlements s ON s.invoice_id = i.id WHERE i.lender_id = 1");
    console.log('Total Settled Rows:', res.rows.length);
    res.rows.forEach(r => console.log(`Supplier: ${r.supplier_id}, Amount: ${r.amount}, Paid: ${r.actual_payment_amount}`));
    await pool.end();
}
run();
