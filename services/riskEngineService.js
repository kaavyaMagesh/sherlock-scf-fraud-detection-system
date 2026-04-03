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
    { id: 'cascade_over_financing', points: 70, description: 'Total financed > 110% root PO' },
    { id: 'carousel_trade_detected', points: 60, description: 'Circular trade pattern detected (90d)' },
    { id: 'isolated_node_detection', points: 10, description: 'Supplier has only one trading partner' },
    { id: 'semantic_mismatch', points: 40, description: 'Document goods descriptions mismatch' },
    { id: 'vague_description', points: 15, description: 'Vague description (phantom signal)' },
    { id: 'templated_invoices', points: 30, description: 'Bot-like repeated descriptions' },
    { id: 'grn_invoice_mismatch', points: 25, description: 'Invoice vs GRN receipt amount misaligned' },
    { id: 'geographical_anomaly', points: 25, description: 'Unlikely delivery location for cargo type' },
    { id: 'payment_timeline_anomaly', points: 20, description: 'Payment terms outside industry norms' },
];

const graphEngineService = require('./graphEngineService');
const semanticService = require('./semanticService');
const explainabilityService = require('./explainabilityService');
const validationService = require('./validationService');

const FACTOR_WEIGHTS = {
    exact_duplicate: 1.0,
    fuzzy_duplicate: 0.75,
    triple_match_fail: 0.9,
    amount_tolerance_fail: 0.5,
    entity_mismatch: 0.6,
    entity_mismatch_grn: 0.6,
    grn_invoice_mismatch: 0.55,
    date_sequence_fail: 0.45,
    centrality_multiplier: 1.0,
    revenue_feasibility: 0.85,
    single_invoice_large: 0.5,
    monthly_volume_spike: 0.55,
    velocity_anomaly: 0.55,
    off_hours_submission: 0.35,
    sequential_invoice_nos: 0.45,
    dormant_entity_burst: 0.7,
    new_relationship_value: 0.5,
    single_buyer_supplier: 0.35,
    payment_term_anomaly: 0.45,
    dilution_rate_high: 0.6,
    cascade_over_financing: 0.9,
    carousel_trade_detected: 1.0,
    isolated_node_detection: 0.3,
    semantic_mismatch: 0.9,
    vague_description: 0.3,
    templated_invoices: 0.65,
    geographical_anomaly: 0.75,
    payment_timeline_anomaly: 0.5
};

let auditSchemaInitPromise = null;
const ensureAuditSchema = async () => {
    if (!auditSchemaInitPromise) {
        auditSchemaInitPromise = Promise.all([
            pool.query('ALTER TABLE risk_score_audits ADD COLUMN IF NOT EXISTS version INTEGER DEFAULT 1'),
            pool.query("ALTER TABLE risk_score_audits ADD COLUMN IF NOT EXISTS engine_version VARCHAR(20) DEFAULT 'v1'")
        ]);
    }
    return auditSchemaInitPromise;
};

