const pool = require('../db/index');

function generateCounterfactual(invoiceId, score, breakdown) {
    if (!breakdown || breakdown.length === 0) return "No counterfactual available.";

    const sorted = [...breakdown].sort((a, b) => {
        const aPoints = typeof a.points === 'number' ? a.points : parseInt(a.points.toString().replace('x', '0'));
        const bPoints = typeof b.points === 'number' ? b.points : parseInt(b.points.toString().replace('x', '0'));
        return bPoints - aPoints;
    });

    const topFactor = sorted[0];
    const dropPoints = typeof topFactor.points === 'number' ? topFactor.points : 0;

    let newScore = Math.max(0, score - dropPoints);
    if (topFactor.factor === 'centrality_multiplier') {
        newScore = Math.round(score / 1.3); // reverse multiplier as an approximation
    }

    const newStatus = newScore >= 60 ? 'BLOCKED' : (newScore >= 30 ? 'REVIEW' : 'APPROVED');

    return `If ${topFactor.factor.replace(/_/g, ' ')} was resolved, score drops to ${newScore} (${newStatus})`;
}

function detectImpatienceSignal(breakdown) {
    const hasDormant = breakdown.some(b => b.factor === 'dormant_entity_burst');
    const hasUrgency = breakdown.some(b => b.factor === 'off_hours_submission' || b.factor === 'velocity_anomaly');

    if (hasDormant && hasUrgency) {
        return "Dormant supplier active recently, submitted with high urgency — urgency is itself a signal";
    }
    return null;
}

