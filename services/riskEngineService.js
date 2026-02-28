const pool = require('../db/index');

const FRAUD_RULES = [
    { id: 'revenue_feasibility', points: 30, description: 'Invoice > 80% annual revenue' },
    { id: 'single_invoice_large', points: 20, description: 'Single invoice > 30% annual revenue' },
    { id: 'monthly_volume_spike', points: 20, description: 'Monthly total > 3x historical avg' },
    { id: 'velocity_anomaly', points: 20, description: 'Rate > 3x historical in rolling window' },
    { id: 'off_hours_submission', points: 10, description: 'Submitted 11pm–5am' },
    { id: 'sequential_invoice_nos', points: 15, description: 'Bot-pattern invoice numbering' },
    { id: 'dormant_entity_burst', points: 25, description: 'Quiet 90d then sudden spike' },
    { id: 'new_relationship_value', points: 15, description: 'Relationship <60d + amount >$500K' },
    { id: 'single_buyer_supplier', points: 10, description: 'Supplier has only one buyer' },
    { id: 'payment_term_anomaly', points: 15, description: 'Payment terms >90 days' },
    { id: 'dilution_rate_high', points: 20, description: 'Rolling dilution rate >5%' },
    { id: 'triple_match_fail', points: 40, description: 'No matching PO/GRN found' },
    { id: 'cascade_over_financing', points: 50, description: 'Total financed > 110% root PO' },
    { id: 'carousel_trade_detected', points: 60, description: 'Circular trade pattern detected (90d)' },
    { id: 'isolated_node_detection', points: 10, description: 'Supplier has only one trading partner' },
    { id: 'semantic_mismatch', points: 40, description: 'Document goods descriptions mismatch' },
    { id: 'vague_description', points: 15, description: 'Vague description (phantom signal)' },
    { id: 'templated_invoices', points: 30, description: 'Bot-like repeated descriptions' },
];

const graphEngineService = require('./graphEngineService');
const semanticService = require('./semanticService');

