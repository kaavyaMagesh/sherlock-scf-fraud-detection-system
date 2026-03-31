const LENDER_ID = '1';
const API_BASE = 'http://localhost:3000/api';

const submissionData = {
    invoice_number: `VELO-${Date.now()}`,
    po_id: 2,
    grn_id: 2,
    supplier_id: 3,
    buyer_id: 47,
    amount: 15000,
    expected_payment_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
    goods_category: 'Electronic Components'
};

async function triggerAnomaly() {
    console.log("🚀 Starting Real-Time Velocity Anomaly Trigger...");
    console.log("Instructions: Keep your dashboard open on the 'Live Threat Feed' (Dashboard) or 'Velocity Monitor' page.");
    console.log("------------------------------------------------------------------------------------------");

    for (let i = 1; i <= 6; i++) {
        try {
            const data = { ...submissionData, invoice_number: `VELO-${Date.now()}-${i}` };
            const response = await fetch(`${API_BASE}/invoices`, {
                method: 'POST',
                headers: { 
                    'Content-Type': 'application/json',
                    'x-lender-id': LENDER_ID 
                },
                body: JSON.stringify(data)
            });
            
            const result = await response.json();
            
            if (response.ok) {
                console.log(`✅ [${i}/6] Invoice submitted. Risk Score: ${result.riskScore}, Status: ${result.status}`);
            } else {
                console.error(`❌ [${i}/6] Failed:`, result.error || response.statusText);
            }
        } catch (e) {
            console.error(`❌ [${i}/6] Network Error:`, e.message);
        }
    }

    console.log("------------------------------------------------------------------------------------------");
    console.log("🏁 Done! You should see a 'velocity_anomaly' alert appear INSTANTLY in the 'Live Threat Feed'.");
    console.log("The 'Velocity Monitor' charts will also update on their next pulse (every 5-10 seconds).");
}

triggerAnomaly();
