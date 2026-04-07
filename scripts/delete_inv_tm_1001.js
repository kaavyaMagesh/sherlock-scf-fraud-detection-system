const pool = require('../db/index');

async function deleteInvoice() {
    try {
        const invNo = 'INV-TM-1001';
        console.log(`--- Surgical Deletion: ${invNo} ---`);

        // 1. Fetch
        const res = await pool.query('SELECT id, po_id FROM invoices WHERE invoice_number = $1', [invNo]);
        if (res.rows.length === 0) {
            console.error('Invoice Not Found');
            process.exit(0); // Already gone
        }
        const invId = res.rows[0].id;
        const poId = res.rows[0].po_id;

        // 2. Cascade Delete
        await pool.query('BEGIN');
        
        // Clean Audit Trail
        await pool.query('DELETE FROM explanations WHERE invoice_id = $1', [invId]);
        await pool.query('DELETE FROM alerts WHERE invoice_id = $1', [invId]);
        await pool.query('DELETE FROM risk_score_audits WHERE invoice_id = $1', [invId]);
        await pool.query('DELETE FROM invoice_fingerprints WHERE invoice_id = $1', [invId]);
        
        // Final Document Deletion
        await pool.query('DELETE FROM invoices WHERE id = $1', [invId]);

        // Optional: Delete orphaned PO if it only belonged to this invoice
        if (poId) {
            const countRes = await pool.query('SELECT COUNT(*) FROM invoices WHERE po_id = $1', [poId]);
            if (parseInt(countRes.rows[0].count) === 0) {
                console.log(`  Deleting Orphaned PO ID: ${poId}`);
                await pool.query('DELETE FROM purchase_orders WHERE id = $1', [poId]);
            }
        }

        await pool.query('COMMIT');
        console.log(`\nSuccessfully purged ${invNo} from all forensic records.`);
        process.exit(0);

    } catch (err) {
        await pool.query('ROLLBACK');
        console.error("Delete Failed:", err.message);
        process.exit(1);
    }
}

deleteInvoice();
