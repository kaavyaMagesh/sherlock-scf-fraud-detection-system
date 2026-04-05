/**
 * tmp/fix_lender_ids.js
 * Ensures all data (companies, POs, GRNs, invoices, settlements, disputes)
 * is owned by lender_id = 1 (the first seeded lender, Global Alpha Bank / HDFC).
 * Safe to re-run — uses UPDATE...WHERE, not destructive.
 */
const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
    connectionString: process.env.DATABASE_URL ||
        'postgresql://neondb_owner:npg_EG7XaOHL6FSZ@ep-snowy-violet-a15qdjeb-pooler.ap-southeast-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require',
});

(async () => {
    // Resolve the actual first lender's id (don't assume it's 1 — SERIAL can differ after reseeds)
    const lenderRes = await pool.query(`SELECT id FROM lenders ORDER BY id ASC LIMIT 1`);
    if (lenderRes.rows.length === 0) throw new Error('No lenders found — run seed_erp.js first');
    const lenderId = lenderRes.rows[0].id;
    console.log(`\nUsing lender_id = ${lenderId} (first seeded lender)`);

    const tables = ['companies', 'purchase_orders', 'goods_receipts', 'delivery_confirmations', 'invoices', 'invoice_fingerprints', 'alerts'];
    let total = 0;
    for (const t of tables) {
        const r = await pool.query(`UPDATE ${t} SET lender_id = $1 WHERE lender_id IS NULL OR lender_id != $1`, [lenderId]);
        if (r.rowCount > 0) console.log(`  Updated ${r.rowCount} rows in ${t}`);
        total += r.rowCount;
    }

    // portal_users has lender_id too
    const pu = await pool.query(`UPDATE portal_users SET lender_id = $1 WHERE lender_id IS NULL OR lender_id != $1`, [lenderId]);
    if (pu.rowCount > 0) console.log(`  Updated ${pu.rowCount} rows in portal_users`);
    total += pu.rowCount;

    console.log(`\n✅ Ownership fix done. ${total} rows normalised to lender_id = ${lenderId}.\n`);

    // Verification
    const check = await pool.query(`
        SELECT 'invoices' AS tbl, COUNT(*) AS total, COUNT(*) FILTER (WHERE lender_id = $1) AS owned
        FROM invoices
        UNION ALL
        SELECT 'companies', COUNT(*), COUNT(*) FILTER (WHERE lender_id = $1) FROM companies
        UNION ALL
        SELECT 'settlements (no lender_id)', COUNT(*), COUNT(*) FROM settlements
    `, [lenderId]);
    console.log('Verification:');
    check.rows.forEach(r => console.log(`  ${r.tbl}: total=${r.total}, owned_by_lender=${r.owned}`));

    await pool.end();
})().catch(e => { console.error(e); process.exit(1); });
