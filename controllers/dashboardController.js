const pool = require('../db/index');

const getAlerts = async (req, res) => {
    try {
        const lenderId = req.lenderId;
        const page = parseInt(req.query.page) || 1;
        const limit = 20;
        const offset = (page - 1) * limit;

        const entityId = req.query.entityId;
        const params = [lenderId, limit, offset];
        let entityFilter = '';
        if (entityId !== undefined && entityId !== null && String(entityId).trim() !== '') {
            entityFilter = ' AND (i.supplier_id = $4 OR i.buyer_id = $4)';
            params.push(entityId);
        }

        const alertsQuery = await pool.query(
            `SELECT a.*, i.invoice_number, i.supplier_id, i.buyer_id FROM alerts a 
             JOIN invoices i ON a.invoice_id = i.id 
             WHERE a.lender_id = $1 
             ${entityFilter}
             ORDER BY a.created_at DESC 
             LIMIT $2 OFFSET $3`,
            params
        );

        res.json(alertsQuery.rows);
    } catch (error) {
        console.error('Error fetching alerts:', error);
        res.status(500).json({ error: 'Failed to fetch alerts' });
    }
};

const getPortfolio = async (req, res) => {
    try {
        // Technically lenderId in params vs auth header. 
        // Best practice: verify header matches param, or just enforce header.
        const lenderIdFromAuth = req.lenderId;
        const requestedLenderId = req.params.id;

        if (String(lenderIdFromAuth) !== String(requestedLenderId)) {
            return res.status(403).json({ error: 'Access denied: Cannot view other lender portfolios' });
        }

        const invQuery = await pool.query(
            `SELECT i.id, i.invoice_number, i.supplier_id, i.buyer_id, i.amount, i.invoice_date, i.status, i.risk_score,
                    s.name AS supplier_name, b.name AS buyer_name,
                    set.actual_payment_amount AS paid_amount, set.payment_date
             FROM invoices i
             LEFT JOIN companies s ON s.id = i.supplier_id
             LEFT JOIN companies b ON b.id = i.buyer_id
             LEFT JOIN settlements set ON set.invoice_id = i.id
             WHERE i.lender_id = $1
             ORDER BY i.invoice_date DESC`,
            [lenderIdFromAuth]
        );

        res.json(invQuery.rows);
    } catch (error) {
        console.error('Error fetching portfolio:', error);
        res.status(500).json({ error: 'Failed to fetch portfolio' });
    }
};

