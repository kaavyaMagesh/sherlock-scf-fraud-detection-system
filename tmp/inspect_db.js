const { Pool } = require('pg');
require('dotenv').config();
const pool = new Pool({
    connectionString: process.env.DATABASE_URL ||
        'postgresql://neondb_owner:npg_EG7XaOHL6FSZ@ep-snowy-violet-a15qdjeb-pooler.ap-southeast-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require',
});

(async () => {
    const buyers = await pool.query(
        `SELECT pu.company_id, pu.email, c.name
         FROM portal_users pu JOIN companies c ON c.id = pu.company_id
         WHERE pu.role = 'BUYER' ORDER BY pu.id LIMIT 3`
    );
    buyers.rows.forEach(x => process.stdout.write('BUYER:' + x.company_id + ':' + x.email + ':' + x.name + '\n'));

    const invs = await pool.query(`SELECT id, buyer_id, supplier_id, lender_id FROM invoices ORDER BY id`);
    invs.rows.forEach(x => process.stdout.write('INV:' + x.id + ':buyer=' + x.buyer_id + ':sup=' + x.supplier_id + ':lender=' + x.lender_id + '\n'));

    await pool.end();
})().catch(e => { process.stdout.write('ERR:' + e.message + '\n'); process.exit(1); });
