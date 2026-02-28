const pool = require('../db/index');

const getAlerts = async (req, res) => {
    try {
        const lenderId = req.lenderId;
        const page = parseInt(req.query.page) || 1;
        const limit = 20;
        const offset = (page - 1) * limit;

        const alertsQuery = await pool.query(
            `SELECT a.*, i.invoice_number FROM alerts a 
             JOIN invoices i ON a.invoice_id = i.id 
             WHERE a.lender_id = $1 
             ORDER BY a.created_at DESC 
             LIMIT $2 OFFSET $3`,
            [lenderId, limit, offset]
        );

        res.json(alertsQuery.rows);
    } catch (error) {
        console.error('Error fetching alerts:', error);
        res.status(500).json({ error: 'Failed to fetch alerts' });
    }
};

const getPortfolio = async (req, res) => {
    try {
        // Technically lenderId in params vs auth header. 
        // Best practice: verify header matches param, or just enforce header.
        const lenderIdFromAuth = req.lenderId;
        const requestedLenderId = req.params.id;

        if (String(lenderIdFromAuth) !== String(requestedLenderId)) {
            return res.status(403).json({ error: 'Access denied: Cannot view other lender portfolios' });
        }

        const invQuery = await pool.query(
            'SELECT id, invoice_number, amount, invoice_date, status, risk_score FROM invoices WHERE lender_id = $1 ORDER BY invoice_date DESC',
            [lenderIdFromAuth]
        );

        res.json(invQuery.rows);
    } catch (error) {
        console.error('Error fetching portfolio:', error);
        res.status(500).json({ error: 'Failed to fetch portfolio' });
    }
};

module.exports = {
    getAlerts,
    getPortfolio
};
