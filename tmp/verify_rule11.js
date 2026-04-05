/**
 * tmp/verify_rule11.js
 * Re-evaluates the three seeded invoices against the fixed risk engine
 * and prints whether dilution_rate_high fired.
 */
const { Pool } = require('pg');
require('dotenv').config();
const riskEngineService = require('../services/riskEngineService');

const pool = new Pool({
    connectionString: process.env.DATABASE_URL ||
        'postgresql://neondb_owner:npg_EG7XaOHL6FSZ@ep-snowy-violet-a15qdjeb-pooler.ap-southeast-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require',
});

(async () => {
    // Get the three invoices that have settlements
    const invRes = await pool.query(`
        SELECT DISTINCT i.id, i.amount, i.supplier_id, i.buyer_id, i.lender_id,
               i.invoice_date, i.expected_payment_date, c.name AS supplier_name
        FROM invoices i
        JOIN settlements s ON s.invoice_id = i.id
        JOIN companies c ON c.id = i.supplier_id
        ORDER BY i.id ASC
    `);

    if (invRes.rows.length === 0) {
        console.log('No settled invoices found. Run seed_settlements.js first.');
        process.exit(0);
    }

    console.log(`\nRe-evaluating ${invRes.rows.length} settled invoices against fixed Rule 11...\n`);

    for (const inv of invRes.rows) {
        const result = await riskEngineService.evaluateRisk(
            inv.lender_id, inv.id, inv.supplier_id, inv.buyer_id,
            inv.amount, inv.invoice_date, inv.expected_payment_date,
            0, []
        );
        const dilutionFired = result.breakdown.some(b => b.factor === 'dilution_rate_high');
        const dilutionDetail = result.breakdown.find(b => b.factor === 'dilution_rate_high')?.detail || 'not fired';
        console.log(`Invoice #${inv.id} | Supplier: ${inv.supplier_name}`);
        console.log(`  Risk Score : ${result.riskScore} | Status: ${result.status}`);
        console.log(`  dilution_rate_high: ${dilutionFired ? '🚨 FIRED' : '✅ clean'} — ${dilutionDetail}`);
        console.log('');
    }

    await pool.end();
})().catch(e => { console.error(e); process.exit(1); });
