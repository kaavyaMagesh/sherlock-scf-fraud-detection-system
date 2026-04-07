const pool = require('../db/index');

async function checkDuplicate() {
    try {
        const invId = 16;
        const invNo = 'INV-TM-1002';
        
        // 1. Get Fingerprint of target
        const resFp = await pool.query('SELECT fingerprint FROM invoice_fingerprints WHERE invoice_id = $1', [invId]);
        if (resFp.rows.length === 0) {
            console.log("No fingerprint found for " + invNo);
            process.exit(0);
        }
        const fp = resFp.rows[0].fingerprint;
        console.log(`Fingerprint for ${invNo}: ${fp}`);

        // 2. Find any other invoice with same fingerprint
        const resDup = await pool.query(`
            SELECT i.id, i.invoice_number, i.amount, i.lender_id, c_sup.name as supplier, c_buy.name as buyer
            FROM invoice_fingerprints f
            JOIN invoices i ON f.invoice_id = i.id
            JOIN companies c_sup ON i.supplier_id = c_sup.id
            JOIN companies c_buy ON i.buyer_id = c_buy.id
            WHERE f.fingerprint = $1 AND i.id != $2
        `, [fp, invId]);

        if (resDup.rows.length > 0) {
            console.log("\nCulprit(s) found:");
            resDup.rows.forEach(row => {
                console.log(`- ID: ${row.id}, Number: ${row.invoice_number}, Amount: ${row.amount}, Lender: ${row.lender_id}`);
                console.log(`  Parties: ${row.supplier} -> ${row.buyer}`);
            });
        } else {
            console.log("\nNo other invoice found with the same fingerprint in the database.");
            
            // Check logic: 
            // In validationService.js, does it check against the same invoice number if the ID matches?
            // Actually, if it's the SAME invoice number, it might be a fuzzy match.
        }

        process.exit(0);

    } catch (err) {
        console.error("Check Failed:", err.message);
        process.exit(1);
    }
}

checkDuplicate();
