const express = require('express');
const router = express.Router();
const ingestionController = require('../controllers/ingestionController');
const { ensureLenderAuth } = require('../middleware/lenderAuth');

// Apply multi-lender isolation to all routes in this file
router.use(ensureLenderAuth);

// Ingestion endpoints
router.post('/pos', ingestionController.ingestPO);
router.post('/grns', ingestionController.ingestGRN);

module.exports = router;
