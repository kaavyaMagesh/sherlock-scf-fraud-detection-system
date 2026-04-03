const pool = require('../db/index');

/**
 * Layer 5 — Network Graph Engine
 * Handles trade relationship graph logic, topology, and advanced network fraud detection.
 */

const updateEdgeMetadata = async (lenderId, supplierId, buyerId, amount, goodsCategory) => {
    const query = `
        INSERT INTO trade_relationships (lender_id, supplier_id, buyer_id, last_seen, total_volume, invoice_count, goods_category)
        VALUES ($1, $2, $3, NOW(), $4, 1, $5)
        ON CONFLICT (supplier_id, buyer_id, lender_id) 
        DO UPDATE SET 
            last_seen = NOW(),
            total_volume = trade_relationships.total_volume + EXCLUDED.total_volume,
            invoice_count = trade_relationships.invoice_count + 1,
            goods_category = COALESCE(EXCLUDED.goods_category, trade_relationships.goods_category);
    `;
    await pool.query(query, [lenderId, supplierId, buyerId, amount, goodsCategory]);
};

const getTopology = async (lenderId) => {
    const nodesQuery = `
        SELECT
            c.id,
            c.name,
            c.tier,
            'company' as type,
            COALESCE(inv.avg_risk_score, 0) AS avg_risk_score,
            COALESCE(inv.max_risk_score, 0) AS max_risk_score,
            COALESCE(inv.active_invoices, 0) AS active_invoices,
            COALESCE(inv.total_volume, 0) AS total_volume,
            inv.latest_invoice_status,
            COALESCE(inv.has_blocked_invoice, FALSE) AS has_blocked_invoice,
            COALESCE(inv.has_review_invoice, FALSE) AS has_review_invoice,
            CASE
                WHEN COALESCE(inv.active_invoices, 0) = 0 THEN 'UNKNOWN'
                WHEN COALESCE(inv.has_blocked_invoice, FALSE) THEN 'BLOCKED'
                WHEN COALESCE(inv.has_review_invoice, FALSE) THEN 'REVIEW'
                WHEN COALESCE(inv.max_risk_score, 0) >= 60 THEN 'BLOCKED'
                WHEN COALESCE(inv.max_risk_score, 0) >= 30 THEN 'REVIEW'
                ELSE 'APPROVED'
            END AS current_status,
            EXISTS (
                SELECT 1 FROM trade_relationships tr
                WHERE tr.lender_id = c.lender_id
                  AND (tr.supplier_id = c.id OR tr.buyer_id = c.id)
            ) AS has_trade_edge
        FROM companies c
        LEFT JOIN LATERAL (
            SELECT
                AVG(
                    GREATEST(
                        COALESCE(i.risk_score, 0),
                        CASE i.status
                            WHEN 'BLOCKED' THEN 60
                            WHEN 'REVIEW' THEN 30
                            ELSE 0
                        END
                    )
                ) AS avg_risk_score,
                MAX(
                    GREATEST(
                        COALESCE(i.risk_score, 0),
                        CASE i.status
                            WHEN 'BLOCKED' THEN 60
                            WHEN 'REVIEW' THEN 30
                            ELSE 0
                        END
                    )
                ) AS max_risk_score,
                COUNT(*) AS active_invoices,
                SUM(i.amount) AS total_volume,
                BOOL_OR(i.status = 'BLOCKED') AS has_blocked_invoice,
                BOOL_OR(i.status = 'REVIEW') AS has_review_invoice,
                (
                    SELECT i2.status
                    FROM invoices i2
                    WHERE i2.lender_id = c.lender_id
                      AND (i2.supplier_id = c.id OR i2.buyer_id = c.id)
                    ORDER BY i2.invoice_date DESC NULLS LAST
                    LIMIT 1
                ) AS latest_invoice_status
            FROM invoices i
            WHERE i.lender_id = c.lender_id
              AND (i.supplier_id = c.id OR i.buyer_id = c.id)
        ) inv ON TRUE
        WHERE c.lender_id = $1
        ORDER BY c.id
    `;
    const edgesQuery = `
        SELECT
            supplier_id as source,
            buyer_id as target,
            total_volume,
            invoice_count,
            goods_category,
            first_trade_date AS first_seen,
            last_seen,
            GREATEST(0, DATE_PART('day', NOW() - first_trade_date))::INT AS relationship_age_days,
            CASE
                WHEN total_volume >= 500000 THEN TRUE
                ELSE FALSE
            END AS high_volume_flag,
            CASE
                WHEN first_trade_date >= NOW() - INTERVAL '30 days' THEN TRUE
                ELSE FALSE
            END AS new_edge_flag,
            CASE
                WHEN invoice_count >= 8 THEN 'carousel'
                WHEN total_volume >= 500000 THEN 'gap'
                ELSE 'normal'
            END AS edge_type
        FROM trade_relationships 
        WHERE lender_id = $1
    `;

    const nodes = await pool.query(nodesQuery, [lenderId]);
    const edges = await pool.query(edgesQuery, [lenderId]);

    return { nodes: nodes.rows, edges: edges.rows };
};

