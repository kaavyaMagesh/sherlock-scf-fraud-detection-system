const pool = require('./db/index');

async function alignData() {
    try {
        // Diagnosing existing invoices
        const allTestInvoices = await pool.query("SELECT invoice_number, buyer_id FROM invoices WHERE invoice_number LIKE 'TEST-%'");
        console.log(`Diagnostic: Found ${allTestInvoices.rows.length} total TEST-% invoices.`);
        if (allTestInvoices.rows.length > 0) {
            console.log("Sample TEST-% invoices:", allTestInvoices.rows.slice(0, 3));
        }

        const buyers = await pool.query("SELECT company_id, role, email FROM portal_users WHERE role = 'BUYER'");
        console.log(`Diagnostic: Found ${buyers.rows.length} BUYERs in portal_users.`);
        if (buyers.rows.length > 0) {
            console.log("BUYER info:", buyers.rows[0]);
            const targetBuyerId = buyers.rows[0].company_id;

            const query = `
                UPDATE invoices 
                SET buyer_id = $1, 
                    status = 'pending' 
                WHERE invoice_number LIKE 'TEST-%'
            `;
            const result = await pool.query(query, [targetBuyerId]);
            console.log(`Aligned ${result.rowCount} test invoices to Buyer ID ${targetBuyerId}.`);

            const checkResult = await pool.query("SELECT count(*) FROM invoices WHERE buyer_id = $1", [targetBuyerId]);
            console.log(`Check: Now ${checkResult.rows[0].count} invoices exist for Buyer ID ${targetBuyerId}.`);
        } else {
            console.log("Check: No BUYER found to align to.");
        }
    } catch (err) {
        console.error("Error aligning data:", err);
    } finally {
        await pool.end();
    }
}

alignData();
