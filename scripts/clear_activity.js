const pool = require('../db/index');

async function clearActivity() {
    try {
        console.log("--- Clearing Activity Data (Preserving Lenders, Companies, & Users) ---");

        // Order matters due to foreign key constraints, or use CASCADE
        const tables = [
            'disputes',
            'manual_overrides',
            'explanations',
            'alerts',
            'risk_score_audits',
            'settlements',
            'invoice_fingerprints',
            'delivery_confirmations',
            'invoices',
            'goods_receipts',
            'purchase_orders',
            'trade_relationships'
        ];

        for (const table of tables) {
            await pool.query(`TRUNCATE TABLE ${table} RESTART IDENTITY CASCADE`);
            console.log(`Cleared table: ${table}`);
        }

        console.log("\n--- Database Activity Cleared Successfully ---");
        process.exit(0);

    } catch (err) {
        console.error("Clear Failed:", err.message);
        process.exit(1);
    }
}

clearActivity();
