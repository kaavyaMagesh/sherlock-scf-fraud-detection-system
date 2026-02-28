const pool = require('../db/index');
const identityService = require('../services/identityService');

async function migrate() {
    try {
        console.log("Starting Credential Migration...");
        const res = await pool.query('SELECT id FROM companies WHERE credential_verified = false OR did IS NULL');

        console.log(`Found ${res.rowCount} companies to migrate. Generating DIDs & VCs...`);

        let successCount = 0;
        for (const row of res.rows) {
            try {
                await identityService.onboardSupplier(row.id);
                successCount++;
            } catch (err) {
                console.error(`Failed to migrate company ${row.id}:`, err.message);
            }
        }

        console.log(`Migration Complete: ${successCount}/${res.rowCount} companies successfully onboarded with Ed25519 VCs.`);
    } catch (error) {
        console.error("Migration fatal error:", error);
    } finally {
        await pool.end();
    }
}

migrate();
