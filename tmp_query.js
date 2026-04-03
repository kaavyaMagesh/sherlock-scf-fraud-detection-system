const pool = require('./db/index');
const fs = require('fs');

async function run() {
  try {
      const out = [];
      out.push("--- 1. Purchase Orders (DESC 5) ---");
      const res1 = await pool.query("SELECT id, buyer_id, supplier_id, lender_id, amount, goods_category FROM purchase_orders ORDER BY id DESC LIMIT 5;");
      out.push(JSON.stringify(res1.rows, null, 2));

      out.push("\n--- 2. Companies ---");
      const res2 = await pool.query("SELECT id, name, role FROM companies;");
      out.push(JSON.stringify(res2.rows, null, 2));

      let boschCorp = res2.rows.find(r => r.name.toLowerCase().includes('bosch'));
      if(boschCorp) {
          out.push(`\n--- 3. POs for Bosch (id: ${boschCorp.id}) ---`);
          const res3 = await pool.query(`SELECT id, buyer_id, supplier_id, lender_id FROM purchase_orders WHERE supplier_id = $1;`, [boschCorp.id]);
          out.push(JSON.stringify(res3.rows, null, 2));
      }

      out.push("\n--- 4. Portal Users ---");
      const res4 = await pool.query("SELECT id, company_id, lender_id, role, email FROM portal_users;");
      out.push(JSON.stringify(res4.rows, null, 2));
      
      fs.writeFileSync('output.json', out.join('\n'));
  } catch (err) {
      console.error(err);
  } finally {
      pool.end();
  }
}
run();
