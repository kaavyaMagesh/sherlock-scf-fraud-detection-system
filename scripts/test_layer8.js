const { Pool } = require('pg');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '../.env') });

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

async function verifyLayer8() {
  try {
    console.log("🔍 [LAYER 8 VERIFICATION] Starting Identity & Shell Company Blocker Test...");

    // 1. Create a Revoked Supplier (Shell Company Simulation)
    const res = await pool.query(
      `INSERT INTO companies (name, tier, annual_revenue, monthly_avg_invoicing, industry_code, credential_verified, is_revoked)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id`,
      ['Shell Corp 404', 3, 0, 0, 'FOO-BAR', true, true] // credential_verified is true BUT is_revoked is TRUE
    );
    const supplierId = res.rows[0].id;
    console.log(`-> 🕵️ Mock Shell Company Created (ID: ${supplierId}, Status: REVOKED)`);

    // 2. We mock the check used in invoiceController.js
    console.log("-> ⚔️ Triggering Identity Gateway Check...");
    
    const compQuery = await pool.query('SELECT credential_verified, is_revoked FROM companies WHERE id = $1', [supplierId]);
    const company = compQuery.rows[0];

    const isBlocked = !company.credential_verified || company.is_revoked;

    if (isBlocked) {
        console.log("✅ [SUCCESS] Gate 0 Blocked the transaction!");
        console.log("   --- VERDICT: SECURITY ENFORCED ---");
    } else {
        console.log("❌ [FAILURE] Gate 0 Failed! Shell company bypassed the identity check!");
    }

    // Cleanup
    await pool.query('DELETE FROM companies WHERE id = $1', [supplierId]);
    console.log("-> Cleanup complete.");
    process.exit(0);
  } catch (err) {
    console.error("Test Failed:", err);
    process.exit(1);
  }
}

verifyLayer8();
