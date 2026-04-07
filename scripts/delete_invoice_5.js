const pool = require('../db/index');

async function deleteInvoice() {
    try {
        const invId = 5;
        const poId = 4;
        console.log(`--- Deleting Invoice ID: ${invId} and PO ID: ${poId} ---`);

        // Transaction cleanup
        const tables = [
            'explanations',
            'alerts',
            'risk_score_audits',
            'invoice_fingerprints',
            'settlements',
            'manual_overrides',
            'disputes'
        ];

        for (const table of tables) {
            const res = await pool.query(`DELETE FROM ${table} WHERE invoice_id = $1`, [invId]);
            console.log(`Deleted ${res.rowCount} rows from ${table}`);
        }

        const invDel = await pool.query('DELETE FROM invoices WHERE id = $1', [invId]);
        console.log(`Deleted ${invDel.rowCount} invoice records.`);

        const poDel = await pool.query('DELETE FROM purchase_orders WHERE id = $1', [poId]);
        console.log(`Deleted ${poDel.rowCount} purchase order records.`);

        process.exit(0);

    } catch (err) {
        console.error("Deletion Failed:", err.message);
        process.exit(1);
    }
}

deleteInvoice();
