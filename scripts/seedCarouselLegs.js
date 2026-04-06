const pool = require('../db/index');

const LENDER_ID = '1';
const category = "High-Precision Industrial Bearing Assemblies";

async function runSeed() {
    try {
        console.log("--- SEEDING CAROUSEL LEGS for MANUAL ERP TESTING ---");

        // Leg 1: Mahindra (2) -> Apollo (3)
        // Leg 2: Apollo (3) -> Bosch (4)
        // Leg 3 (Closer): Bosch (4) -> Mahindra (2)

        const submitLeg = async (sid, bid, invNo) => {
            const po = await pool.query(`INSERT INTO purchase_orders (lender_id, supplier_id, buyer_id, amount, goods_category, po_date) VALUES ($1, $2, $3, 75000, $4, NOW() - INTERVAL '2 days') RETURNING id`, [LENDER_ID, sid, bid, category]);
            await pool.query(`INSERT INTO goods_receipts (lender_id, po_id, amount_received, goods_category, grn_date) VALUES ($1, $2, 75000, $3, NOW() - INTERVAL '1 day')`, [LENDER_ID, po.rows[0].id, category]);

            await pool.query(
                `INSERT INTO invoices (lender_id, invoice_number, po_id, supplier_id, buyer_id, amount, invoice_date, expected_payment_date, goods_category, status, risk_score)
                 VALUES ($1, $2, $3, $4, $5, 75000, NOW(), NOW() + INTERVAL '60 days', $6, 'APPROVED', 7)`,
                [LENDER_ID, invNo, po.rows[0].id, sid, bid, category]
            );

            // Important: Update trade relationship so the graph engine sees it!
            await pool.query(`
                INSERT INTO trade_relationships (lender_id, supplier_id, buyer_id, last_seen, total_volume, invoice_count, goods_category)
                VALUES ($1, $2, $3, NOW(), 75000, 1, $4)
                ON CONFLICT (supplier_id, buyer_id, lender_id) 
                DO UPDATE SET last_seen = NOW(), total_volume = trade_relationships.total_volume + 75000, invoice_count = trade_relationships.invoice_count + 1
            `, [LENDER_ID, sid, bid, category]);

            console.log(`- Seeded ${invNo}: ${sid} -> ${bid} (APPROVED)`);
            return po.rows[0].id;
        };

        const po1Id = await submitLeg(2, 3, 'LEG-1');
        const po2Id = await submitLeg(3, 4, 'LEG-2');

        // Create PO for Leg 3 so the manual entry finds it
        const po3Id = await pool.query(`INSERT INTO purchase_orders (lender_id, supplier_id, buyer_id, amount, goods_category, po_date) VALUES ($1, 4, 2, 75000, $2, NOW() - INTERVAL '2 days') RETURNING id`, [LENDER_ID, category]);
        await pool.query(`INSERT INTO goods_receipts (lender_id, po_id, amount_received, goods_category, grn_date) VALUES ($1, $2, 75000, $3, NOW() - INTERVAL '1 day')`, [LENDER_ID, po3Id.rows[0].id, category]);
        
        console.log(`- Created PO for Leg 3: Bosch -> Mahindra (PO_ID: ${po3Id.rows[0].id})`);

        console.log("\n✅ CAROUSEL PRE-SETUP COMPLETE");
        console.log("-----------------------------------------");
        console.log("Values to enter through ERP Portal:");
        console.log("Supplier: Bosch India (ID 4)");
        console.log("Buyer: Mahindra & Mahindra (ID 2)");
        console.log(`Purchase Order ID: ${po3Id.rows[0].id}`);
        console.log("Amount: 75000");
        console.log(`Goods Category: ${category}`);
        console.log("-----------------------------------------");

        process.exit(0);
    } catch (err) {
        console.error("Seed Error:", err);
        process.exit(1);
    }
}

runSeed();
