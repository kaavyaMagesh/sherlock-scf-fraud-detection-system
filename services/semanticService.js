const llmService = require('./llmService');
const pool = require('../db/index');

/**
 * Layer 6 — AI / Semantic Layer (Semantic Logic)
 * Performs cross-verification of trade documents and historical description analysis.
 */

const verifyDocumentConsistency = async (invoice, po, grn) => {
    const prompt = `
        Analyze the consistency across these 3 trade documents for potential supply chain fraud (Technical/Semantic Analysis):
        1. Invoice: "${invoice.description || 'N/A'}" (Amt: ${invoice.amount || 'N/A'})
        2. Purchase Order: "${po.description || 'N/A'}" (Amt: ${po.amount || 'N/A'})
        3. Goods Receipt: "${grn.description || 'N/A'}" (Recv status: ${grn.received || 'N/A'})

        Scanning rules for AI:
        - **Goods Description Mismatch**: Flag high-value goods (e.g., 'High-grade Steel', 'New Machinery') vs low-value/dummy/scrap (e.g., 'Industrial Waste', 'Scrap Metal', 'Misc Scrap').
        - **Technical Fraud**: Scan for inconsistencies in technical terms, unit types (e.g. 'kg' vs 'units'), or HS codes if present in descriptions.
        - **Phantom Patterns**: Watch for "vague-to-specific" escalation (PO is vague, but Invoice is highly specific for different goods).
        - **Quantity Consistency**: Check if quantity/volume in descriptions aligns across documents.
        
        Return JSON format only: { "isConsistent": boolean, "mismatchReason": string, "riskPoints": number (0-40) }
        *Instruction*: Be extremely concise (max 70 words). Summary of mismatch only.
    `;

    const cacheKey = `consistency-${invoice.description}-${po.description}-${grn.description}`;
    const response = await llmService.generateContent(prompt, cacheKey);

    try {
        const trimmed = String(response).trim();
        const jsonBlock = trimmed.match(/\{[\s\S]*\}/);
        const parsed = JSON.parse(jsonBlock ? jsonBlock[0] : trimmed);
        return {
            isConsistent: parsed.isConsistent,
            mismatchReason: parsed.mismatchReason || parsed.reason,
            riskPoints: parsed.riskPoints || parsed.points || 0
        };
    } catch (e) {
        return { isConsistent: true, mismatchReason: 'LLM response not valid JSON', riskPoints: 0 };
    }
};

const checkGeographyPlausibility = async (supplier, deliveryLocation, goods) => {
    if (!deliveryLocation || !goods) return { isPlausible: true, points: 0 };

    const prompt = `
        Analyze the geographical plausibility of this shipment:
        Supplier: "${supplier.name}" (Sector: ${supplier.industry || 'General'})
        Delivery Location: "${deliveryLocation}"
        Goods: "${goods}"

        Is it unusual for this type of goods to be delivered to this location? 
        (e.g., 100 tons of heavy machinery delivered to a residential zip code or a remote island with no industrial port).
        Return JSON format only: { "isPlausible": boolean, "points": number (0-25), "reason": string }
        *Instruction*: Be extremely concise (max 70 words). Just the core anomaly reason.
    `;

    const response = await llmService.generateContent(prompt, `geo-${deliveryLocation}-${goods}`);
    try {
        const trimmed = String(response).trim();
        const jsonBlock = trimmed.match(/\{[\s\S]*\}/);
        return JSON.parse(jsonBlock ? jsonBlock[0] : trimmed);
    } catch (e) {
        return { isPlausible: true, points: 0 };
    }
};

const checkPaymentTimelineNorms = async (invoice, supplier) => {
    const terms = invoice.payment_terms || 'N/A';
    const amount = invoice.amount || 0;

    const prompt = `
        Analyze the payment timeline for this trade:
        Supplier Industry: "${supplier.industry || 'General'}"
        Invoice Amount: "${amount}"
        Claimed Payment Terms: "${terms}"
        Invoice Date: "${invoice.invoice_date}"
        Expected Payment: "${invoice.expected_payment_date}"

        Is this timeline suspicious or outside industry norms? 
        (e.g., Immediate 1-day payment for a $10M construction project, or 360-day terms for perishable food).
        Return JSON format only: { "isNormal": boolean, "points": number (0-20), "reason": string }
        *Instruction*: Be extremely concise (max 70 words). Summary of anomaly only.
    `;

    const response = await llmService.generateContent(prompt, `terms-${terms}-${amount}`);
    try {
        const trimmed = String(response).trim();
        const jsonBlock = trimmed.match(/\{[\s\S]*\}/);
        return JSON.parse(jsonBlock ? jsonBlock[0] : trimmed);
    } catch (e) {
        return { isNormal: true, points: 0 };
    }
};

