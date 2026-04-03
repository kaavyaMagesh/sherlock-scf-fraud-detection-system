const pool = require('../db/index');

const clearData = async () => {
    try {
        console.log("Starting DB Cleanup...");
        
        // Fetch all user-defined table names in the public schema
        const tablesQuery = await pool.query(`
            SELECT table_name 
            FROM information_schema.tables 
            WHERE table_schema = 'public' 
            AND table_type = 'BASE TABLE'
            AND table_name NOT IN ('knex_migrations', 'knex_migrations_lock')
        `);
        const tables = tablesQuery.rows.map(r => r.table_name);

        if (tables.length === 0) {
            console.log("No tables found to clear.");
            return;
        }

        console.log(`Truncating tables: ${tables.join(', ')}`);
        
        // Perform truncation in a single command to handle FK constraints correctly with CASCADE
        const query = `TRUNCATE TABLE ${tables.map(t => `"${t}"`).join(', ')} RESTART IDENTITY CASCADE;`;
        await pool.query(query);

        console.log("-> DB Cleared Successfully");
        process.exit(0);
    } catch (err) {
        console.error("-> Error clearing DB:", err);
        process.exit(1);
    }
};

clearData();
