const pool = require('../db/index');

async function seed() {
    try {
        console.log('--- SEEDING REAL CAROUSEL CYCLE (A->B->C->A) ---');
        
        // 1. Clear existing trade relations for this specific test case to ensure visibility
        // Companies: 1 (GTC Logistics), 2 (B&H Global), 3 (Target Retail)
        // Note: I'll check if Company 3 exists or use 1, 2, and another one (e.g. 4)
        const companies = await pool.query('SELECT id FROM companies LIMIT 4');
        if (companies.rows.length < 3) {
            console.error('Not enough companies to seed a cycle.');
            process.exit(1);
        }
        
        const id1 = companies.rows[0].id;
        const id2 = companies.rows[1].id;
        const id3 = companies.rows[2].id;
        const lenderId = 1;

        console.log(`Using Company IDs: ${id1}, ${id2}, ${id3} for the cycle.`);

        // 2. Create the cycle A -> B -> C -> A
        const category = 'Specialized Electronic Components';
        
        // A -> B
        await pool.query(`
            INSERT INTO trade_relationships (lender_id, supplier_id, buyer_id, total_volume, invoice_count, goods_category, first_trade_date, last_seen)
            VALUES ($1, $2, $3, 150000, 5, $4, NOW() - INTERVAL '60 days', NOW())
            ON CONFLICT (supplier_id, buyer_id, lender_id) DO UPDATE SET total_volume = 150000, invoice_count = 5;
        `, [lenderId, id1, id2, category]);

        // B -> C
        await pool.query(`
            INSERT INTO trade_relationships (lender_id, supplier_id, buyer_id, total_volume, invoice_count, goods_category, first_trade_date, last_seen)
            VALUES ($1, $2, $3, 145000, 4, $4, NOW() - INTERVAL '55 days', NOW())
            ON CONFLICT (supplier_id, buyer_id, lender_id) DO UPDATE SET total_volume = 145000, invoice_count = 4;
        `, [lenderId, id2, id3, category]);

        // C -> A
        await pool.query(`
            INSERT INTO trade_relationships (lender_id, supplier_id, buyer_id, total_volume, invoice_count, goods_category, first_trade_date, last_seen)
            VALUES ($1, $2, $3, 148000, 3, $4, NOW() - INTERVAL '50 days', NOW())
            ON CONFLICT (supplier_id, buyer_id, lender_id) DO UPDATE SET total_volume = 148000, invoice_count = 3;
        `, [lenderId, id3, id1, category]);

        console.log('--- CYCLE SEEDED SUCCESSFULLY ---');
        console.log(`Open Network Topology for Lender ${lenderId} to see the Olive/Animated carousel edges.`);
    } catch (err) {
        console.error('Seeding failed:', err);
    } finally {
        process.exit(0);
    }
}

seed();
