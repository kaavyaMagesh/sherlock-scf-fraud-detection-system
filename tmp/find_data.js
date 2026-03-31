const { Pool } = require('pg');
const dotenv = require('dotenv');
dotenv.config();

const pool = new Pool({
    connectionString: process.env.DATABASE_URL
});

async function findData() {
    try {
        const res = await pool.query(`
            SELECT po.id as po_id, grn.id as grn_id, po.buyer_id, po.supplier_id 
            FROM purchase_orders po 
            JOIN goods_receipts grn ON po.id = grn.po_id 
            WHERE po.supplier_id = 3 
            LIMIT 1;
        `);
        console.log(JSON.stringify(res.rows[0]));
    } catch (e) {
        console.error(e);
    } finally {
        await pool.end();
    }
}

findData();
