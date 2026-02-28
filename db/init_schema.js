const { Pool } = require('pg');
const dotenv = require('dotenv');

dotenv.config({ path: '../.env' }); // Make sure we grab it from one level up just in case, or root
// Actually process.cwd() will be root if run from index.js directory

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || "postgresql://neondb_owner:npg_EG7XaOHL6FSZ@ep-snowy-violet-a15qdjeb-pooler.ap-southeast-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require",
});

const executeSchema = async () => {
  const ddl = `
    DROP TABLE IF EXISTS manual_overrides, explanations, alerts, risk_score_audits, settlements, invoice_fingerprints, invoices, goods_receipts, purchase_orders, trade_relationships, companies, lenders CASCADE;

    CREATE TABLE IF NOT EXISTS lenders (
      id SERIAL PRIMARY KEY,
      name VARCHAR(255) NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS companies (
      id SERIAL PRIMARY KEY,
      lender_id INTEGER REFERENCES lenders(id),
      name VARCHAR(255),
      tier INTEGER,
      annual_revenue NUMERIC(15,2),
      monthly_avg_invoicing NUMERIC(15,2),
      first_invoice_date TIMESTAMP,
      last_invoice_date TIMESTAMP,
      industry_code VARCHAR(20),
      did VARCHAR(255) UNIQUE,
      verifiable_credential TEXT,
      credential_verified BOOLEAN DEFAULT FALSE,
      is_revoked BOOLEAN DEFAULT FALSE,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS trade_relationships (
      id SERIAL PRIMARY KEY,
      lender_id INTEGER REFERENCES lenders(id),
      supplier_id INTEGER REFERENCES companies(id),
      buyer_id INTEGER REFERENCES companies(id),
      first_trade_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      last_seen TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      total_volume NUMERIC(15,2) DEFAULT 0,
      invoice_count INTEGER DEFAULT 0,
      tier INTEGER,
      goods_category VARCHAR(100),
      UNIQUE(supplier_id, buyer_id, lender_id)
    );

    CREATE TABLE IF NOT EXISTS purchase_orders (
      id SERIAL PRIMARY KEY,
      lender_id INTEGER REFERENCES lenders(id),
      root_po_id INTEGER,
      buyer_id INTEGER REFERENCES companies(id),
      supplier_id INTEGER REFERENCES companies(id),
      amount NUMERIC(15,2),
      goods_category VARCHAR(100),
      po_date TIMESTAMP,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS goods_receipts (
      id SERIAL PRIMARY KEY,
      lender_id INTEGER REFERENCES lenders(id),
      po_id INTEGER REFERENCES purchase_orders(id),
      amount_received DECIMAL,
      grn_date TIMESTAMP,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS invoices (
      id SERIAL PRIMARY KEY,
      lender_id INTEGER REFERENCES lenders(id),
      invoice_number VARCHAR,
      po_id INTEGER REFERENCES purchase_orders(id),
      grn_id INTEGER REFERENCES goods_receipts(id),
      supplier_id INTEGER REFERENCES companies(id),
      buyer_id INTEGER REFERENCES companies(id),
      amount NUMERIC(15,2),
      goods_category VARCHAR(100),
      invoice_date TIMESTAMP,
      expected_payment_date TIMESTAMP,
      status VARCHAR(20) DEFAULT 'PENDING',
      risk_score INTEGER,
      created_at TIMESTAMP DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS invoice_fingerprints (
      id SERIAL PRIMARY KEY,
      fingerprint VARCHAR(64) UNIQUE,
      invoice_id INTEGER REFERENCES invoices(id),
      lender_id INTEGER REFERENCES lenders(id),
      created_at TIMESTAMP DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS settlements (
      id SERIAL PRIMARY KEY,
      invoice_id INTEGER REFERENCES invoices(id),
      actual_payment_amount DECIMAL,
      payment_date TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS risk_score_audits (
      id SERIAL PRIMARY KEY,
      invoice_id INTEGER REFERENCES invoices(id),
      score INTEGER,
      breakdown JSONB,
      created_at TIMESTAMP DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS alerts (
      id SERIAL PRIMARY KEY,
      invoice_id INTEGER REFERENCES invoices(id),
      lender_id INTEGER REFERENCES lenders(id),
      severity VARCHAR(20), -- INFO / WARNING / CRITICAL / BLOCKED
      fraud_rule VARCHAR(50),
      message TEXT,
      created_at TIMESTAMP DEFAULT NOW(),
      resolved BOOLEAN DEFAULT FALSE
    );

    CREATE TABLE IF NOT EXISTS explanations (
      id SERIAL PRIMARY KEY,
      invoice_id INTEGER REFERENCES invoices(id),
      factor_breakdown JSONB,
      counterfactual TEXT,
      impatience_signal TEXT,
      fraud_dna JSONB,
      created_at TIMESTAMP DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS manual_overrides (
      id SERIAL PRIMARY KEY,
      invoice_id INTEGER REFERENCES invoices(id),
      reason_log TEXT NOT NULL,
      auditor_id VARCHAR(255),
      created_at TIMESTAMP DEFAULT NOW()
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
