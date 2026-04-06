const pool = require('../db/index');
const riskEngineService = require('../services/riskEngineService');
const validationService = require('../services/validationService');
const explainabilityService = require('../services/explainabilityService');

async function seedPhantomInvoice() {
    try {
        console.log("--- Seeding Phantom Invoice Scenario (Missing GRN) ---");

        // 1. Fetch dynamic entities from the database
        const lenderRes = await pool.query("SELECT id FROM lenders LIMIT 1");
        if (lenderRes.rows.length === 0) throw new Error("No lenders found. Run db/seed_erp.js first.");
        const lenderId = lenderRes.rows[0].id;

        const supplierRes = await pool.query("SELECT id, name FROM companies WHERE role = 'SUPPLIER' OR role = 'BOTH' LIMIT 1");
        if (supplierRes.rows.length === 0) throw new Error("No suppliers found.");
        const supplier = supplierRes.rows[0];

        const buyerRes = await pool.query("SELECT id, name FROM companies WHERE id != $1 AND (role = 'BUYER' OR role = 'BOTH') LIMIT 1", [supplier.id]);
        if (buyerRes.rows.length === 0) throw new Error("No buyers found.");
        const buyer = buyerRes.rows[0];

        const invoiceNumber = `PHNTM-${Math.floor(Math.random() * 9000) + 1000}`;
        const amount = 450000.00;
        const invoiceDate = new Date();
        const dueDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // Net 30

        console.log(`Using Lender ID: ${lenderId}`);
        console.log(`Using Supplier: ${supplier.name} (ID: ${supplier.id})`);
        console.log(`Using Buyer: ${buyer.name} (ID: ${buyer.id})`);
        console.log(`Invoice Number: ${invoiceNumber}`);

        // 2. Create Purchase Order (PO)
        console.log("Step 1: Creating Purchase Order...");
        const poRes = await pool.query(`
            INSERT INTO purchase_orders (
                lender_id, buyer_id, supplier_id, amount, po_date, 
                goods_category, delivery_location, payment_terms
            )
            VALUES ($1, $2, $3, $4, NOW() - INTERVAL '10 days', 'High-Precision Medical Components', 'Medical Hub Warehouse, Zone A', 'Net 30')
            RETURNING id
        `, [lenderId, buyer.id, supplier.id, amount]);
        const poId = poRes.rows[0].id;

        // 3. Create Invoice (Linking to PO, but NO GRN created)
        console.log("Step 2: Creating Invoice with MISSING GRN...");
        const invRes = await pool.query(`
            INSERT INTO invoices (
                lender_id, invoice_number, po_id, supplier_id, buyer_id, 
                amount, goods_category, invoice_date, expected_payment_date, 
                status, delivery_location, payment_terms
            )
            VALUES ($1, $2, $3, $4, $5, $6, 'High-Precision Medical Components', $7, $8, 'PENDING', 'Medical Hub Warehouse, Zone A', 'Net 30')
            RETURNING id
        `, [lenderId, invoiceNumber, poId, supplier.id, buyer.id, amount, invoiceDate, dueDate]);
        const invoiceId = invRes.rows[0].id;

        // 4. Generate Fingerprint
        const fingerprint = validationService.generateFingerprint(supplier.id, buyer.id, invoiceNumber, amount, invoiceDate);
        await pool.query('INSERT INTO invoice_fingerprints (invoice_id, lender_id, fingerprint) VALUES ($1, $2, $3)', [invoiceId, lenderId, fingerprint]);

        // 5. Triple Match Validation (Manually)
        console.log("Step 3: Running Triple Match Validation...");
        const tripleCheck = await validationService.checkTripleMatch(lenderId, poId, amount, invoiceDate, supplier.id, buyer.id, invoiceNumber);
        
        // 6. Risk Engine Evaluation
        console.log("Step 4: Executing Risk Engine...");
        const riskResult = await riskEngineService.evaluateRisk(
            lenderId, invoiceId, supplier.id, buyer.id, amount, invoiceDate, dueDate, 
            tripleCheck.points, tripleCheck.breakdown, { triggerAI: false }
        );

        // 7. Persist Forensic DNA (Ensures PHANTOM_INVOICE typology is recorded)
        console.log("Step 5: Generating AI Forensic DNA...");
        await explainabilityService.generateExplanation(invoiceId, riskResult);

        console.log("\n--- Success! ---");
        console.log(`Invoice ID: ${invoiceId} has been seeded.`);
        console.log(`Risk Score: ${riskResult.riskScore}`);
        console.log(`Status: ${riskResult.status}`);
        console.log(`Primary Risk Factor: ${riskResult.breakdown[0]?.factor || 'None'}`);
        console.log(`Detail: ${riskResult.breakdown[0]?.detail || 'N/A'}`);
        
        process.exit(0);
    } catch (err) {
        console.error("\nSeed Failed:", err.message);
        process.exit(1);
    }
}

seedPhantomInvoice();