const evaluateRisk = async (lenderId, invoiceId, supplierId, buyerId, amount, invoiceDate, expectedPaymentDate, basePoints, baseBreakdown) => {
    let totalScore = basePoints || 0;
    const finalBreakdown = [...(baseBreakdown || [])];
    const amountNum = Number(amount);
    const invDateObj = new Date(invoiceDate);

    // FETCH SUPPLIER DATA
    const suppQuery = await pool.query('SELECT * FROM companies WHERE id = $1', [supplierId]);
    const supplier = suppQuery.rows[0];

    // Helper to add penalty
    const applyPenalty = (ruleId, detailOverride) => {
        const rule = FRAUD_RULES.find(r => r.id === ruleId);
        if (rule) {
            totalScore += rule.points;
            finalBreakdown.push({ factor: rule.id, points: rule.points, detail: detailOverride || rule.description });
        }
    };

    if (supplier) {
        const annualRevenue = Number(supplier.annual_revenue || 0);
        const monthlyAvg = Number(supplier.monthly_avg_invoicing || 0);

        // Rule 1: Revenue Feasibility (Invoice > 80% annual revenue)
        if (annualRevenue > 0 && amountNum > annualRevenue * 0.8) {
            applyPenalty('revenue_feasibility', `Invoice amount $${amountNum.toFixed(2)} exceeds 80% of annual revenue $${annualRevenue.toFixed(2)}`);
        }

        // Rule 2: Single Invoice Large (Invoice > 30% annual revenue)
        if (annualRevenue > 0 && amountNum > annualRevenue * 0.3 && amountNum <= annualRevenue * 0.8) {
            applyPenalty('single_invoice_large', `Single invoice amount $${amountNum.toFixed(2)} is >30% of annual revenue`);
        }

        // Rule 3: Monthly Volume Spike (> 3x historical avg)
        const monthStart = new Date(invDateObj);
        monthStart.setDate(1);
        monthStart.setHours(0, 0, 0, 0);
        const monthlyVolQuery = await pool.query(`
            SELECT SUM(amount) as current_month_total 
            FROM invoices 
            WHERE supplier_id = $1 AND invoice_date >= $2 AND id != $3
        `, [supplierId, monthStart, invoiceId]);
        const currentMonthTotal = Number(monthlyVolQuery.rows[0].current_month_total || 0) + amountNum;

        if (monthlyAvg > 0 && currentMonthTotal > (monthlyAvg * 3)) {
            applyPenalty('monthly_volume_spike', `Current month total $${currentMonthTotal.toFixed(2)} is >3x historical average $${monthlyAvg.toFixed(2)}`);
        }

        // Rule 7: Dormant Entity Burst (Quiet > 90d then sudden spike)
        if (supplier.last_invoice_date) {
            const daysSinceLast = (invDateObj - new Date(supplier.last_invoice_date)) / (1000 * 60 * 60 * 24);
            if (daysSinceLast > 90) {
                applyPenalty('dormant_entity_burst', `Supplier was dormant for ${Math.round(daysSinceLast)} days before this invoice`);
            }
        }
    }

    // Rule 5: Off-hours Submission (11pm-5am)
    const hour = invDateObj.getUTCHours();
    if (hour >= 23 || hour <= 5) {
        applyPenalty('off_hours_submission', `Invoice submitted at off-hour: ${hour}:00 UTC`);
    }

    // Rule 10: Payment Term Anomaly (> 90 days)
    const expDateObj = new Date(expectedPaymentDate);
    const termDays = (expDateObj - invDateObj) / (1000 * 60 * 60 * 24);
    if (termDays > 90) {
        applyPenalty('payment_term_anomaly', `Payment terms of ${Math.round(termDays)} days exceeds 90-day standard`);
    }

    // Rule 6 & 4: Velocity/Bot Anomaly Proxy
    const hourlyVolQuery = await pool.query(`
        SELECT COUNT(*) as recent_count 
        FROM invoices 
        WHERE supplier_id = $1 AND invoice_date >= (CAST($2 AS TIMESTAMP) - INTERVAL '1 hour')
    `, [supplierId, invoiceDate]);
    const recentCount = Number(hourlyVolQuery.rows[0].recent_count);

    if (recentCount > 5) {
        applyPenalty('sequential_invoice_nos', `Bot-pattern proxy: ${recentCount} invoices submitted in the last hour`);
        applyPenalty('velocity_anomaly', `High velocity: ${recentCount} invoices in rolling 1-hour window`);
    }

    // Rule 8 & 9: Relationship Rules
    const tradeRelQuery = await pool.query('SELECT COUNT(DISTINCT buyer_id) as buyer_count FROM trade_relationships WHERE supplier_id = $1', [supplierId]);
    const buyerCount = Number(tradeRelQuery.rows[0].buyer_count || 0);

    const rawBuyerQuery = await pool.query('SELECT COUNT(DISTINCT buyer_id) as raw_count FROM invoices WHERE supplier_id = $1', [supplierId]);
    const actualBuyerCount = Math.max(buyerCount, Number(rawBuyerQuery.rows[0].raw_count));

    if (actualBuyerCount === 1) {
        applyPenalty('single_buyer_supplier', 'Supplier has historically only transacted with one buyer');
    }

    if (actualBuyerCount === 0 && amountNum > 500000) {
        // Technically a new relationship to this buyer on a massive invoice
        applyPenalty('new_relationship_value', `No prior history with buyer, but amount is $${amountNum} (>500K)`);
    }

    // Rule 11: Dilution rate high
    const dilutionQuery = await pool.query(`
        SELECT SUM(i.amount) as expected_total, SUM(s.actual_payment_amount) as actual_total
        FROM invoices i
        JOIN settlements s ON i.id = s.invoice_id
        WHERE i.supplier_id = $1
    `, [supplierId]);

    if (dilutionQuery.rows[0] && dilutionQuery.rows[0].expected_total) {
        const expTotal = Number(dilutionQuery.rows[0].expected_total);
        const actTotal = Number(dilutionQuery.rows[0].actual_total);
        if (expTotal > 0 && actTotal > 0) {
            const dilutionRate = (expTotal - actTotal) / expTotal;
            if (dilutionRate > 0.05) {
                applyPenalty('dilution_rate_high', `Historical dilution rate is ${(dilutionRate * 100).toFixed(1)}% (Threshold: 5%)`);
            }
        }
    }

    // --- LAYER 5: GRAPH ENGINE RULES ---

    // 1. Cascade Over-financing Check
    const poQuery = await pool.query('SELECT id FROM purchase_orders WHERE id = (SELECT po_id FROM invoices WHERE id = $1)', [invoiceId]);
    if (poQuery.rows.length > 0) {
        const rootPoId = poQuery.rows[0].id; // Simplified: assuming current PO is potential root or part of chain
        const cascade = await graphEngineService.calculateCascadeExposure(rootPoId);
        if (cascade.ratio > 1.1) {
            applyPenalty('cascade_over_financing', `Total chain financing is ${(cascade.ratio * 100).toFixed(1)}% of root PO (Exceeds 110%)`);
        }
    }

    // 2. Carousel Trade Detection
    const cycles = await graphEngineService.detectCycles(lenderId);
    const hasCycle = cycles.some(c => c.path.includes(supplierId) && c.path.includes(buyerId));
    if (hasCycle) {
        applyPenalty('carousel_trade_detected', 'Supplier/Buyer are part of a circular trade chain within 90 days');
    }

    // 3. Isolated Node Check
    const isolated = await graphEngineService.detectIsolatedNodes(lenderId);
    if (isolated.some(i => i.supplier_id === supplierId)) {
        applyPenalty('isolated_node_detection', 'Supplier has historically only transacted with one buyer (Graph Analysis)');
    }

    // --- LAYER 6: SEMANTIC LAYER RULES (PARALLEL FOR SPEED) ---

    // Fetch related docs for consistency check
    const docsQuery = await pool.query(`
        SELECT p.goods_category as po_desc, g.amount_received, i.goods_category as inv_desc
        FROM invoices i
        LEFT JOIN purchase_orders p ON i.po_id = p.id
        LEFT JOIN goods_receipts g ON i.grn_id = g.id
        WHERE i.id = $1
    `, [invoiceId]);

    const docData = docsQuery.rows[0];
    const semanticTasks = [];

    if (docData) {
        // Task A: Document Consistency
        semanticTasks.push(semanticService.verifyDocumentConsistency(
            { description: docData.inv_desc },
            { description: docData.po_desc },
            { description: `Received ${docData.amount_received}` } // Mocking GRN desc
        ).then(res => { if (!res.isConsistent) applyPenalty('semantic_mismatch', res.mismatchReason); }));

        // Task B: Vague Description
        semanticTasks.push(semanticService.checkVagueDescriptions(docData.inv_desc)
            .then(res => { if (res.isVague) applyPenalty('vague_description', res.reason); }));
    }

    // Task C: Supplier History Similarity
    semanticTasks.push(semanticService.analyzeSupplierSimilarity(supplierId)
        .then(res => { if (res.isSuspicious) applyPenalty('templated_invoices', res.reason); }));

    // Wait for LLM results (max performance)
    await Promise.all(semanticTasks);

    // 4. Centrality Multiplier (APPLIED LAST)
    const centrality = await graphEngineService.calculateCentrality(lenderId);
    const entityDegree = centrality.find(c => Number(c.company_id) === Number(supplierId))?.degree ?? 0;

    if (entityDegree > 5 && finalBreakdown.length > 0) {
        const multiplier = 1.3;
        const previousScore = totalScore;
        totalScore = Math.min(100, Math.round(totalScore * multiplier));
        finalBreakdown.push({
            factor: 'centrality_multiplier',
            points: `x${multiplier}`,
            detail: `High-centrality node (${entityDegree} partners) with existing flags. Score increased from ${previousScore} to ${totalScore}`
        });
    }

    // Determine target status
    let status = 'APPROVED';
    if (totalScore >= 60) status = 'BLOCKED';
    else if (totalScore >= 30) status = 'REVIEW';

    let recommendation = 'APPROVE_DISBURSEMENT';
    if (status === 'BLOCKED') recommendation = 'BLOCK_DISBURSEMENT';
    else if (status === 'REVIEW') recommendation = 'MANUAL_REVIEW_REQUIRED';

    // Persist Updates
    await pool.query('UPDATE invoices SET status = $1, risk_score = $2 WHERE id = $3', [status, totalScore, invoiceId]);

    if (supplier) {
        await pool.query('UPDATE companies SET last_invoice_date = $1 WHERE id = $2', [invDateObj, supplierId]);
    }

    await pool.query('INSERT INTO risk_score_audits (invoice_id, score, breakdown) VALUES ($1, $2, $3)', [invoiceId, totalScore, JSON.stringify(finalBreakdown)]);

    if (status !== 'APPROVED') {
        const primaryFactor = finalBreakdown.length > 0 ? finalBreakdown[0].factor : 'unknown';
        await pool.query(
            'INSERT INTO alerts (invoice_id, lender_id, severity, fraud_rule, message) VALUES ($1, $2, $3, $4, $5)',
            [invoiceId, lenderId, status === 'BLOCKED' ? 'CRITICAL' : 'WARNING', primaryFactor, `Invoice blocked/flagged with score ${totalScore}`]
        );
    }

    return {
        invoiceId,
        status,
        riskScore: totalScore,
        breakdown: finalBreakdown,
        recommendation
    };
};

module.exports = {
    FRAUD_RULES,
    evaluateRisk
};
