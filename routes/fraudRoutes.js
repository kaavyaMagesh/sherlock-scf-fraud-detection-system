const express = require('express');
const router = express.Router();
const fraudController = require('../controllers/fraudController');

// Feature 1: Invoice Triple-Match Validation
router.post('/validate/triple-match', fraudController.validateTripleMatch);

// Feature 2: Duplicate Detection
router.post('/validate/fingerprint', fraudController.detectDuplicate);

// Feature 3: Relationship Gap Detection
router.get('/network/relationships/:supplierId', fraudController.detectRelationshipGap);

// Feature 4: Velocity & Sequencing Anomalies
router.get('/monitor/velocity/:supplierId', fraudController.monitorVelocity);

// Feature 5: Revenue Feasibility Check
router.get('/monitor/feasibility/:supplierId', fraudController.checkFeasibility);

// Feature 6: Dilution Fraud Detection
router.get('/monitor/dilution/:supplierId', fraudController.detectDilutionFraud);

// Feature 7: Cross-Tier Cascade Exposure
router.get('/network/cascade/:rootPoId', fraudController.checkCascadeExposure);

// Feature 8: Master Risk Dashboard
router.post('/evaluate-risk', fraudController.evaluateRisk);

module.exports = router;
