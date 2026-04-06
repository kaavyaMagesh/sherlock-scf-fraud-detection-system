const pool = require('../db/index');

async function seed() {
    try {
        console.log('--- SEEDING NEW AI TEST CASES ---');
        
        // 1. ANOMALY_PAYMENT_TIMELINE
        const inv1 = await pool.query(`
            INSERT INTO invoices (
                invoice_number, supplier_id, buyer_id, lender_id, amount, 
                goods_category, delivery_location, payment_terms, 
                invoice_date, expected_payment_date, status, risk_score
            ) VALUES (
                'AI-TEST-9901', 1, 2, 1, 1250000.00,
                'Industrial Copper Cathodes Grade A', 'Main Hub - Warehouse 4', 'Net-1 Day',
                '2026-04-05', '2026-04-06', 'REVIEW', 45
            ) RETURNING id;
        `);
        console.log('Seeded AI-TEST-9901 (ID:', inv1.rows[0].id, ') - Goal: Timeline Anomaly');

        // 2. ANOMALY_GEOGRAPHY_VAGUE
        const inv2 = await pool.query(`
            INSERT INTO invoices (
                invoice_number, supplier_id, buyer_id, lender_id, amount, 
                goods_category, delivery_location, payment_terms, 
                invoice_date, expected_payment_date, status, risk_score
            ) VALUES (
                'AI-TEST-9902', 1, 2, 1, 850000.00,
                'Various technical equipment and assorted parts', 'Unmarked Site, Northern Border Region, sector 9', 'Net-30',
                '2026-04-01', '2026-05-01', 'REVIEW', 35
            ) RETURNING id;
        `);
        console.log('Seeded AI-TEST-9902 (ID:', inv2.rows[0].id, ') - Goal: Geography & Vagueness');

        console.log('--- SEEDING COMPLETE ---');
    } catch (err) {
        console.error('Seeding failed:', err);
    } finally {
        process.exit(0);
    }
}

seed();
