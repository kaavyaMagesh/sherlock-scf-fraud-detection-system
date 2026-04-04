const { Pool } = require('pg');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '../.env') });

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

const riskEngineService = require('../services/riskEngineService');

async function seedSafe() {
  console.log('--- STARTING SAFE SEMANTIC ENRICHMENT ---');
  
  try {
    // 1. Resolve IDs
    const lenderRes = await pool.query("SELECT id FROM lenders WHERE name = 'HDFC Bank' LIMIT 1");
    if (lenderRes.rows.length === 0) throw new Error('HDFC Bank not found');
    const lenderId = lenderRes.rows[0].id;

    const buyerRes = await pool.query("SELECT id FROM companies WHERE name = 'Tata Motors' LIMIT 1");
    if (buyerRes.rows.length === 0) throw new Error('Tata Motors not found');
    const buyerId = buyerRes.rows[0].id;

    const supplierRes = await pool.query("SELECT id FROM companies WHERE name = 'Bosch India' LIMIT 1");
    if (supplierRes.rows.length === 0) throw new Error('Bosch India not found');
    const supplierId = supplierRes.rows[0].id;

    console.log(`Found IDs: Lender(${lenderId}), Buyer(${buyerId}), Supplier(${supplierId})`);

    // 2. Insert Minimal High-Fidelity Cases
    
    // Case A: Perfect Match (All Good)
    console.log('Inserting Case A: Perfect Match...');
    const poARes = await pool.query(
      `INSERT INTO purchase_orders (lender_id, buyer_id, supplier_id, amount, quantity, po_date, goods_category, delivery_location, payment_terms) 
       VALUES ($1, $2, $3, 150000, 100, NOW() - INTERVAL '10 days', 'Precision Brake Pads', 'Bosch Factory, Pune', 'Net 30') RETURNING id`,
      [lenderId, buyerId, supplierId]
    );
    const poAId = poARes.rows[0].id;

    const grnARes = await pool.query(
      `INSERT INTO goods_receipts (lender_id, po_id, amount_received, quantity, grn_date) 
       VALUES ($1, $2, 150000, 100, NOW() - INTERVAL '5 days') RETURNING id`,
      [lenderId, poAId]
    );
    const grnAId = grnARes.rows[0].id;

    const invARes = await pool.query(
      `INSERT INTO invoices (lender_id, invoice_number, po_id, grn_id, supplier_id, buyer_id, amount, goods_category, delivery_location, payment_terms, invoice_date, expected_payment_date, status, risk_score) 
       VALUES ($1, $2, $3, $4, $5, $6, 150000, 'Precision Brake Pads', 'Bosch Factory, Pune', 'Net 30', NOW() - INTERVAL '2 days', NOW() + INTERVAL '28 days', 'PENDING', 0) RETURNING id`,
      [lenderId, 'INV-A-101', poAId, grnAId, supplierId, buyerId]
    );
    const invAId = invARes.rows[0].id;


    // Case B: Semantic Mismatch (Steel vs Scrap)
    console.log('Inserting Case B: Semantic Mismatch...');
    const poBRes = await pool.query(
      `INSERT INTO purchase_orders (lender_id, buyer_id, supplier_id, amount, quantity, po_date, goods_category, delivery_location, payment_terms) 
       VALUES ($1, $2, $3, 850000, 50, NOW() - INTERVAL '15 days', 'High-Grade CRCA Steel Sheets', 'Tata Motors Plant, Jamshedpur', 'Net 45') RETURNING id`,
      [lenderId, buyerId, supplierId]
    );
    const poBId = poBRes.rows[0].id;

    const grnBRes = await pool.query(
      `INSERT INTO goods_receipts (lender_id, po_id, amount_received, quantity, grn_date) 
       VALUES ($1, $2, 850000, 50, NOW() - INTERVAL '10 days') RETURNING id`,
      [lenderId, poBId]
    );
    const grnBId = grnBRes.rows[0].id;

    const invBRes = await pool.query(
      `INSERT INTO invoices (lender_id, invoice_number, po_id, grn_id, supplier_id, buyer_id, amount, goods_category, delivery_location, payment_terms, invoice_date, expected_payment_date, status, risk_score) 
       VALUES ($1, $2, $3, $4, $5, $6, 850000, 'Industrial Steel Scrap & Offcuts', 'Tata Motors Plant, Jamshedpur', 'Net 45', NOW() - INTERVAL '5 days', NOW() + INTERVAL '40 days', 'PENDING', 0) RETURNING id`,
      [lenderId, 'INV-B-999', poBId, grnBId, supplierId, buyerId]
    );
    const invBId = invBRes.rows[0].id;

    // Case C: Geographical Anomaly
    console.log('Inserting Case C: Geographical Anomaly...');
    const poCRes = await pool.query(
      `INSERT INTO purchase_orders (lender_id, buyer_id, supplier_id, amount, quantity, po_date, goods_category, delivery_location, payment_terms) 
       VALUES ($1, $2, $3, 200000, 20, NOW() - INTERVAL '20 days', 'Engine Control Units', 'Tata Motors R&D, Pune', 'Net 60') RETURNING id`,
      [lenderId, buyerId, supplierId]
    );
    const poCId = poCRes.rows[0].id;

    const grnCRes = await pool.query(
      `INSERT INTO goods_receipts (lender_id, po_id, amount_received, quantity, grn_date) 
       VALUES ($1, $2, 200000, 20, NOW() - INTERVAL '15 days') RETURNING id`,
      [lenderId, poCId]
    );
    const grnCId = grnCRes.rows[0].id;

    const invCRes = await pool.query(
      `INSERT INTO invoices (lender_id, invoice_number, po_id, grn_id, supplier_id, buyer_id, amount, goods_category, delivery_location, payment_terms, invoice_date, expected_payment_date, status, risk_score) 
       VALUES ($1, $2, $3, $4, $5, $6, 200000, 'Engine Control Units', 'Apartment Complex B, Building 4, Bengaluru', 'Net 60', NOW() - INTERVAL '5 days', NOW() + INTERVAL '55 days', 'PENDING', 0) RETURNING id`,
      [lenderId, 'INV-C-ANOM', poCId, grnCId, supplierId, buyerId]
    );
    const invCId = invCRes.rows[0].id;

    console.log('Starting sequential Risk Engine Evaluation...');
    
    // Evaluate sequentially to avoid API rate limits
    const invoicesToEvaluate = [invAId, invBId, invCId];
    for (const invId of invoicesToEvaluate) {
        console.log(`Evaluating Risk for Invoice ID: ${invId}...`);
        try {
            // Need to fetch details for risk engine
            const inv = (await pool.query('SELECT * FROM invoices WHERE id = $1', [invId])).rows[0];
            await riskEngineService.evaluateRisk(
                lenderId, invId, supplierId, buyerId, inv.amount, inv.invoice_date, inv.expected_payment_date, 0, []
            );
            console.log(`Successfully evaluated Invoice ${invId}`);
            // Small delay to be safe
            await new Promise(resolve => setTimeout(resolve, 1000));
        } catch (err) {
            console.error(`Evaluation failed for Invoice ${invId}:`, err.message);
        }
    }

    console.log('--- ENRICHMENT COMPLETED SUCCESSFULLY ---');
  } catch (err) {
    console.error('--- ENRICHMENT FAILED ---');
    console.error(err);
  } finally {
    await pool.end();
  }
}

seedSafe();
