const pool = require('../db/index');
const validationService = require('../services/validationService');
const riskEngineService = require('../services/riskEngineService');
const graphEngineService = require('../services/graphEngineService');
const explainabilityService = require('../services/explainabilityService');
const identityService = require('../services/identityService');

const submitInvoice = async (req, res) => {
    try {
        const lenderId = req.lenderId;
        const {
            invoice_number, po_id, supplier_id, buyer_id, amount,
            expected_payment_date, goods_category, invoice_date, delivery_location, payment_terms
        } = req.body;
        const invoiceDate = invoice_date ? new Date(invoice_date) : new Date();

        if (!invoice_number || !po_id || !supplier_id || !buyer_id || !amount || !expected_payment_date) {
            return res.status(400).json({ error: 'Missing required invoice fields' });
        }

        // 0. Identity Gate (Deep VC Verification on Every Submission)
        const compQuery = await pool.query('SELECT verifiable_credential, credential_verified, is_revoked FROM companies WHERE id = $1', [supplier_id]);
        if (compQuery.rows.length === 0) {
            return res.status(400).json({ error: 'Supplier not found' });
        }
        const company = compQuery.rows[0];

        // Perform Cryptographic Verification
        let vcData = company.verifiable_credential;
        if (typeof vcData === 'string') {
            try {
                vcData = JSON.parse(vcData);
            } catch (e) {
                vcData = null;
            }
        }

        const isVCValid = identityService.verifyVC(vcData);

        if (!company.credential_verified || company.is_revoked || !isVCValid) {
            return res.status(403).json({ error: 'Identity Verification Failed: Invalid or Revoked Credential' });
        }

        // 1. Generate Fingerprint
        const fingerprint = validationService.generateFingerprint(supplier_id, buyer_id, invoice_number, amount, invoiceDate);

        // 2. Draft Initial Invoice
        const invQuery = await pool.query(
            `INSERT INTO invoices (lender_id, invoice_number, po_id, supplier_id, buyer_id, amount, invoice_date, expected_payment_date, goods_category, delivery_location, payment_terms)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11) RETURNING *`,
            [lenderId, invoice_number, po_id, supplier_id, buyer_id, amount, invoiceDate, expected_payment_date, goods_category, delivery_location, payment_terms]
        );
        const invoice = invQuery.rows[0];

        // 3. Store Fingerprint
        await pool.query(
            'INSERT INTO invoice_fingerprints (invoice_id, lender_id, fingerprint) VALUES ($1, $2, $3) ON CONFLICT (fingerprint) DO NOTHING',
            [invoice.id, lenderId, fingerprint]
        );

        let totalPoints = 0;
        let finalBreakdown = [];

        // 4. Duplicate Check (Exact and Fuzzy)
        const dupCheck = await validationService.detectDuplicates(lenderId, fingerprint, supplier_id, buyer_id, amount, invoiceDate, invoice_number, invoice.id);

        if (dupCheck.isDuplicate) {
            totalPoints += dupCheck.points;
            finalBreakdown.push(...dupCheck.breakdown);
        }

        // 5. Triple Match Validation
        const tripleCheck = await validationService.checkTripleMatch(lenderId, po_id, invoice.grn_id, amount, invoiceDate, supplier_id, buyer_id, invoice_number);

        totalPoints += tripleCheck.points;
        finalBreakdown.push(...tripleCheck.breakdown);

        // 6. Complete Risk Engine Execution (Default: NO AI/Gemini for speed)
        const riskResult = await riskEngineService.evaluateRisk(
            lenderId,
            invoice.id,
            supplier_id,
            buyer_id,
            amount,
            invoiceDate,
            expected_payment_date,
            totalPoints,
            finalBreakdown,
            { triggerAI: false }
        );

        // 7. Update Trade Relationship Graph (Fire for ALL invoices)
        await graphEngineService.updateEdgeMetadata(
            lenderId,
            supplier_id,
            buyer_id,
            amount,
            goods_category
        );

        // --- AUTOMATED CASCADE RECALCULATION ---
        // We trigger a background re-evaluation of other pending invoices for this supplier/buyer 
        // to detect new network patterns (like Carousel loops) that this new invoice might have completed.
        setImmediate(async () => {
            try {
                // B6 FIX: select each neighbor's own IDs and fields so evaluateRisk
                // scores them in their correct entity context, not with this invoice's IDs.
                const neighbors = await pool.query(
                    `SELECT id, supplier_id, buyer_id, lender_id,
                            amount, invoice_date, expected_payment_date
                     FROM invoices
                     WHERE (supplier_id IN ($1, $2) OR buyer_id IN ($1, $2))
                       AND status IN ('PENDING', 'APPROVED') AND id != $3`,
                    [supplier_id, buyer_id, invoice.id]
                );
                for (const row of neighbors.rows) {
                    await riskEngineService.evaluateRisk(
                        row.lender_id || lenderId,
                        row.id,
                        row.supplier_id,
                        row.buyer_id,
                        row.amount || 0,
                        row.invoice_date || new Date(),
                        row.expected_payment_date || new Date(),
                        0,
                        []
                    );
                }
            } catch (err) {
                console.error('Background recalculation failed:', err);
            }
        });

        // Map to exact required JSON contract
        const responseContract = {
            invoiceId: invoice.id,
            status: riskResult.status,
            riskScore: riskResult.riskScore,
            breakdown: riskResult.breakdown,
            duplicateOf: dupCheck.duplicateOf,
            recommendation: riskResult.recommendation
        };

        res.status(201).json(responseContract);
    } catch (error) {
        console.error('Error submitting invoice:', error);
        res.status(500).json({ error: 'Failed to submit invoice: ' + error.message });
    }
};