const computeCompositeScore = (breakdown) => {
    const weightedScore = breakdown.reduce((sum, item) => {
        const points = Number(item.points);
        if (Number.isNaN(points)) return sum;
        const weight = FACTOR_WEIGHTS[item.factor] ?? 0.4;
        return sum + (points * weight);
    }, 0);

    return Math.max(0, Math.min(100, Math.round(weightedScore)));
};

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

    // Rule 5: Off-hours Submission (11pm-5am) — local wall-clock unless RISK_OFF_HOURS_USE_UTC=true
    const useUtc = process.env.RISK_OFF_HOURS_USE_UTC === 'true';
    const hour = useUtc ? invDateObj.getUTCHours() : invDateObj.getHours();
    const tzLabel = useUtc ? 'UTC' : 'local';
    if (hour >= 23 || hour <= 5) {
        applyPenalty('off_hours_submission', `Invoice submitted at off-hour: ${hour}:00 (${tzLabel})`);
    }

    // Rule 10: Payment Term Anomaly (> 90 days)
    const expDateObj = new Date(expectedPaymentDate);
    const termDays = (expDateObj - invDateObj) / (1000 * 60 * 60 * 24);
    if (termDays > 90) {
        applyPenalty('payment_term_anomaly', `Payment terms of ${Math.round(termDays)} days exceeds 90-day standard`);
    }

    // Rule 6: Velocity — 1h / 24h / 7d vs 3× historical average rate (90-day baseline)
    const baselineQuery = await pool.query(
        `
        SELECT GREATEST(COUNT(*)::float / NULLIF(90.0 * 24.0, 0), 0.00001) AS avg_invoices_per_hour
        FROM invoices
        WHERE supplier_id = $1
          AND invoice_date >= NOW() - INTERVAL '90 days'
          AND id != $2
        `,
        [supplierId, invoiceId]
    );
    const avgPerHour = Number(baselineQuery.rows[0]?.avg_invoices_per_hour || 0.00001);

    const velocityWindows = await pool.query(
        `
        SELECT
            COUNT(*) FILTER (
                WHERE invoice_date >= CAST($2 AS TIMESTAMP) - INTERVAL '1 hour'
                  AND invoice_date <= CAST($2 AS TIMESTAMP)
            ) AS c1h,
            COUNT(*) FILTER (
                WHERE invoice_date >= CAST($2 AS TIMESTAMP) - INTERVAL '24 hours'
                  AND invoice_date <= CAST($2 AS TIMESTAMP)
            ) AS c24h,
            COUNT(*) FILTER (
                WHERE invoice_date >= CAST($2 AS TIMESTAMP) - INTERVAL '7 days'
                  AND invoice_date <= CAST($2 AS TIMESTAMP)
            ) AS c7d
        FROM invoices
        WHERE supplier_id = $1 AND id != $3
        `,
        [supplierId, invoiceDate, invoiceId]
    );
    const c1h = Number(velocityWindows.rows[0]?.c1h || 0) + 1;
    const c24h = Number(velocityWindows.rows[0]?.c24h || 0) + 1;
    const c7d = Number(velocityWindows.rows[0]?.c7d || 0) + 1;

    const thr1h = Math.max(5, avgPerHour * 3);
    const thr24h = Math.max(30, avgPerHour * 24 * 3);
    const thr7d = Math.max(50, avgPerHour * 24 * 7 * 3);

    const velParts = [];
    if (c1h > thr1h) velParts.push(`1h=${c1h} (thr ${thr1h.toFixed(2)})`);
    if (c24h > thr24h) velParts.push(`24h=${c24h} (thr ${thr24h.toFixed(1)})`);
    if (c7d > thr7d) velParts.push(`7d=${c7d} (thr ${thr7d.toFixed(0)})`);
    if (velParts.length > 0) {
        applyPenalty(
            'velocity_anomaly',
            `Submission rate exceeds 3× historical baseline: ${velParts.join('; ')} (baseline ${avgPerHour.toFixed(4)}/hr over 90d)`
        );
    }

    const invNumRow = await pool.query('SELECT invoice_number FROM invoices WHERE id = $1', [invoiceId]);
    const invoiceNumberStr = invNumRow.rows[0]?.invoice_number || '';
    const seqPattern = await validationService.detectSequentialInvoicePattern(
        supplierId,
        invoiceNumberStr,
        invoiceId
    );
    if (seqPattern) {
        applyPenalty(
            'sequential_invoice_nos',
            'Consecutive numeric invoice numbering detected across recent supplier submissions (bot-like pattern)'
        );
    }

    // Rule 8 & 9: Relationship Rules
    const tradeRelQuery = await pool.query(
        'SELECT COUNT(DISTINCT buyer_id) as buyer_count FROM trade_relationships WHERE supplier_id = $1',
        [supplierId]
    );
    const buyerCount = Number(tradeRelQuery.rows[0].buyer_count || 0);

    const rawBuyerQuery = await pool.query(
        'SELECT COUNT(DISTINCT buyer_id) as raw_count FROM invoices WHERE supplier_id = $1',
        [supplierId]
    );
    const actualBuyerCount = Math.max(buyerCount, Number(rawBuyerQuery.rows[0].raw_count));

    const pairRel = await pool.query(
        `
        SELECT tr.first_trade_date
        FROM trade_relationships tr
        WHERE tr.supplier_id = $1 AND tr.buyer_id = $2 AND tr.lender_id = $3
        `,
        [supplierId, buyerId, lenderId]
    );
    let firstTrade = pairRel.rows[0]?.first_trade_date;
    if (!firstTrade) {
        const minInv = await pool.query(
            'SELECT MIN(invoice_date) AS d FROM invoices WHERE supplier_id = $1 AND buyer_id = $2',
            [supplierId, buyerId]
        );
        firstTrade = minInv.rows[0]?.d;
    }
    if (firstTrade) {
        const relAgeDays = (invDateObj - new Date(firstTrade)) / (1000 * 60 * 60 * 24);
        if (relAgeDays >= 0 && relAgeDays <= 60 && amountNum > 500000) {
            applyPenalty(
                'new_relationship_value',
                `Relationship age ${Math.round(relAgeDays)} days with invoice amount $${amountNum.toFixed(2)} (>500K)`
            );
        }
    }

    if (actualBuyerCount === 1) {
        applyPenalty('single_buyer_supplier', 'Supplier has historically only transacted with one buyer');
    }

    // Rule 11: Dilution — rolling 90-day window on settlements
    const dilutionQuery = await pool.query(
        `
        SELECT SUM(i.amount) AS expected_total, SUM(s.actual_payment_amount) AS actual_total
        FROM invoices i
        JOIN settlements s ON i.id = s.invoice_id
        WHERE i.supplier_id = $1
          AND s.payment_date >= NOW() - INTERVAL '90 days'
        `,
        [supplierId]
    );

    if (dilutionQuery.rows[0] && dilutionQuery.rows[0].expected_total) {
        const expTotal = Number(dilutionQuery.rows[0].expected_total);
        const actTotal = Number(dilutionQuery.rows[0].actual_total);
        if (expTotal > 0 && actTotal > 0) {
            const dilutionRate = (expTotal - actTotal) / expTotal;
            if (dilutionRate > 0.05) {
                applyPenalty(
                    'dilution_rate_high',
                    `Rolling 90d dilution rate ${(dilutionRate * 100).toFixed(1)}% (threshold 5%)`
                );
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
    const pathHasEntities = (path, sid, bid) => {
        const arr = Array.isArray(path) ? path.map((x) => Number(x)) : [];
        return arr.includes(Number(sid)) && arr.includes(Number(bid));
    };
    const hasCycle = cycles.some((c) => pathHasEntities(c.path, supplierId, buyerId));
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
        SELECT 
            p.goods_category as po_desc, p.amount as po_amount, p.payment_terms as po_terms, p.delivery_location as po_loc,
            g.amount_received, 
            i.goods_category as inv_desc, i.amount as inv_amount, i.delivery_location as inv_loc, i.payment_terms as inv_terms,
            i.invoice_date, i.expected_payment_date
        FROM invoices i
        LEFT JOIN purchase_orders p ON i.po_id = p.id
        LEFT JOIN goods_receipts g ON i.grn_id = g.id
        WHERE i.id = $1
    `, [invoiceId]);

    const docData = docsQuery.rows[0];
    const semanticTasks = [];

    if (docData) {
        // Task A: Document Consistency (Refined)
        semanticTasks.push(semanticService.verifyDocumentConsistency(
            { description: docData.inv_desc, amount: docData.inv_amount },
            { description: docData.po_desc, amount: docData.po_amount },
            { description: `Received items`, received: docData.amount_received }
        ).then(res => { if (!res.isConsistent) applyPenalty('semantic_mismatch', res.mismatchReason); }));

        // Task B: Vague Description
        semanticTasks.push(semanticService.checkVagueDescriptions(docData.inv_desc)
            .then(res => { if (res.isVague) applyPenalty('vague_description', res.reason); }));

        // Task D: Geography Plausibility (NEW)
        semanticTasks.push(semanticService.checkGeographyPlausibility(
            supplier, 
            docData.inv_loc || docData.po_loc, 
            docData.inv_desc
        ).then(res => { if (!res.isPlausible) applyPenalty('geographical_anomaly', res.reason); }));

        // Task E: Payment Timeline Norms (NEW)
        semanticTasks.push(semanticService.checkPaymentTimelineNorms(
            { 
                payment_terms: docData.inv_terms || docData.po_terms, 
                amount: docData.inv_amount,
                invoice_date: docData.invoice_date,
                expected_payment_date: docData.expected_payment_date
            },
            supplier
        ).then(res => { if (!res.isNormal) applyPenalty('payment_timeline_anomaly', res.reason); }));
    }

    // Task C: Supplier History Similarity
    semanticTasks.push(semanticService.analyzeSupplierSimilarity(supplierId)
        .then(res => { if (res.isSuspicious) applyPenalty('templated_invoices', res.reason); }));

    // Wait for LLM results (max performance)
    await Promise.all(semanticTasks);

    // Layer 3 composite score (0-100): weighted across all factors.
    totalScore = computeCompositeScore(finalBreakdown);

    // Centrality multiplier applied AFTER composite so it affects the persisted gate score
    const centrality = await graphEngineService.calculateCentrality(lenderId);
    const entityDegree = centrality.find((c) => Number(c.company_id) === Number(supplierId))?.degree ?? 0;
    if (entityDegree > 5 && finalBreakdown.length > 0) {
        const multiplier = 1.3;
        const beforeCentrality = totalScore;
        totalScore = Math.min(100, Math.round(totalScore * multiplier));
        const delta = totalScore - beforeCentrality;
        if (delta > 0) {
            finalBreakdown.push({
                factor: 'centrality_multiplier',
                points: delta,
                detail: `High-centrality supplier node (${entityDegree} distinct partners) with active risk flags: score ${beforeCentrality} → ${totalScore} (×${multiplier})`
            });
        }
    }

    // Determine target status
    let status = 'APPROVED';
    if (totalScore >= 60) status = 'BLOCKED';
    else if (totalScore >= 30) status = 'REVIEW';

    let recommendation = 'APPROVE_DISBURSEMENT';
    if (status === 'BLOCKED') recommendation = 'BLOCK_DISBURSEMENT';
    else if (status === 'REVIEW') recommendation = 'MANUAL_REVIEW_REQUIRED';

    // Manual lender approval: keep gate open even if model score is high (audit still records true score)
    const manualOverrideRes = await pool.query('SELECT 1 FROM manual_overrides WHERE invoice_id = $1 LIMIT 1', [invoiceId]);
    const hasManualOverride = manualOverrideRes.rows.length > 0;
    let statusToPersist = status;
    if (hasManualOverride) {
        statusToPersist = 'APPROVED';
        recommendation = 'APPROVE_DISBURSEMENT';
    }

    // Persist Updates
    await pool.query('UPDATE invoices SET status = $1, risk_score = $2 WHERE id = $3', [statusToPersist, totalScore, invoiceId]);

    if (supplier) {
        await pool.query('UPDATE companies SET last_invoice_date = $1 WHERE id = $2', [invDateObj, supplierId]);
    }

    await ensureAuditSchema();
    const versionQuery = await pool.query('SELECT COALESCE(MAX(version), 0) + 1 AS next_version FROM risk_score_audits WHERE invoice_id = $1', [invoiceId]);
    const nextVersion = Number(versionQuery.rows[0]?.next_version || 1);
    await pool.query(
        'INSERT INTO risk_score_audits (invoice_id, score, breakdown, version, engine_version) VALUES ($1, $2, $3, $4, $5)',
        [invoiceId, totalScore, JSON.stringify(finalBreakdown), nextVersion, 'v1']
    );

    if (!hasManualOverride && statusToPersist !== 'APPROVED') {
        const primaryFactor = finalBreakdown.length > 0 ? finalBreakdown[0].factor : 'unknown';
        const contagionVolume = await graphEngineService.calculateContagionScore(supplierId);
        
        const alertMsg = status === 'BLOCKED' 
            ? `Critical Block: Score ${totalScore}. Contagion Alert: ₹${(contagionVolume / 10000000).toFixed(2)} Cr volume at risk across neighbors.`
            : `Warning: Score ${totalScore}. Contagion exposure: ₹${(contagionVolume / 10000000).toFixed(2)} Cr.`;

        await pool.query(
            'INSERT INTO alerts (invoice_id, lender_id, severity, fraud_rule, message) VALUES ($1, $2, $3, $4, $5)',
            [invoiceId, lenderId, status === 'BLOCKED' ? 'CRITICAL' : 'WARNING', primaryFactor, alertMsg]
        );

        const websocketService = require('./websocketService');
        websocketService.broadcast({
            entityName: supplier ? supplier.name : 'Unknown Entity',
            invoiceId,
            fraudType: primaryFactor,
            score: totalScore,
            severity: status === 'BLOCKED' ? 'CRITICAL' : 'WARNING'
        });
    }

    const result = {
        invoiceId,
        status: statusToPersist,
        riskScore: totalScore,
        breakdown: finalBreakdown,
        recommendation,
        engineSuggestedStatus: status,
        manualOverrideApplied: hasManualOverride
    };

    // Ensure DNA/explanations are persisted before returning,
    // so the Verification Center drawer refresh shows the updated Fraud DNA immediately.
    try {
        await explainabilityService.generateExplanation(invoiceId, result);
    } catch (err) {
        console.error('Explanation save failed:', err);
    }

    return result;
};

module.exports = {
    FRAUD_RULES,
    evaluateRisk
};
