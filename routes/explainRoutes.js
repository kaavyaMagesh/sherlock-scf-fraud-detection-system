const express = require('express');
const router = express.Router();
const explainController = require('../controllers/explainController');
const { ensureLenderAuth } = require('../middleware/lenderAuth');

router.use(ensureLenderAuth);

router.get('/:invoiceId', explainController.getExplanation);

module.exports = router;
