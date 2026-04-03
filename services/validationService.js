const pool = require('../db/index');
const crypto = require('crypto');

// Helpers
const generateFingerprint = (supplierId, buyerId, invoiceNumber, amount, invoiceDate) => {
    const raw = `${supplierId}${buyerId}${invoiceNumber}${Number(amount).toFixed(2)}${new Date(invoiceDate).toISOString().split('T')[0]}`;
    return crypto.createHash('sha256').update(raw).digest('hex');
};

const checkTripleMatch = async (lenderId, poId, invoiceAmount, invoiceDate, supplierId, buyerId, invoiceNumber) => {
    const breakdown = [];
    let penaltyPoints = 0;

    // 1. Fetch PO, GRN and Delivery dynamically
    const poQuery = await pool.query('SELECT * FROM purchase_orders WHERE id = $1 AND lender_id = $2', [poId, lenderId]);
    const po = poQuery.rows[0];

    const grnQuery = await pool.query('SELECT * FROM goods_receipts WHERE po_id = $1 AND lender_id = $2 ORDER BY created_at DESC LIMIT 1', [poId, lenderId]);
    const grn = grnQuery.rows[0];

    let delivery = null;
    if (grn) {
        const deliveryQuery = await pool.query('SELECT * FROM delivery_confirmations WHERE grn_id = $1 AND lender_id = $2 ORDER BY created_at DESC LIMIT 1', [grn.id, lenderId]);
        delivery = deliveryQuery.rows[0];
    }

    // Document presence checks (Invoice -> PO -> GRN)
    if (!invoiceAmount || !invoiceDate || !supplierId || !buyerId || !invoiceNumber) {
        penaltyPoints += 40;
        breakdown.push({
            factor: 'triple_match_fail',
            points: 40,
            detail: 'Invoice not provided'
        });
        return { valid: false, points: penaltyPoints, breakdown };
    }

    if (!po) {
        penaltyPoints += 40;
        breakdown.push({
            factor: 'triple_match_fail',
            points: 40,
            detail: 'Purchase Order not found'
        });
        return { valid: false, points: penaltyPoints, breakdown };
    }

    if (!grn) {
        penaltyPoints += 40;
        breakdown.push({
            factor: 'triple_match_fail',
            points: 40,
            detail: 'Goods Receipt Note not found'
        });
        return { valid: false, points: penaltyPoints, breakdown };
    }

    if (!delivery) {
        penaltyPoints += 25;
        breakdown.push({ factor: 'delivery_missing', points: 25, detail: 'Delivery confirmation missing' });
    } else if (delivery.delivery_status === 'REJECTED') {
        penaltyPoints += 35;
        breakdown.push({ factor: 'delivery_rejected', points: 35, detail: 'Delivery was rejected' });
    } else if (delivery.delivery_status === 'PARTIAL') {
        penaltyPoints += 15;
        breakdown.push({ factor: 'delivery_partial', points: 15, detail: 'Delivery was partially fulfilled' });
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

    // 4. ID Consistency Check (invoice ↔ PO)
    if (po.supplier_id !== Number(supplierId) || po.buyer_id !== Number(buyerId)) {
        penaltyPoints += 40;
        breakdown.push({ factor: 'entity_mismatch', points: 40, detail: 'Invoice supplier/buyer does not match PO' });
    }

    // GRN rows do not store supplier/buyer; validate GRN belongs to this PO (chain integrity)
    if (Number(grn.po_id) !== Number(po.id)) {
        penaltyPoints += 40;
        breakdown.push({
            factor: 'entity_mismatch_grn',
            points: 40,
            detail: 'GRN is not linked to the same Purchase Order as this invoice'
        });
    }

    // Invoice amount vs goods received (±5% vs GRN receipt)
    if (grn.amount_received != null && Number(grn.amount_received) > 0) {
        const grnAmt = Number(grn.amount_received);
        const invAmt = Number(invoiceAmount);
        const relDiff = Math.abs(invAmt - grnAmt) / grnAmt;
        if (relDiff > 0.05) {
            penaltyPoints += 25;
            breakdown.push({
                factor: 'grn_invoice_mismatch',
                points: 25,
                detail: `Invoice amount ${invAmt} outside 5% of GRN amount received ${grnAmt}`
            });
        }
    }

    return { valid: penaltyPoints === 0, points: penaltyPoints, breakdown };
};

/** Last contiguous digit run at end of invoice number (e.g. INV-80012 → 80012) */
const extractTrailingInteger = (invoiceNumber) => {
    const m = String(invoiceNumber).match(/(\d+)$/);
    return m ? parseInt(m[1], 10) : null;
};

/**
 * True if this supplier shows ≥3 consecutive numeric invoice suffixes among recent invoices (bot-like sequencing).
 */
const detectSequentialInvoicePattern = async (supplierId, invoiceNumber, excludeInvoiceId) => {
    const current = extractTrailingInteger(invoiceNumber);
    if (current === null) return false;

    const res = await pool.query(
        `
        SELECT invoice_number
        FROM invoices
        WHERE supplier_id = $1 AND ($2::integer IS NULL OR id <> $2)
        ORDER BY invoice_date DESC
        LIMIT 14
        `,
        [supplierId, excludeInvoiceId]
    );

    const nums = [
        current,
        ...res.rows.map((r) => extractTrailingInteger(r.invoice_number)).filter((n) => n !== null)
    ];
    nums.sort((a, b) => a - b);

    let maxRun = 1;
    let run = 1;
    for (let i = 1; i < nums.length; i++) {
        if (nums[i] === nums[i - 1] + 1) {
            run += 1;
            maxRun = Math.max(maxRun, run);
        } else if (nums[i] !== nums[i - 1]) {
            run = 1;
        }
    }
    return maxRun >= 3;
};

const detectDuplicates = async (lenderId, fingerprint, supplierId, buyerId, amount, invoiceDate, invoiceNumber, excludeInvoiceId = null) => {
    const breakdown = [];
    let penaltyPoints = 0;
    let duplicateOf = null;

    // 1. Exact Duplicate (Cross-lender via fingerprint)
    // NOTE: We intentionally do NOT filter by lenderId here (Feature 12)
    // excludeInvoiceId: when re-evaluating, the current row's fingerprint must not match itself
    const exactCheck = await pool.query(
        `
        SELECT f.lender_id, i.invoice_number, f.invoice_id
        FROM invoice_fingerprints f
        JOIN invoices i ON f.invoice_id = i.id
        WHERE f.fingerprint = $1
          AND ($2::integer IS NULL OR f.invoice_id <> $2)
    `,
        [fingerprint, excludeInvoiceId]
    );

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

    // 2. Fuzzy Duplicate (Cross-lender, same parties, exact amount, date ±3d, diff invoice_number)
    const fuzzyCheck = await pool.query(
        `
        SELECT invoice_number FROM invoices 
        WHERE supplier_id = $1
        AND buyer_id = $2
        AND amount = $3
        AND invoice_date >= (CAST($4 AS TIMESTAMP) - INTERVAL '3 days')
        AND invoice_date <= (CAST($4 AS TIMESTAMP) + INTERVAL '3 days')
        AND invoice_number != $5
        AND ($6::integer IS NULL OR id <> $6)
    `,
        [supplierId, buyerId, amount, invoiceDate, invoiceNumber, excludeInvoiceId]
    );

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
    detectDuplicates,
    extractTrailingInteger,
    detectSequentialInvoicePattern
};