const getEgoNetwork = async (lenderId, entityId) => {
    const query = `
        SELECT tr.*, s.name as supplier_name, b.name as buyer_name
        FROM trade_relationships tr
        JOIN companies s ON tr.supplier_id = s.id
        JOIN companies b ON tr.buyer_id = b.id
        WHERE tr.lender_id = $1 AND (tr.supplier_id = $2 OR tr.buyer_id = $2)
    `;
    const result = await pool.query(query, [lenderId, entityId]);
    return result.rows;
};

const detectCycles = async (lenderId) => {
    // Carousel trade detection (cycle finding — A→B→C→A within 90 days, same goods category)
    const cycleQuery = `
        WITH RECURSIVE cycle_search AS (
            SELECT supplier_id, buyer_id, goods_category, 
                   ARRAY[supplier_id] as path, 
                   1 as depth
            FROM trade_relationships
            WHERE lender_id = $1 AND last_seen > NOW() - INTERVAL '90 days'
            
            UNION ALL
            
            SELECT tr.supplier_id, tr.buyer_id, tr.goods_category,
                   path || tr.supplier_id,
                   depth + 1
            FROM trade_relationships tr
            JOIN cycle_search cs ON tr.supplier_id = cs.buyer_id
            WHERE tr.lender_id = $1
            AND tr.goods_category = cs.goods_category
            AND tr.supplier_id != ALL(path)
            AND depth < 6
        )
        SELECT DISTINCT path, goods_category
        FROM cycle_search 
        WHERE buyer_id = path[1] AND depth > 1;
    `;
    const result = await pool.query(cycleQuery, [lenderId]);
    return result.rows;
};

const calculateCascadeExposure = async (rootPoId) => {
    // Cross-tier cascade detection via recursive CTE
    // Sums financed amounts across tiers vs root PO value
    const cascadeQuery = `
        WITH RECURSIVE tier_hierarchy AS (
            SELECT id, root_po_id, amount, 1 as tier_level
            FROM purchase_orders
            WHERE id = $1
            
            UNION ALL
            
            SELECT po.id, po.root_po_id, po.amount, th.tier_level + 1
            FROM purchase_orders po
            JOIN tier_hierarchy th ON po.root_po_id = th.id
            WHERE th.tier_level < 10
        )
        SELECT SUM(amount) as total_financed, 
               (SELECT amount FROM purchase_orders WHERE id = $1) as root_amount
        FROM tier_hierarchy;
    `;
    const result = await pool.query(cascadeQuery, [rootPoId]);
    if (result.rows.length === 0) return { totalFinanced: 0, rootAmount: 0, ratio: 0 };

    const { total_financed, root_amount } = result.rows[0];
    const ratio = root_amount > 0 ? (total_financed / root_amount) : 0;

    return {
        totalFinanced: Number(total_financed),
        rootAmount: Number(root_amount),
        ratio: ratio
    };
};

const calculateCentrality = async (lenderId) => {
    const query = `
        WITH partners AS (
            SELECT supplier_id AS company_id, buyer_id AS partner_id FROM trade_relationships WHERE lender_id = $1
            UNION ALL
            SELECT buyer_id AS company_id, supplier_id AS partner_id FROM trade_relationships WHERE lender_id = $1
        ),
        deg AS (
            SELECT company_id, COUNT(DISTINCT partner_id) AS degree
            FROM partners
            GROUP BY company_id
        )
        SELECT d.company_id, c.name AS company_name, d.degree
        FROM deg d
        JOIN companies c ON c.id = d.company_id AND c.lender_id = $1
        ORDER BY d.degree DESC;
    `;
    const result = await pool.query(query, [lenderId]);
    return result.rows;
};

const detectIsolatedNodes = async (lenderId) => {
    // Suppliers with only one buyer
    const query = `
        SELECT supplier_id, COUNT(DISTINCT buyer_id) as buyer_count
        FROM trade_relationships
        WHERE lender_id = $1
        GROUP BY supplier_id
        HAVING COUNT(DISTINCT buyer_id) = 1;
    `;
    const result = await pool.query(query, [lenderId]);
    return result.rows;
};

