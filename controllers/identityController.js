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

module.exports = {
    onboardSupplier,
    revokeCredential
};
