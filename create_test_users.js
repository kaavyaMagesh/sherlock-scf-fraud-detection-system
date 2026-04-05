const pool = require('./db/index');

async function createUsers() {
    try {
        console.log("Creating test users...");
        await pool.query(`
            INSERT INTO portal_users (email, password_hash, role, company_id, lender_id) 
            VALUES 
                ('buyer@tatamotors.com', 'password123', 'BUYER', 1, 1),
                ('supplier@boschindia.com', 'password123', 'SUPPLIER', 4, 1)
            ON CONFLICT (email) 
            DO UPDATE SET 
                company_id = EXCLUDED.company_id, 
                role = EXCLUDED.role,
                lender_id = EXCLUDED.lender_id
        `);
        console.log("✅ Test users created/updated successfully.");
        process.exit(0);
    } catch (err) {
        console.error("❌ User creation failed:", err);
        process.exit(1);
    }
}

createUsers();
