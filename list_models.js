require('dotenv').config();

async function listModels() {
    const key = process.env.GEMINI_API_KEY;
    try {
        const url = `https://generativelanguage.googleapis.com/v1beta/models?key=${key}`;
        console.log("Fetching models from:", url.replace(key, "REDACTED"));
        const response = await fetch(url);
        const data = await response.json();
        if (data.models) {
            console.log("All Available Models:");
            data.models.forEach(m => {
                console.log(`- ${m.name} (${m.displayName}) [Methods: ${m.supportedGenerationMethods.join(', ')}]`);
            });
        } else {
            console.log("Full Response:", JSON.stringify(data, null, 2));
        }
    } catch (error) {
        console.error("Fetch Failed:", error.message);
    }
}

listModels();
