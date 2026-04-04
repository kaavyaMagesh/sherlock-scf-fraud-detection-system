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
        const { supplier_id, amount, quantity, goods_category, delivery_location, payment_terms } = req.body;

        const query = `
            INSERT INTO purchase_orders (lender_id, buyer_id, supplier_id, amount, quantity, goods_category, delivery_location, payment_terms, po_date)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())
            RETURNING *
        `;
        const result = await pool.query(query, [lender_id, company_id, supplier_id, amount, quantity, goods_category, delivery_location, payment_terms]);
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
        const { po_id, amount_received, quantity } = req.body;
        
        const query = `
            INSERT INTO goods_receipts (lender_id, po_id, amount_received, quantity, grn_date)
            VALUES ($1, $2, $3, $4, NOW())
            RETURNING *
        `;
        const result = await pool.query(query, [lender_id, po_id, amount_received, quantity]);
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
        const { grn_id, confirmed_by, delivery_status, notes } = req.body;
        
        const query = `
            INSERT INTO delivery_confirmations (grn_id, lender_id, confirmed_by, delivery_date, delivery_status, notes)
            VALUES ($1, $2, $3, NOW(), $4, $5)
            RETURNING *
        `;
        const result = await pool.query(query, [grn_id, lender_id, confirmed_by, delivery_status, notes]);
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
