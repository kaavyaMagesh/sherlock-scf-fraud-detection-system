const express = require('express');
const router = express.Router();
const scoreController = require('../controllers/scoreController');
const { ensureLenderAuth } = require('../middleware/lenderAuth');

router.use(ensureLenderAuth);

router.get('/:id', scoreController.getScore);
router.post('/:id/recalculate', scoreController.recalculateScore);

module.exports = router;
