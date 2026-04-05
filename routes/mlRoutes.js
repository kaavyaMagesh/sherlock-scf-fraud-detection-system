const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs');

/**
 * @route GET /api/ml/clustering
 * @desc Returns the pre-trained supplier clustering results
 */
router.get('/clustering', (req, res) => {
    try {
        const dataPath = path.join(__dirname, '../ml/data/clustered_results.json');
        if (fs.existsSync(dataPath)) {
            const raw = fs.readFileSync(dataPath, 'utf8');
            res.json(JSON.parse(raw));
        } else {
            // Fallback to public if ml/data is missing
            const publicPath = path.join(__dirname, '../frontend/public/clustered_results.json');
            if (fs.existsSync(publicPath)) {
                res.json(JSON.parse(fs.readFileSync(publicPath, 'utf8')));
            } else {
                res.status(404).json({ error: 'Clustering model results not found. Run training script first.' });
            }
        }
    } catch (err) {
        res.status(500).json({ error: 'Failed to load clustering results', details: err.message });
    }
});

module.exports = router;
