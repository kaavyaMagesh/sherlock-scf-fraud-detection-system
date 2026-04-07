const pool = require('../db/index');

/**
 * SEEDING CAROUSEL LEG 3 DOCUMENTS (PO/GRN)
 * Goal: Allow user to manually enter the invoice to complete the 3->8->9->3 cycle.
 */
async function seedLeg3() {
    try {
        console.log("--- Carousel Simulation: Preparing Leg 3 Documents ---");

        const lenderRes = await pool.query("SELECT id FROM lenders LIMIT 1");
        const lenderId = lenderRes.rows[0].id;
        const category = 'Automotive Sensors';
        const amount = 50000;

        // Leg 3: Supplier 9 (Bosch) -> Buyer 3 (Tata)
        const supplierId = 9;
        const buyerId = 3;

        // 1. PO
        const po = await pool.query(`
            INSERT INTO purchase_orders (lender_id, buyer_id, supplier_id, amount, po_date, goods_category)
            VALUES ($1::INTEGER, $2::INTEGER, $3::INTEGER, $4::NUMERIC, NOW() - INTERVAL '1 day', $5::VARCHAR) RETURNING id
        `, [lenderId, buyerId, supplierId, amount, category]);
        const poId = po.rows[0].id;

        // 2. GRN
        const grn = await pool.query(`
            INSERT INTO goods_receipts (lender_id, po_id, amount_received, grn_date, goods_category)
            VALUES ($1::INTEGER, $2::INTEGER, $3::NUMERIC, NOW(), $4::VARCHAR) RETURNING id
        `, [lenderId, poId, amount, category]);
        const grnId = grn.rows[0].id;

        console.log("\n--- Manual Entry Preparation Complete ---");
        console.log(`PO ID: ${poId}`);
        console.log(`GRN ID: ${grnId}`);
        console.log(`Supplier ID: ${supplierId} (Bosch India)`);
        console.log(`Buyer ID: ${buyerId} (Tata Motors)`);
        console.log(`Amount: ${amount}`);
        console.log(`Category: ${category}`);
        
        process.exit(0);

    } catch (err) {
        console.error("Seed Failed:", err.message);
        process.exit(1);
    }
}

seedLeg3();
