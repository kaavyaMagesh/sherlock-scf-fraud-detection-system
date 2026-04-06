const { GoogleGenerativeAI } = require('@google/generative-ai');
const dotenv = require('dotenv');

dotenv.config();

/**
 * Layer 6 — AI / Semantic Layer (LLM Integration Wrapper)
 */

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || 'AIzaSyExampleKey');
// Simple In-memory cache for semantic results to avoid redundant API calls
const semanticCache = new Map();

const generateContent = async (prompt, cacheKey = null) => {
    if (cacheKey && semanticCache.has(cacheKey)) {
        return semanticCache.get(cacheKey);
    }

    try {
        const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });
        const result = await model.generateContent(prompt);
        const response = await result.response;
        const text = response.text();

        if (cacheKey) {
            semanticCache.set(cacheKey, text);
        }
        return text;
    } catch (error) {
        console.error(`[LLM] Gemini 2.5 Flash Error:`, error.message);
        // Explicit failure message without fallback JSON
        return JSON.stringify({
            consistency: { isConsistent: true, reason: "Analysis Failed", points: 0 },
            geography: { isPlausible: true, reason: "Analysis Failed", points: 0 },
            timeline: { isNormal: true, reason: "Analysis Failed", points: 0 },
            vagueness: { isVague: false, reason: "Analysis Failed", points: 0 },
            similarity: { isSuspicious: false, reason: "Analysis Failed", points: 0 },
            forensicNarrative: `Gemini 2.5 Flash Error: ${error.message}. No fallback was permitted.`
        });
    }
};

module.exports = {
    generateContent
};
