const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
    connectionString: process.env.DATABASE_URL ||
        'postgresql://neondb_owner:npg_EG7XaOHL6FSZ@ep-snowy-violet-a15qdjeb-pooler.ap-southeast-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require',
});

(async () => {
    // settlements
    const s = await pool.query(
        `SELECT s.id, s.invoice_id, s.actual_payment_amount, s.payment_date, i.amount AS invoiced
         FROM settlements s JOIN invoices i ON i.id = s.invoice_id ORDER BY s.id`
    );
    console.log('\n=== SETTLEMENTS ===');
    s.rows.forEach(r => console.log(r));

    // disputes
    const d = await pool.query(
        `SELECT id, invoice_id, reason, deduction_amount, created_at FROM disputes ORDER BY id`
    );
    console.log('\n=== DISPUTES ===');
    d.rows.forEach(r => console.log(r));

    // dilution rates
    const dr = await pool.query(`
        SELECT i.supplier_id, c.name AS supplier_name,
               SUM(i.amount) AS expected_total,
               COALESCE(SUM(s.actual_payment_amount), 0) AS actual_total,
               ROUND(
                   (1 - COALESCE(SUM(s.actual_payment_amount), 0) / NULLIF(SUM(i.amount), 0)) * 100,
                   2
               ) AS dilution_pct
        FROM invoices i
        JOIN settlements s ON i.id = s.invoice_id
            AND s.payment_date >= NOW() - INTERVAL '90 days'
        JOIN companies c ON c.id = i.supplier_id
        GROUP BY i.supplier_id, c.name
        ORDER BY dilution_pct DESC
    `);
    console.log('\n=== DILUTION RATES (90-day window) ===');
    dr.rows.forEach(r => console.log(r));

    await pool.end();
})();
