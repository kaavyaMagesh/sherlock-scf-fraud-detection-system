const { Pool } = require('pg');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '../.env') });

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || "postgresql://neondb_owner:npg_EG7XaOHL6FSZ@ep-snowy-violet-a15qdjeb-pooler.ap-southeast-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require",
});

const migrate = async () => {
  const queries = [
    // 1. Add parent_po_id to purchase_orders
    `ALTER TABLE purchase_orders ADD COLUMN IF NOT EXISTS parent_po_id INTEGER REFERENCES purchase_orders(id);`,
    
    // 2. Add receipt_date to goods_receipts
    `ALTER TABLE goods_receipts ADD COLUMN IF NOT EXISTS receipt_date TIMESTAMP;`,
    
    // 3. Ensure annual_revenue exists in companies (already in init_schema but for safety)
    `ALTER TABLE companies ADD COLUMN IF NOT EXISTS annual_revenue NUMERIC(15,2);`,

    // 4. Create disputes table
    `CREATE TABLE IF NOT EXISTS disputes (
      id SERIAL PRIMARY KEY,
      invoice_id INTEGER REFERENCES invoices(id),
      lender_id INTEGER REFERENCES lenders(id),
      dispute_reason VARCHAR(50), -- GOODS_RETURNED, QUALITY_ISSUE, QUANTITY_MISMATCH, FRAUDULENT
      dispute_notes TEXT,
      disputed_at TIMESTAMP DEFAULT NOW()
    );`
  ];

  try {
    for (const q of queries) {
      console.log(`Executing: ${q.substring(0, 50)}...`);
      await pool.query(q);
    }
    console.log("Migration successful!");
  } catch (error) {
    console.error("Migration failed:", error);
  } finally {
    await pool.end();
  }
};

migrate();
