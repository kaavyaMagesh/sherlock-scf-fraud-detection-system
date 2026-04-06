const pool = require('../db/index');
const riskEngineService = require('../services/riskEngineService');

async function main() {
    const args = process.argv.slice(2);
    let invoiceId = args[0];

    if (!invoiceId) {
        console.log("No ID provided. Fetching the latest Scenario 8 (Semantic) invoice...");
        const latest = await pool.query("SELECT id FROM invoices WHERE invoice_number LIKE 'MISMATCH-%' OR invoice_number LIKE 'GEO-TIME-%' ORDER BY created_at DESC LIMIT 1");
        if (latest.rows.length === 0) {
            console.error("No test invoices found. Please run 'node scripts/seedData.js' first.");
            process.exit(1);
        }
        invoiceId = latest.rows[0].id;
    }

    console.log(`\n--- Deep Risk Analysis for Invoice ID: ${invoiceId} ---`);

    try {
        // Fetch invoice details for context
        const invRes = await pool.query(`
            SELECT i.*, sup.name as supplier_name, buy.name as buyer_name, sup.industry_code as supplier_industry
            FROM invoices i
            JOIN companies sup ON i.supplier_id = sup.id
            JOIN companies buy ON i.buyer_id = buy.id
            WHERE i.id = $1
        `, [invoiceId]);

        if (invRes.rows.length === 0) {
            console.error("Invoice not found.");
            process.exit(1);
        }

        const invoice = invRes.rows[0];
        console.log(`Supplier: ${invoice.supplier_name} (${invoice.supplier_industry})`);
        console.log(`Buyer: ${invoice.buyer_name}`);
        console.log(`Amount: ${invoice.amount}`);
        console.log(`Category: ${invoice.goods_category}`);
        console.log(`Location: ${invoice.delivery_location || 'N/A'}`);
        console.log(`Terms: ${invoice.payment_terms || 'N/A'}`);

        console.log("\n[LLM] Re-evaluating Layer 6 Semantic Engine...");
        
        // We simulate the risk engine flow
        const result = await riskEngineService.evaluateRisk(
            invoice.lender_id,
            invoice.id,
            invoice.supplier_id,
            invoice.buyer_id,
            invoice.amount,
            invoice.invoice_date,
            invoice.expected_payment_date,
            0, // Start with 0 base points to isolate semantic impact
            [],
            { triggerAI: true }
        );

        console.log("\n--- Analysis Results ---");
        console.log(`Resulting Status: ${result.status}`);
        console.log(`Layer 6 Semantic reasoning:`);
        
        result.breakdown.forEach(factor => {
            if (['semantic_mismatch', 'geographical_anomaly', 'payment_timeline_anomaly', 'vague_description'].includes(factor.factor)) {
                console.log(`  > [${factor.factor.toUpperCase()}] (+${factor.points} pts): ${factor.detail}`);
            }
        });

    } catch (err) {
        console.error("Analysis Failed:", err);
    } finally {
        process.exit();
    }
}

main();