const checkVagueDescriptions = async (text) => {
    if (!text) return { isVague: false, points: 0 };

    const prompt = `
        Is the following trade document description too vague or a common 'phantom' signal?
        Description: "${text}"
        Examples of vague: 'Services rendered', 'Goods supplied', 'Consulting fees', 'Misc items'.
        Return JSON: { "isVague": boolean, "points": number (0-15), "reason": string }
        *Instruction*: Be extremely concise (max 70 words).
    `;

    const response = await llmService.generateContent(prompt, `vague-${text}`);
    try {
        const trimmed = String(response).trim();
        const jsonBlock = trimmed.match(/\{[\s\S]*\}/);
        return JSON.parse(jsonBlock ? jsonBlock[0] : trimmed);
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
        *Instruction*: Be extremely concise (max 70 words).
    `;

    const response = await llmService.generateContent(prompt, `similarity-${supplierId}`);
    try {
        const trimmed = String(response).trim();
        const jsonBlock = trimmed.match(/\{[\s\S]*\}/);
        return JSON.parse(jsonBlock ? jsonBlock[0] : trimmed);
    } catch (e) {
        return { isSuspicious: false, points: 0 };
    }
};

const runUnifiedSemanticAnalysis = async (invoiceId, supplier, invoice, po, grn, history) => {
    const prompt = `
        Perform a unified forensic semantic analysis for this trade (Invoice ID: ${invoiceId}):
        
        1. **Documents**: 
           - Inv: "${invoice.description}" (Amt: ${invoice.amount}, Loc: ${invoice.location}, Terms: ${invoice.terms})
           - PO: "${po.description}" (Amt: ${po.amount}, Loc: ${po.location}, Terms: ${po.terms})
           - GRN: "${grn.description}" (Recv status: ${grn.received})
        2. **Supplier Context**: 
           - Name: "${supplier.name}" (Industry: ${supplier.industry})
           - Recent History: ${history}

        **Tasks**:
        A. **Consistency**: Check if goods and quantities align across Inv, PO, and GRN. Flag mismatches.
        B. **Geography**: Is the delivery location ("${invoice.location}") plausible for these goods and this supplier?
        C. **Timeline**: Are terms ("${invoice.terms}") and payment timeline (Date: ${invoice.date}, Due: ${invoice.dueDate}) within industry norms?
        D. **Vagueness**: Is the invoice description too vague (e.g. "Services rendered")?
        E. **Similarity**: Does the description look like a bot-generated template compared to history?

        Return JSON format only:
        {
            "consistency": { "isConsistent": boolean, "reason": string, "points": number (0-40) },
            "geography": { "isPlausible": boolean, "reason": string, "points": number (0-25) },
            "timeline": { "isNormal": boolean, "reason": string, "points": number (0-20) },
            "vagueness": { "isVague": boolean, "reason": string, "points": number (0-15) },
            "similarity": { "isSuspicious": boolean, "reason": string, "points": number (0-30) },
            "forensicNarrative": "A concise (max 100 words), professional summary that bridges both deterministic and semantic findings for the investigator."
        }
    `;

    const response = await llmService.generateContent(prompt, `unified-${invoiceId}`);
    try {
        const trimmed = String(response).trim();
        const jsonBlock = trimmed.match(/\{[\s\S]*\}/);
        return JSON.parse(jsonBlock ? jsonBlock[0] : trimmed);
    } catch (e) {
        console.error('Unified analysis parse failed:', e);
        // Return a safe fallback object so the forensic narrative can show the error
        return {
            consistency: { isConsistent: true, reason: "Analysis Parse Error", points: 0 },
            geography: { isPlausible: true, reason: "Analysis Parse Error", points: 0 },
            timeline: { isNormal: true, reason: "Analysis Parse Error", points: 0 },
            vagueness: { isVague: false, reason: "Analysis Parse Error", points: 0 },
            similarity: { isSuspicious: false, reason: "Analysis Parse Error", points: 0 },
            forensicNarrative: `AI Scan Error: Could not parse Gemini response. Technical logs show: ${e.message}`
        };
    }
};

module.exports = {
    verifyDocumentConsistency,
    checkVagueDescriptions,
    analyzeSupplierSimilarity,
    checkGeographyPlausibility,
    checkPaymentTimelineNorms,
    runUnifiedSemanticAnalysis
};
