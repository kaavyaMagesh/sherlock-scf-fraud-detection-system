const pool = require('../db/index');
const riskEngineService = require('../services/riskEngineService');
const validationService = require('../services/validationService');
const graphEngineService = require('../services/graphEngineService');
const crypto = require('crypto');
let faker;
const loadFaker = async () => {
    const fakerModule = await import('@faker-js/faker');
    faker = fakerModule.faker;
};

const submitSeedInvoice = async (lenderId, invoiceNumber, poId, grnId, supplierId, buyerId, amount, invoiceDate, expectedPaymentDate, goodsCategory, deliveryLocation = '', paymentTerms = '') => {
    const invDateObj = new Date(invoiceDate);
    
    // 1. Generate Fingerprint
    const fingerprint = validationService.generateFingerprint(supplierId, buyerId, invoiceNumber, amount, invDateObj);

    // 2. Insert Invoice
    const invQuery = await pool.query(
        `INSERT INTO invoices (lender_id, invoice_number, po_id, grn_id, supplier_id, buyer_id, amount, invoice_date, expected_payment_date, goods_category, delivery_location, payment_terms)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12) RETURNING *`,
        [lenderId, invoiceNumber, poId, grnId, supplierId, buyerId, amount, invDateObj, expectedPaymentDate, goodsCategory, deliveryLocation, paymentTerms]
    );
    const invoice = invQuery.rows[0];

    // 3. Store Fingerprint
    await pool.query(
        'INSERT INTO invoice_fingerprints (invoice_id, lender_id, fingerprint) VALUES ($1, $2, $3) ON CONFLICT (fingerprint) DO NOTHING',
        [invoice.id, lenderId, fingerprint]
    );

    let totalPoints = 0;
    let finalBreakdown = [];

    // 4. Duplicate Check
    const dupCheck = await validationService.detectDuplicates(lenderId, fingerprint, supplierId, buyerId, amount, invDateObj, invoiceNumber);
    if (dupCheck.isDuplicate) {
        totalPoints += dupCheck.points;
        finalBreakdown.push(...dupCheck.breakdown);
    }

    // 5. Triple Match
    const tripleCheck = await validationService.checkTripleMatch(lenderId, poId, amount, invDateObj, supplierId, buyerId, invoiceNumber);
    totalPoints += tripleCheck.points;
    finalBreakdown.push(...tripleCheck.breakdown);

    // 6. Risk Engine Execution (NO AI during seeding to keep it fast)
    const riskResult = await riskEngineService.evaluateRisk(
        lenderId,
        invoice.id,
        supplierId,
        buyerId,
        amount,
        invDateObj,
        expectedPaymentDate,
        totalPoints,
        finalBreakdown,
        { triggerAI: false }
    );

    // 7. Update Trade Relationship Graph
    await graphEngineService.updateEdgeMetadata(lenderId, supplierId, buyerId, amount, goodsCategory);

    return riskResult;
};

