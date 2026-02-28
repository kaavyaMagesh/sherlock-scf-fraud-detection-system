const pool = require('../db/index');
const { faker } = require('@faker-js/faker');

const seedData = async () => {
    try {
        console.log("Starting DB Seed...");
        await pool.query('BEGIN');

        // 1. Create Lenders
        const lenders = [];
        for (let i = 1; i <= 3; i++) {
            const res = await pool.query(
                'INSERT INTO lenders (name) VALUES ($1) RETURNING *',
                [`Lender Bank ${i}`]
            );
            lenders.push(res.rows[0]);
        }
        const mainLender = lenders[0].id;
        console.log("-> Lenders created");

        // 2. Create Companies (Suppliers and Buyers)
        const companies = [];
        for (let i = 0; i < 50; i++) {
            const res = await pool.query(
                `INSERT INTO companies (lender_id, name, tier, annual_revenue, monthly_avg_invoicing, first_invoice_date, last_invoice_date, industry_code)
                 VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
                [
                    faker.helpers.arrayElement(lenders).id,
                    faker.company.name(),
                    faker.number.int({ min: 1, max: 3 }),
                    faker.number.int({ min: 500000, max: 50000000 }), // 500k to 50M
                    faker.number.int({ min: 40000, max: 4000000 }),
                    faker.date.past({ years: 2 }),
                    faker.date.recent({ days: 10 }),
                    faker.string.alphanumeric(5).toUpperCase()
                ]
            );
            companies.push(res.rows[0]);
        }
        const suppliers = companies.slice(0, 30);
        const buyers = companies.slice(30, 50);
        console.log("-> Companies created");

        // --- SPECIFIC FRAUD SCENARIOS FOR DEMO ---

        // SCENARIO 1: 5 Phantom Invoices (No matching PO/GRN)
        console.log("-> Generating Scenario 1: Phantom Invoices");
        for (let i = 0; i < 5; i++) {
            const s = faker.helpers.arrayElement(suppliers).id;
            const b = faker.helpers.arrayElement(buyers).id;
            await pool.query(
                `INSERT INTO invoices (lender_id, invoice_number, po_id, grn_id, supplier_id, buyer_id, amount, invoice_date, expected_payment_date)
                 VALUES ($1, $2, null, null, $3, $4, $5, $6, $7)`,
                [
                    mainLender,
                    `PHANTOM-${faker.number.int({ min: 1000, max: 9999 })}`,
                    s, b,
                    faker.number.float({ min: 10000, max: 50000, fractionDigits: 2 }),
                    faker.date.recent({ days: 5 }),
                    faker.date.soon({ days: 30 })
                ]
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
        const inv1Res = await pool.query(
            `INSERT INTO invoices (lender_id, invoice_number, po_id, grn_id, supplier_id, buyer_id, amount, invoice_date, expected_payment_date)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING id`,
            [lenders[0].id, 'ORIG-MULT-1', fakePoId, fakeGrnId, dupSupplier, dupBuyer, dupAmount, dupDate, faker.date.soon({ days: 30 })]
        );
        // Standardize fingerprint simulation (normally done via app logic, simulating here based on validationService)
        const crypto = require('crypto');
        const raw = `${dupSupplier}-${dupBuyer}-${Number(dupAmount).toFixed(2)}-${dupDate.toISOString().split('T')[0]}`;
        const fingerprint = crypto.createHash('sha256').update(raw).digest('hex');

        await pool.query('INSERT INTO invoice_fingerprints (invoice_id, lender_id, fingerprint) VALUES ($1, $2, $3)', [inv1Res.rows[0].id, lenders[0].id, fingerprint]);

        // Insert dupes across other lenders
        for (let i = 1; i <= 2; i++) {
            const dupInv = await pool.query(
                `INSERT INTO invoices (lender_id, invoice_number, po_id, grn_id, supplier_id, buyer_id, amount, invoice_date, expected_payment_date)
                 VALUES ($1, $2, null, null, $3, $4, $5, $6, $7) RETURNING id`,
                [lenders[i].id, `DUPE-MULT-${i}`, dupSupplier, dupBuyer, dupAmount, dupDate, faker.date.soon({ days: 30 })]
            );
            // In reality, fingerprint insertion might fail if UNIQUE constraint fires unless cross-lender allows it. 
            // In our schema blueprint: fingerprint is UNIQUE globally. 
            // Meaning if Lender 2 tries to insert, DB blocks the fingerprint insert, flagging it.
            // So we leave the seed script here, simulating the first pass only.
        }

        // SCENARIO 3: Dormant supplier (No activity 90 days) then 20 invoices in 2 hours
        console.log("-> Generating Scenario 3: Dormant Burst");
        const dormantSupplier = companies[1];
        await pool.query("UPDATE companies SET first_invoice_date = $1, last_invoice_date = $2 WHERE id = $3",
            [faker.date.past({ years: 1 }), faker.date.recent({ days: 100 }), dormantSupplier.id]); // > 90 days ago

        const burstTime = new Date();
        for (let i = 0; i < 20; i++) {
            burstTime.setMinutes(burstTime.getMinutes() + 5); // 5 mins apart
            await pool.query(
                `INSERT INTO invoices (lender_id, invoice_number, po_id, grn_id, supplier_id, buyer_id, amount, invoice_date, expected_payment_date)
                 VALUES ($1, $2, null, null, $3, $4, $5, $6, $7)`,
                [mainLender, `BURST-${i}`, dormantSupplier.id, buyers[1].id, faker.number.int({ min: 5000, max: 20000 }), burstTime, faker.date.soon({ days: 30 })]
            );
        }

        // SCENARIO 4: 2 suppliers YTD exceeding annual revenue
        console.log("-> Generating Scenario 4: Revenue Breach");
        for (let sIdx = 2; sIdx <= 3; sIdx++) {
            const greedySupplier = companies[sIdx];
            const massiveAmount = Number(greedySupplier.annual_revenue) * 1.5; // 150% of annual
            await pool.query(
                `INSERT INTO invoices (lender_id, invoice_number, po_id, grn_id, supplier_id, buyer_id, amount, invoice_date, expected_payment_date)
                 VALUES ($1, $2, null, null, $3, $4, $5, $6, $7)`,
                [mainLender, `GREED-${sIdx}`, greedySupplier.id, buyers[2].id, massiveAmount, new Date(), faker.date.soon({ days: 30 })]
            );
        }

        // SCENARIO 5: 10 invoices 2am-4am with sequential numbers
        console.log("-> Generating Scenario 5: Bot Pattern Off-Hours");
        const botSupplier = companies[4];
        const baseSeq = 80000;
        const nightTime = new Date();
        nightTime.setUTCHours(3, 15, 0, 0); // 3:15 AM

        for (let i = 0; i < 10; i++) {
            nightTime.setMinutes(nightTime.getMinutes() + 2); // 2 mins apart
            await pool.query(
                `INSERT INTO invoices (lender_id, invoice_number, po_id, grn_id, supplier_id, buyer_id, amount, invoice_date, expected_payment_date)
                 VALUES ($1, $2, null, null, $3, $4, $5, $6, $7)`,
                [mainLender, `BOT-${baseSeq + i}`, botSupplier.id, buyers[3].id, faker.number.int({ min: 1000, max: 5000 }), nightTime, faker.date.soon({ days: 30 })]
            );
        }

        // NORMAL SEED DATA (Remaining ~450+ clean/random invoices + associated PO/GRN)
        console.log("-> Generating Bulk Clean Data (~460 records)");
        let cleanCount = 0;
        for (let i = 0; i < 460; i++) {
            const supp = faker.helpers.arrayElement(suppliers);
            const buy = faker.helpers.arrayElement(buyers);
            const lendId = faker.helpers.arrayElement(lenders).id;
            const amt = faker.number.int({ min: 1000, max: 80000 });

            // Sequential valid dates
            const poDate = faker.date.recent({ days: 45 });
            const grnDate = new Date(poDate.getTime() + (5 * 24 * 60 * 60 * 1000)); // PO + 5 days
            const invDate = new Date(grnDate.getTime() + (2 * 24 * 60 * 60 * 1000)); // GRN + 2 days

            const poRes = await pool.query(
                `INSERT INTO purchase_orders (lender_id, buyer_id, supplier_id, amount, po_date) VALUES ($1, $2, $3, $4, $5) RETURNING id`,
                [lendId, buy.id, supp.id, amt * 1.02, poDate]
            );

            const grnRes = await pool.query(
                `INSERT INTO goods_receipts (lender_id, po_id, amount_received, grn_date) VALUES ($1, $2, $3, $4) RETURNING id`,
                [lendId, poRes.rows[0].id, amt, grnDate]
            );

            await pool.query(
                `INSERT INTO invoices (lender_id, invoice_number, po_id, grn_id, supplier_id, buyer_id, amount, invoice_date, expected_payment_date, status, risk_score)
                 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'APPROVED', 10)`,
                [lendId, `CLEAN-${faker.number.int({ min: 100000, max: 999999 })}`, poRes.rows[0].id, grnRes.rows[0].id, supp.id, buy.id, amt, invDate, faker.date.soon({ days: 60 })]
            );
            cleanCount++;
        }

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
