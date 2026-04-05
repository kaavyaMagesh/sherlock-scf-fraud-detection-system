const identityService = require('../services/identityService');
const pool = require('../db/index');

const onboardSupplier = async (req, res) => {
    try {
        const { companyId } = req.body;

        if (!companyId) {
            return res.status(400).json({ error: 'companyId is required' });
        }

        const result = await identityService.onboardSupplier(companyId);
        res.status(201).json({ message: 'Supplier successfully onboarded', did: result.did, vc: result.vc });

    } catch (error) {
        console.error('Error onboarding supplier:', error);
        res.status(500).json({ error: error.message || 'Failed to onboard supplier' });
    }
}

const revokeCredential = async (req, res) => {
    try {
        const { companyId } = req.params;
        const lenderId = req.lenderId; // Assuming lenderAuth middleware

        // Verify the lender has authority/relationship (basic check)
        const compQuery = await pool.query('SELECT * FROM companies WHERE id = $1 AND lender_id = $2', [companyId, lenderId]);

        if (compQuery.rows.length === 0) {
            return res.status(403).json({ error: 'Unauthorized to revoke credential for this company' });
        }

        await identityService.revokeCredential(companyId);

        res.json({ message: `Credential revoked for company ${companyId}. All future invoices will be blocked.` });
    } catch (error) {
        console.error('Error revoking credential:', error);
        res.status(500).json({ error: 'Failed to revoke credential' });
    }
}

const getCompanies = async (req, res) => {
    try {
        const lenderId = req.lenderId;
        const result = await pool.query('SELECT id, name, tier FROM companies WHERE lender_id = $1 ORDER BY name ASC', [lenderId]);
        res.json(result.rows);
    } catch (error) {
        console.error('Error fetching companies:', error);
        res.status(500).json({ error: 'Failed to fetch companies' });
    }
}

const createCompany = async (req, res) => {
    try {
        const lenderId = req.lenderId;
        const { name, tier, annual_revenue } = req.body;

        if (!name) {
            return res.status(400).json({ error: 'Company name is required' });
        }

        const result = await pool.query(
            'INSERT INTO companies (lender_id, name, tier, annual_revenue, monthly_avg_invoicing) VALUES ($1, $2, $3, $4, $5) RETURNING *',
            [lenderId, name, tier || 1, annual_revenue || 1000000, 50000] // Defaults for manual entries
        );

        res.status(201).json(result.rows[0]);
    } catch (error) {
        console.error('Error creating company:', error);
        res.status(500).json({ error: 'Failed to create company' });
    }
}

const getCompanyProfile = async (req, res) => {
    try {
        const lenderId = req.lenderId;
        const companyId = req.params.id;

        const companyQuery = await pool.query(
            'SELECT id, name, tier FROM companies WHERE id = $1 AND lender_id = $2',
            [companyId, lenderId]
        );
        if (companyQuery.rows.length === 0) {
            return res.status(404).json({ error: 'Company not found for lender' });
        }

        const profileQuery = await pool.query(
            `SELECT
                COALESCE(
                    AVG(
                        GREATEST(
                            COALESCE(i.risk_score, 0),
                            CASE i.status
                                WHEN 'BLOCKED' THEN 60
                                WHEN 'REVIEW' THEN 30
                                ELSE 0
                            END
                        )
                    ),
                    0
                ) AS avg_risk_score,
                COALESCE(
                    MAX(
                        GREATEST(
                            COALESCE(i.risk_score, 0),
                            CASE i.status
                                WHEN 'BLOCKED' THEN 60
                                WHEN 'REVIEW' THEN 30
                                ELSE 0
                            END
                        )
                    ),
                    0
                ) AS max_risk_score,
                COUNT(*)::INT AS active_invoices,
                COALESCE(SUM(i.amount), 0) AS total_volume,
                BOOL_OR(i.status = 'BLOCKED') AS has_blocked_invoice,
                BOOL_OR(i.status = 'REVIEW') AS has_review_invoice,
                (
                    SELECT i2.status
                    FROM invoices i2
                    WHERE i2.lender_id = $1
                      AND (i2.supplier_id = $2 OR i2.buyer_id = $2)
                    ORDER BY i2.invoice_date DESC NULLS LAST
                    LIMIT 1
                ) AS latest_invoice_status
             FROM invoices i
             WHERE i.lender_id = $1
               AND (i.supplier_id = $2 OR i.buyer_id = $2)`,
            [lenderId, companyId]
        );

        const row = profileQuery.rows[0];
        const active = row ? Number(row.active_invoices || 0) : 0;
        const maxRisk = row ? Number(row.max_risk_score || 0) : 0;
        const hasBlocked = row ? Boolean(row.has_blocked_invoice) : false;
        const hasReview = row ? Boolean(row.has_review_invoice) : false;
        const entityStatus =
            active === 0
                ? 'UNKNOWN'
                : hasBlocked
                    ? 'BLOCKED'
                    : hasReview
                        ? 'REVIEW'
                        : maxRisk >= 60
                            ? 'BLOCKED'
                            : maxRisk >= 30
                                ? 'REVIEW'
                                : 'APPROVED';

        res.json({
            ...companyQuery.rows[0],
            avgRiskScore: row ? Number(row.avg_risk_score || 0) : 0,
            maxRiskScore: maxRisk,
            latestInvoiceStatus: row?.latest_invoice_status || null,
            activeInvoices: active,
            totalVolume: row ? Number(row.total_volume || 0) : 0,
            hasBlockedInvoice: hasBlocked,
            hasReviewInvoice: hasReview,
            status: entityStatus
        });
    } catch (error) {
        console.error('Error fetching company profile:', error);
        res.status(500).json({ error: 'Failed to fetch company profile' });
    }
}

const getPOs = async (req, res) => {
    try {
        const lenderId = req.lenderId;
        const result = await pool.query('SELECT id, amount, goods_category FROM purchase_orders WHERE lender_id = $1 ORDER BY po_date DESC', [lenderId]);
        res.json(result.rows);
    } catch (error) {
        console.error('Error fetching POs:', error);
        res.status(500).json({ error: 'Failed to fetch POs' });
    }
}

const getGRNs = async (req, res) => {
    try {
        const lenderId = req.lenderId;
        const result = await pool.query('SELECT id, po_id, amount_received FROM goods_receipts WHERE lender_id = $1 ORDER BY grn_date DESC', [lenderId]);
        res.json(result.rows);
    } catch (error) {
        console.error('Error fetching GRNs:', error);
        res.status(500).json({ error: 'Failed to fetch GRNs' });
    }
}

module.exports = {
    onboardSupplier,
    revokeCredential,
    getCompanies,
    createCompany,
    getCompanyProfile,
    getPOs,
    getGRNs
};
