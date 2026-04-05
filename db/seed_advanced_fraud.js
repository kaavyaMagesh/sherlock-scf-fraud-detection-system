const pool = require('./index');
const { evaluateRisk } = require('../services/riskEngineService');
const { updateEdgeMetadata } = require('../services/graphEngineService');

async function seedAdvancedFraud() {
    const lender_id = 1;
    const buyer_id = 3;

    try {
        console.log('--- Cleaning previous advanced fraud seeds ---');
        // Delete in correct dependency order
        const supplierSubquery = "SELECT id FROM companies WHERE name IN ('Global Trade Corp', 'Silent Parts Ltd')";
        
        // Step 6 Fix: Added explanations cleanup
        await pool.query(`DELETE FROM explanations WHERE invoice_id IN (SELECT id FROM invoices WHERE supplier_id IN (${supplierSubquery}))`);
        
        await pool.query(`DELETE FROM alerts WHERE invoice_id IN (SELECT id FROM invoices WHERE supplier_id IN (${supplierSubquery}))`);
        await pool.query(`DELETE FROM risk_score_audits WHERE invoice_id IN (SELECT id FROM invoices WHERE supplier_id IN (${supplierSubquery}))`);
        await pool.query(`DELETE FROM settlements WHERE invoice_id IN (SELECT id FROM invoices WHERE supplier_id IN (${supplierSubquery}))`);
        await pool.query(`DELETE FROM disputes WHERE invoice_id IN (SELECT id FROM invoices WHERE supplier_id IN (${supplierSubquery}))`);
        await pool.query(`DELETE FROM invoices WHERE supplier_id IN (${supplierSubquery})`);
        await pool.query(`DELETE FROM trade_relationships WHERE supplier_id IN (${supplierSubquery}) OR buyer_id IN (${supplierSubquery})`);
        await pool.query(`DELETE FROM companies WHERE id IN (${supplierSubquery})`);

        console.log('--- Seeding Global Trade Corp ---');
        const supplierGtc = await pool.query(
            "INSERT INTO companies (lender_id, name, annual_revenue, monthly_avg_invoicing) VALUES ($1, $2, $3, $4) RETURNING id",
            [lender_id, 'Global Trade Corp', 10000000, 800000]
        );
        const gtcId = supplierGtc.rows[0].id;

        const gtcInvoices = [];
        for (let i = 1; i <= 4; i++) {
            const amount = 100000;
            const res = await pool.query(
                "INSERT INTO invoices (lender_id, supplier_id, buyer_id, invoice_number, amount, invoice_date, status, goods_category) VALUES ($1, $2, $3, $4, $5, NOW() - INTERVAL '5 days', 'APPROVED', 'Electronics') RETURNING id",
                [lender_id, gtcId, buyer_id, `GTC-INV-00${i}`, amount]
            );
            gtcInvoices.push(res.rows[0].id);
            await updateEdgeMetadata(lender_id, gtcId, buyer_id, amount, 'Electronics');
        }

        // Carousel cycle completion (Buyer -> Supplier relationship)
        await pool.query(
            "INSERT INTO trade_relationships (lender_id, supplier_id, buyer_id, total_volume, invoice_count, goods_category, last_seen) VALUES ($1, $2, $3, $4, $5, $6, NOW()) ON CONFLICT DO NOTHING",
            [lender_id, buyer_id, gtcId, 100000, 1, 'Electronics']
        );

        for (const invId of gtcInvoices) {
            await pool.query(
                "INSERT INTO settlements (invoice_id, actual_payment_amount, payment_date) VALUES ($1, $2, NOW() - INTERVAL '2 days')",
                [invId, 60000]
            );
        }

        for (let i = 1; i <= 4; i++) {
            const res = await pool.query(
                "INSERT INTO invoices (lender_id, supplier_id, buyer_id, invoice_number, amount, invoice_date, status, goods_category) VALUES ($1, $2, $3, $4, $5, NOW() - INTERVAL '1 day', 'PENDING', 'Electronics') RETURNING id",
                [lender_id, gtcId, buyer_id, `GTC-REPLACE-00${i}`, 40000]
            );
            await updateEdgeMetadata(lender_id, gtcId, buyer_id, 40000, 'Electronics');
        }

        console.log('--- Seeding Silent Parts Ltd ---');
        const supplierSpl = await pool.query(
            "INSERT INTO companies (lender_id, name, annual_revenue, monthly_avg_invoicing, last_invoice_date) VALUES ($1, $2, $3, $4, NOW() - INTERVAL '185 days') RETURNING id",
            [lender_id, 'Silent Parts Ltd', 5000000, 400000]
        );
        const splId = supplierSpl.rows[0].id;

        const splInvoices = [];
        for (let i = 1; i <= 5; i++) {
            const res = await pool.query(
                "INSERT INTO invoices (lender_id, supplier_id, buyer_id, invoice_number, amount, invoice_date, status, goods_category) VALUES ($1, $2, $3, $4, $5, NOW() - INTERVAL '1 day', 'PENDING', 'Auto Parts') RETURNING id",
                [lender_id, splId, buyer_id, `SPL-INV-00${i}`, 150000]
            );
            splInvoices.push(res.rows[0].id);
            await updateEdgeMetadata(lender_id, splId, buyer_id, 150000, 'Auto Parts');
        }

        for (let i = 0; i < 3; i++) {
            const invId = splInvoices[i];
            await pool.query(
                "INSERT INTO disputes (invoice_id, reason, notes, deduction_amount) VALUES ($1, $2, $3, $4)",
                [invId, 'QUALITY_ISSUE', 'Massive defect reported', 50000]
            );
            await pool.query(
                "INSERT INTO settlements (invoice_id, actual_payment_amount, payment_date) VALUES ($1, $2, NOW()) ON CONFLICT (invoice_id) DO UPDATE SET actual_payment_amount = EXCLUDED.actual_payment_amount",
                [invId, 100000]
            );
        }

        console.log('--- Triggering Risk Engine Re-evaluation ---');
        const allInvoices = await pool.query(
            "SELECT * FROM invoices WHERE invoice_number LIKE 'GTC-%' OR invoice_number LIKE 'SPL-%'"
        );
        
        for (const inv of allInvoices.rows) {
            await evaluateRisk(
                inv.lender_id, inv.id, inv.supplier_id, inv.buyer_id,
                inv.amount, inv.invoice_date, inv.expected_payment_date,
                0, []
            );
        }

        const stats = await pool.query("SELECT COUNT(*) FROM alerts WHERE severity IN ('CRITICAL', 'WARNING')");
        console.log('SUCCESS: Seeding complete.');
        console.log(`TOTAL_HIGH_RISK_ALERTS: ${stats.rows[0].count}`);

    } catch (err) {
        console.error('FINAL_SEEDING_ERROR:', err.message);
        process.exit(1);
    } finally {
        await pool.end();
    }
}

seedAdvancedFraud();
