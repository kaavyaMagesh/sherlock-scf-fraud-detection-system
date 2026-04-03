const { Pool } = require('pg');
const bcrypt = require('bcrypt');
const dotenv = require('dotenv');

dotenv.config({ path: '../.env' });

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || "postgresql://neondb_owner:npg_EG7XaOHL6FSZ@ep-snowy-violet-a15qdjeb-pooler.ap-southeast-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require",
});

const generatePasswordHash = async (password) => {
    return await bcrypt.hash(password, 10);
};

const seedERPData = async () => {
  try {
    const passwordHash = await generatePasswordHash('password123');

    // 1. Seed Lenders
    console.log("Seeding lenders...");
    const lender1Res = await pool.query(`INSERT INTO lenders (name) VALUES ('HDFC Bank') RETURNING id`);
    const lender2Res = await pool.query(`INSERT INTO lenders (name) VALUES ('ICICI Bank') RETURNING id`);
    const lenderId1 = lender1Res.rows[0].id;
    const lenderId2 = lender2Res.rows[0].id;

    // Lender Users
    await pool.query(`INSERT INTO portal_users (lender_id, role, email, password_hash) VALUES ($1, 'LENDER', 'lender1@hdfc.com', $2)`, [lenderId1, passwordHash]);
    await pool.query(`INSERT INTO portal_users (lender_id, role, email, password_hash) VALUES ($1, 'LENDER', 'lender2@icici.com', $2)`, [lenderId2, passwordHash]);

    // 2. Seed Buyers
    console.log("Seeding buyers...");
    const buyerNames = ['Tata Motors', 'Reliance Industries', 'Maruti Suzuki'];
    const buyerIds = [];
    for (const name of buyerNames) {
        const res = await pool.query(
            `INSERT INTO companies (lender_id, name, tier, role, industry_code, credential_verified) VALUES ($1, $2, 1, 'BUYER', 'MFG', true) RETURNING id`,
            [lenderId1, name]
        );
        const bId = res.rows[0].id;
        buyerIds.push(bId);
        await pool.query(
            `INSERT INTO portal_users (company_id, lender_id, role, email, password_hash) VALUES ($1, $2, 'BUYER', $3, $4)`, 
            [bId, lenderId1, `buyer@${name.replace(/\s+/g, '').toLowerCase()}.com`, passwordHash]
        );
    }

    // 3. Seed Suppliers
    console.log("Seeding suppliers...");
    const supplierNames = ['Bosch India', 'Motherson Sumi', 'Endurance Tech', 'Bharat Forge'];
    const supplierIds = [];
    for (const name of supplierNames) {
        const res = await pool.query(
            `INSERT INTO companies (lender_id, name, tier, role, industry_code, credential_verified) VALUES ($1, $2, 2, 'SUPPLIER', 'MFG', true) RETURNING id`,
            [lenderId1, name]
        );
        const sId = res.rows[0].id;
        supplierIds.push(sId);
        await pool.query(
            `INSERT INTO portal_users (company_id, lender_id, role, email, password_hash) VALUES ($1, $2, 'SUPPLIER', $3, $4)`, 
            [sId, lenderId1, `supplier@${name.replace(/\s+/g, '').toLowerCase()}.com`, passwordHash]
        );
    }

    // 4. Seed POs
    console.log("Seeding POs, GRNs, Deliveries...");
    // Create ~10 POs
    for (let i = 1; i <= 10; i++) {
        const buyerId = buyerIds[i % buyerIds.length];
        const supplierId = supplierIds[i % supplierIds.length];
        const amount = Math.floor(Math.random() * 500000) + 50000;
        const quantity = Math.floor(Math.random() * 500) + 50;

        const poRes = await pool.query(
            `INSERT INTO purchase_orders (lender_id, buyer_id, supplier_id, amount, quantity, po_date, goods_category) VALUES ($1, $2, $3, $4, $5, NOW() - INTERVAL '${30 - i} days', 'Auto Parts') RETURNING id`,
            [lenderId1, buyerId, supplierId, amount, quantity]
        );
        const poId = poRes.rows[0].id;

        // Leave 2-3 without GRNs/deliveries
        if (i <= 7) {
            const grnRes = await pool.query(
                `INSERT INTO goods_receipts (lender_id, po_id, amount_received, quantity, grn_date) VALUES ($1, $2, $3, $4, NOW() - INTERVAL '${25 - i} days') RETURNING id`,
                [lenderId1, poId, amount, quantity] // Perfect match
            );
            const grnId = grnRes.rows[0].id;

            // Deliveries matching most of them
            if (i <= 5) {
                await pool.query(
                    `INSERT INTO delivery_confirmations (grn_id, lender_id, confirmed_by, delivery_date, delivery_status, notes) VALUES ($1, $2, 'Logistics Officer', NOW() - INTERVAL '${24 - i} days', 'DELIVERED', 'All goods verified')`,
                    [grnId, lenderId1]
                );
            } else if (i === 6) {
                // One rejected
                await pool.query(
                    `INSERT INTO delivery_confirmations (grn_id, lender_id, confirmed_by, delivery_date, delivery_status, notes) VALUES ($1, $2, 'Quality Checks', NOW() - INTERVAL '${24 - i} days', 'REJECTED', 'Damaged goods')`,
                    [grnId, lenderId1]
                );
            }
            // PO 7 has GRN but no delivery yet.

            // 5. Seed Invoices for the first few complete chains
            if (i <= 4) {
                await pool.query(
                    `INSERT INTO invoices (lender_id, invoice_number, po_id, grn_id, supplier_id, buyer_id, amount, goods_category, invoice_date, expected_payment_date, status, risk_score) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW() - INTERVAL '${23 - i} days', NOW() + INTERVAL '30 days', 'PENDING', 0)`,
                    [lenderId1, 'INV-' + (1000 + i), poId, grnId, supplierId, buyerId, amount, 'Auto Parts']
                );
            }
        }
    }

    console.log("Seed data inserted successfully!");
  } catch (err) {
    console.error("Error seeding ERP data:", err);
  } finally {
    pool.end();
  }
};

seedERPData();
