const { GoogleGenerativeAI } = require('@google/generative-ai');
const dotenv = require('dotenv');

dotenv.config();

/**
 * Layer 6 — AI / Semantic Layer (LLM Integration Wrapper)
 */

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || 'AIzaSyExampleKey');
const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });

// Simple In-memory cache for semantic results to avoid redundant API calls
const semanticCache = new Map();

const generateContent = async (prompt, cacheKey = null) => {
    if (cacheKey && semanticCache.has(cacheKey)) {
        return semanticCache.get(cacheKey);
    }

    try {
        const result = await model.generateContent(prompt);
        const response = await result.response;
        const text = response.text();

        if (cacheKey) {
            semanticCache.set(cacheKey, text);
        }

        return text;
    } catch (error) {
        console.error('Gemini API Error:', error);
        // Fallback or empty response to prevent engine stall
        return '{"error": "LLM_SERVICE_UNAVAILABLE", "analysis": "Could not perform semantic check"}';
    }
};

module.exports = {
    generateContent
};
