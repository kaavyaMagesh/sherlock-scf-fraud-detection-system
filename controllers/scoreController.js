const pool = require('../db/index');
const validationService = require('../services/validationService');
const riskEngineService = require('../services/riskEngineService');

const getScore = async (req, res) => {
    try {
        const lenderId = req.lenderId;
        const invoiceId = req.params.id;

        const invQuery = await pool.query('SELECT * FROM invoices WHERE id = $1 AND lender_id = $2', [invoiceId, lenderId]);
        if (invQuery.rows.length === 0) {
            return res.status(404).json({ error: 'Invoice not found or access denied' });
        }

        const auditQuery = await pool.query('SELECT score, breakdown, created_at FROM risk_score_audits WHERE invoice_id = $1 ORDER BY created_at DESC', [invoiceId]);

        res.json({
            invoiceId,
            currentScore: invQuery.rows[0].risk_score,
            status: invQuery.rows[0].status,
            history: auditQuery.rows
        });
    } catch (error) {
        console.error('Error fetching score:', error);
        res.status(500).json({ error: 'Failed to fetch score' });
    }
};

const recalculateScore = async (req, res) => {
    try {
        const lenderId = req.lenderId;
        const invoiceId = req.params.id;

        const invQuery = await pool.query('SELECT * FROM invoices WHERE id = $1 AND lender_id = $2', [invoiceId, lenderId]);
        if (invQuery.rows.length === 0) {
            return res.status(404).json({ error: 'Invoice not found or access denied' });
        }

        const invoice = invQuery.rows[0];

        // Fetch fingerprint
        const fpQuery = await pool.query('SELECT fingerprint FROM invoice_fingerprints WHERE invoice_id = $1', [invoiceId]);
        const fingerprint = fpQuery.rows.length > 0 ? fpQuery.rows[0].fingerprint : null;

        let totalPoints = 0;
        let finalBreakdown = [];

        // 1. Re-check Duplicate Check 
        if (fingerprint) {
            const dupCheck = await validationService.detectDuplicates(lenderId, fingerprint, invoice.supplier_id, invoice.buyer_id, invoice.amount, invoice.invoice_date, invoice.invoice_number);
            if (dupCheck.isDuplicate) {
                totalPoints += dupCheck.points;
                finalBreakdown.push(...dupCheck.breakdown);
            }
        }

        // 2. Re-check Triple Match (e.g., if a new GRN arrived, or if they are entirely missing)
        const tripleCheck = await validationService.checkTripleMatch(lenderId, invoice.po_id, invoice.grn_id, invoice.amount, invoice.invoice_date, invoice.supplier_id, invoice.buyer_id);
        totalPoints += tripleCheck.points;
        finalBreakdown.push(...tripleCheck.breakdown);

        // 3. Re-evaluate Core 12 Rules 
        const riskResult = await riskEngineService.evaluateRisk(
            lenderId,
            invoice.id,
            invoice.supplier_id,
            invoice.buyer_id,
            invoice.amount,
            invoice.invoice_date,
            invoice.expected_payment_date,
            totalPoints,
            finalBreakdown
        );

        res.json({
            message: "Score recalculated successfully",
            result: riskResult
        });
    } catch (error) {
        console.error('Error recalculating score:', error);
        res.status(500).json({ error: 'Failed to recalculate score' });
    }
};

module.exports = {
    getScore,
    recalculateScore
};
