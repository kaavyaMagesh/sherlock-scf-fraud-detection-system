const { Pool } = require('pg');
require('dotenv').config();
const pool = new Pool({
    connectionString: process.env.DATABASE_URL ||
        'postgresql://neondb_owner:npg_EG7XaOHL6FSZ@ep-snowy-violet-a15qdjeb-pooler.ap-southeast-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require',
});

(async () => {
    // Get first buyer company_id and first lender_id
    const bRes = await pool.query(
        `SELECT pu.company_id, c.name, pu.lender_id
         FROM portal_users pu JOIN companies c ON c.id = pu.company_id
         WHERE pu.role = 'BUYER' ORDER BY pu.company_id ASC LIMIT 1`
    );
    const buyer = bRes.rows[0];
    process.stdout.write('Buyer: company_id=' + buyer.company_id + ' name=' + buyer.name + ' lender_id=' + buyer.lender_id + '\n');

    const lRes = await pool.query(`SELECT id FROM lenders ORDER BY id ASC LIMIT 1`);
    const lenderId = lRes.rows[0].id;

    // Update TEST-% invoices — force lowercase 'pending' as well
    const r1 = await pool.query(
        `UPDATE invoices
         SET buyer_id = $1, lender_id = $2, status = 'PENDING'
         WHERE invoice_number LIKE 'TEST-%'
         RETURNING id, invoice_number, buyer_id, lender_id, status`,
        [buyer.company_id, lenderId]
    );
    process.stdout.write('TEST-% updated: ' + r1.rowCount + '\n');
    r1.rows.forEach(r => process.stdout.write('  -> id=' + r.id + ' num=' + r.invoice_number + ' buyer=' + r.buyer_id + ' lender=' + r.lender_id + '\n'));

    // Also update INV-% (seeded by seed_erp)
    const r2 = await pool.query(
        `UPDATE invoices
         SET buyer_id = $1, lender_id = $2
         WHERE invoice_number LIKE 'INV-%'
         RETURNING id, invoice_number, buyer_id, lender_id`,
        [buyer.company_id, lenderId]
    );
    process.stdout.write('INV-% updated: ' + r2.rowCount + '\n');
    r2.rows.forEach(r => process.stdout.write('  -> id=' + r.id + ' num=' + r.invoice_number + ' buyer=' + r.buyer_id + '\n'));

    // Confirm final state
    const check = await pool.query(
        `SELECT COUNT(*) AS total, 
                COUNT(*) FILTER (WHERE invoice_number LIKE 'TEST-%') AS test_count,
                COUNT(*) FILTER (WHERE invoice_number LIKE 'INV-%') AS inv_count
         FROM invoices WHERE buyer_id = $1 AND lender_id = $2`,
        [buyer.company_id, lenderId]
    );
    process.stdout.write('Invoices now visible to buyer: ' + JSON.stringify(check.rows[0]) + '\n');

    await pool.end();
    process.stdout.write('Done.\n');
})().catch(e => { process.stdout.write('ERR: ' + e.message + '\n'); process.exit(1); });
