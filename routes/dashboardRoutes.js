const express = require('express');
const router = express.Router();
const dashboardController = require('../controllers/dashboardController');
const { ensureLenderAuth } = require('../middleware/lenderAuth');

router.use(ensureLenderAuth);

router.get('/alerts', dashboardController.getAlerts);
router.get('/lender/:id/portfolio', dashboardController.getPortfolio);

module.exports = router;
