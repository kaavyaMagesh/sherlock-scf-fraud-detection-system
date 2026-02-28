const pool = require('../db/index');
const validationService = require('../services/validationService');
const riskEngineService = require('../services/riskEngineService');
const graphEngineService = require('../services/graphEngineService');

const submitInvoice = async (req, res) => {
    try {
        const lenderId = req.lenderId;
        const { invoice_number, po_id, grn_id, supplier_id, buyer_id, amount, expected_payment_date, goods_category } = req.body;
        const invoiceDate = new Date();

        if (!invoice_number || !po_id || !grn_id || !supplier_id || !buyer_id || !amount || !expected_payment_date) {
            return res.status(400).json({ error: 'Missing required invoice fields' });
        }

        // 0. Identity Gate (VC Check FIRST)
        const compQuery = await pool.query('SELECT credential_verified, is_revoked FROM companies WHERE id = $1', [supplier_id]);
        if (compQuery.rows.length === 0) {
            return res.status(400).json({ error: 'Supplier not found' });
        }
        const company = compQuery.rows[0];
        if (!company.credential_verified || company.is_revoked) {
            return res.status(403).json({ error: 'Identity Not Verified' });
        }

        // 1. Generate Fingerprint
        const fingerprint = validationService.generateFingerprint(supplier_id, buyer_id, invoice_number, amount, invoiceDate);

        // 2. Draft Initial Invoice
        const invQuery = await pool.query(
            `INSERT INTO invoices (lender_id, invoice_number, po_id, grn_id, supplier_id, buyer_id, amount, invoice_date, expected_payment_date, goods_category)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING *`,
            [lenderId, invoice_number, po_id, grn_id, supplier_id, buyer_id, amount, invoiceDate, expected_payment_date, goods_category]
        );
        const invoice = invQuery.rows[0];

        // 3. Store Fingerprint
        await pool.query(
            'INSERT INTO invoice_fingerprints (invoice_id, lender_id, fingerprint) VALUES ($1, $2, $3)',
            [invoice.id, lenderId, fingerprint]
        );

        let totalPoints = 0;
        let finalBreakdown = [];

        // 4. Duplicate Check (Exact and Fuzzy)
        const dupCheck = await validationService.detectDuplicates(lenderId, fingerprint, supplier_id, buyer_id, amount, invoiceDate, invoice_number);

        if (dupCheck.isDuplicate) {
            totalPoints += dupCheck.points;
            finalBreakdown.push(...dupCheck.breakdown);
        }

        // 5. Triple Match Validation
        const tripleCheck = await validationService.checkTripleMatch(lenderId, po_id, grn_id, amount, invoiceDate, supplier_id, buyer_id);

        totalPoints += tripleCheck.points;
        finalBreakdown.push(...tripleCheck.breakdown);

        // 6. Complete Risk Engine Execution
        const riskResult = await riskEngineService.evaluateRisk(
            lenderId,
            invoice.id,
            supplier_id,
            buyer_id,
            amount,
            invoiceDate,
            expected_payment_date,
            totalPoints,
            finalBreakdown
        );

        // 7. Update Trade Relationship Graph (Fire for ALL invoices)
        await graphEngineService.updateEdgeMetadata(
            lenderId,
            supplier_id,
            buyer_id,
            amount,
            goods_category
        );

        // Map to exact required JSON contract
        const responseContract = {
            invoiceId: invoice.id,
            status: riskResult.status,
            riskScore: riskResult.riskScore,
            breakdown: riskResult.breakdown,
            duplicateOf: dupCheck.duplicateOf,
            recommendation: riskResult.recommendation
        };

        res.status(201).json(responseContract);
    } catch (error) {
        console.error('Error submitting invoice:', error);
        res.status(500).json({ error: 'Failed to submit invoice' });
    }
};

const getInvoiceDetails = async (req, res) => {
    try {
        const { id } = req.params;
        const lenderId = req.lenderId;

        const invQuery = await pool.query('SELECT * FROM invoices WHERE id = $1 AND lender_id = $2', [id, lenderId]);

        if (invQuery.rows.length === 0) {
            return res.status(404).json({ error: 'Invoice not found or access denied' });
        }

        const invoice = invQuery.rows[0];

        // Fetch audit history breakdown
        const auditQuery = await pool.query('SELECT breakdown FROM risk_score_audits WHERE invoice_id = $1 ORDER BY created_at DESC LIMIT 1', [id]);
        const breakdown = auditQuery.rows.length > 0 ? auditQuery.rows[0].breakdown : [];

        res.json({
            ...invoice,
            breakdown
        });

    } catch (error) {
        console.error('Error fetching invoice:', error);
        res.status(500).json({ error: 'Failed to fetch invoice' });
    }
};

const preDisbursementGate = async (req, res) => {
    try {
        const { id } = req.params;
        const lenderId = req.lenderId;

        const invQuery = await pool.query('SELECT status FROM invoices WHERE id = $1 AND lender_id = $2', [id, lenderId]);
        if (invQuery.rows.length === 0) {
            return res.status(404).json({ error: 'Invoice not found or access denied' });
        }

        const invoice = invQuery.rows[0];
        if (invoice.status === 'BLOCKED' || invoice.status === 'REVIEW') {
            return res.status(403).json({ error: `Disbursement Failed: Invoice is currently in ${invoice.status} status.` });
        }

        res.json({ message: 'Disbursement Approved' });
    } catch (error) {
        console.error('Error at disbursement gate:', error);
        res.status(500).json({ error: 'Failed to process disbursement request' });
    }
};

const manualOverride = async (req, res) => {
    try {
        const { id } = req.params;
        const lenderId = req.lenderId;
        const { reason, auditorId } = req.body;

        if (!reason) {
            return res.status(400).json({ error: 'Mandatory reason log is required to override' });
        }

        const invQuery = await pool.query('SELECT status FROM invoices WHERE id = $1 AND lender_id = $2', [id, lenderId]);
        if (invQuery.rows.length === 0) {
            return res.status(404).json({ error: 'Invoice not found or access denied' });
        }

        // Add to manual_overrides table
        await pool.query(
            'INSERT INTO manual_overrides (invoice_id, reason_log, auditor_id) VALUES ($1, $2, $3)',
            [id, reason, auditorId || 'system_auditor']
        );

        // Forcefully approve invoice
        await pool.query("UPDATE invoices SET status = 'APPROVED' WHERE id = $1", [id]);

        // Resolve active alerts
        await pool.query("UPDATE alerts SET resolved = true WHERE invoice_id = $1", [id]);

        res.json({ message: 'Invoice manually overriden and approved successfully' });
    } catch (error) {
        console.error('Error at manual override:', error);
        res.status(500).json({ error: 'Failed to override invoice' });
    }
};

module.exports = {
    submitInvoice,
    getInvoiceDetails,
    preDisbursementGate,
    manualOverride
};