const calculateContagionScore = async (entityId) => {
    const query = `
        SELECT SUM(total_volume) as total_exposed_volume
        FROM trade_relationships
        WHERE supplier_id = $1 OR buyer_id = $1
    `;
    const result = await pool.query(query, [entityId]);
    return Number(result.rows[0]?.total_exposed_volume || 0);
};

const getCascadeExposureDetails = async (lenderId, rootPoId) => {
    const summary = await calculateCascadeExposure(rootPoId);

    const tiersQuery = `
        WITH RECURSIVE tier_hierarchy AS (
            SELECT id, root_po_id, supplier_id, buyer_id, amount, goods_category, 1 as tier_level
            FROM purchase_orders
            WHERE lender_id = $1 AND id = $2

            UNION ALL

            SELECT po.id, po.root_po_id, po.supplier_id, po.buyer_id, po.amount, po.goods_category, th.tier_level + 1
            FROM purchase_orders po
            JOIN tier_hierarchy th ON po.root_po_id = th.id
            WHERE po.lender_id = $1
              AND th.tier_level < 10
        )
        SELECT th.id, th.root_po_id, th.supplier_id, th.buyer_id, th.amount, th.goods_category, th.tier_level,
               s.name AS supplier_name, b.name AS buyer_name
        FROM tier_hierarchy th
        LEFT JOIN companies s ON s.id = th.supplier_id
        LEFT JOIN companies b ON b.id = th.buyer_id
        ORDER BY th.tier_level, th.id;
    `;
    const tiers = await pool.query(tiersQuery, [lenderId, rootPoId]);

    return {
        ...summary,
        alert: summary.ratio > 1.1,
        tiers: tiers.rows
    };
};

const getContagionImpact = async (lenderId, entityId) => {
    const rootNameResult = await pool.query(
        'SELECT name FROM companies WHERE id = $1 AND lender_id = $2',
        [entityId, lenderId]
    );
    const rootEntityName = rootNameResult.rows[0]?.name || null;

    const neighborsQuery = `
        WITH neighbors AS (
            SELECT buyer_id AS neighbor_id, total_volume
            FROM trade_relationships
            WHERE lender_id = $1 AND supplier_id = $2
            UNION ALL
            SELECT supplier_id AS neighbor_id, total_volume
            FROM trade_relationships
            WHERE lender_id = $1 AND buyer_id = $2
        )
        SELECT
            n.neighbor_id AS id,
            c.name,
            c.tier,
            SUM(n.total_volume) AS exposure
        FROM neighbors n
        JOIN companies c ON c.id = n.neighbor_id
        GROUP BY n.neighbor_id, c.name, c.tier
        ORDER BY exposure DESC;
    `;
    const neighborsResult = await pool.query(neighborsQuery, [lenderId, entityId]);
    const exposedEntities = neighborsResult.rows.map((row) => ({
        id: row.id,
        name: row.name,
        tier: row.tier,
        exposure: Number(row.exposure || 0)
    }));

    const totalExposed = exposedEntities.reduce((sum, item) => sum + item.exposure, 0);
    // Distinct lenders that have financed or received this entity (cross-portfolio exposure signal)
    const lenderCountQuery = `
        SELECT COUNT(DISTINCT lender_id)::int AS lender_count
        FROM invoices
        WHERE supplier_id = $1 OR buyer_id = $1
    `;
    const lenderCountResult = await pool.query(lenderCountQuery, [entityId]);
    const lenderCount = Number(lenderCountResult.rows[0]?.lender_count || 0);

    const contagionRiskScore = Math.min(
        100,
        Math.round((exposedEntities.length * 8) + (lenderCount * 10) + (totalExposed > 0 ? Math.log10(totalExposed + 1) * 8 : 0))
    );

    return {
        rootEntityId: Number(entityId),
        rootEntityName,
        exposedEntityCount: exposedEntities.length,
        lenderCount,
        totalExposedVolume: totalExposed,
        contagionRiskScore,
        exposedEntities
    };
};

module.exports = {
    updateEdgeMetadata,
    getTopology,
    getEgoNetwork,
    detectCycles,
    calculateCascadeExposure,
    calculateCentrality,
    detectIsolatedNodes,
    calculateContagionScore,
    getCascadeExposureDetails,
    getContagionImpact
};
