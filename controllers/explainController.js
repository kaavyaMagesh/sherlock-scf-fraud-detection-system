const pool = require('../db/index');
const explainabilityService = require('../services/explainabilityService');

const getExplanation = async (req, res) => {
    try {
        const { invoiceId } = req.params;
        const lenderId = req.lenderId;

        // ── Step 1: Verify lender owns this invoice ───────────────────────────
        const invQuery = await pool.query(
            'SELECT id, risk_score FROM invoices WHERE id = $1 AND lender_id = $2',
            [invoiceId, lenderId]
        );
        if (invQuery.rows.length === 0) {
            return res.status(404).json({ error: 'Invoice not found or access denied' });
        }
        const invoice = invQuery.rows[0];

        // ── Step 2: Fetch the latest persisted breakdown (for on-the-fly fallback) ──
        const auditQuery = await pool.query(
            'SELECT breakdown FROM risk_score_audits WHERE invoice_id = $1 ORDER BY created_at DESC LIMIT 1',
            [invoiceId]
        );
        let breakdown = auditQuery.rows.length > 0 ? auditQuery.rows[0].breakdown : [];
        if (typeof breakdown === 'string') {
            try { breakdown = JSON.parse(breakdown); } catch { breakdown = []; }
        }
        if (!Array.isArray(breakdown)) breakdown = [];

        // ── Step 3: Try persisted explanation row ─────────────────────────────
        const expQuery = await pool.query(
            'SELECT * FROM explanations WHERE invoice_id = $1 ORDER BY created_at DESC LIMIT 1',
            [invoiceId]
        );

        if (expQuery.rows.length > 0) {
            // Happy path — explanation was already generated and stored
            const explanation = expQuery.rows[0];

            // fraud_dna may be stored as a JSON string in some DB configurations
            let fraudDNA = explanation.fraud_dna;
            if (typeof fraudDNA === 'string') {
                try { fraudDNA = JSON.parse(fraudDNA); } catch { fraudDNA = null; }
            }

            // factor_breakdown may also be stored as a JSON string
            let factorBreakdown = explanation.factor_breakdown;
            if (typeof factorBreakdown === 'string') {
                try { factorBreakdown = JSON.parse(factorBreakdown); } catch { factorBreakdown = []; }
            }
            if (!Array.isArray(factorBreakdown)) factorBreakdown = breakdown; // fall back to audit row

            return res.json({
                invoiceId,
                factorBreakdown,
                counterfactual: explanation.counterfactual || null,
                impatienceSignal: explanation.impatience_signal || null,
                fraudDNA: fraudDNA || explainabilityService.classifyFraudDNA(breakdown)
            });
        }

        // ── Step 4: On-the-fly derivation (no persisted row yet) ─────────────
        // This covers invoices that were scored before the explanation pipeline
        // existed, or invoices that have been manually overridden without re-eval.
        console.log(`[explain] No persisted explanation for invoice ${invoiceId} — deriving on-the-fly`);

        const fraudDNA       = explainabilityService.classifyFraudDNA(breakdown);
        const counterfactual = explainabilityService.generateCounterfactual(invoiceId, invoice.risk_score || 0, breakdown);
        const impatienceSignal = explainabilityService.detectImpatienceSignal(breakdown);

        return res.json({
            invoiceId,
            factorBreakdown: breakdown,
            counterfactual:    counterfactual    || null,
            impatienceSignal:  impatienceSignal  || null,
            fraudDNA
        });

    } catch (error) {
        console.error('Error fetching explanation:', error);
        res.status(500).json({ error: 'Failed to fetch explanation' });
    }
};

module.exports = {
    getExplanation
};
