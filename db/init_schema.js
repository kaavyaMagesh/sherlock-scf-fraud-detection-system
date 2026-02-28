const { Pool } = require('pg');
const dotenv = require('dotenv');

dotenv.config({ path: '../.env' }); // Make sure we grab it from one level up just in case, or root
// Actually process.cwd() will be root if run from index.js directory

const pool = new Pool({
    connectionString: process.env.DATABASE_URL || "postgresql://neondb_owner:npg_EG7XaOHL6FSZ@ep-snowy-violet-a15qdjeb-pooler.ap-southeast-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require",
});

const executeSchema = async () => {
    const ddl = `
    CREATE TABLE IF NOT EXISTS companies (
      id UUID PRIMARY KEY,
      name VARCHAR,
      tier INTEGER,
      annual_revenue DECIMAL,
      avg_monthly_invoicing DECIMAL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS trade_relationships (
      id UUID PRIMARY KEY,
      supplier_id UUID REFERENCES companies(id),
      buyer_id UUID REFERENCES companies(id),
      first_trade_date TIMESTAMP,
      total_volume DECIMAL,
      invoice_count INTEGER
    );

    CREATE TABLE IF NOT EXISTS purchase_orders (
      id UUID PRIMARY KEY,
      root_po_id UUID,
      buyer_id UUID REFERENCES companies(id),
      supplier_id UUID REFERENCES companies(id),
      amount DECIMAL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS goods_receipts (
      id UUID PRIMARY KEY,
      po_id UUID REFERENCES purchase_orders(id),
      amount_received DECIMAL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS invoices (
      id UUID PRIMARY KEY,
      invoice_number VARCHAR,
      po_id UUID REFERENCES purchase_orders(id),
      grn_id UUID REFERENCES goods_receipts(id),
      supplier_id UUID REFERENCES companies(id),
      buyer_id UUID REFERENCES companies(id),
      amount DECIMAL,
      expected_payment_date TIMESTAMP,
      created_at TIMESTAMP DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS invoice_fingerprints (
      id UUID PRIMARY KEY,
      invoice_id UUID REFERENCES invoices(id),
      lender_id VARCHAR,
      fingerprint_hash VARCHAR UNIQUE,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS settlements (
      id UUID PRIMARY KEY,
      invoice_id UUID REFERENCES invoices(id),
      actual_payment_amount DECIMAL,
      payment_date TIMESTAMP
    );
  `;

    try {
        await pool.query(ddl);
        console.log("Database Schema Initialized Successfully!");
    } catch (error) {
        console.error("Error creating tables:", error);
    } finally {
        await pool.end();
    }
};

executeSchema();
