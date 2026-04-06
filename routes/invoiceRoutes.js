const express = require('express');
const router = express.Router();
const invoiceController = require('../controllers/invoiceController');
const { ensureLenderAuth } = require('../middleware/lenderAuth');

router.use(ensureLenderAuth);

router.post('/', invoiceController.submitInvoice);
router.get('/:id', invoiceController.getInvoiceDetails);
router.get('/:id/audits', invoiceController.getInvoiceAudits);
router.post('/:id/trigger-ai', invoiceController.triggerAIExplainer);
router.post('/:id/disburse', invoiceController.preDisbursementGate);
router.post('/:id/override', invoiceController.manualOverride);

module.exports = router;
