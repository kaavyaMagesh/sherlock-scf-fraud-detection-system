const pool = require('./db/index');

async function runTest() {
    try {
        const lendersRes = await pool.query("SELECT id FROM lenders LIMIT 2");
        const lender1 = lendersRes.rows[0].id;
        const lender2 = lendersRes.rows[1].id;

        const poRes = await pool.query("SELECT id, supplier_id, buyer_id, amount FROM purchase_orders LIMIT 1");
        const po = poRes.rows[0];
        
        const invoicePayload = {
            invoice_number: `TEST-DUP-${Date.now()}`,
            po_id: po.id,
            supplier_id: po.supplier_id,
            buyer_id: po.buyer_id,
            amount: po.amount,
            expected_payment_date: new Date().toISOString(),
            goods_category: "Electronics"
        };

        console.log("\n--- Submitting Invoice to Lender 1 ---");
        const res1 = await fetch('http://localhost:3000/api/invoices', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'x-lender-id': lender1.toString() },
            body: JSON.stringify(invoicePayload)
        });
        const data1 = await res1.json();
        console.log(`Lender 1 Response Status: ${res1.status}`);
        console.log(JSON.stringify(data1, null, 2));


        console.log("\n--- Submitting EXACT SAME Invoice to Lender 2 ---");
        const res2 = await fetch('http://localhost:3000/api/invoices', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'x-lender-id': lender2.toString() },
            body: JSON.stringify(invoicePayload)
        });
        const data2 = await res2.json();
        console.log(`Lender 2 Response Status: ${res2.status}`);
        console.log(JSON.stringify(data2, null, 2));

        process.exit(0);
    } catch (err) {
        console.error("Error running test:", err);
        process.exit(1);
    }
}

runTest();
