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

        // 1. Generate Fingerprint
        const fingerprint = validationService.generateFingerprint(supplierId, buyerId, amount, invoiceDate);

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
        const dupCheck = await validationService.detectDuplicates(lenderId, fingerprint, supplierId, buyerId, amount, invoiceDate, invoice_number);

        if (dupCheck.isDuplicate) {
            totalPoints += dupCheck.points;
            finalBreakdown.push(...dupCheck.breakdown);
        }

        // 5. Triple Match Validation
        const tripleCheck = await validationService.checkTripleMatch(lenderId, po_id, grn_id, amount, invoiceDate, supplierId, buyerId);

        totalPoints += tripleCheck.points;
        finalBreakdown.push(...tripleCheck.breakdown);

        // 6. Complete Risk Engine Execution
        const riskResult = await riskEngineService.evaluateRisk(
            lenderId,
            invoice.id,
            supplierId,
            buyerId,
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

module.exports = {
    submitInvoice,
    getInvoiceDetails
};
