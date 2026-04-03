const pool = require('../db/index');
const riskEngineService = require('../services/riskEngineService');

async function testLayer6() {
    console.log('--- Testing Layer 6 Semantic Engine ---');

    try {
        // 1. Create a dummy supplier
        const supplierRes = await pool.query(`
            INSERT INTO companies (name, industry, annual_revenue, credential_verified) 
            VALUES ($1, $2, $3, $4) RETURNING id
        `, ['Steel Corp India', 'Industrial / Mining', 10000000, true]);
        const supplierId = supplierRes.rows[0].id;

        // 2. Create a dummy buyer
        const buyerRes = await pool.query(`
            INSERT INTO companies (name, industry, credential_verified) 
            VALUES ($1, $2, $3) RETURNING id
        `, ['Luxe Apartments LLC', 'Real Estate', true]);
        const buyerId = buyerRes.rows[0].id;

        // 3. Create a suspicious invoice
        // Suspicious: Steel delivered to an Apartment, and 1-day payment terms for a large amount.
        const invRes = await pool.query(`
            INSERT INTO invoices (
                lender_id, invoice_number, supplier_id, buyer_id, amount, 
                invoice_date, expected_payment_date, goods_category, 
                delivery_location, payment_terms
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING id
        `, [
            1, 'TEST-L6-001', supplierId, buyerId, 500000, 
            new Date(), new Date(), '50 Tons of Industrial Steel Beams', 
            'Floor 14, Penthouse Suite, Luxury Residential Tower, Mumbai', 
            'Immediate Net-1 (1 Day)'
        ]);
        const invoiceId = invRes.rows[0].id;

        console.log(`Created test invoice ID: ${invoiceId}`);

        // 4. Evaluate Risk
        console.log('Evaluating risk (this will call Gemini)...');
        const result = await riskEngineService.evaluateRisk(
            1, invoiceId, supplierId, buyerId, 500000, 
            new Date(), new Date(), 0, []
        );

        console.log('\n--- Risk Result ---');
        console.log(`Score: ${result.riskScore}`);
        console.log(`Status: ${result.status}`);
        console.log('Breakdown:');
        result.breakdown.forEach(f => {
            console.log(` - [${f.factor}] Points: ${f.points} | Detail: ${f.detail}`);
        });

        // 5. Cleanup (Disabled for verification visibility)
        // await pool.query('DELETE FROM alerts WHERE invoice_id = $1', [invoiceId]);
        // await pool.query('DELETE FROM explanations WHERE invoice_id = $1', [invoiceId]);
        // await pool.query('DELETE FROM risk_score_audits WHERE invoice_id = $1', [invoiceId]);
        // await pool.query('DELETE FROM invoices WHERE id = $1', [invoiceId]);
        // await pool.query('DELETE FROM companies WHERE id IN ($1, $2)', [supplierId, buyerId]);

        console.log('\n--- Test Completed ---');

    } catch (err) {
        console.error('Test Failed:', err);
    } finally {
        process.exit();
    }
}

testLayer6();
