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
        SELECT id, name, tier, 'company' as type FROM companies WHERE lender_id = $1
    `;
    const edgesQuery = `
        SELECT supplier_id as source, buyer_id as target, total_volume, invoice_count, goods_category 
        FROM trade_relationships 
        WHERE lender_id = $1
    `;

    const nodes = await pool.query(nodesQuery, [lenderId]);
    const edges = await pool.query(edgesQuery, [lenderId]);

    return { nodes: nodes.rows, edges: edges.rows };
};

const getEgoNetwork = async (entityId) => {
    const query = `
        SELECT tr.*, s.name as supplier_name, b.name as buyer_name
        FROM trade_relationships tr
        JOIN companies s ON tr.supplier_id = s.id
        JOIN companies b ON tr.buyer_id = b.id
        WHERE tr.supplier_id = $1 OR tr.buyer_id = $1
    `;
    const result = await pool.query(query, [entityId]);
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
        SELECT company_id, COUNT(DISTINCT partner_id) as degree
        FROM (
            SELECT supplier_id as company_id, buyer_id as partner_id FROM trade_relationships WHERE lender_id = $1
            UNION ALL
            SELECT buyer_id as company_id, supplier_id as partner_id FROM trade_relationships WHERE lender_id = $1
        ) partners
        GROUP BY company_id;
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

module.exports = {
    updateEdgeMetadata,
    getTopology,
    getEgoNetwork,
    detectCycles,
    calculateCascadeExposure,
    calculateCentrality,
    detectIsolatedNodes
};