function classifyFraudDNA(breakdown) {
    if (!breakdown || breakdown.length === 0) {
        return {
            typologies: [{
                label: 'LOW_RISK_PROFILE',
                confidence: 88,
                action: 'Continue standard monitoring; re-run scoring after material document changes.',
                isPrimary: true
            }],
            evidence: ['No fraud-rule factors fired in the latest risk audit.']
        };
    }

    /**
     * Sum the numeric point values for all breakdown items whose factor is in
     * the given targetFactors list. Handles numeric points, string multipliers
     * (e.g. "x1.3"), and string integers gracefully.
     */
    const sumPoints = (targetFactors) =>
        breakdown
            .filter(b => targetFactors.includes(b.factor))
            .reduce((total, b) => {
                const pts =
                    typeof b.points === 'number' ? b.points
                    : typeof b.points === 'string' && b.points.startsWith('x') ? 20
                    : parseInt(String(b.points), 10) || 0;
                return total + pts;
            }, 0);

    const factors = breakdown.map(b => b.factor);
    let typologies = [];
    
    // Separate standard markers and Gemini semantic reasoning
    const geminiFactors = ['semantic_mismatch', 'vague_description', 'templated_invoices', 'geographical_anomaly', 'payment_timeline_anomaly', 'unified_ai_narrative'];
    
    const standardEvidence = breakdown
        .filter(b => b.detail && !geminiFactors.includes(b.factor))
        .map(b => b.detail)
        .slice(0, 5);
        
    const technicalSummaryFactor = breakdown.find(b => b.factor === 'unified_ai_narrative');
    const technicalSummary = technicalSummaryFactor ? technicalSummaryFactor.detail : 
        breakdown
            .filter(b => b.detail && geminiFactors.includes(b.factor))
            .map(b => b.detail)
            .join('. ')
            .replace(/\. \./g, '.') + (breakdown.some(b => geminiFactors.includes(b.factor)) ? '.' : '');

    // ── DOUBLE_FINANCING ──────────────────────────────────────────────────────
    // Triggered by exact or fuzzy duplicate detection; points can be very high
    // (duplicate penalties are typically 40–60 pts each).
    if (factors.includes('exact_duplicate') || factors.includes('fuzzy_duplicate')) {
        const pts = sumPoints(['exact_duplicate', 'fuzzy_duplicate']);
        typologies.push({
            label: "DOUBLE_FINANCING",
            confidence: Math.min(99, Math.max(70, pts)),
            action: "Block disbursement immediately and notify compliance"
        });
    }

    // ── PHANTOM_INVOICE ───────────────────────────────────────────────────────
    // Triggered by document-quality failures; sum points from all three factors.
    if (factors.includes('vague_description') || factors.includes('triple_match_fail') || factors.includes('semantic_mismatch')) {
        const pts = sumPoints(['vague_description', 'triple_match_fail', 'semantic_mismatch']);
        typologies.push({
            label: "PHANTOM_INVOICE",
            confidence: Math.min(99, Math.max(60, pts)),
            action: "Freeze supplier account and request original shipping documents"
        });
    }

    // ── CAROUSEL_TRADE ────────────────────────────────────────────────────────
    if (factors.includes('carousel_trade_detected')) {
        const pts = sumPoints(['carousel_trade_detected']);
        typologies.push({
            label: "CAROUSEL_TRADE",
            confidence: Math.min(99, Math.max(65, pts)),
            action: "Investigate connected entities for circular money flow"
        });
    }

    // ── CROSS_TIER_CASCADE ────────────────────────────────────────────────────
    if (factors.includes('cascade_over_financing')) {
        const pts = sumPoints(['cascade_over_financing']);
        typologies.push({
            label: "CROSS_TIER_CASCADE",
            confidence: Math.min(99, Math.max(60, pts)),
            action: "Review supply chain root PO and financing limits"
        });
    }

    // ── VELOCITY_FRAUD ───────────────────────────────────────────────────────
    if (factors.includes('velocity_anomaly')) {
        const pts = sumPoints(['velocity_anomaly']);
        typologies.push({
            label: "VELOCITY_FRAUD",
            confidence: Math.min(99, Math.max(70, pts * 3)), // Multiplier to show higher confidence on velocity
            action: "Review submission timestamps and investigate potential automated/bot-driven invoicing"
        });
    }

    // ── DORMANT_ENTITY_BURST ──────────────────────────────────────────────────
    if (factors.includes('dormant_entity_burst')) {
        const pts = sumPoints(['dormant_entity_burst']);
        typologies.push({
            label: "DORMANT_ENTITY_BURST",
            confidence: Math.min(99, Math.max(55, pts)),
            action: "Require enhanced due diligence for account reactivation"
        });
    }

    // ── BURST_INVOICING ───────────────────────────────────────────────────────
    if (factors.includes('monthly_volume_spike')) {
        const pts = sumPoints(['monthly_volume_spike']);
        typologies.push({
            label: "BURST_INVOICING",
            confidence: Math.min(99, Math.max(60, pts)),
            action: "Verify current month's volume legitimacy against historical turnover"
        });
    }

    // ── DILUTION_FRAUD ────────────────────────────────────────────────────────
    // B3 FIX: payment_term_anomaly removed — it is a timing risk, not a cash
    //         collection failure. Grouping it here caused false DILUTION_FRAUD
    //         positives on invoices with Net-120 terms but clean settlement history.
    if (factors.includes('dilution_rate_high')) {
        // B2 FIX: extract the actual dilution percentage from the detail string
        // so confidence is proportional to how severe the shortfall is.
        // Detail format: "Rolling 90d dilution rate 32.4% (threshold 5%)"
        let dilutionPct = 0;
        try {
            const dilFactor = breakdown.find(b => b.factor === 'dilution_rate_high');
            if (dilFactor && typeof dilFactor.detail === 'string') {
                const match = dilFactor.detail.match(/dilution rate\s+([\d.]+)%/i);
                if (match) dilutionPct = parseFloat(match[1]);
            }
        } catch (_) { /* regex failed — fall through to fallback */ }

        // Formula: min(99,  max(50,  pct × 2))
        //   30% dilution  → confidence 60
        //   50% dilution  → confidence 99 (capped)
        //   0% (no match) → fallback 75
        const dilutionConf = dilutionPct > 0
            ? Math.min(99, Math.max(50, Math.round(dilutionPct * 2)))
            : 75;

        typologies.push({
            label: "DILUTION_FRAUD",
            confidence: dilutionConf,
            action: "Audit historical settlement patterns and cross-reference dispute logs for this supplier"
        });
    }

    // ── PAYMENT_TERM_RISK ─────────────────────────────────────────────────────
    // B3 FIX: payment_term_anomaly is a scheduling/timing risk, not a cash
    //         collection failure — given its own lower-confidence typology.
    if (factors.includes('payment_term_anomaly')) {
        const pts = sumPoints(['payment_term_anomaly']);
        typologies.push({
            label: "PAYMENT_TERM_RISK",
            confidence: Math.min(80, Math.max(40, pts)),
            action: "Review payment schedule with buyer and renegotiate terms to within 90-day standard"
        });
    }


    // ── OVER_INVOICING ────────────────────────────────────────────────────────
    // Confidence is delta-driven; regex hardened with try/catch + looser pattern
    // so detail-string format drift doesn't silently produce wrong values.
    if (factors.includes('amount_tolerance_fail')) {
        let baseConf = 75;
        try {
            const tolFactor = breakdown.find(b => b.factor === 'amount_tolerance_fail');
            if (tolFactor && typeof tolFactor.detail === 'string') {
                // Looser regex: tolerates varied spacing and wording around the numbers
                const match = tolFactor.detail.match(
                    /Invoice amount\s+([\d.]+).*?tolerance\s*\(\s*([\d.]+)\s*\)/i
                );
                if (match) {
                    const invAmt = parseFloat(match[1]);
                    const poAmt  = parseFloat(match[2]);
                    if (Number.isFinite(invAmt) && Number.isFinite(poAmt) && poAmt > 0 && invAmt > poAmt) {
                        baseConf = Math.min(99, Math.round(70 + ((invAmt - poAmt) / poAmt) * 100));
                    }
                }
            }
        } catch (_) {
            // Regex or parse failed — silently fall back to base confidence of 75
        }
        typologies.push({
            label: "OVER_INVOICING",
            confidence: baseConf,
            action: "Request original purchase order and verify contracted amounts with buyer directly."
        });
    }

    if (typologies.length === 0) {
        typologies.push({
            label: "UNKNOWN_PATTERN",
            confidence: 50,
            action: "Manual review recommended"
        });
    } else {
        typologies.sort((a, b) => b.confidence - a.confidence);
    }

    // Assign primary typology (highest confidence after sort)
    if (typologies.length > 0) typologies[0].isPrimary = true;

    return { 
        typologies, 
        evidence: standardEvidence,
        technicalSummary: technicalSummary || null 
    };
}

