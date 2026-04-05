const pool = require('./db/index');
async function run() {
    const res = await pool.query(`
        SELECT 
            i.supplier_id, i.amount, s.actual_payment_amount,
            (i.amount - s.actual_payment_amount) as diff,
            (i.amount - s.actual_payment_amount) > 0 as is_diluted
        FROM invoices i
        JOIN settlements s ON s.invoice_id = i.id
        WHERE i.lender_id = 1 AND i.invoice_date >= NOW() - INTERVAL '90 days'
    `);
    console.log('Query Breakdown (Lender 1, 90d):');
    res.rows.forEach(r => console.log(r));
    
    const countRes = await pool.query(`
        SELECT COUNT(DISTINCT i.supplier_id) FILTER (WHERE (i.amount - s.actual_payment_amount) > 0) as diluted_suppliers
        FROM invoices i
        JOIN settlements s ON s.invoice_id = i.id
        WHERE i.lender_id = 1 AND i.invoice_date >= NOW() - INTERVAL '90 days'
    `);
    console.log('Final Count:', countRes.rows[0].diluted_suppliers);
    
    await pool.end();
}
run();
