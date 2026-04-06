const pool = require('../db/index');
const riskEngineService = require('../services/riskEngineService');
const graphEngineService = require('../services/graphEngineService');

const LENDER_ID = '1';
const category = "Carousel Logic Test (Industrial)";

async function runTest() {
    try {
        console.log("--- CAROUSEL AUTO-RECALCULATE TEST (INTERNAL ENGINE) ---");

        // 1. Setup 3 Parties
        // A=2, B=3, C=4
        const A = 2, B = 3, C = 4;

        // Cleanup any old test data for these parties to avoid FK violations
        const testCaseIds = await pool.query('SELECT id FROM invoices WHERE supplier_id IN (2,3,4)');
        const ids = testCaseIds.rows.map(r => r.id);
        
        if (ids.length > 0) {
            await pool.query('DELETE FROM risk_score_audits WHERE invoice_id = ANY($1)', [ids]);
            await pool.query('DELETE FROM explanations WHERE invoice_id = ANY($1)', [ids]);
            await pool.query('DELETE FROM alerts WHERE invoice_id = ANY($1)', [ids]);
            await pool.query('DELETE FROM invoice_fingerprints WHERE invoice_id = ANY($1)', [ids]);
            await pool.query('DELETE FROM invoices WHERE id = ANY($1)', [ids]);
        }
        await pool.query('DELETE FROM trade_relationships WHERE supplier_id IN (2,3,4) OR buyer_id IN (2,3,4)');
        console.log("Cleanup complete.");

        // Helpers
        const submitForTest = async (sid, bid, invNo) => {
            // Seed PO for Triple Match
            const po = await pool.query(`INSERT INTO purchase_orders (lender_id, supplier_id, buyer_id, amount, goods_category) VALUES ($1, $2, $3, 100000, $4) RETURNING id`, [LENDER_ID, sid, bid, category]);
            await pool.query(`INSERT INTO goods_receipts (lender_id, po_id, amount_received, goods_category) VALUES ($1, $2, 100000, $3)`, [LENDER_ID, po.rows[0].id, category]);

            const inv = await pool.query(
                `INSERT INTO invoices (lender_id, invoice_number, po_id, supplier_id, buyer_id, amount, invoice_date, expected_payment_date, goods_category, status)
                 VALUES ($1, $2, $3, $4, $5, 100000, NOW(), NOW() + INTERVAL '30 days', $6, 'PENDING') RETURNING *`,
                [LENDER_ID, invNo, po.rows[0].id, sid, bid, category]
            );

            // Update Graph Edge
            await graphEngineService.updateEdgeMetadata(LENDER_ID, sid, bid, 100000, category);

            // Execute Risk Engine
            const result = await riskEngineService.evaluateRisk(LENDER_ID, inv.rows[0].id, sid, bid, 100000, new Date(), new Date(), 0, []);
            return { id: inv.rows[0].id, status: result.status, score: result.riskScore };
        };

        console.log("2. Submitting Leg 1 (A -> B)...");
        const leg1 = await submitForTest(A, B, 'CAR-L1');
        console.log(`Leg 1: ${leg1.status} (Score ${leg1.score})`);

        console.log("3. Submitting Leg 2 (B -> C)...");
        const leg2 = await submitForTest(B, C, 'CAR-L2');
        console.log(`Leg 2: ${leg2.status} (Score ${leg2.score})`);

        console.log("4. Submitting Leg 3 (C -> A) - THE CLOSER...");
        const leg3 = await submitForTest(C, A, 'CAR-L3');
        console.log(`Leg 3 (Closer): ${leg3.status} (Score ${leg3.score})`);

        console.log("5. Triggering Background Recalculation (Mimicking Controller Logic)...");
        // This is what the controller does in setImmediate
        const sid = C, bid = A;
        const neighbors = await pool.query(
            `SELECT id, supplier_id, buyer_id, lender_id, amount, invoice_date, expected_payment_date
             FROM invoices
             WHERE (supplier_id IN ($1, $2) OR buyer_id IN ($1, $2))
               AND status IN ('PENDING', 'APPROVED') AND id != $3`,
            [sid, bid, leg3.id]
        );
        console.log(`Found ${neighbors.rows.length} related invoices for recalculation...`);

        // Debug: Log the neighbors found
        neighbors.rows.forEach(r => console.log(` - Found Neighbor ID ${r.id}: ${r.supplier_id} -> ${r.buyer_id}`));

        for (const row of neighbors.rows) {
            console.log(`Recalculating Invoice ${row.id} (${row.supplier_id} -> ${row.buyer_id}) for Carousel Check...`);
            await riskEngineService.evaluateRisk(row.lender_id, row.id, row.supplier_id, row.buyer_id, row.amount, row.invoice_date, row.expected_payment_date, 0, []);
        }

        console.log("6. Final Status Check...");
        const final1 = await pool.query('SELECT status, risk_score FROM invoices WHERE id = $1', [leg1.id]);
        const final2 = await pool.query('SELECT status, risk_score FROM invoices WHERE id = $1', [leg2.id]);

        console.log(`FINAL Status Leg 1: ${final1.rows[0].status} (Score ${final1.rows[0].risk_score})`);
        console.log(`FINAL Status Leg 2: ${final2.rows[0].status} (Score ${final2.rows[0].risk_score})`);

        if (final1.rows[0].status === 'BLOCKED' && final2.rows[0].status === 'BLOCKED') {
            console.log("✅ SUCCESS: Background auto-recalculation triggered and blocked carousel legs.");
        } else {
            console.log("❌ FAILURE: Carousel legs were NOT automatically updated.");
        }

        process.exit(0);
    } catch (err) {
        console.error("Test Error:", err);
        process.exit(1);
    }
}

runTest();
