const pool = require('./db/index');
async function run() {
    const res = await pool.query("SELECT id, name, lender_id FROM companies WHERE (name LIKE 'Global%' OR name LIKE 'Silent%')");
    console.log('Fraud providers found:', res.rows);
    await pool.end();
}
run();
