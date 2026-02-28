const pool = require('../db/index');

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

        res.status(201).json(result.rows[0]);
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

        res.status(201).json(result.rows[0]);
    } catch (error) {
        console.error('Error ingesting GRN:', error);
        res.status(500).json({ error: 'Failed to ingest Goods Receipt Note' });
    }
};

module.exports = {
    ingestPO,
    ingestGRN
};
