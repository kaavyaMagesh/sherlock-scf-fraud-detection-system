const pool = require('../db/index');

// BUYER ACTIONS

exports.getPurchaseOrders = async (req, res) => {
    try {
        const { company_id, lender_id } = req.user;
        const query = `
            SELECT po.*, c.name as supplier_name 
            FROM purchase_orders po
            JOIN companies c ON po.supplier_id = c.id
            WHERE po.buyer_id = $1 AND po.lender_id = $2
            ORDER BY po.created_at DESC
        `;
        const result = await pool.query(query, [company_id, lender_id]);
        res.json(result.rows);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Failed to fetch purchase orders' });
    }
};

exports.createPurchaseOrder = async (req, res) => {
    try {
        const { company_id, lender_id } = req.user;
        const { 
            supplier_id, amount, quantity, goods_category, 
            delivery_location, payment_terms, po_date, parent_po_id 
        } = req.body;

        const query = `
            INSERT INTO purchase_orders (
                lender_id, buyer_id, supplier_id, amount, quantity, 
                goods_category, delivery_location, payment_terms, po_date, parent_po_id
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
            RETURNING *
        `;
        const result = await pool.query(query, [
            lender_id,
            company_id,
            supplier_id,
            amount,
            quantity,
            goods_category,
            delivery_location || null,
            payment_terms || null,
            po_date || new Date(),
            parent_po_id || null
        ]);
        res.status(201).json(result.rows[0]);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Failed to create purchase order' });
    }
};

exports.getGoodsReceipts = async (req, res) => {
    try {
        const { company_id, lender_id } = req.user;
        const query = `
            SELECT grn.*, po.supplier_id 
            FROM goods_receipts grn
            JOIN purchase_orders po ON grn.po_id = po.id
            WHERE po.buyer_id = $1 AND grn.lender_id = $2
            ORDER BY grn.created_at DESC
        `;
        const result = await pool.query(query, [company_id, lender_id]);
        res.json(result.rows);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Failed to fetch goods receipts' });
    }
};

exports.createGoodsReceipt = async (req, res) => {
    try {
        const { lender_id } = req.user;
        const { po_id, amount_received, quantity, receipt_date, goods_category } = req.body;

        const query = `
            INSERT INTO goods_receipts (lender_id, po_id, amount_received, quantity, grn_date, receipt_date, goods_category)
            VALUES ($1, $2, $3, $4, $5, $5, $6)
            RETURNING *
        `;
        const result = await pool.query(query, [lender_id, po_id, amount_received, quantity, receipt_date || new Date(), goods_category]);
        res.status(201).json(result.rows[0]);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Failed to create goods receipt' });
    }
};

exports.getDeliveries = async (req, res) => {
    try {
        const { company_id, lender_id } = req.user;
        const query = `
            SELECT d.*, po.id as po_id
            FROM delivery_confirmations d
            JOIN goods_receipts grn ON d.grn_id = grn.id
            JOIN purchase_orders po ON grn.po_id = po.id
            WHERE po.buyer_id = $1 AND d.lender_id = $2
            ORDER BY d.created_at DESC
        `;
        const result = await pool.query(query, [company_id, lender_id]);
        res.json(result.rows);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Failed to fetch deliveries' });
    }
};

exports.createDelivery = async (req, res) => {
    try {
        const { lender_id } = req.user;
        const { grn_id, confirmed_by, delivery_status, notes, delivery_date } = req.body;

        const query = `
            INSERT INTO delivery_confirmations (grn_id, lender_id, confirmed_by, delivery_date, delivery_status, notes)
            VALUES ($1, $2, $3, $4, $5, $6)
            RETURNING *
        `;
        const result = await pool.query(query, [grn_id, lender_id, confirmed_by, delivery_date || new Date(), delivery_status, notes]);
        res.status(201).json(result.rows[0]);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Failed to confirm delivery' });
    }
};

// SUPPLIER ACTIONS

exports.getSupplierPurchaseOrders = async (req, res) => {
    try {
        const { company_id, lender_id } = req.user;
        const query = `
            SELECT po.*, c.name as buyer_name 
            FROM purchase_orders po
            JOIN companies c ON po.buyer_id = c.id
            WHERE po.supplier_id = $1 AND po.lender_id = $2
            ORDER BY po.created_at DESC
        `;
        const result = await pool.query(query, [company_id, lender_id]);
        res.json(result.rows);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Failed to fetch supplier purchase orders' });
    }
};

// DISPUTES & BUYER DASHBOARDS

exports.getBuyerInvoices = async (req, res) => {
    try {
        const { company_id, lender_id } = req.user;
        const query = `
            SELECT i.*, c.name as supplier_name, po.goods_category
            FROM invoices i
            JOIN companies c ON i.supplier_id = c.id
            LEFT JOIN purchase_orders po ON i.po_id = po.id
            WHERE i.buyer_id = $1 AND i.lender_id = $2
            ORDER BY i.created_at DESC
        `;
        const result = await pool.query(query, [company_id, lender_id]);
        res.json(result.rows);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Failed to fetch buyer invoices' });
    }
};

exports.createDispute = async (req, res) => {
    const client = await pool.connect();
    try {
        const { lender_id } = req.user;
        const { invoice_id, dispute_reason, dispute_notes } = req.body;

        await client.query('BEGIN');

        // 1. Create dispute record
        const disputeQuery = `
            INSERT INTO disputes (invoice_id, lender_id, dispute_reason, dispute_notes)
            VALUES ($1, $2, $3, $4)
            RETURNING *
        `;
        const disputeResult = await client.query(disputeQuery, [invoice_id, lender_id, dispute_reason, dispute_notes]);

        // 2. Update invoice status
        await client.query("UPDATE invoices SET status = 'DISPUTED' WHERE id = $1", [invoice_id]);

        await client.query('COMMIT');

        // 3. Trigger Risk Re-evaluation (async)
        const riskEngineService = require('../services/riskEngineService');
        const invQuery = await client.query('SELECT * FROM invoices WHERE id = $1', [invoice_id]);
        const invoice = invQuery.rows[0];

        if (invoice) {
            // We fire and forget or wait depending on UX needs. Here we just trigger.
            riskEngineService.evaluateRisk(
                lender_id,
                invoice.id,
                invoice.supplier_id,
                invoice.buyer_id,
                invoice.amount,
                invoice.invoice_date,
                invoice.expected_payment_date,
                0, []
            ).catch(e => console.error("Risk re-eval failed after dispute:", e));
        }

        res.status(201).json(disputeResult.rows[0]);
    } catch (err) {
        await client.query('ROLLBACK');
        console.error(err);
        res.status(500).json({ error: 'Failed to raise dispute' });
    } finally {
        client.release();
    }
};
