const { GoogleGenerativeAI } = require('@google/generative-ai');
require('dotenv').config();

async function testModels() {
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    const models = ['gemini-2.5-flash', 'gemini-2.0-flash', 'gemini-1.5-flash', 'gemini-pro'];
    
    for (const modelName of models) {
        try {
            console.log(`Testing Model: ${modelName}...`);
            const model = genAI.getGenerativeModel({ model: modelName });
            const result = await model.generateContent("Hello, are you there?");
            const response = await result.response;
            console.log(`Success with ${modelName}! Response:`, response.text());
            return;
        } catch (error) {
            console.error(`Failed with ${modelName}:`, error.status || error.message);
        }
    }
    console.error("All candidates failed.");
}

testModels();