async function generateExplanation(invoiceId, riskResult) {
    try {
        const { riskScore, breakdown } = riskResult;

        const counterfactual = generateCounterfactual(invoiceId, riskScore, breakdown);
        const impatienceSignal = detectImpatienceSignal(breakdown);
        // Extract the high-fidelity AI narrative if it exists in the breakdown (Layer 6/7)
        const geminiFactor = breakdown.find(b => b.factor === 'unified_ai_narrative');
        const geminiReasoning = geminiFactor ? geminiFactor.detail : null;

        if (geminiReasoning) {
            console.log(`[PERSIST] Found AI Reasoning for Invoice ${invoiceId} (Length: ${geminiReasoning.length})`);
        } else {
            console.warn(`[PERSIST] No AI Reasoning found in breakdown for Invoice ${invoiceId}`);
        }

        const fraudDNA = classifyFraudDNA(breakdown);
        // Ensure the DNA object in the DB includes the high-fidelity reasoning
        if (geminiReasoning) fraudDNA.geminiReasoning = geminiReasoning;

        await pool.query('DELETE FROM explanations WHERE invoice_id = $1', [invoiceId]);
        await pool.query(
            `INSERT INTO explanations (invoice_id, factor_breakdown, counterfactual, impatience_signal, fraud_dna) 
             VALUES ($1, $2, $3, $4, $5)`,
            [invoiceId, JSON.stringify(breakdown), counterfactual, impatienceSignal, JSON.stringify(fraudDNA)]
        );

    } catch (err) {
        console.error('Explanation save failed:', err);
    }
}

module.exports = {
    generateExplanation,
    generateCounterfactual,
    detectImpatienceSignal,
    classifyFraudDNA
};