const getInvoiceDetails = async (req, res) => {
    try {
        const { id } = req.params;
        const lenderId = req.lenderId;

        const invQuery = await pool.query(
            `
            SELECT i.*, 
                   po.goods_category AS po_description, 
                   po.po_date AS po_date,
                   po.amount AS po_amount,
                   po.delivery_location AS po_location,
                   po.payment_terms AS po_payment_terms,
                   grn.amount_received AS grn_amount,
                   grn.grn_date AS grn_date,
                   grn.goods_category AS grn_category,
                   e.fraud_dna,
                   e.counterfactual,
                   e.impatience_signal,
                   sup.name AS supplier_name,
                   buy.name AS buyer_name
            FROM invoices i
            LEFT JOIN purchase_orders po ON i.po_id = po.id
            LEFT JOIN goods_receipts grn ON i.grn_id = grn.id
            LEFT JOIN companies sup ON sup.id = i.supplier_id
            LEFT JOIN companies buy ON buy.id = i.buyer_id
            LEFT JOIN LATERAL (
                SELECT fraud_dna, counterfactual, impatience_signal
                FROM explanations
                WHERE invoice_id = i.id
                ORDER BY created_at DESC
                LIMIT 1
            ) e ON true
            WHERE i.id = $1 AND i.lender_id = $2
        `,
            [id, lenderId]
        );

        if (invQuery.rows.length === 0) {
            return res.status(404).json({ error: 'Invoice not found or access denied' });
        }

        const invoice = invQuery.rows[0];

        // Fetch audit history breakdown (JSONB may arrive as object or string)
        const auditQuery = await pool.query('SELECT breakdown FROM risk_score_audits WHERE invoice_id = $1 ORDER BY created_at DESC LIMIT 1', [id]);
        let breakdown = auditQuery.rows.length > 0 ? auditQuery.rows[0].breakdown : [];
        if (typeof breakdown === 'string') {
            try {
                breakdown = JSON.parse(breakdown);
            } catch {
                breakdown = [];
            }
        }
        if (!Array.isArray(breakdown)) breakdown = [];

        // DNA: prefer persisted explanation; always derive when missing so APPROVED/clean invoices still show a profile
        let fraudDNA = invoice.fraud_dna;
        if (typeof fraudDNA === 'string') {
            try {
                fraudDNA = JSON.parse(fraudDNA);
            } catch {
                fraudDNA = null;
            }
        }
        if (!fraudDNA) {
            fraudDNA = explainabilityService.classifyFraudDNA(breakdown);
        }

        // Counterfactual: prefer persisted value; derive on-the-fly for older invoices with no explanation row
        let counterfactual = invoice.counterfactual || null;
        if (!counterfactual && breakdown.length > 0) {
            counterfactual = explainabilityService.generateCounterfactual(id, invoice.risk_score || 0, breakdown);
        }

        // Impatience signal: prefer persisted string; derive on-the-fly if missing
        let impatienceSignal = invoice.impatience_signal || null;
        if (!impatienceSignal && breakdown.length > 0) {
            impatienceSignal = explainabilityService.detectImpatienceSignal(breakdown);
        }

        const grnDesc = invoice.grn_category ? invoice.grn_category : (
            invoice.grn_amount != null
                ? `Goods receipt — amount received: ${invoice.grn_amount} (aligned to PO line items where applicable)`
                : null
        );

        res.json({
            ...invoice,
            breakdown,
            fraudDNA,
            counterfactual,
            impatience_signal: impatienceSignal,
            documentTriplet: {
                invoice: { id: invoice.invoice_number, amount: invoice.amount, date: invoice.invoice_date, category: invoice.goods_category },
                po: { id: invoice.po_id, amount: invoice.po_amount, date: invoice.po_date, category: invoice.po_description, location: invoice.po_location, payment_terms: invoice.po_payment_terms },
                grn: { id: invoice.grn_id, amount: invoice.grn_amount, date: invoice.grn_date }
            },
            semanticData: {
                invoiceDescription: invoice.goods_category || '',
                poDescription: invoice.po_description || '',
                grnDescription: grnDesc || '',
                invoiceLocation: invoice.delivery_location || '',
                poLocation: invoice.po_location || '',
                invoiceTerms: invoice.payment_terms || '',
                poTerms: invoice.po_payment_terms || ''
            }
        });

    } catch (error) {
        console.error('Error fetching invoice:', error);
        res.status(500).json({ error: 'Failed to fetch invoice' });
    }
};

