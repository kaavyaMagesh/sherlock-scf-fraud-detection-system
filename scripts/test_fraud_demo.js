const pool = require('../db/index');
const riskEngineService = require('../services/riskEngineService');

const runTest = async () => {
    console.log("Starting Manual Fraud Demo Verification...");

    try {
        // 1. Setup Test Data
        const lenderResult = await pool.query("INSERT INTO lenders (name) VALUES ('Demo Lender') RETURNING id");
        const lenderId = lenderResult.rows[0].id;

        const supplierResult = await pool.query(
            "INSERT INTO companies (lender_id, name, tier, annual_revenue, monthly_avg_invoicing) VALUES ($1, 'Test Supplier', 2, 1000000, 50000) RETURNING id",
            [lenderId]
        );
        const supplierId = supplierResult.rows[0].id;

        const buyerResult = await pool.query(
            "INSERT INTO companies (lender_id, name, tier, annual_revenue, monthly_avg_invoicing) VALUES ($1, 'Test Buyer', 1, 50000000, 1000000) RETURNING id",
            [lenderId]
        );
        const buyerId = buyerResult.rows[0].id;

        const poResult = await pool.query(
            "INSERT INTO purchase_orders (lender_id, buyer_id, supplier_id, amount, quantity, goods_category, po_date) VALUES ($1, $2, $3, 100000, 10, 'Electronics', NOW()) RETURNING id",
            [lenderId, buyerId, supplierId]
        );
        const poId = poResult.rows[0].id;

        const invResult = await pool.query(
            "INSERT INTO invoices (lender_id, po_id, supplier_id, buyer_id, amount, invoice_number, invoice_date, expected_payment_date, status) VALUES ($1, $2, $3, $4, 100000, 'INV-TEST-001', NOW(), NOW() + INTERVAL '30 days', 'APPROVED') RETURNING id",
            [lenderId, poId, supplierId, buyerId]
        );
        const invoiceId = invResult.rows[0].id;

        console.log(`Created Test Invoice: ${invoiceId}`);

        // 2. Initial Risk Evaluation
        console.log("Running initial risk evaluation...");
        const result1 = await riskEngineService.evaluateRisk(lenderId, invoiceId, supplierId, buyerId, 100000, new Date(), new Date(), 0, []);
        console.log(`Initial Score: ${result1.riskScore}`);

        // 3. Raise Dispute
        console.log("Raising dispute...");
        await pool.query(
            "INSERT INTO disputes (invoice_id, lender_id, dispute_reason, dispute_notes) VALUES ($1, $2, 'GOODS_RETURNED', 'Test dispute')",
            [invoiceId, lenderId]
        );
        await pool.query("UPDATE invoices SET status = 'DISPUTED' WHERE id = $1", [invoiceId]);

        // 4. Re-evaluate Risk
        console.log("Running re-evaluation after dispute...");
        const result2 = await riskEngineService.evaluateRisk(lenderId, invoiceId, supplierId, buyerId, 100000, new Date(), new Date(), 0, []);
        console.log(`Score after dispute: ${result2.riskScore}`);

        // 5. Verification
        if (result2.riskScore > result1.riskScore) {
            console.log("✅ SUCCESS: Risk score increased after dispute.");
            const disputeRule = result2.breakdown.find(b => b.factor === 'invoice_disputed');
            if (disputeRule) {
                console.log(`✅ SUCCESS: Found 'invoice_disputed' rule with ${disputeRule.points} points.`);
            } else {
                console.log("❌ FAILURE: Could not find 'invoice_disputed' rule in breakdown.");
            }
        } else {
            console.log("❌ FAILURE: Risk score did not increase after dispute.");
        }

        // 6. Cleanup (Optional, but good for local)
        console.log("Cleaning up test data...");
        await pool.query("DELETE FROM alerts WHERE invoice_id = $1", [invoiceId]);
        await pool.query("DELETE FROM risk_score_audits WHERE invoice_id = $1", [invoiceId]);
        await pool.query("DELETE FROM disputes WHERE invoice_id = $1", [invoiceId]);
        await pool.query("DELETE FROM invoices WHERE id = $1", [invoiceId]);
        await pool.query("DELETE FROM purchase_orders WHERE id = $1", [poId]);
        await pool.query("DELETE FROM companies WHERE id IN ($1, $2)", [supplierId, buyerId]);
        await pool.query("DELETE FROM lenders WHERE id = $1", [lenderId]);

    } catch (err) {
        console.error("Test execution failed:", err);
    } finally {
        await pool.end();
    }
};

runTest();
