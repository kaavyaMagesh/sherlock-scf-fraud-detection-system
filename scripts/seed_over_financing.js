const pool = require('../db/index');
const riskEngineService = require('../services/riskEngineService');
const validationService = require('../services/validationService');
const explainabilityService = require('../services/explainabilityService');

/**
 * SEEDING OVER-FINANCING (CROSS-TIER CASCADE)
 * 1. Root PO (Tata Motors -> Bosch): ₹10,000,000
 * 2. Sub-Tier PO (Bosch -> Uno Minda): ₹2,000,000 (references Root PO)
 * 3. Invoice (Uno Minda -> Bosch): ₹2,000,000
 * Logic: Total chain volume = 10M + 2M = 12M. Ratio = 1.2 (> 1.1).
 */
async function seedOverFinancing() {
    try {
        console.log("--- Unified Seeding: Cross-Tier Cascade (Over-Financing) ---");

        // 1. Resolve Entities
        const lenderRes = await pool.query("SELECT id FROM lenders LIMIT 1");
        if (lenderRes.rows.length === 0) throw new Error("No lenders found.");
        const lenderId = lenderRes.rows[0].id;

        const rootBuyer = { id: 3, name: "Tata Motors" };
        const tier1Supplier = { id: 9, name: "Bosch India" };
        const tier2Supplier = { id: 8, name: "Uno Minda" };

        console.log(`Root Buyer: ${rootBuyer.name}`);
        console.log(`Tier-1 Supplier/Buyer: ${tier1Supplier.name}`);
        console.log(`Tier-2 Supplier: ${tier2Supplier.name}`);

        // 2. Insert Root PO (Tier 1)
        const rootPoAmount = 10000000.00;
        const rootPo = await pool.query(`
            INSERT INTO purchase_orders (lender_id, buyer_id, supplier_id, amount, po_date, goods_category)
            VALUES ($1, $2, $3, $4, NOW() - INTERVAL '10 days', 'High-Capacity Traction Motors') RETURNING id
        `, [lenderId, rootBuyer.id, tier1Supplier.id, rootPoAmount]);
        const rootPoId = rootPo.rows[0].id;
        console.log(`  Root PO Created: ID ${rootPoId} (Amount: ${rootPoAmount})`);

        // 3. Insert Sub-Tier PO (Tier 2) - Cascading from Root
        const subPoAmount = 2000000.00;
        const subPo = await pool.query(`
            INSERT INTO purchase_orders (lender_id, buyer_id, supplier_id, amount, po_date, goods_category, root_po_id)
            VALUES ($1, $2, $3, $4, NOW() - INTERVAL '5 days', 'Traction Motor Sub-Assemblies', $5) RETURNING id
        `, [lenderId, tier1Supplier.id, tier2Supplier.id, subPoAmount, rootPoId]);
        const subPoId = subPo.rows[0].id;
        console.log(`  Sub-Tier PO Created: ID ${subPoId} (Amount: ${subPoAmount}, Root: ${rootPoId})`);

        // 4. Insert Sub-Tier GRN
        const grn = await pool.query(`
            INSERT INTO goods_receipts (lender_id, po_id, amount_received, grn_date, goods_category)
            VALUES ($1, $2, $3, NOW() - INTERVAL '2 days', 'Traction Motor Sub-Assemblies') RETURNING id
        `, [lenderId, subPoId, subPoAmount]);
        const grnId = grn.rows[0].id;

        // 5. Insert Sub-Tier Invoice (The Target)
        const invNo = `CASCADE-SPIKE-${Math.floor(Math.random() * 9000) + 1000}`;
        const invDate = new Date();
        const dueDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

        const inv = await pool.query(`
            INSERT INTO invoices (lender_id, invoice_number, po_id, grn_id, supplier_id, buyer_id, amount, invoice_date, expected_payment_date, status)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'PENDING') RETURNING id
        `, [lenderId, invNo, subPoId, grnId, tier2Supplier.id, tier1Supplier.id, subPoAmount, invDate, dueDate]);
        const invId = inv.rows[0].id;

        // 6. Fingerprint
        const fp = validationService.generateFingerprint(tier2Supplier.id, tier1Supplier.id, invNo, subPoAmount, invDate);
        await pool.query('INSERT INTO invoice_fingerprints (invoice_id, lender_id, fingerprint) VALUES ($1, $2, $3)', [invId, lenderId, fp]);

        // 7. Execute Risk Engine on Sub-Tier Invoice
        console.log("Step 2: Triggering Risk Engine (Tier 5 Cascade Check)...");
        const tripleCheck = await validationService.checkTripleMatch(lenderId, subPoId, grnId, subPoAmount, invDate, tier2Supplier.id, tier1Supplier.id, invNo);
        
        const result = await riskEngineService.evaluateRisk(
            lenderId, invId, tier2Supplier.id, tier1Supplier.id, subPoAmount, invDate, dueDate,
            tripleCheck.points, tripleCheck.breakdown, { triggerAI: true }
        );

        console.log("\n--- Success! ---");
        console.log(`Invoice ID: ${invId} (Number: ${invNo})`);
        console.log(`Risk Score: ${result.riskScore}`);
        console.log(`Factors: ${result.breakdown.map(b => b.factor).join(', ')}`);
        
        const hasCascade = result.breakdown.some(b => b.factor === 'cascade_over_financing');
        console.log(`Cascade Alert: ${hasCascade ? 'ACTIVE (₹12M / ₹10M Ratio)' : 'INACTIVE'}`);

        process.exit(0);
    } catch (err) {
        console.error("Seed Failed:", err.message);
        process.exit(1);
    }
}

seedOverFinancing();
