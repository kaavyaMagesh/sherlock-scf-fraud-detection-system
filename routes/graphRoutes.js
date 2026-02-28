const express = require('express');
const router = express.Router();
const graphEngineService = require('../services/graphEngineService');
const { ensureLenderAuth } = require('../middleware/lenderAuth');

router.use(ensureLenderAuth);

router.get('/topology', async (req, res) => {
    try {
        const lenderId = req.lenderId;
        const topology = await graphEngineService.getTopology(lenderId);
        res.json(topology);
    } catch (error) {
        console.error('Error fetching topology:', error);
        res.status(500).json({ error: 'Failed to fetch graph topology' });
    }
});

router.get('/ego/:entityId', async (req, res) => {
    try {
        const { entityId } = req.params;
        const egoNetwork = await graphEngineService.getEgoNetwork(entityId);
        res.json(egoNetwork);
    } catch (error) {
        console.error('Error fetching ego network:', error);
        res.status(500).json({ error: 'Failed to fetch ego network' });
    }
});

router.get('/cycles', async (req, res) => {
    try {
        const lenderId = req.lenderId;
        const cycles = await graphEngineService.detectCycles(lenderId);
        res.json(cycles);
    } catch (error) {
        console.error('Error detecting cycles:', error);
        res.status(500).json({ error: 'Failed to detect carousel trades' });
    }
});

module.exports = router;
