const pool = require('../db/index');
const validationService = require('../services/validationService');

async function renameInvoice() {
    try {
        const oldNo = 'PHNTM-BLOCK-6637';
        const newNo = 'PHNTM-6637';

        console.log(`--- Renaming ${oldNo} to ${newNo} ---`);

        // 1. Fetch
        const res = await pool.query('SELECT * FROM invoices WHERE invoice_number = $1', [oldNo]);
        if (res.rows.length === 0) {
            console.error('Invoice Not Found');
            process.exit(1);
        }
        const inv = res.rows[0];

        // 2. New Fingerprint (Consistency check)
        const newFingerprint = validationService.generateFingerprint(
            inv.supplier_id, 
            inv.buyer_id, 
            newNo, 
            inv.amount, 
            inv.invoice_date
        );

        // 3. Update
        await pool.query('BEGIN');
        await pool.query('UPDATE invoices SET invoice_number = $1 WHERE id = $2', [newNo, inv.id]);
        await pool.query('UPDATE invoice_fingerprints SET fingerprint = $1 WHERE invoice_id = $2', [newFingerprint, inv.id]);
        await pool.query('COMMIT');

        console.log(`\nSuccessfully renamed to ${newNo} and re-generated security fingerprint.`);
        process.exit(0);

    } catch (err) {
        await pool.query('ROLLBACK');
        console.error("Rename Failed:", err.message);
        process.exit(1);
    }
}

renameInvoice();