const seedData = async () => {
    await loadFaker();
    try {
        console.log("Starting DB Seed...");
        await pool.query('BEGIN');

        // 1. Create Lenders
        const lenders = [];
        for (let i = 1; i <= 3; i++) {
            const name = `Lender Bank ${i}`;
            let res = await pool.query(
                'INSERT INTO lenders (name) VALUES ($1) ON CONFLICT (id) DO NOTHING RETURNING *',
                [name]
            );
            if (res.rows.length === 0) {
                res = await pool.query('SELECT * FROM lenders WHERE name = $1', [name]);
            }
            if (res.rows.length > 0) lenders.push(res.rows[0]);
        }
        const mainLender = lenders[0].id;
        console.log("-> Lenders created");

        // 2. Create Companies (Suppliers and Buyers)
        const companies = [];
        for (const lender of lenders) {
            console.log(`--> Seeding companies for Lender: ${lender.name} (ID: ${lender.id})`);
            for (let i = 0; i < 5; i++) {
                const res = await pool.query(
                    `INSERT INTO companies (lender_id, name, tier, annual_revenue, monthly_avg_invoicing, first_invoice_date, last_invoice_date, industry_code)
                     VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
                    [
                        lender.id,
                        faker.company.name(),
                        faker.number.int({ min: 1, max: 3 }),
                        faker.number.int({ min: 500000, max: 50000000 }), 
                        faker.number.int({ min: 40000, max: 4000000 }),
                        faker.date.past({ years: 2 }),
                        faker.date.recent({ days: 10 }),
                        faker.string.alphanumeric(5).toUpperCase()
                    ]
                );
                companies.push(res.rows[0]);
            }
        }
        const suppliers = companies.slice(0, 10);
        const buyers = companies.slice(10, 15);
        console.log("-> Companies created");

        // --- SPECIFIC FRAUD SCENARIOS FOR DEMO ---

        // SCENARIO 1: 5 Phantom Invoices (No matching PO/GRN)
        console.log("-> Generating Scenario 1: Phantom Invoices");
        for (let i = 0; i < 2; i++) {
            const s = faker.helpers.arrayElement(suppliers).id;
            const b = faker.helpers.arrayElement(buyers).id;
            const cat = faker.helpers.arrayElement(['Industrial Steel', 'Electronics', 'Chemicals']);
            await submitSeedInvoice(
                mainLender,
                `PHANTOM-${faker.number.int({ min: 1000, max: 9999 })}`,
                null, null, s, b,
                faker.number.float({ min: 10000, max: 50000, fractionDigits: 2 }),
                faker.date.recent({ days: 5 }),
                faker.date.soon({ days: 30 }),
                cat
            );
        }

        // SCENARIO 2: 3 Duplicate Invoices across different lender IDs
        console.log("-> Generating Scenario 2: Cross-Lender Duplicates");
        const dupSupplier = suppliers[0].id;
        const dupBuyer = buyers[0].id;
        const dupAmount = 25400.50;
        const dupDate = new Date();
        const fakePoId = null; // Simplifying
        const fakeGrnId = null;

        // Insert first
        await submitSeedInvoice(lenders[0].id, 'ORIG-MULT-1', fakePoId, fakeGrnId, dupSupplier, dupBuyer, dupAmount, dupDate, faker.date.soon({ days: 30 }), 'Office Supplies');

        // Insert dupes across other lenders
        for (let i = 1; i <= 2; i++) {
            await submitSeedInvoice(lenders[i].id, `DUPE-MULT-${i}`, null, null, dupSupplier, dupBuyer, dupAmount, dupDate, faker.date.soon({ days: 30 }), 'Office Supplies');
        }

        // SCENARIO 3: Dormant supplier (No activity 90 days) then 20 invoices in 2 hours
        console.log("-> Generating Scenario 3: Dormant Burst");
        const dormantSupplier = companies[1];
        await pool.query("UPDATE companies SET first_invoice_date = $1, last_invoice_date = $2 WHERE id = $3",
            [faker.date.past({ years: 1 }), faker.date.recent({ days: 100 }), dormantSupplier.id]); // > 90 days ago

        const burstTime = new Date();
        for (let i = 0; i < 5; i++) {
            burstTime.setMinutes(burstTime.getMinutes() + 5); // 5 mins apart
            await submitSeedInvoice(
                mainLender, `BURST-${i}`, null, null, dormantSupplier.id, buyers[1].id,
                faker.number.int({ min: 5000, max: 20000 }), burstTime, faker.date.soon({ days: 30 }), 'Raw Materials'
            );
        }

        // SCENARIO 4: 2 suppliers YTD exceeding annual revenue
        console.log("-> Generating Scenario 4: Revenue Breach");
        for (let sIdx = 2; sIdx <= 3; sIdx++) {
            const greedySupplier = companies[sIdx];
            const massiveAmount = Number(greedySupplier.annual_revenue) * 1.5; // 150% of annual
            await submitSeedInvoice(
                mainLender, `GREED-${sIdx}`, null, null, greedySupplier.id, buyers[2].id, massiveAmount, new Date(), faker.date.soon({ days: 30 }), 'Machinery'
            );
        }

        // SCENARIO 5: 10 invoices 2am-4am with sequential numbers
        console.log("-> Generating Scenario 5: Bot Pattern Off-Hours");
        const botSupplier = companies[4];
        const baseSeq = 80000;
        const nightTime = new Date();
        nightTime.setUTCHours(3, 15, 0, 0); // 3:15 AM

        for (let i = 0; i < 3; i++) {
            nightTime.setMinutes(nightTime.getMinutes() + 2); // 2 mins apart
            await submitSeedInvoice(
                mainLender, `BOT-${baseSeq + i}`, null, null, botSupplier.id, buyers[3].id,
                faker.number.int({ min: 1000, max: 5000 }), nightTime, faker.date.soon({ days: 30 }), 'Consumer Goods'
            );
        }

        // NORMAL SEED DATA (Remaining ~450+ clean/random invoices + associated PO/GRN)
        console.log("-> Generating Bulk Clean Data (~20 records)");
        let cleanCount = 0;
        for (let i = 0; i < 20; i++) {
            const supp = faker.helpers.arrayElement(suppliers);
            const buy = faker.helpers.arrayElement(buyers);
            const lendId = faker.helpers.arrayElement(lenders).id;
            const amt = faker.number.int({ min: 1000, max: 80000 });

            // Sequential valid dates
            const poDate = faker.date.recent({ days: 45 });
            const grnDate = new Date(poDate.getTime() + (5 * 24 * 60 * 60 * 1000)); // PO + 5 days
            const invDate = new Date(grnDate.getTime() + (2 * 24 * 60 * 60 * 1000)); // GRN + 2 days

            const poRes = await pool.query(
                `INSERT INTO purchase_orders (lender_id, buyer_id, supplier_id, amount, po_date, goods_category) VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
                [lendId, buy.id, supp.id, amt * 1.02, poDate, 'General Trade']
            );

            const grnRes = await pool.query(
                `INSERT INTO goods_receipts (lender_id, po_id, amount_received, grn_date) VALUES ($1, $2, $3, $4) RETURNING id`,
                [lendId, poRes.rows[0].id, amt, grnDate]
            );

            await submitSeedInvoice(
                lendId, `CLEAN-${faker.number.int({ min: 100000, max: 999999 })}`, poRes.rows[0].id, grnRes.rows[0].id, supp.id, buy.id, amt, invDate, faker.date.soon({ days: 60 }), 'General Trade'
            );
            cleanCount++;
        }

        // SCENARIO 6: Carousel Trade (A->B->C->A)
        console.log("-> Generating Scenario 6: Carousel Trade");
        const compA = suppliers[5].id;
        const compB = suppliers[6].id;
        const compC = suppliers[7].id;
        const cat = 'Circular Electronics';

        const trades = [[compA, compB], [compB, compC], [compC, compA]];
        for (const [s, b] of trades) {
            await submitSeedInvoice(
                mainLender, `CYCLE-${s}-${b}`, null, null, s, b, 50000, new Date(), new Date(), cat
            );
        }

        // SCENARIO 7: Cascade Over-financing
        console.log("-> Generating Scenario 7: Cascade Over-financing");
        const rootAmt = 1000000;
        const rootPo = await pool.query(
            `INSERT INTO purchase_orders (lender_id, buyer_id, supplier_id, amount, po_date, goods_category) VALUES ($1, $2, $3, $4, NOW(), 'Cascade Logic') RETURNING id`,
            [mainLender, buyers[2].id, suppliers[1].id, rootAmt]
        );
        const rootId = rootPo.rows[0].id;

        // Sub-tier financing
        await pool.query(
            `INSERT INTO purchase_orders (lender_id, buyer_id, supplier_id, amount, po_date, goods_category, root_po_id) VALUES ($1, $2, $3, $4, NOW(), 'Cascade Logic', $5)`,
            [mainLender, suppliers[1].id, suppliers[2].id, 600000, rootId]
        );
        await pool.query(
            `INSERT INTO purchase_orders (lender_id, buyer_id, supplier_id, amount, po_date, goods_category, root_po_id) VALUES ($1, $2, $3, $4, NOW(), 'Cascade Logic', $5)`,
            [mainLender, suppliers[1].id, suppliers[3].id, 600000, rootId]
        );
        // Total financed = 1.2M > 1M (1.2x ratio > 1.1x threshold)

        // SCENARIO 8: Layer 6 — AI / Semantic Layer Anomalies
        console.log("-> Generating Scenario 8: Layer 6 AI / Semantic Fraud");
                // 8a. Goods Description Mismatch (Feature 45)
        const mismatchSupp = suppliers[4].id;
        const mismatchBuy = buyers[3].id;
        const mismatchInvId = `MISMATCH-${faker.number.int({ min: 100, max: 998 })}`;
        const mismatchAmt = 450000;
        
        const misPoRes = await pool.query(
            `INSERT INTO purchase_orders (lender_id, buyer_id, supplier_id, amount, po_date, goods_category) VALUES ($1, $2, $3, $4, NOW(), 'High-grade Structural Steel Beams (Grade 50)') RETURNING id`,
            [mainLender, mismatchBuy, mismatchSupp, mismatchAmt * 1.05]
        );
        
        await submitSeedInvoice(
            mainLender, mismatchInvId, misPoRes.rows[0].id, null, mismatchSupp, mismatchBuy, mismatchAmt, new Date(), new Date(), 
            'Industrial Scrap Metal / Mixed Waste', 'Port of Singapore', 'Net 30'
        );

        // 8b. Geographical & Timeline Anomaly (Layer 6 Addition)
        const geoSupp = suppliers[0].id;
        const geoBuy = buyers[1].id;
        const geoInvId = `GEO-TIME-${faker.number.int({ min: 100, max: 998 })}`;
        
        await submitSeedInvoice(
            mainLender, geoInvId, null, null, geoSupp, geoBuy, 850000, new Date(), new Date(), 
            'Aviation Fuel (Jet A-1)', 'Floor 42, Luxury Residential Tower, Mumbai Central', 'Immediate Net-1 (1 Day)'
        );


        await pool.query('COMMIT');
        console.log(`Seed Data Generation Complete! Generated explicit fraud patterns + ${cleanCount} clean records.`);
        process.exit(0);
    } catch (e) {
        await pool.query('ROLLBACK');
        console.error("Seed Failed:", e);
        process.exit(1);
    }
};

seedData();
