const pool = require('../db/index');
const riskEngineService = require('../services/riskEngineService');
const validationService = require('../services/validationService');
const graphEngineService = require('../services/graphEngineService');

async function seedSemanticFraud() {
    try {
        console.log("Seeding Semantic Fraud Scenario...");

        // 1. Get existing entities
        const lenderRes = await pool.query("SELECT id FROM lenders LIMIT 1");
        const lenderId = lenderRes.rows[0].id;

        const supplierRes = await pool.query("SELECT id, name FROM companies WHERE tier = 1 LIMIT 1");
        const supplier = supplierRes.rows[0];

        const buyerRes = await pool.query("SELECT id, name FROM companies WHERE id != $1 LIMIT 1", [supplier.id]);
        const buyer = buyerRes.rows[0];

        const invoiceNumber = `SEM-FRAUD-${Math.floor(Math.random() * 9000) + 1000}`;

        // 2. Create high-value PO
        const poRes = await pool.query(`
            INSERT INTO purchase_orders (lender_id, buyer_id, supplier_id, amount, po_date, goods_category, delivery_location, payment_terms)
            VALUES ($1, $2, $3, 750000.00, NOW() - INTERVAL '5 days', 'Precision Medical Surgical Laser Equipment (Grade A)', 'Central Hospital, Surgical Wing, Block 4', 'Net 30')
            RETURNING id
        `, [lenderId, buyer.id, supplier.id]);
        const poId = poRes.rows[0].id;

        // 3. Create fraud Invoice (Value mismatch + Geo Anomaly + Payment Term Anomaly)
        // Description is "Industrial Plastic Scrap" instead of "Surgical Laser Equipment"
        // Delivery location is "Public Warehouse, Loading Dock 9, Seaport" (maybe plausible, let's make it weird)
        // Better: Delivery to "Abandoned Lot, 123 Ghost St"
        
        const invRes = await pool.query(`
            INSERT INTO invoices (
                lender_id, invoice_number, po_id, supplier_id, buyer_id, 
                amount, goods_category, invoice_date, expected_payment_date, 
                status, delivery_location, payment_terms
            )
            VALUES ($1, $2, $3, $4, $5, 750000.00, 'Assorted Industrial Plastic Scrap and Waste', NOW(), NOW() + INTERVAL '1 day', 'PENDING', 'Abandoned Lot 4, Sector 7, Desert Road', 'Immediate Net-1')
            RETURNING id
        `, [lenderId, invoiceNumber, poId, supplier.id, buyer.id]);

        const invoiceId = invRes.rows[0].id;
        const invoiceDate = new Date();

        // 4. Pass through Risk Engine (Deterministic only during seed)
        const fingerprint = validationService.generateFingerprint(supplier.id, buyer.id, invoiceNumber, 750000.00, invoiceDate);
        await pool.query('INSERT INTO invoice_fingerprints (invoice_id, lender_id, fingerprint) VALUES ($1, $2, $3)', [invoiceId, lenderId, fingerprint]);

        await riskEngineService.evaluateRisk(
            lenderId, invoiceId, supplier.id, buyer.id, 750000.00, invoiceDate, new Date(Date.now() + 86400000), 0, [], { triggerAI: false }
        );

        console.log("\nSuccess!");
        console.log(`Invoice ID: ${invoiceId}`);
        console.log(`Invoice Number: ${invoiceNumber}`);
        console.log(`Supplier: ${supplier.name}`);
        console.log(`Buyer: ${buyer.name}`);
        console.log(`Fraud Pattern:`);
        console.log(`  - Semantic Mismatch: PO (Surgical Laser) vs Invoice (Plastic Scrap)`);
        console.log(`  - Geo Anomaly: Delivery to 'Abandoned Lot'`);
        console.log(`  - Payment Anomaly: $750k immediate payment (Net-1)`);
        console.log("\nYou can now test this by running:");
        console.log(`node scripts/evaluate_invoice.js ${invoiceId}`);

        process.exit(0);
    } catch (err) {
        console.error("Seed Failed:", err);
        process.exit(1);
    }
}

seedSemanticFraud();
