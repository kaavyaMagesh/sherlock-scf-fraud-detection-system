const pool = require('./db/index');

async function fix() {
    try {
        await pool.query('ALTER TABLE invoices ADD COLUMN IF NOT EXISTS delivery_location VARCHAR(255);');
        await pool.query('ALTER TABLE purchase_orders ADD COLUMN IF NOT EXISTS delivery_location VARCHAR(255);');
        await pool.query('ALTER TABLE invoices ADD COLUMN IF NOT EXISTS payment_terms VARCHAR(255);');
        await pool.query('ALTER TABLE purchase_orders ADD COLUMN IF NOT EXISTS payment_terms VARCHAR(255);');
        console.log('SUCCESS');
    } catch(e) {
        console.error(e);
    } finally {
        pool.end();
    }
}
fix();