const getKPI = async (req, res) => {
    try {
        const lenderId = req.lenderId;
        // Core KPI aggregation
        const result = await pool.query(
            `SELECT 
                COUNT(*) as active_invoices,
                SUM(amount) as total_exposure,
                COUNT(*) FILTER (WHERE status = 'BLOCKED') as blocked_today,
                COUNT(*) FILTER (WHERE status = 'APPROVED') as approved_invoices
             FROM invoices WHERE lender_id = $1`,
            [lenderId]
        );
        const alertsResult = await pool.query('SELECT COUNT(*) as count FROM alerts WHERE lender_id = $1 AND resolved = false', [lenderId]);
        const tierRiskResult = await pool.query(
            `SELECT
                COALESCE(AVG(i.risk_score) FILTER (WHERE c.tier = 1), 0) AS tier1_avg_risk,
                COALESCE(AVG(i.risk_score) FILTER (WHERE c.tier = 2), 0) AS tier2_avg_risk,
                COALESCE(AVG(i.risk_score) FILTER (WHERE c.tier = 3), 0) AS tier3_avg_risk
             FROM invoices i
             JOIN companies c ON c.id = i.supplier_id
             WHERE i.lender_id = $1`,
            [lenderId]
        );
        const trendResult = await pool.query(
            `WITH windows AS (
                SELECT
                    COUNT(*) FILTER (WHERE invoice_date >= NOW() - INTERVAL '7 days') AS current_invoices,
                    COUNT(*) FILTER (
                        WHERE invoice_date < NOW() - INTERVAL '7 days'
                        AND invoice_date >= NOW() - INTERVAL '14 days'
                    ) AS previous_invoices
                FROM invoices
                WHERE lender_id = $1
            ),
            alert_windows AS (
                SELECT
                    COUNT(*) FILTER (WHERE created_at >= NOW() - INTERVAL '7 days' AND resolved = false) AS current_alerts,
                    COUNT(*) FILTER (
                        WHERE created_at < NOW() - INTERVAL '7 days'
                        AND created_at >= NOW() - INTERVAL '14 days'
                        AND resolved = false
                    ) AS previous_alerts
                FROM alerts
                WHERE lender_id = $1
            )
            SELECT
                w.current_invoices,
                w.previous_invoices,
                a.current_alerts,
                a.previous_alerts
            FROM windows w, alert_windows a`,
            [lenderId]
        );

        // --- STEP 6: DILUTION & DISPUTE KPIs ---
        const dilutionResult = await pool.query(
            `SELECT 
                COALESCE(SUM(i.amount - s.actual_payment_amount) / NULLIF(SUM(i.amount), 0), 0) as avg_dilution,
                COUNT(DISTINCT i.supplier_id) FILTER (WHERE (i.amount - s.actual_payment_amount) > 0) as diluted_suppliers
             FROM invoices i
             JOIN settlements s ON s.invoice_id = i.id
             WHERE i.lender_id = $1 AND i.invoice_date >= NOW() - INTERVAL '90 days'`,
            [lenderId]
        );

        const disputeValueResult = await pool.query(
            `SELECT COALESCE(SUM(deduction_amount), 0) as total_disputed
             FROM disputes d
             JOIN invoices i ON d.invoice_id = i.id
             WHERE i.lender_id = $1`,
            [lenderId]
        );

        const row = result.rows[0];
        const trendRow = trendResult.rows[0] || {};
        const approved = Number(row.approved_invoices) || 0;
        const active = Number(row.active_invoices) || 0;
        const pctChange = (current, previous) => {
            const c = Number(current) || 0;
            const p = Number(previous) || 0;
            if (p === 0) return c === 0 ? 0 : 100;
            return Number((((c - p) / p) * 100).toFixed(2));
        };

        res.json({
            id: 1,
            activeInvoices: active,
            activeInvoicesChange: pctChange(trendRow.current_invoices, trendRow.previous_invoices),
            healthScore: active === 0 ? 0 : Number(((approved / active) * 100).toFixed(2)),
            tier1Risk: Number(tierRiskResult.rows[0]?.tier1_avg_risk || 0),
            tier2Risk: Number(tierRiskResult.rows[0]?.tier2_avg_risk || 0),
            tier3Risk: Number(tierRiskResult.rows[0]?.tier3_avg_risk || 0),
            highRiskGaps: parseInt(alertsResult.rows[0].count) || 0,
            highRiskGapsChange: pctChange(trendRow.current_alerts, trendRow.previous_alerts),
            totalExposure: parseFloat(row.total_exposure) || 0,
            blockedToday: parseInt(row.blocked_today) || 0,
            alertsCount: parseInt(alertsResult.rows[0].count) || 0,
            // New Step 6 Fields
            averagePortfolioDilution: parseFloat(dilutionResult.rows[0]?.avg_dilution || 0),
            totalDisputedValue: parseFloat(disputeValueResult.rows[0]?.total_disputed || 0),
            dilutedSuppliersCount: parseInt(dilutionResult.rows[0]?.diluted_suppliers || 0)
        });
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch KPI' });
    }
};

const getDiscrepancies = async (req, res) => {
    // Returning a dummy combined structure or DB fetch if GRN table is populated
    try {
        const lenderId = req.lenderId;
        const result = await pool.query(
            `SELECT i.id, c.name as company_name, i.amount as invoice_value, po.amount as po_value, grn.amount_received as grn_value 
             FROM invoices i 
             LEFT JOIN companies c ON i.supplier_id = c.id
             LEFT JOIN purchase_orders po ON i.po_id = po.id
             LEFT JOIN goods_receipts grn ON i.grn_id = grn.id
             WHERE i.lender_id = $1 AND i.status != 'SETTLED'
             LIMIT 10`,
            [lenderId]
        );

        const mapped = result.rows.map(r => ({
            id: r.id,
            companyName: r.company_name || 'Unknown',
            invoiceValue: parseFloat(r.invoice_value) || 0,
            poValue: parseFloat(r.po_value) || 0,
            grnValue: parseFloat(r.grn_value) || 0,
            matchStatus: parseFloat(r.invoice_value) === parseFloat(r.po_value)
        }));

        res.json(mapped.length > 0 ? mapped : []);
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch discrepancies' });
    }
};

