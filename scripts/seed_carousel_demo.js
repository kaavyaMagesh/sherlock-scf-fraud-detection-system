const pool = require('../db/index');
const riskEngineService = require('../services/riskEngineService');
const validationService = require('../services/validationService');
const graphEngineService = require('../services/graphEngineService');

/**
 * SEEDING CAROUSEL DEMO (LEGS 1 & 2)
 * Leg 1: Tata Motors (3) -> Uno Minda (8)
 * Leg 2: Uno Minda (8) -> Bosch India (9)
 * 
 * Goal: These should be initially APPROVED.
 */
async function seedCarousel() {
    try {
        console.log("--- Carousel Simulation: Seeding Legs 1 & 2 ---");

        const lenderRes = await pool.query("SELECT id FROM lenders LIMIT 1");
        const lenderId = lenderRes.rows[0].id;
        const category = 'Automotive Sensors';

        const legs = [
            { buyerId: 3, supplierId: 8, amount: 50000, invNo: `CAR-LEG1-${Math.floor(Math.random()*9000)+1000}` },
            { buyerId: 8, supplierId: 9, amount: 50000, invNo: `CAR-LEG2-${Math.floor(Math.random()*9000)+1000}` }
        ];

        for (const leg of legs) {
            console.log(`\nLeg: Supplier ${leg.supplierId} -> Buyer ${leg.buyerId}`);

            // 1. PO
            const po = await pool.query(`
                INSERT INTO purchase_orders (lender_id, buyer_id, supplier_id, amount, po_date, goods_category)
                VALUES ($1::INTEGER, $2::INTEGER, $3::INTEGER, $4::NUMERIC, NOW() - INTERVAL '5 days', $5::VARCHAR) RETURNING id
            `, [lenderId, leg.buyerId, leg.supplierId, leg.amount, category]);
            const poId = po.rows[0].id;

            // 2. GRN
            const grn = await pool.query(`
                INSERT INTO goods_receipts (lender_id, po_id, amount_received, grn_date, goods_category)
                VALUES ($1::INTEGER, $2::INTEGER, $3::NUMERIC, NOW() - INTERVAL '2 days', $4::VARCHAR) RETURNING id
            `, [lenderId, poId, leg.amount, category]);
            const grnId = grn.rows[0].id;

            // 3. Invoice
            const invDate = new Date();
            const dueDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
            const inv = await pool.query(`
                INSERT INTO invoices (lender_id, invoice_number, po_id, grn_id, supplier_id, buyer_id, amount, invoice_date, expected_payment_date, goods_category, status)
                VALUES ($1::INTEGER, $2::VARCHAR, $3::INTEGER, $4::INTEGER, $5::INTEGER, $6::INTEGER, $7::NUMERIC, $8::TIMESTAMP, $9::TIMESTAMP, $10::VARCHAR, 'PENDING') RETURNING id
            `, [lenderId, leg.invNo, poId, grnId, leg.supplierId, leg.buyerId, leg.amount, invDate, dueDate, category]);
            const invId = inv.rows[0].id;

            // 4. Fingerprint
            const fp = validationService.generateFingerprint(leg.supplierId, leg.buyerId, leg.invNo, leg.amount, invDate);
            await pool.query('INSERT INTO invoice_fingerprints (invoice_id, lender_id, fingerprint) VALUES ($1, $2, $3)', [invId, lenderId, fp]);

            // 4.5 Update Graph Topology (CRITICAL for Cycle Detection)
            await graphEngineService.updateEdgeMetadata(lenderId, leg.supplierId, leg.buyerId, leg.amount, category);

            // 5. Initial Assessment
            const tripleCheck = await validationService.checkTripleMatch(lenderId, poId, grnId, leg.amount, invDate, leg.supplierId, leg.buyerId, leg.invNo);
            const res = await riskEngineService.evaluateRisk(
                lenderId, invId, leg.supplierId, leg.buyerId, leg.amount, invDate, dueDate,
                tripleCheck.points, tripleCheck.breakdown, { triggerAI: false }
            );

            console.log(`  Invoice Created: ID ${invId} (${leg.invNo})`);
            console.log(`  Initial Status: ${res.status} (Score: ${res.riskScore})`);
        }

        console.log("\nSuccess: Part 1 Complete. First two legs are APPROVED.");
        process.exit(0);

    } catch (err) {
        console.error("Seed Failed:", err.message);
        process.exit(1);
    }
}

seedCarousel();
