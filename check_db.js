const pool = require('./db/index');
async function check() {
  try {
    console.log('--- TRADE RELATIONSHIPS ---');
    const tr = await pool.query('SELECT supplier_id, buyer_id, goods_category, lender_id FROM trade_relationships');
    tr.rows.forEach(r => console.log(`${r.supplier_id} -> ${r.buyer_id} [${r.goods_category}] (Lender: ${r.lender_id})`));
    
    console.log('\n--- RECENT INVOICES ---');
    const inv = await pool.query('SELECT id, status, risk_score, goods_category, supplier_id, buyer_id FROM invoices ORDER BY id DESC LIMIT 10');
    inv.rows.forEach(r => console.log(`INV ${r.id}: ${r.supplier_id} -> ${r.buyer_id} [${r.goods_category}] Status: ${r.status} Score: ${r.risk_score}`));
    
    // Check companies
    console.log('\n--- COMPANIES ---');
    const comp = await pool.query('SELECT id, name FROM companies WHERE id IN (3, 8, 9)');
    comp.rows.forEach(r => console.log(`${r.id}: ${r.name}`));

    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}
check();
