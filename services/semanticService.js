const llmService = require('./llmService');
const pool = require('../db/index');

/**
 * Layer 6 — AI / Semantic Layer (Semantic Logic)
 * Performs cross-verification of trade documents and historical description analysis.
 */

const verifyDocumentConsistency = async (invoice, po, grn) => {
    const prompt = `
        Analyze the consistency across these 3 trade documents for potential supply chain fraud:
        1. Invoice Description: "${invoice.description || 'N/A'}"
        2. Purchase Order Description: "${po.description || 'N/A'}"
        3. Goods Receipt Note Description: "${grn.description || 'N/A'}"

        Rules:
        - Flag mismatch between high-value goods (e.g., 'Steel') vs low-value/scrap (e.g., 'Industrial Waste').
        - Flag suspicious quantity/unit differences.
        - Return JSON format: { "isConsistent": boolean, "mismatchReason": string, "riskPoints": number (0-40) }
    `;

    // Using descriptions as cache key (simplified)
    const cacheKey = `consistency-${invoice.description}-${po.description}-${grn.description}`;
    const response = await llmService.generateContent(prompt, cacheKey);

    try {
        return JSON.parse(response);
    } catch (e) {
        return { isConsistent: true, mismatchReason: 'Analysis pending', riskPoints: 0 };
    }
};

const checkVagueDescriptions = async (text) => {
    if (!text) return { isVague: false, points: 0 };

    const prompt = `
        Is the following trade document description too vague or a common 'phantom' signal?
        Description: "${text}"
        Examples of vague: 'Services rendered', 'Goods supplied', 'Consulting fees', 'Misc items'.
        Return JSON: { "isVague": boolean, "points": number (0-15), "reason": string }
    `;

    const response = await llmService.generateContent(prompt, `vague-${text}`);
    try {
        return JSON.parse(response);
    } catch (e) {
        return { isVague: false, points: 0 };
    }
};

const analyzeSupplierSimilarity = async (supplierId) => {
    // Fetch last 10 invoice descriptions
    const query = `
        SELECT goods_category, amount, invoice_date 
        FROM invoices 
        WHERE supplier_id = $1 
        ORDER BY invoice_date DESC LIMIT 10
    `;
    const result = await pool.query(query, [supplierId]);
    if (result.rows.length < 3) return { isSuspicious: false, points: 0 };

    const descriptions = result.rows.map(r => r.goods_category).join(' | ');
    const prompt = `
        Analyze these 10 recent invoice descriptions from the same supplier for bot-like repetition or templated fraud:
        Descriptions: ${descriptions}
        
        Are these suspiciously identical or too similar for this industry? 
        Return JSON: { "isSuspicious": boolean, "points": number (0-30), "reason": string }
    `;

    const response = await llmService.generateContent(prompt, `similarity-${supplierId}`);
    try {
        return JSON.parse(response);
    } catch (e) {
        return { isSuspicious: false, points: 0 };
    }
};

module.exports = {
    verifyDocumentConsistency,
    checkVagueDescriptions,
    analyzeSupplierSimilarity
};
