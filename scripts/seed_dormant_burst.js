const pool = require('../db/index');
const riskEngineService = require('../services/riskEngineService');
const validationService = require('../services/validationService');
const explainabilityService = require('../services/explainabilityService');

async function seedDormantBurst() {
    try {
        console.log("--- Unified Seeding: Dormant Entity Burst Scenario ---");

        // 1. Fetch dynamic entities
        const lenderRes = await pool.query("SELECT id FROM lenders LIMIT 1");
        const lenderId = lenderRes.rows[0].id;

        const supplierRes = await pool.query("SELECT id, name FROM companies WHERE id = 8 LIMIT 1");
        const supplier = supplierRes.rows[0];

        const buyerRes = await pool.query("SELECT id, name FROM companies WHERE id != $1 AND (role = 'BUYER' OR role = 'BOTH') LIMIT 1", [supplier.id]);
        const buyer = buyerRes.rows[0];

        const amount = 6000000.00; // >30% of 18M annual revenue
        const invoiceNumber = `DORM-${Math.floor(Math.random() * 9000) + 1000}`;
        const invoiceDate = new Date();
        invoiceDate.setHours(3, 15, 0, 0); // 3:15 AM (Offline hours)
        const dueDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

        console.log(`Targeting Supplier: ${supplier.name} (ID: ${supplier.id})`);
        console.log(`Targeting Buyer: ${buyer.name} (ID: ${buyer.id})`);

        // 2. Simulate Dormancy: Update supplier's last_invoice_date to 120 days ago
        console.log("Step 1: Simulating dormancy (setting last_invoice_date to 120 days ago)...");
        await pool.query("UPDATE companies SET last_invoice_date = NOW() - INTERVAL '120 days' WHERE id = $1", [supplier.id]);

        // 3. Create PO (Unified chain start)
        console.log("Step 2: Creating Purchase Order...");
        const poRes = await pool.query(`
            INSERT INTO purchase_orders (lender_id, buyer_id, supplier_id, amount, po_date, goods_category, delivery_location, payment_terms)
            VALUES ($1, $2, $3, $4, NOW() - INTERVAL '5 days', 'Industrial Power Converters', 'Central Hub, North Delhi', 'Net 30')
            RETURNING id
        `, [lenderId, buyer.id, supplier.id, amount]);
        const poId = poRes.rows[0].id;

        // 4. Create GRN
        console.log("Step 3: Creating Goods Receipt Note...");
        const grnRes = await pool.query(`
            INSERT INTO goods_receipts (lender_id, po_id, amount_received, grn_date, quantity, goods_category)
            VALUES ($1, $2, $3, NOW() - INTERVAL '2 days', 10, 'Industrial Power Converters')
            RETURNING id
        `, [lenderId, poId, amount]);
        const grnId = grnRes.rows[0].id;

        // 5. Create Delivery Confirmation
        console.log("Step 4: Creating Delivery Confirmation...");
        await pool.query(`
            INSERT INTO delivery_confirmations (grn_id, lender_id, confirmed_by, delivery_date, delivery_status)
            VALUES ($1, $2, 'Inbound Manager', NOW() - INTERVAL '2 days', 'FULFILLED')
        `, [grnId, lenderId]);

        // 6. Create Invoice (Unified chain end)
        console.log("Step 5: Creating Invoice...");
        const invRes = await pool.query(`
            INSERT INTO invoices (
                lender_id, invoice_number, po_id, grn_id, supplier_id, buyer_id, 
                amount, goods_category, invoice_date, expected_payment_date, status,
                delivery_location, payment_terms
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7, 'Industrial Power Converters', $8, $9, 'PENDING', 'Central Hub, North Delhi', 'Net 30')
            RETURNING id
        `, [lenderId, invoiceNumber, poId, grnId, supplier.id, buyer.id, amount, invoiceDate, dueDate]);
        const invoiceId = invRes.rows[0].id;

        // 7. Fingerprint
        const fingerprint = validationService.generateFingerprint(supplier.id, buyer.id, invoiceNumber, amount, invoiceDate);
        await pool.query('INSERT INTO invoice_fingerprints (invoice_id, lender_id, fingerprint) VALUES ($1, $2, $3)', [invoiceId, lenderId, fingerprint]);

        // 8. Evaluation
        console.log("Step 6: Executing Risk Engine (Unified Validation)...");
        const tripleCheck = await validationService.checkTripleMatch(lenderId, poId, grnId, amount, invoiceDate, supplier.id, buyer.id, invoiceNumber);
        
        const riskResult = await riskEngineService.evaluateRisk(
            lenderId, invoiceId, supplier.id, buyer.id, amount, invoiceDate, dueDate,
            tripleCheck.points, tripleCheck.breakdown, { triggerAI: false }
        );

        // 9. DNA Persistence
        console.log("Step 7: Generating Forensic DNA...");
        await explainabilityService.generateExplanation(invoiceId, riskResult);

        console.log("\n--- Success! ---");
        console.log(`Invoice ID: ${invoiceId} (Number: ${invoiceNumber}) seeded.`);
        console.log(`Risk Score: ${riskResult.riskScore}`);
        console.log(`Primary Factor: ${riskResult.breakdown.find(b => b.factor === 'dormant_entity_burst') ? 'dormant_entity_burst' : 'Other'}`);
        
        process.exit(0);

    } catch (err) {
        console.error("Seed Failed:", err.message);
        process.exit(1);
    }
}

seedDormantBurst();
