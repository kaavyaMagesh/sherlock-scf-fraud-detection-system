const express = require('express');
const router = express.Router();
const identityController = require('../controllers/identityController');
const { ensureLenderAuth } = require('../middleware/lenderAuth');

router.use(ensureLenderAuth);

router.post('/onboard', identityController.onboardSupplier);
router.post('/revoke/:companyId', identityController.revokeCredential);

module.exports = router;
