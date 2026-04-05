const pool = require('./db/index');

async function align() {
    try {
        const updateResult = await pool.query(`
            UPDATE invoices 
            SET buyer_id = (SELECT company_id FROM portal_users WHERE role = 'BUYER' LIMIT 1), 
                status = 'pending' 
            WHERE invoice_number LIKE '%TEST-%'
        `);
        console.log(`Aligned ${updateResult.rowCount} invoices.`);
        
        const checkResult = await pool.query(`
            SELECT invoice_number, buyer_id FROM invoices WHERE invoice_number LIKE '%TEST-%'
        `);
        console.log('Test invoices after update:', checkResult.rows);
    } catch (err) {
        console.error(err);
    } finally {
        await pool.end();
    }
}

align();