const preDisbursementGate = async (req, res) => {
    try {
        const { id } = req.params;
        const lenderId = req.lenderId;

        const invQuery = await pool.query('SELECT status FROM invoices WHERE id = $1 AND lender_id = $2', [id, lenderId]);
        if (invQuery.rows.length === 0) {
            return res.status(404).json({ error: 'Invoice not found or access denied' });
        }

        const invoice = invQuery.rows[0];
        if (invoice.status === 'BLOCKED' || invoice.status === 'REVIEW') {
            return res.status(403).json({ error: `Disbursement Failed: Invoice is currently in ${invoice.status} status.` });
        }

        res.json({ message: 'Disbursement Approved' });
    } catch (error) {
        console.error('Error at disbursement gate:', error);
        res.status(500).json({ error: 'Failed to process disbursement request' });
    }
};

const manualOverride = async (req, res) => {
    try {
        const { id } = req.params;
        const lenderId = req.lenderId;
        const { reason, auditorId } = req.body;

        if (!reason) {
            return res.status(400).json({ error: 'Mandatory reason log is required to override' });
        }

        const invQuery = await pool.query('SELECT status FROM invoices WHERE id = $1 AND lender_id = $2', [id, lenderId]);
        if (invQuery.rows.length === 0) {
            return res.status(404).json({ error: 'Invoice not found or access denied' });
        }

        // Add to manual_overrides table
        await pool.query(
            'INSERT INTO manual_overrides (invoice_id, reason_log, auditor_id) VALUES ($1, $2, $3)',
            [id, reason, auditorId || 'system_auditor']
        );

        // Forcefully approve invoice
        await pool.query("UPDATE invoices SET status = 'APPROVED' WHERE id = $1", [id]);

        // Resolve active alerts
        await pool.query("UPDATE alerts SET resolved = true WHERE invoice_id = $1", [id]);

        res.json({ message: 'Invoice manually overriden and approved successfully' });
    } catch (error) {
        console.error('Error at manual override:', error);
        res.status(500).json({ error: 'Failed to override invoice' });
    }
};

const triggerAIExplainer = async (req, res) => {
    try {
        const { id } = req.params;
        const lenderId = req.lenderId;
        console.log(`[TRIGGER-AI] Incoming request for Invoice ID: ${id}, Lender: ${lenderId}`);

        const invQuery = await pool.query('SELECT * FROM invoices WHERE id = $1 AND lender_id = $2', [id, lenderId]);
        if (invQuery.rows.length === 0) {
            return res.status(404).json({ error: 'Invoice not found' });
        }
        const invoice = invQuery.rows[0];

        // Fetch current breakdown to avoid losing deterministic flags
        const auditQuery = await pool.query('SELECT breakdown FROM risk_score_audits WHERE invoice_id = $1 ORDER BY version DESC LIMIT 1', [id]);
        let baseBreakdown = auditQuery.rows.length > 0 ? auditQuery.rows[0].breakdown : [];
        if (typeof baseBreakdown === 'string') baseBreakdown = JSON.parse(baseBreakdown);

        console.log(`[AI-SCAN] Starting Forensic & Semantic Audit for Invoice ${id}...`);
        // Run FULL risk engine WITH AI Layer 6 & Layer 7
        const result = await riskEngineService.evaluateRisk(
            lenderId,
            invoice.id,
            invoice.supplier_id,
            invoice.buyer_id,
            invoice.amount,
            invoice.invoice_date,
            invoice.expected_payment_date,
            0, // We reset score for a clean re-calc
            [],
            { triggerAI: true }
        );

        console.log(`[AI-SCAN] Forensic Audit complete for Invoice ${id}.`);

        // CRITICAL: Persist the new AI reasoning to the Layer 7 explanations table
        await explainabilityService.generateExplanation(Number(id), result);

        res.json({
            message: 'AI Reasoning and Forensic DNA generated successfully',
            status: result.status,
            riskScore: result.riskScore,
            breakdown: result.breakdown
        });
    } catch (error) {
        console.error('Error triggering AI reasoning:', error);
        res.status(500).json({ error: 'Failed to trigger AI reasoning' });
    }
};

const getInvoiceAudits = async (req, res) => {
    try {
        const { id } = req.params;
        const lenderId = req.lenderId;

        const invCheck = await pool.query('SELECT id FROM invoices WHERE id = $1 AND lender_id = $2', [id, lenderId]);
        if (invCheck.rows.length === 0) {
            return res.status(404).json({ error: 'Invoice not found' });
        }

        const auditQuery = await pool.query(
            'SELECT version, score, breakdown, engine_version, created_at FROM risk_score_audits WHERE invoice_id = $1 ORDER BY version DESC',
            [id]
        );

        res.json(auditQuery.rows);
    } catch (error) {
        console.error('Error fetching audits:', error);
        res.status(500).json({ error: 'Failed to fetch audit history' });
    }
};

module.exports = {
    submitInvoice,
    getInvoiceDetails,
    preDisbursementGate,
    manualOverride,
    triggerAIExplainer,
    getInvoiceAudits
};
