const pool = require('./db/index');
async function run() {
    const res = await pool.query("SELECT name FROM companies WHERE name IN ('Global Trade Corp', 'Silent Parts Ltd')");
    console.log('Companies Found:', res.rows.map(x => x.name));
    
    const alerts = await pool.query("SELECT COUNT(*) FROM alerts WHERE lender_id = 1");
    console.log('Total Alerts for Lender 1:', alerts.rows[0].count);
    
    const kpiRes = await pool.query("SELECT SUM(amount) as exp FROM invoices WHERE lender_id = 1");
    console.log('Total Exposure:', kpiRes.rows[0].exp);
    
    await pool.end();
}
run();
