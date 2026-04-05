const pool = require('./db/index');
async function run() {
    const res = await pool.query("SELECT column_name FROM information_schema.columns WHERE table_name = 'disputes'");
    console.log('Columns in disputes:', res.rows.map(x => x.column_name));
    await pool.end();
}
run();
