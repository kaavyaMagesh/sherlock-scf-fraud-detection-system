const BASE_URL = 'http://localhost:3000/api';

async function testERPFlow() {
    console.log("=========================================");
    console.log("🕵️ SHERLOCK E2E ERP PIPELINE SIMULATION");
    console.log("=========================================\n");

    try {
        // --- 1. BUYER LOGIN ---
        console.log("[1] Authenticating Buyer (buyer@tatamotors.com)...");
        const buyerAuth = await fetch(`${BASE_URL}/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: 'buyer@tatamotors.com', password: 'password123' })
        });
        const buyerAuthData = await buyerAuth.json();
        const buyerToken = buyerAuthData.token;
        const buyerHeaders = { 'Content-Type': 'application/json', Authorization: `Bearer ${buyerToken}` };
        console.log("✅ Buyer Authenticated.\n");

        // --- 2. CREATE PURCHASE ORDER ---
        console.log("[2] Buyer creating Purchase Order against Bosch (Supplier ID: 4)...");
        const poRes = await fetch(`${BASE_URL}/erp/purchase-orders`, {
            method: 'POST', headers: buyerHeaders,
            body: JSON.stringify({ supplier_id: 4, amount: 50000, quantity: 100, goods_category: "Heavy Machinery" })
        });
        const poData = await poRes.json();
        const poId = poData.id;
        console.log(`✅ Purchase Order Created: PO-${poId}\n`);

        // --- 3. CREATE GOODS RECEIPT (GRN) ---
        console.log(`[3] Buyer generating Goods Receipt Note for PO-${poId}...`);
        const grnRes = await fetch(`${BASE_URL}/erp/goods-receipts`, {
            method: 'POST', headers: buyerHeaders,
            body: JSON.stringify({ po_id: poId, amount_received: 50000, quantity: 100 })
        });
        const grnData = await grnRes.json();
        const grnId = grnData.id;
        console.log(`✅ Goods Receipt Created: GRN-${grnId}\n`);

        // --- 4. CONFIRM DELIVERY ---
        console.log(`[4] Logistics confirming Delivery for GRN-${grnId}...`);
        const delRes = await fetch(`${BASE_URL}/erp/deliveries`, {
            method: 'POST', headers: buyerHeaders,
            body: JSON.stringify({ grn_id: grnId, confirmed_by: "Warehouse Manager A", delivery_status: "DELIVERED", notes: "Routine delivery test" })
        });
        const delData = await delRes.json();
        console.log(`✅ Delivery Confirmed: Status -> ${delData.delivery_status}\n`);

        // --- 5. SUPPLIER LOGIN ---
        console.log("[5] Authenticating Supplier (supplier@boschindia.com)...");
        const supplierAuth = await fetch(`${BASE_URL}/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: 'supplier@boschindia.com', password: 'password123' })
        });
        const supplierAuthData = await supplierAuth.json();
        const supplierToken = supplierAuthData.token;
        const supplierHeaders = {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${supplierToken}`,
            "x-lender-id": "1" 
        };
        console.log("✅ Supplier Authenticated.\n");

        // --- 6. SUPPLIER SUBMITS INVOICE ---
        const invoiceNum = `INV-DEMO-${Math.floor(Math.random() * 10000)}`;
        console.log(`[6] Supplier submitting Invoice (${invoiceNum}) against PO-${poId}...`);
        
        const invPayload = {
            po_id: poId,
            supplier_id: 4,     // Bosch ID
            buyer_id: 1,        // Tata ID
            invoice_number: invoiceNum,
            amount: 50000,
            expected_payment_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
            goods_category: "Heavy Machinery"
        };
        
        const invoiceRes = await fetch(`${BASE_URL}/invoices`, {
            method: 'POST', headers: supplierHeaders, body: JSON.stringify(invPayload)
        });
        const invoiceData = await invoiceRes.json();
        
        console.log("\n=========================================");
        console.log("🎯 FRAUD ENGINE VERIFICATION RESULTS");
        console.log("=========================================");
        if (invoiceData.error) {
            throw new Error(invoiceData.error);
        }
        console.log(`Status:      ${invoiceData.status}`);
        console.log(`Risk Score:  ${invoiceData.riskScore}`);
        console.log(`Breakdown:`);
        invoiceData.breakdown.forEach(b => console.log(`  ➤ [${b.points > 0 ? '+' : ''}${b.points}] ${b.detail || b.factor}`));

    } catch (error) {
        console.error("\n❌ TEST PIPELINE FAILED!");
        console.error(error.message || error);
    }
}

testERPFlow();
