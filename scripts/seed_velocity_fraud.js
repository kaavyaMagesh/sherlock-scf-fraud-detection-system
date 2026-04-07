const pool = require('../db/index');
const riskEngineService = require('../services/riskEngineService');
const validationService = require('../services/validationService');
const explainabilityService = require('../services/explainabilityService');
const graphEngineService = require('../services/graphEngineService');

/**
 * SEEDING VELOCITY FRAUD
 * 1. Creates 5 "Background" Invoices (PO -> GRN -> Invoice) in the last hour.
 * 2. Creates 1 "Target" Invoice now, crossing the 5-invoice/hour threshold.
 */
async function seedVelocityFraud() {
    try {
        console.log("--- Unified Seeding: Velocity Fraud (Frequency Spike) ---");

        // 1. Resolve Core Entities
        const lenderRes = await pool.query("SELECT id FROM lenders LIMIT 1");
        if (lenderRes.rows.length === 0) throw new Error("No lenders found.");
        const lenderId = lenderRes.rows[0].id;

        const supplierRes = await pool.query("SELECT id, name FROM companies WHERE id = 8 LIMIT 1");
        if (supplierRes.rows.length === 0) throw new Error("Supplier Uno Minda (ID 8) not found.");
        const supplier = supplierRes.rows[0];

        const buyerRes = await pool.query("SELECT id, name FROM companies WHERE id != $1 AND (role = 'BUYER' OR role = 'BOTH') LIMIT 1", [supplier.id]);
        if (buyerRes.rows.length === 0) throw new Error("No buyer found.");
        const buyer = buyerRes.rows[0];

        console.log(`Using Supplier: ${supplier.name} (ID: ${supplier.id})`);
        console.log(`Using Buyer: ${buyer.name} (ID: ${buyer.id})`);

        // 2. Clear old velocity tests for this supplier (Optional, but ensures clean c1h count)
        // await pool.query("DELETE FROM invoices WHERE supplier_id = $1 AND invoice_date >= NOW() - INTERVAL '1 hour'", [supplier.id]);

        // 3. Seed 5 Background Invoices (Approved)
        for (let i = 1; i <= 5; i++) {
            const amount = 200000.00 + (i * 10000);
            const invNo = `VEL-BG-${i}-${Math.floor(Math.random() * 1000)}`;
            // Space them out slightly in the last 45 mins
            const timestamp = new Date(Date.now() - (45 - i * 5) * 60000);

            console.log(`  Seeding Step ${i}/5: ${invNo}...`);

            // PO
            const po = await pool.query(`
                INSERT INTO purchase_orders (lender_id, buyer_id, supplier_id, amount, po_date, goods_category)
                VALUES ($1, $2, $3, $4, $5, 'Automotive Control Units') RETURNING id
            `, [lenderId, buyer.id, supplier.id, amount, new Date(timestamp.getTime() - 86400000)]);
            const poId = po.rows[0].id;

            // GRN
            const grn = await pool.query(`
                INSERT INTO goods_receipts (lender_id, po_id, amount_received, grn_date, goods_category)
                VALUES ($1, $2, $3, $4, 'Automotive Control Units') RETURNING id
            `, [lenderId, poId, amount, new Date(timestamp.getTime() - 3600000)]);
            const grnId = grn.rows[0].id;

            // Invoice
            const inv = await pool.query(`
                INSERT INTO invoices (lender_id, invoice_number, po_id, grn_id, supplier_id, buyer_id, amount, invoice_date, expected_payment_date, status)
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'PENDING') RETURNING id
            `, [lenderId, invNo, poId, grnId, supplier.id, buyer.id, amount, timestamp, new Date(timestamp.getTime() + 30 * 24 * 60 * 60 * 1000)]);
            const invId = inv.rows[0].id;

            // Fingerprint
            const fp = validationService.generateFingerprint(supplier.id, buyer.id, invNo, amount, timestamp);
            await pool.query('INSERT INTO invoice_fingerprints (invoice_id, lender_id, fingerprint) VALUES ($1, $2, $3)', [invId, lenderId, fp]);

            // Update Graph Topology
            await graphEngineService.updateEdgeMetadata(lenderId, supplier.id, buyer.id, amount, 'Automotive Control Units');

            // Initial Assessment (Dynamic)
            const tripleCheck = await validationService.checkTripleMatch(lenderId, poId, grnId, amount, timestamp, supplier.id, buyer.id, invNo);
            await riskEngineService.evaluateRisk(
                lenderId, invId, supplier.id, buyer.id, amount, timestamp, new Date(timestamp.getTime() + 30 * 24 * 60 * 60 * 1000),
                tripleCheck.points, tripleCheck.breakdown, { triggerAI: false }
            );
        }

        // 4. Seed Target (6th) Invoice (The Trigger)
        console.log("\nStep 2: Seeding Target Invoice (The Trigger)...");
        const amount = 850000.00;
        const targetInvNo = `VEL-SPIKE-${Math.floor(Math.random() * 9000) + 1000}`;
        const targetDate = new Date();
        const dueDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

        // PO
        const targetPo = await pool.query(`
            INSERT INTO purchase_orders (lender_id, buyer_id, supplier_id, amount, po_date, goods_category)
            VALUES ($1, $2, $3, $4, NOW() - INTERVAL '1 day', 'High-Frequency Power Inverters') RETURNING id
        `, [lenderId, buyer.id, supplier.id, amount]);
        const targetPoId = targetPo.rows[0].id;

        // GRN
        const targetGrn = await pool.query(`
            INSERT INTO goods_receipts (lender_id, po_id, amount_received, grn_date, goods_category)
            VALUES ($1, $2, $3, NOW() - INTERVAL '4 hours', 'High-Frequency Power Inverters') RETURNING id
        `, [lenderId, targetPoId, amount]);
        const targetGrnId = targetGrn.rows[0].id;

        // Invoice
        const targetInv = await pool.query(`
            INSERT INTO invoices (lender_id, invoice_number, po_id, grn_id, supplier_id, buyer_id, amount, invoice_date, expected_payment_date, status)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'PENDING') RETURNING id
        `, [lenderId, targetInvNo, targetPoId, targetGrnId, supplier.id, buyer.id, amount, targetDate, dueDate]);
        const targetInvId = targetInv.rows[0].id;

        // Fingerprint
        const targetFp = validationService.generateFingerprint(supplier.id, buyer.id, targetInvNo, amount, targetDate);
        await pool.query('INSERT INTO invoice_fingerprints (invoice_id, lender_id, fingerprint) VALUES ($1, $2, $3)', [targetInvId, lenderId, targetFp]);

        // 5. Evaluate Risk
        console.log("Step 3: Running Full Risk Engine for Target Invoice...");
        const tripleCheck = await validationService.checkTripleMatch(lenderId, targetPoId, targetGrnId, amount, targetDate, supplier.id, buyer.id, targetInvNo);
        
        const riskResult = await riskEngineService.evaluateRisk(
            lenderId, targetInvId, supplier.id, buyer.id, amount, targetDate, dueDate,
            tripleCheck.points, tripleCheck.breakdown, { triggerAI: false }
        );

        // 6. Persist DNA
        console.log("Step 4: Generating Forensic DNA...");
        await explainabilityService.generateExplanation(targetInvId, riskResult);

        console.log("\n--- Success! ---");
        console.log(`Invoice ID: ${targetInvId} (Number: ${targetInvNo}) has been seeded.`);
        console.log(`Current 1h Frequency: 6 (Threshold: 5)`);
        console.log(`Risk Score: ${riskResult.riskScore}`);
        console.log(`DNA Typology: ${riskResult.breakdown.some(b => b.factor === 'velocity_anomaly') ? 'VELOCITY_FRAUD' : 'Other'}`);

        process.exit(0);

    } catch (err) {
        console.error("Seed Failed:", err.message);
        process.exit(1);
    }
}

seedVelocityFraud();
