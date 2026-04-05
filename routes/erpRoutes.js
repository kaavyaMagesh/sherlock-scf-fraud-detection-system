const express = require('express');
const router = express.Router();
const erpController = require('../controllers/erpController');
const { requireAuth, requireBuyer, requireSupplier } = require('../middleware/authMiddleware');

router.use(requireAuth);

// Buyer Routes
router.get('/purchase-orders', requireBuyer, erpController.getPurchaseOrders);
router.post('/purchase-orders', requireBuyer, erpController.createPurchaseOrder);

router.get('/goods-receipts', requireBuyer, erpController.getGoodsReceipts);
router.post('/goods-receipts', requireBuyer, erpController.createGoodsReceipt);

router.get('/deliveries', requireBuyer, erpController.getDeliveries);
router.post('/deliveries', requireBuyer, erpController.createDelivery);

// B5 FIX: Buyer can now see their invoices including settlement status for dilution visibility
router.get('/buyer-invoices', requireBuyer, erpController.getBuyerInvoices);

// B4 FIX: Buyer can now raise formal disputes — feeds the settlements table and triggers Rule 11
router.post('/disputes', requireBuyer, erpController.handleDispute);

// Supplier Routes
router.get('/my-purchase-orders', requireSupplier, erpController.getSupplierPurchaseOrders);

module.exports = router;
