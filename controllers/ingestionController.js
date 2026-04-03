const pool = require('../db/index');
const { recomputeInvoiceRisk } = require('./scoreController');

const ingestPO = async (req, res) => {
    try {
        const lenderId = req.lenderId;
        const { root_po_id, buyer_id, supplier_id, amount, po_date } = req.body;

        if (!buyer_id || !supplier_id || !amount || !po_date) {
            return res.status(400).json({ error: 'Missing required PO fields' });
        }

        const result = await pool.query(
            `INSERT INTO purchase_orders (lender_id, root_po_id, buyer_id, supplier_id, amount, po_date) 
             VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
            [lenderId, root_po_id, buyer_id, supplier_id, amount, po_date]
        );

        const poRow = result.rows[0];
        const impacted = await pool.query(
            'SELECT id FROM invoices WHERE lender_id = $1 AND po_id = $2',
            [lenderId, poRow.id]
        );
        for (const row of impacted.rows) {
            await recomputeInvoiceRisk(lenderId, row.id);
        }

        res.status(201).json(poRow);
    } catch (error) {
        console.error('Error ingesting PO:', error);
        res.status(500).json({ error: 'Failed to ingest Purchase Order' });
    }
};

const ingestGRN = async (req, res) => {
    try {
        const lenderId = req.lenderId;
        const { po_id, amount_received, grn_date } = req.body;

        if (!po_id || !amount_received || !grn_date) {
            return res.status(400).json({ error: 'Missing required GRN fields' });
        }

        // Verify PO belongs to this lender
        const poCheck = await pool.query('SELECT id FROM purchase_orders WHERE id = $1 AND lender_id = $2', [po_id, lenderId]);
        if (poCheck.rows.length === 0) {
            return res.status(404).json({ error: 'Purchase Order not found or not owned by lender' });
        }

        const result = await pool.query(
            `INSERT INTO goods_receipts (lender_id, po_id, amount_received, grn_date) 
             VALUES ($1, $2, $3, $4) RETURNING *`,
            [lenderId, po_id, amount_received, grn_date]
        );

        // Evidence arrived: link to candidate invoices and recompute score automatically.
        const impactedInvoices = await pool.query(
            `UPDATE invoices
             SET grn_id = $1
             WHERE lender_id = $2
               AND po_id = $3
               AND (grn_id IS NULL OR grn_id = $1)
             RETURNING id`,
            [result.rows[0].id, lenderId, po_id]
        );

        for (const invoice of impactedInvoices.rows) {
            await recomputeInvoiceRisk(lenderId, invoice.id);
        }

        res.status(201).json(result.rows[0]);
    } catch (error) {
        console.error('Error ingesting GRN:', error);
        res.status(500).json({ error: 'Failed to ingest Goods Receipt Note' });
    }
};

const ingestSettlement = async (req, res) => {
    try {
        const lenderId = req.lenderId;
        const { invoice_id, actual_payment_amount, payment_date } = req.body;

        if (!invoice_id || !actual_payment_amount || !payment_date) {
            return res.status(400).json({ error: 'Missing required settlement fields' });
        }

        const invoiceCheck = await pool.query(
            'SELECT id FROM invoices WHERE id = $1 AND lender_id = $2',
            [invoice_id, lenderId]
        );
        if (invoiceCheck.rows.length === 0) {
            return res.status(404).json({ error: 'Invoice not found or not owned by lender' });
        }

        const result = await pool.query(
            `INSERT INTO settlements (invoice_id, actual_payment_amount, payment_date)
             VALUES ($1, $2, $3)
             RETURNING *`,
            [invoice_id, actual_payment_amount, payment_date]
        );

        // New payment evidence changes dilution and downstream risk calculations.
        await recomputeInvoiceRisk(lenderId, invoice_id);

        res.status(201).json(result.rows[0]);
    } catch (error) {
        console.error('Error ingesting settlement:', error);
        res.status(500).json({ error: 'Failed to ingest settlement' });
    }
};

module.exports = {
    ingestPO,
    ingestGRN,
    ingestSettlement
};
