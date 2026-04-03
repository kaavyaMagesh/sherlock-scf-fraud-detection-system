const pool = require('./index');

async function migrate() {
    console.log('Starting Layer 6 Schema Migration...');
    try {
        await pool.query(`
            ALTER TABLE invoices 
            ADD COLUMN IF NOT EXISTS payment_terms VARCHAR(255);
        `);
        console.log('Added payment_terms to invoices table.');

        await pool.query(`
            ALTER TABLE purchase_orders 
            ADD COLUMN IF NOT EXISTS payment_terms VARCHAR(255);
        `);
        console.log('Added payment_terms to purchase_orders table.');

        await pool.query(`
            ALTER TABLE purchase_orders 
            ADD COLUMN IF NOT EXISTS delivery_location VARCHAR(255);
        `);
        console.log('Added delivery_location to purchase_orders table.');

        console.log('Layer 6 Schema Migration Completed Successfully.');
    } catch (err) {
        console.error('Migration Failed:', err);
    } finally {
        process.exit();
    }
}

migrate();
