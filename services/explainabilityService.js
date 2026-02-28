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
    const factors = breakdown.map(b => b.factor);

    let typology = "UNKNOWN_PATTERN";
    let confidence = 50;
    let evidence = breakdown.map(b => b.detail).slice(0, 3);
    let action = "Manual review recommended";

    if (factors.includes('exact_duplicate') || factors.includes('fuzzy_duplicate')) {
        typology = "DOUBLE_FINANCING";
        confidence = 95;
        action = "Block disbursement immediately and notify compliance";
    } else if (factors.includes('vague_description') || factors.includes('triple_match_fail') || factors.includes('semantic_mismatch')) {
        typology = "PHANTOM_INVOICE";
        confidence = 85 + (factors.includes('vague_description') && factors.includes('triple_match_fail') ? 10 : 0);
        action = "Freeze supplier account and request original shipping documents";
    } else if (factors.includes('carousel_trade_detected')) {
        typology = "CAROUSEL_TRADE";
        confidence = 90;
        action = "Investigate connected entities for circular money flow";
    } else if (factors.includes('cascade_over_financing')) {
        typology = "CROSS_TIER_CASCADE";
        confidence = 88;
        action = "Review supply chain root PO and financing limits";
    } else if (factors.includes('dormant_entity_burst')) {
        typology = "DORMANT_ENTITY_BURST";
        confidence = 80;
        action = "Require enhanced due diligence for account reactivation";
    } else if (factors.includes('dilution_rate_high') || factors.includes('payment_term_anomaly')) {
        typology = "DILUTION_FRAUD";
        confidence = 75;
        action = "Audit historical settlement patterns for this supplier";
    }

    return { typology, confidence, evidence, action };
}

async function generateExplanation(invoiceId, riskResult) {
    try {
        const { riskScore, breakdown } = riskResult;

        const counterfactual = generateCounterfactual(invoiceId, riskScore, breakdown);
        const impatienceSignal = detectImpatienceSignal(breakdown);
        const fraudDNA = classifyFraudDNA(breakdown);

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
