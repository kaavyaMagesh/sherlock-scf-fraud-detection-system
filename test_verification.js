const pool = require('./db/index');
const riskEngineService = require('./services/riskEngineService');
const validationService = require('./services/validationService');

async function testSingleInvoice() {
    try {
        console.log("Testing Single Invoice Processing...");
        const lenderRes = await pool.query("SELECT id FROM lenders LIMIT 1");
        if (lenderRes.rows.length === 0) throw new Error("No lenders found");
        const lenderId = lenderRes.rows[0].id;

        const supplierRes = await pool.query("SELECT id FROM companies LIMIT 1");
        const buyerRes = await pool.query("SELECT id FROM companies WHERE id != $1 LIMIT 1", [supplierRes.rows[0].id]);
        
        const supplierId = supplierRes.rows[0].id;
        const buyerId = buyerRes.rows[0].id;
        const invoiceNumber = `TEST-${Date.now()}`;
        const amount = 50000;
        const invoiceDate = new Date();

        // 1. Fingerprint
        const fingerprint = validationService.generateFingerprint(supplierId, buyerId, invoiceNumber, amount, invoiceDate);

        // 2. Insert
        const res = await pool.query(
            `INSERT INTO invoices (lender_id, invoice_number, supplier_id, buyer_id, amount, invoice_date, expected_payment_date, status)
             VALUES ($1, $2, $3, $4, $5, $6, $7, 'PENDING') RETURNING id`,
            [lenderId, invoiceNumber, supplierId, buyerId, amount, invoiceDate, new Date(Date.now() + 86400000)]
        );
        const invoiceId = res.rows[0].id;

        console.log(`Invoice inserted with ID: ${invoiceId}`);

        // 3. Evaluate (NO AI)
        const result = await riskEngineService.evaluateRisk(
            lenderId, invoiceId, supplierId, buyerId, amount, invoiceDate, new Date(Date.now() + 86400000), 0, [], { triggerAI: false }
        );

        console.log("Evaluation Result:", result.status, result.riskScore);
        
        // 4. Verify audit exists
        const audit = await pool.query("SELECT * FROM risk_score_audits WHERE invoice_id = $1", [invoiceId]);
        console.log("Audit entries created:", audit.rows.length);

        process.exit(0);
    } catch (err) {
        console.error("Test Failed:", err);
        process.exit(1);
    }
}

testSingleInvoice();
