/**
 * tmp/fix_buyer_ids.js
 *
 * Ensures the 3 seeded settlement invoices are visible to a logged-in Buyer:
 *  1. Finds the first lender and first buyer company from the DB
 *  2. Updates the 3 settled invoices to have buyer_id = first buyer AND lender_id = first lender
 *  3. Prints a confirmation table
 *
 * Safe to re-run (idempotent).
 */
const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
    connectionString: process.env.DATABASE_URL ||
        'postgresql://neondb_owner:npg_EG7XaOHL6FSZ@ep-snowy-violet-a15qdjeb-pooler.ap-southeast-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require',
});

(async () => {
    // 1. Find first lender
    const lRes = await pool.query(`SELECT id, name FROM lenders ORDER BY id ASC LIMIT 1`);
    if (!lRes.rows.length) throw new Error('No lenders found. Run seed_erp.js first.');
    const lender = lRes.rows[0];
    process.stdout.write(`First lender: id=${lender.id} name=${lender.name}\n`);

    // 2. Find first BUYER company (has a portal_user with role=BUYER)
    const bRes = await pool.query(`
        SELECT pu.company_id, c.name
        FROM portal_users pu
        JOIN companies c ON c.id = pu.company_id
        WHERE pu.role = 'BUYER'
        ORDER BY pu.company_id ASC
        LIMIT 1
    `);
    if (!bRes.rows.length) throw new Error('No BUYER portal users found.');
    const buyer = bRes.rows[0];
    process.stdout.write(`First buyer: company_id=${buyer.company_id} name=${buyer.name}\n`);

    // 3. Find all invoice IDs that have a settlement row (those are our test invoices)
    const sRes = await pool.query(`SELECT DISTINCT invoice_id FROM settlements`);
    const settledIds = sRes.rows.map(r => r.invoice_id);
    process.stdout.write(`Settled invoice IDs: ${settledIds.join(', ')}\n`);

    if (settledIds.length === 0) {
        process.stdout.write('No settlements found — run seed_settlements.js first.\n');
        process.exit(0);
    }

    // 4. Update buyer_id AND lender_id on these specific invoices
    const updateRes = await pool.query(
        `UPDATE invoices
         SET buyer_id = $1, lender_id = $2
         WHERE id = ANY($3::int[])
         RETURNING id, buyer_id, lender_id`,
        [buyer.company_id, lender.id, settledIds]
    );

    process.stdout.write(`Updated ${updateRes.rowCount} invoices:\n`);
    updateRes.rows.forEach(r =>
        process.stdout.write(`  invoice_id=${r.id} => buyer_id=${r.buyer_id} lender_id=${r.lender_id}\n`)
    );

    // 5. Also ensure the buyer's company has the right lender_id
    await pool.query(
        `UPDATE companies SET lender_id = $1 WHERE id = $2`,
        [lender.id, buyer.company_id]
    );
    process.stdout.write(`Buyer company (id=${buyer.company_id}) normalised to lender_id=${lender.id}\n`);

    // 6. Verification: confirm what getBuyerInvoices would return
    process.stdout.write('\n--- VERIFICATION: getBuyerInvoices simulation ---\n');
    const verify = await pool.query(`
        SELECT i.id, i.invoice_number, i.amount AS original_amount,
               s.actual_payment_amount AS paid_amount,
               CASE
                 WHEN s.actual_payment_amount IS NULL THEN 'UNPAID'
                 WHEN s.actual_payment_amount >= i.amount THEN 'PAID_FULL'
                 WHEN s.actual_payment_amount = 0 THEN 'ZERO_PAYMENT'
                 ELSE 'PARTIAL'
               END AS payment_status,
               sup.name AS supplier_name
        FROM invoices i
        JOIN companies sup ON sup.id = i.supplier_id
        LEFT JOIN settlements s ON s.invoice_id = i.id
        WHERE i.buyer_id = $1 AND i.lender_id = $2
        ORDER BY i.id
    `, [buyer.company_id, lender.id]);

    if (verify.rows.length === 0) {
        process.stdout.write('WARNING: getBuyerInvoices returned 0 rows — check buyer_id / lender_id alignment.\n');
    } else {
        verify.rows.forEach(r =>
            process.stdout.write(
                `  inv_id=${r.id} supplier=${r.supplier_name} ` +
                `original=${r.original_amount} paid=${r.paid_amount} status=${r.payment_status}\n`
            )
        );
    }

    process.stdout.write('\nDone.\n');
    await pool.end();
})().catch(e => { process.stdout.write('ERROR: ' + e.message + '\n'); process.exit(1); });
