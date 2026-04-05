const pool = require('../db/index');
const riskEngineService = require('../services/riskEngineService');

async function reEvaluateGlobalAlpha() {
    console.log('--- STARTING RE-EVALUATION FOR GLOBAL ALPHA BANK (Lender ID: 1) ---');
    
    try {
        const lenderId = 1;
        
        // 1. Fetch all invoices for this lender
        const invoicesQuery = await pool.query(
            'SELECT * FROM invoices WHERE lender_id = $1',
            [lenderId]
        );
        
        const invoices = invoicesQuery.rows;
        console.log(`Found ${invoices.length} invoices to re-evaluate.`);
        
        // 2. Clear old alerts for these invoices to avoid duplicates
        const invoiceIds = invoices.map(i => i.id);
        if (invoiceIds.length > 0) {
            await pool.query('DELETE FROM alerts WHERE invoice_id = ANY($1)', [invoiceIds]);
            console.log(`Cleared existing alerts for ${invoices.length} invoices.`);
        }

        let evaluatedCount = 0;

        // 3. Re-evaluate each invoice
        for (const inv of invoices) {
            try {
                // We pass 0 and [] for basePoints and baseBreakdown to perform a fresh evaluation
                // Note: EvaluateRisk internally checks duplicates and triple match if we wanted, 
                // but those require validationService. 
                // To be thorough, we'll just run the core risk engine pass which includes the Dilution check.
                
                await riskEngineService.evaluateRisk(
                    lenderId,
                    inv.id,
                    inv.supplier_id,
                    inv.buyer_id,
                    inv.amount,
                    inv.invoice_date,
                    inv.expected_payment_date,
                    0, // basePoints
                    [] // baseBreakdown
                );
                
                evaluatedCount++;
                if (evaluatedCount % 10 === 0) {
                    console.log(`Processed ${evaluatedCount}/${invoices.length}...`);
                }
            } catch (err) {
                console.error(`Failed to evaluate invoice #${inv.id}:`, err.message);
            }
        }

        console.log(`--- RE-EVALUATION COMPLETE ---`);
        console.log(`Total Invoices Re-evaluated: ${evaluatedCount}`);
        
        process.exit(0);
    } catch (error) {
        console.error('Critical error during re-evaluation:', error);
        process.exit(1);
    }
}

reEvaluateGlobalAlpha();
