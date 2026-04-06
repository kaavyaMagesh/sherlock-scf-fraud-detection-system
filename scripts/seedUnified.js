const { Pool } = require('pg');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '../.env') });

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

const riskEngineService = require('../services/riskEngineService');
const explainabilityService = require('../services/explainabilityService');
const validationService = require('../services/validationService');

async function seedUnified() {
  const { faker } = await import('@faker-js/faker');
  console.log('--- STARTING UNIFIED HIGH-FIDELITY SEEDING ---');
  
  try {
    // 1. Resolve IDs for seeding
    const lenderRes = await pool.query("SELECT id FROM lenders WHERE name = 'HDFC Bank' LIMIT 1");
    const lenderId = lenderRes.rows.length > 0 ? lenderRes.rows[0].id : 1;

    const tataRes = await pool.query("SELECT id FROM companies WHERE name = 'Tata Motors' LIMIT 1");
    const buyerId = tataRes.rows.length > 0 ? tataRes.rows[0].id : 1;

    const boschRes = await pool.query("SELECT id FROM companies WHERE name = 'Bosch India' LIMIT 1");
    const supplierId = boschRes.rows.length > 0 ? boschRes.rows[0].id : 4;

    console.log(`Targeting Lender(${lenderId}), Buyer(${buyerId}), Supplier(${supplierId})`);

    const categories = {
      APPROVED: { count: 5, color: '\x1b[32m' },
      REVIEW: { count: 5, color: '\x1b[33m' },
      BLOCKED: { count: 5, color: '\x1b[31m' }
    };

    for (const [type, cfg] of Object.entries(categories)) {
      console.log(`${cfg.color}Generating ${cfg.count} ${type} cases...\x1b[0m`);
      
      for (let i = 0; i < cfg.count; i++) {
        let amount = faker.number.int({ min: 100000, max: 900000 });
        let qty = faker.number.int({ min: 50, max: 200 });
        let poDesc = 'Precision Auto Parts';
        let invDesc = 'Precision Auto Parts';
        let poLoc = 'Pune, Maharashtra';
        let invLoc = 'Pune, Maharashtra';
        let poTerms = 'Net 30';
        let invTerms = 'Net 30';
        let invNo = `${type}-${faker.string.alphanumeric(6).toUpperCase()}`;
        let invDate = new Date();
        invDate.setDate(invDate.getDate() - 2);

        // Modify parameters based on type to hit thresholds
        if (type === 'REVIEW') {
          amount = 600000; 
          invTerms = 'Net 90'; 
        } else if (type === 'BLOCKED') {
          if (i === 0) {
            // Phantom Invoice (Handled by poId = null below)
            invNo = `PHANTOM-${invNo}`;
          } else if (i === 1) {
            // Semantic Mismatch
            poDesc = 'Grade-A Steel Sheets';
            invDesc = 'Mixed Industrial Scrap';
          } else if (i === 2) {
            // Geographical Anomaly
            invLoc = 'Apartment Complex B, Residential Zone, Delhi';
          } else if (i === 3) {
            // Bot/Sequential Pattern
            invNo = `SEQ-100${i}`;
          } else {
            // Duplicate
            invNo = 'DUPE-EXACT-999';
          }
        }

        // --- STEP 1: PO ---
        let poId = null;
        if (type !== 'BLOCKED' || i !== 0) {
          const poRes = await pool.query(
            `INSERT INTO purchase_orders (lender_id, buyer_id, supplier_id, amount, quantity, po_date, goods_category, delivery_location, payment_terms) 
             VALUES ($1, $2, $3, $4, $5, NOW() - INTERVAL '15 days', $6, $7, $8) RETURNING id`,
            [lenderId, buyerId, supplierId, amount, qty, poDesc, poLoc, poTerms]
          );
          poId = poRes.rows[0].id;
        }

        // --- STEP 2: GRN ---
        let grnId = null;
        if (poId) {
          const grnRes = await pool.query(
            `INSERT INTO goods_receipts (lender_id, po_id, amount_received, quantity, grn_date) 
             VALUES ($1, $2, $3, $4, NOW() - INTERVAL '5 days') RETURNING id`,
            [lenderId, poId, amount, qty]
          );
          grnId = grnRes.rows[0].id;
        }

        // --- STEP 3: INVOICE ---
        const invRes = await pool.query(
          `INSERT INTO invoices (lender_id, invoice_number, po_id, grn_id, supplier_id, buyer_id, amount, goods_category, delivery_location, payment_terms, invoice_date, expected_payment_date, status, risk_score) 
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, NOW() + INTERVAL '28 days', 'PENDING', 0) RETURNING id`,
          [lenderId, invNo, poId, grnId, supplierId, buyerId, amount, invDesc, invLoc, invTerms, invDate]
        );
        const invId = invRes.rows[0].id;

        // --- STEP 4: LAYER 1 & 2 VALIDATION ---
        const fingerprint = validationService.generateFingerprint(supplierId, buyerId, invNo, amount, invDate);
        
        // 4a. Check Duplicates
        const dupeResult = await validationService.detectDuplicates(lenderId, fingerprint, supplierId, buyerId, amount, invDate, invNo);
        
        // 4b. Check Triple Match
        const tripleResult = await validationService.checkTripleMatch(lenderId, poId, amount, invDate, supplierId, buyerId, invNo);

        // --- STEP 5: INTEGRATED RISK EVALUATION ---
        const basePoints = dupeResult.points + tripleResult.points;
        const baseBreakdown = [...dupeResult.breakdown, ...tripleResult.breakdown];

        const result = await riskEngineService.evaluateRisk(
          lenderId, invId, supplierId, buyerId, amount, invDate, new Date(), basePoints, baseBreakdown, { triggerAI: false }
        );
        
        // --- STEP 6: PERSISTENCE ---
        // 6a. Insert Fingerprint (CRITICAL for baseline engine)
        await pool.query(
          'INSERT INTO invoice_fingerprints (invoice_id, lender_id, fingerprint) VALUES ($1, $2, $3)',
          [invId, lenderId, fingerprint]
        );

        // 6b. Generate Layer 7 Explanation
        await explainabilityService.generateExplanation(invId, result);

        console.log(`  -> Saved ${invNo} (ID: ${invId}) - Score: ${result.riskScore} [${result.status}]`);
      }
    }

    console.log('--- UNIFIED SEEDING COMPLETED ---');
  } catch (err) {
    console.error('--- SEEDING FAILED ---');
    console.error(err);
  } finally {
    await pool.end();
  }
}

seedUnified();
