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
    let evidence = breakdown.map(b => b.detail).filter(Boolean).slice(0, 5);

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

    // ── DORMANT_ENTITY_BURST ──────────────────────────────────────────────────
    if (factors.includes('dormant_entity_burst')) {
        const pts = sumPoints(['dormant_entity_burst']);
        typologies.push({
            label: "DORMANT_ENTITY_BURST",
            confidence: Math.min(99, Math.max(55, pts)),
            action: "Require enhanced due diligence for account reactivation"
        });
    }

    // ── DILUTION_FRAUD ────────────────────────────────────────────────────────
    if (factors.includes('dilution_rate_high') || factors.includes('payment_term_anomaly')) {
        const pts = sumPoints(['dilution_rate_high', 'payment_term_anomaly']);
        typologies.push({
            label: "DILUTION_FRAUD",
            confidence: Math.min(99, Math.max(50, pts)),
            action: "Audit historical settlement patterns for this supplier"
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

    return { typologies, evidence };
}

async function generateExplanation(invoiceId, riskResult) {
    try {
        const { riskScore, breakdown } = riskResult;

        const counterfactual = generateCounterfactual(invoiceId, riskScore, breakdown);
        const impatienceSignal = detectImpatienceSignal(breakdown);
        const fraudDNA = classifyFraudDNA(breakdown);

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
