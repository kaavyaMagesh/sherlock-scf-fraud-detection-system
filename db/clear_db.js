const { Pool } = require('pg');
const dotenv = require('dotenv');
const path = require('path');

// Load environment variables
dotenv.config({ path: path.join(__dirname, '../.env') });

const pool = new Pool({
    connectionString: process.env.DATABASE_URL || "postgresql://neondb_owner:npg_EG7XaOHL6FSZ@ep-snowy-violet-a15qdjeb-pooler.ap-southeast-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require",
});

const clearDatabase = async () => {
    const tables = [
        'manual_overrides',
        'explanations',
        'alerts',
        'risk_score_audits',
        'settlements',
        'invoice_fingerprints',
        'invoices',
        'goods_receipts',
        'purchase_orders',
        'trade_relationships',
        'companies',
        'lenders',
        'retail_alerts',
        'retail_transactions',
        'retail_accounts'
    ];

    try {
        console.log("Starting database cleanup...");
        
        // Truncate all tables and reset identity (primary key) sequences
        // CASCADE ensures that dependent records are also handled
        const query = `TRUNCATE TABLE ${tables.join(', ')} RESTART IDENTITY CASCADE;`;
        
        await pool.query(query);
        
        console.log("Database cleared successfully!");
        console.log(`Cleared ${tables.length} tables: ${tables.join(', ')}`);
        
    } catch (error) {
        console.error("Error clearing database:", error);
    } finally {
        await pool.end();
    }
};

clearDatabase();
