/**
 * db/seed_settlements.js
 *
 * Seeds the `settlements` and `disputes` tables for the dilution detection
 * feature (Risk Engine Rule 11).
 *
 * Requires: init_schema.js and seed_erp.js to have already been run so that
 * invoices exist in the database.
 *
 * Run with: node db/seed_settlements.js
 */

const { Pool } = require('pg');
const dotenv = require('dotenv');
dotenv.config();

const pool = new Pool({
    connectionString: process.env.DATABASE_URL ||
        'postgresql://neondb_owner:npg_EG7XaOHL6FSZ@ep-snowy-violet-a15qdjeb-pooler.ap-southeast-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require',
});

const seedSettlements = async () => {
    try {
        // ── 1. Fetch the first 3 invoices that have an amount ─────────────────
        const invResult = await pool.query(
            `SELECT id, amount, supplier_id, buyer_id
             FROM invoices
             WHERE amount IS NOT NULL AND amount > 0
             ORDER BY id ASC
             LIMIT 3`
        );

        if (invResult.rows.length < 3) {
            throw new Error(
                `Need at least 3 invoices in the database. Found ${invResult.rows.length}. ` +
                `Run seed_erp.js first.`
            );
        }

        const [invoiceA, invoiceB, invoiceC] = invResult.rows;

        console.log('\n──────────────────────────────────────────────');
        console.log('Seeding settlements for:');
        console.log(`  Invoice A → id=${invoiceA.id}, amount=${invoiceA.amount}`);
        console.log(`  Invoice B → id=${invoiceB.id}, amount=${invoiceB.amount}`);
        console.log(`  Invoice C → id=${invoiceC.id}, amount=${invoiceC.amount}`);
        console.log('──────────────────────────────────────────────\n');

        // Clear any existing test rows first (idempotent re-run)
        await pool.query(
            'DELETE FROM disputes   WHERE invoice_id = ANY($1)',
            [[invoiceA.id, invoiceB.id, invoiceC.id]]
        );
        await pool.query(
            'DELETE FROM settlements WHERE invoice_id = ANY($1)',
            [[invoiceA.id, invoiceB.id, invoiceC.id]]
        );

        // ── 2a. Invoice A — Full payment (no dilution) ────────────────────────
        //   actual_payment_amount = invoiced amount   →  dilution rate = 0%
        await pool.query(
            `INSERT INTO settlements (invoice_id, actual_payment_amount, payment_date)
             VALUES ($1, $2, NOW() - INTERVAL '10 days')`,
            [invoiceA.id, invoiceA.amount]
        );
        console.log(`✅ Invoice A (id=${invoiceA.id}): FULL payment — ₹${invoiceA.amount}`);

        // ── 2b. Invoice B — Partial payment (70%) — should trigger Rule 11 ───
        //   dilution rate for this supplier becomes 30% across the window
        const invoiceBPaid = Number((Number(invoiceB.amount) * 0.70).toFixed(2));
        const invoiceBDeduction = Number((Number(invoiceB.amount) * 0.30).toFixed(2));

        await pool.query(
            `INSERT INTO settlements (invoice_id, actual_payment_amount, payment_date)
             VALUES ($1, $2, NOW() - INTERVAL '5 days')`,
            [invoiceB.id, invoiceBPaid]
        );

        // Record the buyer's formal dispute for this deduction
        await pool.query(
            `INSERT INTO disputes (invoice_id, reason, notes, deduction_amount, created_at)
             VALUES ($1, $2, $3, $4, NOW() - INTERVAL '6 days')`,
            [
                invoiceB.id,
                'GOODS_RETURNED',
                '30% of delivered goods (batch #GRN-2B) failed quality inspection — deduction logged per supplier agreement clause 4.2.',
                invoiceBDeduction,
            ]
        );
        console.log(
            `⚠️  Invoice B (id=${invoiceB.id}): PARTIAL payment — paid ₹${invoiceBPaid} / ` +
            `invoiced ₹${invoiceB.amount} (30% deduction, dispute raised)`
        );

        // ── 2c. Invoice C — Zero payment — tests the actTotal edge case ───────
        //   This is the scenario Bug B1 silently skips (actTotal > 0 guard).
        //   actual_payment_amount = 0  → 100% dilution rate
        await pool.query(
            `INSERT INTO settlements (invoice_id, actual_payment_amount, payment_date)
             VALUES ($1, $2, NOW() - INTERVAL '2 days')`,
            [invoiceC.id, 0]
        );

        // Record the buyer's formal dispute — total non-payment
        await pool.query(
            `INSERT INTO disputes (invoice_id, reason, notes, deduction_amount, created_at)
             VALUES ($1, $2, $3, $4, NOW() - INTERVAL '3 days')`,
            [
                invoiceC.id,
                'QUALITY_ISSUE',
                'Entire shipment rejected — goods did not meet contractual specifications. No payment will be released pending independent lab verification.',
                invoiceC.amount,  // full amount is the deduction
            ]
        );
        console.log(
            `🔴 Invoice C (id=${invoiceC.id}): ZERO payment — paid ₹0 / ` +
            `invoiced ₹${invoiceC.amount} (100% dilution, full dispute raised)`
        );

        // ── 3. Verification query ─────────────────────────────────────────────
        console.log('\n──────────────────────────────────────────────');
        console.log('Verification: rolling 90-day dilution per supplier\n');

        const verifyResult = await pool.query(
            `SELECT
                i.supplier_id,
                c.name                                              AS supplier_name,
                SUM(i.amount)                                       AS expected_total,
                COALESCE(SUM(s.actual_payment_amount), 0)          AS actual_total,
                ROUND(
                    (1 - COALESCE(SUM(s.actual_payment_amount), 0) / NULLIF(SUM(i.amount), 0)) * 100,
                    2
                )                                                   AS dilution_rate_pct
             FROM invoices i
             JOIN settlements s
                 ON i.id = s.invoice_id
                 AND s.payment_date >= NOW() - INTERVAL '90 days'
             JOIN companies c ON c.id = i.supplier_id
             GROUP BY i.supplier_id, c.name
             ORDER BY dilution_rate_pct DESC`
        );

        if (verifyResult.rows.length === 0) {
            console.log('  No settlement data found — check invoice IDs match.');
        } else {
            verifyResult.rows.forEach(row => {
                const rate = Number(row.dilution_rate_pct);
                const flag = rate > 5 ? '🚨 RULE 11 FIRES' : '✅ Clean';
                console.log(
                    `  Supplier: ${row.supplier_name.padEnd(20)} | ` +
                    `Expected: ₹${Number(row.expected_total).toLocaleString('en-IN').padStart(12)} | ` +
                    `Actual: ₹${Number(row.actual_total).toLocaleString('en-IN').padStart(12)} | ` +
                    `Dilution: ${rate}% ${flag}`
                );
            });
        }

        console.log('\n──────────────────────────────────────────────');
        console.log('✅ Settlements + Disputes seeded successfully.\n');

    } catch (err) {
        console.error('\n❌ Seed failed:', err.message);
        process.exit(1);
    } finally {
        await pool.end();
    }
};

seedSettlements();
