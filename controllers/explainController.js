const pool = require('../db/index');

const getExplanation = async (req, res) => {
    try {
        const { invoiceId } = req.params;
        const lenderId = req.lenderId;

        // Verify access to invoice
        const invQuery = await pool.query('SELECT amount FROM invoices WHERE id = $1 AND lender_id = $2', [invoiceId, lenderId]);
        if (invQuery.rows.length === 0) {
            return res.status(404).json({ error: 'Invoice not found or access denied' });
        }

        const expQuery = await pool.query('SELECT * FROM explanations WHERE invoice_id = $1 ORDER BY created_at DESC LIMIT 1', [invoiceId]);

        if (expQuery.rows.length === 0) {
            return res.status(404).json({ error: 'Explanation not generated for this invoice yet' });
        }

        const explanation = expQuery.rows[0];

        res.json({
            invoiceId: invoiceId,
            factorBreakdown: explanation.factor_breakdown || [],
            counterfactual: explanation.counterfactual || "",
            impatienceSignal: explanation.impatience_signal || "",
            fraudDNA: explanation.fraud_dna || {}
        });

    } catch (error) {
        console.error('Error fetching explanation:', error);
        res.status(500).json({ error: 'Failed to fetch explanation' });
    }
};

module.exports = {
    getExplanation
};