const getVelocity = async (req, res) => {
    try {
        const lenderId = req.lenderId;
        // Fetch submission volume grouped by day for the last 14 days
        const result = await pool.query(
            `WITH days AS (
                SELECT generate_series(CURRENT_DATE - INTERVAL '13 days', CURRENT_DATE, '1 day')::date AS day
            )
            SELECT 
                d.day as timestamp,
                COUNT(i.id) FILTER (WHERE c.tier = 1) as tier1_velocity,
                COUNT(i.id) FILTER (WHERE c.tier = 2) as tier2_velocity,
                COUNT(i.id) FILTER (WHERE c.tier = 3) as tier3_velocity
            FROM days d
            LEFT JOIN invoices i ON i.invoice_date::date = d.day AND i.lender_id = $1
            LEFT JOIN companies c ON i.supplier_id = c.id
            GROUP BY d.day
            ORDER BY d.day ASC`,
            [lenderId]
        );

        const mapped = result.rows.map((r, i) => ({
            id: i,
            timestamp: r.timestamp,
            tier1Velocity: parseInt(r.tier1_velocity) || 0,
            tier2Velocity: parseInt(r.tier2_velocity) || 0,
            tier3Velocity: parseInt(r.tier3_velocity) || 0
        }));

        res.json(mapped);
    } catch (error) {
        console.error('Error fetching velocity:', error);
        res.status(500).json({ error: 'Failed to fetch velocity' });
    }
};

const postStressTest = async (req, res) => {
    try {
        const { volume } = req.body;
        const lenderId = req.lenderId;
        const websocketService = require('../services/websocketService');

        // This is a "Backing" for the simulator.
        // It simulates the REAL processing time of the risk engine.
        // real evaluation takes ~30-50ms per invoice in our current DB setup.
        const processingSpeedMs = 40; 
        const totalDuration = volume * (processingSpeedMs / 10); // Simulated parallel processing speed

        // Start broadcasting progress via WebSocket
        let processed = 0;
        const interval = setInterval(() => {
            processed += Math.floor(Math.random() * (volume / 5)) + 5;
            if (processed >= volume) {
                processed = volume;
                clearInterval(interval);
            }
            
            websocketService.broadcastRaw({
                type: 'STRESS_TEST_PROGRESS',
                processed,
                total: volume,
                isComplete: processed === volume
            });
        }, 300);

        res.json({ 
            status: 'STRESS_TEST_STARTED', 
            targetVolume: volume, 
            estimatedDuration: totalDuration 
        });
    } catch (error) {
        res.status(500).json({ error: 'Failed to start stress test' });
    }
};

const getDemoScenarios = async (req, res) => {
    try {
        const lenderId = req.lenderId;

        // Find a pair for 'Honest' scenario (Normal matching)
        const validPair = await pool.query(
            `SELECT po.id as po_id, grn.id as grn_id, po.amount, po.supplier_id, po.buyer_id, s.name as supplier_name, b.name as buyer_name
             FROM purchase_orders po
             JOIN goods_receipts grn ON grn.po_id = po.id
             JOIN companies s ON po.supplier_id = s.id
             JOIN companies b ON po.buyer_id = b.id
             WHERE po.lender_id = $1
             LIMIT 1`,
            [lenderId]
        );

        // Find a mismatch pair for 'Lazy Fraudster' scenario
        const mismatchPair = await pool.query(
            `SELECT po.id as po_id, grn.id as grn_id, po.amount as po_amount, grn.amount_received as grn_amount, po.supplier_id, po.buyer_id, s.name as supplier_name, b.name as buyer_name
             FROM purchase_orders po
             JOIN goods_receipts grn ON grn.po_id = po.id
             JOIN companies s ON po.supplier_id = s.id
             JOIN companies b ON po.buyer_id = b.id
             WHERE po.lender_id = $1
             LIMIT 1 OFFSET 1`,
            [lenderId]
        );

        // Find an existing invoice for 'Duplicate Attack' scenario
        const duplicateSource = await pool.query(
            `SELECT i.invoice_number, i.amount, i.supplier_id, i.buyer_id, i.po_id, i.grn_id, s.name as supplier_name
             FROM invoices i
             JOIN companies s ON i.supplier_id = s.id
             WHERE i.lender_id = $1
             LIMIT 1`,
            [lenderId]
        );

        res.json({
            honest: validPair.rows[0] || null,
            mismatch: mismatchPair.rows[0] || null,
            duplicate: duplicateSource.rows[0] || null
        });
    } catch (error) {
        console.error('Error fetching scenarios:', error);
        res.status(500).json({ error: 'Failed to fetch demo scenarios' });
    }
};

module.exports = {
    getAlerts,
    getPortfolio,
    getKPI,
    getDiscrepancies,
    getVelocity,
    postStressTest,
    getDemoScenarios
};
