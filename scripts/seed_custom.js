const { Pool } = require('pg');
const dotenv = require('dotenv');
const path = require('path');

// Load environment variables
dotenv.config({ path: path.join(__dirname, '../.env') });

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

// Import the Risk Engine Service
const riskEngineService = require('../services/riskEngineService');

async function seedEngineDrivenData() {
  try {
    console.log("Starting Engine-Driven Data Seed...");
    
    // 1. Create a Lender
    const lenderRes = await pool.query(
      'INSERT INTO lenders (name) VALUES ($1) RETURNING id',
      ['Standard Chartered India']
    );
    const lenderId = lenderRes.rows[0].id;
    console.log(`-> Lender Created: StanChart (ID: ${lenderId})`);

    // 2. Create Companies
    const supplierRes = await pool.query(
      `INSERT INTO companies (lender_id, name, tier, annual_revenue, monthly_avg_invoicing, industry_code, credential_verified)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id`,
      [lenderId, 'Reliance Industries', 1, 500000000, 40000000, 'PET-001', true]
    );
    const supplierId = supplierRes.rows[0].id;

    const buyerRes = await pool.query(
      `INSERT INTO companies (lender_id, name, tier, annual_revenue, monthly_avg_invoicing, industry_code, credential_verified)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id`,
      [lenderId, 'Adani Enterprises', 1, 400000000, 30000000, 'LOG-002', true]
    );
    const buyerId = buyerRes.rows[0].id;
    console.log(`-> Companies Created: Supplier (ID: ${supplierId}), Buyer (ID: ${buyerId})`);

    // 3. Create Trade Relationship
    await pool.query(
      `INSERT INTO trade_relationships (lender_id, supplier_id, buyer_id, total_volume, invoice_count, goods_category)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [lenderId, supplierId, buyerId, 250000, 0, 'Petrochemicals']
    );

    // 4. Create RAW Invoices (No status, no score)
    
    // Invoice 1: Healthy 
    const po1 = await pool.query(
      `INSERT INTO purchase_orders (lender_id, buyer_id, supplier_id, amount, po_date, goods_category)
       VALUES ($1, $2, $3, $4, NOW() - INTERVAL '10 days', $5) RETURNING id`,
      [lenderId, buyerId, supplierId, 120000, 'Refined Polymer']
    );
    const grn1 = await pool.query(
      `INSERT INTO goods_receipts (lender_id, po_id, amount_received, grn_date)
       VALUES ($1, $2, $3, NOW() - INTERVAL '5 days') RETURNING id`,
      [lenderId, po1.rows[0].id, 120000]
    );
    const inv1Res = await pool.query(
      `INSERT INTO invoices (lender_id, invoice_number, po_id, grn_id, supplier_id, buyer_id, amount, invoice_date, expected_payment_date, goods_category)
       VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), NOW() + INTERVAL '30 days', 'Refined Polymer') RETURNING *`,
      [lenderId, 'STAN-HEALTHY-01', po1.rows[0].id, grn1.rows[0].id, supplierId, buyerId, 120000]
    );
    const inv1 = inv1Res.rows[0];

    // Invoice 2: Bot Attack / High Velocity Anomaly (Simulating by inserting multiple recent ones)
    for(let i=0; i<5; i++) {
        await pool.query(
            `INSERT INTO invoices (lender_id, invoice_number, supplier_id, buyer_id, amount, invoice_date, expected_payment_date, goods_category)
             VALUES ($1, $2, $3, $4, $5, NOW(), NOW() + INTERVAL '30 days', 'Raw Chemicals')`,
            [lenderId, `STAN-BOT-${i}`, supplierId, buyerId, 5000,]
        );
    }
    const inv2Res = await pool.query(
      `INSERT INTO invoices (lender_id, invoice_number, supplier_id, buyer_id, amount, invoice_date, expected_payment_date, goods_category)
       VALUES ($1, $2, $3, $4, $5, NOW(), NOW() + INTERVAL '30 days', 'Raw Chemicals') RETURNING *`,
      [lenderId, 'STAN-BOT-TARGET', supplierId, buyerId, 5000]
    );
    const inv2 = inv2Res.rows[0];

    console.log("-> Raw Data Seeded. Now Triggering Risk Engine for Processing...");

    // 5. CALL THE RISK ENGINE TO DECIDE STATUS AND SCORE
    const invsToProcess = [inv1, inv2];
    
    for (const inv of invsToProcess) {
        console.log(`--> Processing ${inv.invoice_number} via Risk Engine...`);
        const result = await riskEngineService.evaluateRisk(
            inv.lender_id, 
            inv.id, 
            inv.supplier_id, 
            inv.buyer_id, 
            inv.amount, 
            inv.invoice_date, 
            inv.expected_payment_date,
            0, // basePoints
            [] // baseBreakdown
        );
        console.log(`    [RESULT] Status: ${result.status}, Score: ${result.riskScore}`);
    }

    console.log("-> Engine-Driven Seed Complete!");
    process.exit(0);
  } catch (err) {
    console.error("Seed Failed:", err);
    process.exit(1);
  }
}

seedEngineDrivenData();
