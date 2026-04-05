const pool = require('./db/index');
const identityService = require('./services/identityService');

async function fixCredentials() {
    console.log("Starting batch identity onboarding...");
    try {
        // Fetch all companies that are not yet verified or missing credentials
        const result = await pool.query(`
            SELECT id, name FROM companies 
            WHERE credential_verified = false OR verifiable_credential IS NULL OR did IS NULL
        `);

        console.log(`Found ${result.rows.length} companies requiring onboarding.`);

        for (const company of result.rows) {
            console.log(`Onboarding ${company.name} (ID: ${company.id})...`);
            try {
                const onboard = await identityService.onboardSupplier(company.id);
                console.log(`✅ Success for ${company.name}: ${onboard.did}`);
            } catch (err) {
                console.error(`❌ Failed for ${company.name}:`, err.message);
            }
        }

        console.log("Batch onboarding complete!");
        process.exit(0);
    } catch (error) {
        console.error("Batch onboarding failed:", error);
        process.exit(1);
    }
}

fixCredentials();
