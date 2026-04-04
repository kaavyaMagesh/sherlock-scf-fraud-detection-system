const { Pool } = require('pg');
const pool = new Pool({
  connectionString: 'postgresql://neondb_owner:npg_EG7XaOHL6FSZ@ep-snowy-violet-a15qdjeb-pooler.ap-southeast-1.aws.neon.tech/neondb?sslmode=require'
});

async function run() {
  console.log('Fetching suppliers and buyers...');
  const suppliersRes = await pool.query('SELECT id, name FROM companies LIMIT 10');
  const buyersRes = await pool.query('SELECT id, name FROM companies OFFSET 10 LIMIT 5');
  const lenderRes = await pool.query("SELECT id FROM lenders WHERE name = 'HDFC Bank' LIMIT 1");
  
  if (suppliersRes.rows.length === 0 || buyersRes.rows.length === 0 || lenderRes.rows.length === 0) {
    console.error('Missing initial data. Please ensure DB is initialized.');
    process.exit(1);
  }
  
  const suppliers = suppliersRes.rows;
  const buyers = buyersRes.rows;
  const lenderId = lenderRes.rows[0].id;
  
  console.log('Inserting 10 invoices per supplier...');
  let count = 0;
  
  await pool.query('BEGIN');
  try {
    for (const supplier of suppliers) {
      for (let i = 0; i < 10; i++) {
        const buyer = buyers[Math.floor(Math.random() * buyers.length)];
        const amt = Math.floor(Math.random() * 90000) + 10000;
        
        const poDate = new Date(Date.now() - Math.floor(Math.random() * 30) * 86400000);
        const grnDate = new Date(poDate.getTime() + 5 * 86400000);
        const invDate = new Date(grnDate.getTime() + 2 * 86400000);
        
        const poRes = await pool.query(
            'INSERT INTO purchase_orders (lender_id, buyer_id, supplier_id, amount, po_date, goods_category) VALUES ($1, $2, $3, $4, $5, $6) RETURNING id',
            [lenderId, buyer.id, supplier.id, amt * 1.02, poDate, 'General Trade']
        );
        
        const grnRes = await pool.query(
            'INSERT INTO goods_receipts (lender_id, po_id, amount_received, grn_date) VALUES ($1, $2, $3, $4) RETURNING id',
            [lenderId, poRes.rows[0].id, amt, grnDate]
        );
        
        const invStr = Math.floor(Math.random() * 900000) + 100000;
        await pool.query(
            'INSERT INTO invoices (lender_id, invoice_number, po_id, grn_id, supplier_id, buyer_id, amount, invoice_date, expected_payment_date, status, risk_score, goods_category) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)',
            [lenderId, `BULK-${invStr}`, poRes.rows[0].id, grnRes.rows[0].id, supplier.id, buyer.id, amt, invDate, new Date(invDate.getTime() + 30 * 86400000), 'APPROVED', 15, 'General Trade']
        );
        
        count++;
      }
    }
    await pool.query('COMMIT');
    console.log('Successfully inserted ' + count + ' invoices!');
  } catch (err) {
    await pool.query('ROLLBACK');
    console.error('Error during insert:', err);
  } finally {
    pool.end();
  }
}

run();
