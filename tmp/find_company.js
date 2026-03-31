const { Pool } = require('pg');
const dotenv = require('dotenv');
dotenv.config();

const pool = new Pool({
    connectionString: process.env.DATABASE_URL
});

async function findCompany() {
    try {
        const res = await pool.query('SELECT id, name FROM companies WHERE credential_verified = true AND is_revoked = false LIMIT 1;');
        console.log(JSON.stringify(res.rows[0]));
    } catch (e) {
        console.error(e);
    } finally {
        await pool.end();
    }
}

findCompany();
