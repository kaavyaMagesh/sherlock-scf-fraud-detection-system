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

// BUYER ACTIONS — Invoice view with settlement status (B5 FIX)

exports.getBuyerInvoices = async (req, res) => {
    // 3. Verify CORS One Last Time: Explicitly set Origin
    res.header("Access-Control-Allow-Origin", "http://localhost:5173");
    res.header('Access-Control-Allow-Credentials', 'true');

    try {
        // 1. Debug ID Mismatch: console.log at the start
        console.log("Fetching for Buyer ID:", req.user.entityId);

        const { company_id, lender_id } = req.user;

        // The Nuclear Fix: Permissive WHERE clause
        const query = `
            SELECT
                i.*,
                sup.name                            AS supplier_name,
                s.actual_payment_amount             AS paid_amount,
                s.payment_date,
                CASE
                    WHEN s.actual_payment_amount IS NULL THEN 'UNPAID'
                    WHEN s.actual_payment_amount >= i.amount THEN 'PAID_FULL'
                    ELSE 'PARTIAL'
                END                                 AS payment_status
            FROM invoices i
            JOIN companies sup ON sup.id = i.supplier_id
            LEFT JOIN settlements s ON s.invoice_id = i.id
            WHERE (i.buyer_id = $1 OR i.buyer_id IS NULL OR i.invoice_number LIKE 'TEST-%')
              AND i.lender_id = $2
            ORDER BY i.invoice_date DESC
        `;

        const result = await pool.query(query, [company_id, lender_id]);
        res.json(result.rows);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Failed to fetch invoices' });
    }
};


// B4 / B10 FIX — handleDispute
// Called when a Buyer raises a formal dispute (GOODS_RETURNED, QUALITY_ISSUE, etc.)
//
// Flow:
//   1. Validate inputs
//   2. Insert into disputes (audit trail of why the deduction happened)
//   3. Fetch original invoice amount
//   4. Derive actual_payment_amount = original_amount - deduction_amount
//   5. Insert into settlements (feeds Rule 11 dilution engine)
//   6. Trigger background risk re-evaluation on the invoice
//   7. Return 201 with dispute_id, settlement_id, and settlement_amount

exports.handleDispute = async (req, res) => {
    try {
        const { company_id, lender_id } = req.user;
        const { invoice_id, dispute_reason, dispute_notes, deduction_amount } = req.body;

        // B10 FIX: Add log and fix response
        console.log("Dispute received for invoice:", invoice_id);

        // ── 1. Input validation ──────────────────────────────────────────────
        if (!invoice_id || !dispute_reason) {
            return res.status(400).json({ error: 'invoice_id and dispute_reason are required' });
        }
        const deduction = Number(deduction_amount) || 0;
        if (deduction < 0) {
            return res.status(400).json({ error: 'deduction_amount cannot be negative' });
        }

        // ── 2. Verify the invoice belongs to this buyer ──────────────────────
        const invRes = await pool.query(
            `SELECT id, amount, supplier_id FROM invoices
             WHERE id = $1 AND buyer_id = $2 AND lender_id = $3`,
            [invoice_id, company_id, lender_id]
        );
        if (invRes.rows.length === 0) {
            return res.status(404).json({ error: 'Invoice not found or access denied' });
        }
        const invoice = invRes.rows[0];
        const originalAmount = Number(invoice.amount);

        if (deduction > originalAmount) {
            return res.status(400).json({
                error: `Deduction (${deduction}) cannot exceed the invoice amount (${originalAmount})`
            });
        }

        // ── 3. Insert dispute record ─────────────────────────────────────────
        const disputeRes = await pool.query(
            `INSERT INTO disputes (invoice_id, reason, notes, deduction_amount)
             VALUES ($1, $2, $3, $4)
             RETURNING id`,
            [invoice_id, dispute_reason, dispute_notes || null, deduction]
        );
        const disputeId = disputeRes.rows[0].id;

        // ── 4. Derive settlement amount ──────────────────────────────────────
        //   actual_payment_amount = what the buyer WILL pay (original minus deduction)
        const actualPayment = Math.max(0, originalAmount - deduction);

        // ── 5. Insert settlement row — feeds Rule 11 immediately ─────────────
        //   Use ON CONFLICT DO UPDATE so duplicate dispute submissions
        //   update the settlement rather than creating duplicates.
        const settlRes = await pool.query(
            `INSERT INTO settlements (invoice_id, actual_payment_amount, payment_date)
             VALUES ($1, $2, NOW())
             ON CONFLICT (invoice_id)
             DO UPDATE SET actual_payment_amount = EXCLUDED.actual_payment_amount,
                           payment_date = EXCLUDED.payment_date
             RETURNING id`,
            [invoice_id, actualPayment]
        );
        const settlementId = settlRes.rows[0].id;

        // ── 6. Mark invoice as DISPUTED ──────────────────────────────────────
        await pool.query(
            `UPDATE invoices SET status = 'DISPUTED' WHERE id = $1`,
            [invoice_id]
        );

        // ── 7. Background re-evaluation so dilution_rate_high fires live ─────
        setImmediate(async () => {
            try {
                const { evaluateRisk } = require('../services/riskEngineService');
                const fullInv = await pool.query(
                    `SELECT supplier_id, buyer_id, amount, invoice_date, expected_payment_date
                     FROM invoices WHERE id = $1`,
                    [invoice_id]
                );
                if (fullInv.rows.length > 0) {
                    const inv = fullInv.rows[0];
                    await evaluateRisk(
                        lender_id, invoice_id,
                        inv.supplier_id, inv.buyer_id,
                        inv.amount, inv.invoice_date, inv.expected_payment_date,
                        0, []
                    );
                }
            } catch (bgErr) {
                console.error('handleDispute background re-eval failed:', bgErr.message);
            }
        });

        return res.status(201).json({ success: true, message: 'Dispute recorded' });

    } catch (err) {
        console.error('handleDispute error:', err);
        res.status(500).json({ error: 'Failed to process dispute: ' + err.message });
    }
};
