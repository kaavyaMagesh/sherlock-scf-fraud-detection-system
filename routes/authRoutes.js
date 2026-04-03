const express = require('express');
const router = express.Router();
const pool = require('../db/index');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { JWT_SECRET } = require('../middleware/authMiddleware');

router.post('/login', async (req, res) => {
    const { email, password } = req.body;
    
    if (!email || !password) {
        return res.status(400).json({ error: 'Email and password required' });
    }

    try {
        const result = await pool.query(`SELECT * FROM portal_users WHERE email = $1`, [email]);
        if (result.rows.length === 0) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        const user = result.rows[0];
        const match = await bcrypt.compare(password, user.password_hash);
        if (!match) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        const token = jwt.sign(
            { 
                id: user.id, 
                company_id: user.company_id, 
                lender_id: user.lender_id, 
                role: user.role 
            }, 
            JWT_SECRET, 
            { expiresIn: '24h' }
        );

        res.json({ token, user: { id: user.id, role: user.role, company_id: user.company_id, lender_id: user.lender_id, email: user.email } });
    } catch (err) {
        console.error("Login error:", err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

router.post('/logout', (req, res) => {
    // With stateless JWT, frontend just drops the token. 
    // We provide a stub for completeness.
    res.json({ message: 'Logged out successfully' });
});

module.exports = router;
