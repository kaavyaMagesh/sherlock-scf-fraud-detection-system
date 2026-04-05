const jwt = require('jsonwebtoken');
require('dotenv').config({ path: '../.env' });

const JWT_SECRET = process.env.JWT_SECRET || 'sherlock-super-secret-key-123';

const requireAuth = (req, res, next) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'Unauthorized: Missing or invalid token' });
    }

    const token = authHeader.split(' ')[1];
    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        req.user = decoded; // { id, company_id, lender_id, role }
        req.lenderId = decoded.lender_id;
        next();
    } catch (err) {
        return res.status(403).json({ error: 'Forbidden: Invalid or expired token' });
    }
};

const requireRole = (allowedRoles) => {
    return (req, res, next) => {
        const userRole = (req.user?.role || '').toUpperCase();
        const normalizedAllowed = allowedRoles.map(r => r.toUpperCase());
        if (!req.user || !normalizedAllowed.includes(userRole)) {
            return res.status(403).json({ error: `Forbidden: Requires role in [${allowedRoles.join(',')}]` });
        }
        next();
    };
};

const requireBuyer = requireRole(['BUYER', 'LENDER']); // Often lenders can view buyer stuff too if needed, but strictly:
const requireBuyerStrict = requireRole(['BUYER']);
const requireSupplier = requireRole(['SUPPLIER']);
const requireLender = requireRole(['LENDER']);

module.exports = { requireAuth, requireRole, requireBuyer, requireBuyerStrict, requireSupplier, requireLender, JWT_SECRET };
