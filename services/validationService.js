const pool = require('../db/index');
const crypto = require('crypto');

// Helpers
const generateFingerprint = (supplierId, buyerId, amount, invoiceDate) => {
    const raw = `${supplierId}-${buyerId}-${Number(amount).toFixed(2)}-${new Date(invoiceDate).toISOString().split('T')[0]}`;
    return crypto.createHash('sha256').update(raw).digest('hex');
};

const checkTripleMatch = async (lenderId, poId, grnId, invoiceAmount, invoiceDate, supplierId, buyerId) => {
    const breakdown = [];
    let penaltyPoints = 0;

    // 1. Fetch PO and GRN
    const poQuery = await pool.query('SELECT * FROM purchase_orders WHERE id = $1 AND lender_id = $2', [poId, lenderId]);
    const grnQuery = await pool.query('SELECT * FROM goods_receipts WHERE id = $1 AND lender_id = $2', [grnId, lenderId]);

    const po = poQuery.rows[0];
    const grn = grnQuery.rows[0];

    // If either missing -> Triple Match Fail
    if (!po || !grn) {
        penaltyPoints += 40;
        breakdown.push({
            factor: 'triple_match_fail',
            points: 40,
            detail: !po ? 'Purchase Order not found' : 'Goods Receipt Note not found'
        });
        return { valid: false, points: penaltyPoints, breakdown };
    }

    // 2. Amount Tolerance (±5% variance allowed)
    const toleranceMin = Number(po.amount) * 0.95;
    const toleranceMax = Number(po.amount) * 1.05;
    if (Number(invoiceAmount) < toleranceMin || Number(invoiceAmount) > toleranceMax) {
        penaltyPoints += 30; // Custom penalty not strictly defined in 12 rules but severe
        breakdown.push({ factor: 'amount_tolerance_fail', points: 30, detail: `Invoice amount ${invoiceAmount} outside 5% PO tolerance (${po.amount})` });
    }

    // 3. Date Sequence (PO < GRN < Invoice)
    if (new Date(po.po_date) > new Date(grn.grn_date) || new Date(grn.grn_date) > new Date(invoiceDate)) {
        penaltyPoints += 20;
        breakdown.push({ factor: 'date_sequence_fail', points: 20, detail: 'Dates not sequential: PO < GRN < Invoice' });
    }

    // 4. ID Consistency Check
    if (po.supplier_id !== Number(supplierId) || po.buyer_id !== Number(buyerId)) {
        penaltyPoints += 40;
        breakdown.push({ factor: 'entity_mismatch', points: 40, detail: 'Invoice supplier/buyer does not match PO' });
    }

    return { valid: penaltyPoints === 0, points: penaltyPoints, breakdown };
};

const detectDuplicates = async (lenderId, fingerprint, supplierId, buyerId, amount, invoiceDate, invoiceNumber) => {
    const breakdown = [];
    let penaltyPoints = 0;
    let duplicateOf = null;

    // 1. Exact Duplicate (Cross-lender via fingerprint)
    // NOTE: We intentionally do NOT filter by lenderId here (Feature 12)
    const exactCheck = await pool.query(`
        SELECT f.lender_id, i.invoice_number 
        FROM invoice_fingerprints f
        JOIN invoices i ON f.invoice_id = i.id
        WHERE f.fingerprint = $1
    `, [fingerprint]);

    if (exactCheck.rows.length > 0) {
        const match = exactCheck.rows[0];
        duplicateOf = match.invoice_number;
        penaltyPoints += 100; // Auto-block
        breakdown.push({
            factor: 'exact_duplicate',
            points: 100,
            detail: `Exact cross-lender duplicate found. Originally submitted by lender ${match.lender_id}`
        });
        return { isDuplicate: true, duplicateOf, points: penaltyPoints, breakdown };
    }

    // 2. Fuzzy Duplicate (Same lender, same parties, amt ±2%, date ±3d, diff invoice_number)
    const amountNum = Number(amount);
    const amtMin = amountNum * 0.98;
    const amtMax = amountNum * 1.02;

    const fuzzyCheck = await pool.query(`
        SELECT invoice_number FROM invoices 
        WHERE lender_id = $1
        AND supplier_id = $2
        AND buyer_id = $3
        AND amount >= $4 AND amount <= $5
        AND invoice_date >= (CAST($6 AS TIMESTAMP) - INTERVAL '3 days')
        AND invoice_date <= (CAST($6 AS TIMESTAMP) + INTERVAL '3 days')
        AND invoice_number != $7
    `, [lenderId, supplierId, buyerId, amtMin, amtMax, invoiceDate, invoiceNumber]);

    if (fuzzyCheck.rows.length > 0) {
        duplicateOf = fuzzyCheck.rows[0].invoice_number;
        penaltyPoints += 50;
        breakdown.push({
            factor: 'fuzzy_duplicate',
            points: 50,
            detail: `Fuzzy duplicate match detected with invoice ${duplicateOf}`
        });
        return { isDuplicate: true, duplicateOf, points: penaltyPoints, breakdown };
    }

    return { isDuplicate: false, duplicateOf: null, points: 0, breakdown: [] };
};

module.exports = {
    generateFingerprint,
    checkTripleMatch,
    detectDuplicates
};
