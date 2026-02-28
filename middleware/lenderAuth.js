const ensureLenderAuth = (req, res, next) => {
    const lenderId = req.headers['x-lender-id'];

    if (!lenderId) {
        return res.status(401).json({ error: 'Missing x-lender-id header. Multi-lender isolation required.' });
    }

    req.lenderId = lenderId;
    next();
};

module.exports = { ensureLenderAuth };
