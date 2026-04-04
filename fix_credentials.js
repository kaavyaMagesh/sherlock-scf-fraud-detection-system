const pool = require('./db/index');
const identityService = require('./services/identityService');

async function fixCredentials() {
    try {
        console.log("Checking for companies with missing credentials...");
        const res = await pool.query('SELECT id, name FROM companies WHERE verifiable_credential IS NULL OR did IS NULL');
        
        if (res.rows.length === 0) {
            console.log("No companies found missing credentials. All set!");
            process.exit(0);
        }

        console.log(`Found ${res.rows.length} companies needing onboarding.`);
        
        for (const company of res.rows) {
            console.log(`Onboarding [ID: ${company.id}] ${company.name}...`);
            await identityService.onboardSupplier(company.id);
            console.log(`✅ Onboarded ${company.name}`);
        }
        
        // Final verification check
        const verifyRes = await pool.query('SELECT count(*) FROM companies WHERE verifiable_credential IS NULL OR did IS NULL');
        const remaining = parseInt(verifyRes.rows[0].count);
        
        if (remaining === 0) {
            console.log('\nSUCCESS: All companies now have valid DIDs and VCs.');
        } else {
            console.log(`\nWARNING: ${remaining} companies still have missing credentials!`);
        }
        
        process.exit(0);
    } catch (err) {
        console.error('Error fixing credentials:', err);
        process.exit(1);
    }
}

fixCredentials();
