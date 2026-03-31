require('dotenv').config();
const { Pool } = require('pg');
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function check() {
    try {
        const lenderId = 1;
        const invCount = await pool.query('SELECT COUNT(*) FROM invoices WHERE lender_id = $1', [lenderId]);
        const poCount = await pool.query('SELECT COUNT(*) FROM purchase_orders WHERE lender_id = $1', [lenderId]);
        const compCount = await pool.query('SELECT COUNT(*) FROM companies WHERE lender_id = $1', [lenderId]);
        
        console.log(JSON.stringify({
            lenderId: 1,
            invoices: invCount.rows[0].count,
            pos: poCount.rows[0].count,
            companies: compCount.rows[0].count
        }, null, 2));
    } catch (e) {
        console.error(e.message);
    } finally {
        await pool.end();
    }
}

check();
