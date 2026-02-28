export const MOCK_KPI = {
    id: 1,
    activeInvoices: 240,
    activeInvoicesChange: 5.5,
    healthScore: 81.2,
    tier3Risk: 87,
    highRiskGaps: 12,
    highRiskGapsChange: 11.2,
    totalExposure: 42500000,
    blockedToday: 14,
    alertsCount: 32,
};

export const MOCK_DISCREPANCIES = [
    { id: 1, companyName: "TechCorp Global", invoiceValue: 150000, poValue: 150000, grnValue: 150000, matchStatus: true },
    { id: 2, companyName: "Nexus Supply", invoiceValue: 85000, poValue: 80000, grnValue: 80000, matchStatus: false },
    { id: 3, companyName: "Omega Logistics", invoiceValue: 210000, poValue: 210000, grnValue: 195000, matchStatus: false },
    { id: 4, companyName: "Aero Industries", invoiceValue: 45000, poValue: 45000, grnValue: 45000, matchStatus: true },
];

export const MOCK_ALERTS = [
    { id: 1, fingerprint: "INV-992-A8X", priority: "critical", amount: 125000, date: new Date().toISOString() },
    { id: 2, fingerprint: "INV-104-B2Y", priority: "high", amount: 84000, date: new Date(Date.now() - 3600000).toISOString() },
    { id: 3, fingerprint: "INV-445-C9Z", priority: "medium", amount: 12000, date: new Date(Date.now() - 7200000).toISOString() },
];

// 14 days of velocity data simulating a spike
export const MOCK_VELOCITY = Array.from({ length: 14 }).map((_, i) => ({
    id: i,
    timestamp: new Date(Date.now() - (13 - i) * 86400000).toISOString(),
    tier1Velocity: 50 + Math.random() * 10,
    tier2Velocity: 35 + Math.random() * 8,
    tier3Velocity: i >= 5 && i <= 8 ? 85 + Math.random() * 5 : 15 + Math.random() * 5, // T3 Spike between day 5 and 8
}));

// Dictionary of different topology scenarios
export const MOCK_TOPOLOGIES: Record<string, { name: string, nodes: any[], edges: any[] }> = {
    "anchor-corp": {
        name: "Anchor Corp",
        nodes: [
            { id: 1, label: "Anchor Corp (T1)", tier: "T1", riskScore: 5, isFlagged: false },
            { id: 2, label: "Supplier Alpha (T2)", tier: "T2", riskScore: 12, isFlagged: false },
            { id: 3, label: "Supplier Beta (T2)", tier: "T2", riskScore: 8, isFlagged: false },
            { id: 4, label: "Sub-supplier X (T3)", tier: "T3", riskScore: 45, isFlagged: false },
            { id: 5, label: "Sub-supplier Y (T3)", tier: "T3", riskScore: 88, isFlagged: true },
            { id: 6, label: "Sub-supplier Z (T3)", tier: "T3", riskScore: 92, isFlagged: true },
        ],
        edges: [
            { id: 1, source: 1, target: 2, type: "normal" },
            { id: 2, source: 1, target: 3, type: "normal" },
            { id: 3, source: 2, target: 4, type: "normal" },
            { id: 4, source: 3, target: 5, type: "gap" }, // Verification gap
            { id: 5, source: 3, target: 6, type: "carousel" }, // Suspicious loop start
            { id: 6, source: 6, target: 4, type: "carousel" }, // Suspicious loop linking back
        ]
    },
    "global-tech": {
        name: "Global Tech Inc",
        nodes: [
            { id: 101, label: "Global Tech Inc (T1)", tier: "T1", riskScore: 2, isFlagged: false },
            { id: 102, label: "Hardware Div (T2)", tier: "T2", riskScore: 5, isFlagged: false },
            { id: 103, label: "Software Solutions (T2)", tier: "T2", riskScore: 18, isFlagged: false },
            { id: 104, label: "Cloud Infra (T2)", tier: "T2", riskScore: 10, isFlagged: false },
            { id: 105, label: "Data Center Auth (T3)", tier: "T3", riskScore: 95, isFlagged: true }, // The anomaly
        ],
        edges: [
            { id: 101, source: 101, target: 102, type: "normal" },
            { id: 102, source: 101, target: 103, type: "normal" },
            { id: 103, source: 101, target: 104, type: "normal" },
            { id: 104, source: 104, target: 105, type: "gap" }, // Missing compliance doc
        ]
    },
    "omega-logistics": {
        name: "Omega Logistics Group",
        nodes: [
            { id: 201, label: "Omega Logistics (T1)", tier: "T1", riskScore: 8, isFlagged: false },
            { id: 202, label: "Freight Forwarder A (T2)", tier: "T2", riskScore: 40, isFlagged: false },
            { id: 203, label: "Port Authority (T2)", tier: "T2", riskScore: 2, isFlagged: false },
            { id: 204, label: "Shell Transport (T3)", tier: "T3", riskScore: 99, isFlagged: true }, // Phantom entity
            { id: 205, label: "Shell Transport B (T3)", tier: "T3", riskScore: 98, isFlagged: true }, // Phantom entity
            { id: 206, label: "Shell Transport C (T3)", tier: "T3", riskScore: 99, isFlagged: true }, // Phantom entity
        ],
        edges: [
            { id: 201, source: 201, target: 202, type: "normal" },
            { id: 202, source: 201, target: 203, type: "normal" },
            { id: 203, source: 202, target: 204, type: "carousel" },
            { id: 204, source: 202, target: 205, type: "carousel" },
            { id: 205, source: 202, target: 206, type: "carousel" },
        ]
    }
};

// Map backward compatibility for hooks
export const MOCK_NODES = MOCK_TOPOLOGIES["anchor-corp"].nodes;
export const MOCK_EDGES = MOCK_TOPOLOGIES["anchor-corp"].edges;

export const MOCK_INVOICE_QUEUE = [
    { id: "INV-2900", supplier: "TechCorp Global", amount: 1250000, date: "2023-11-20", status: "PENDING", riskScore: 28 },
    { id: "INV-2901", supplier: "Nexus Supply", amount: 85000, date: "2023-11-20", status: "APPROVED", riskScore: 12 },
    { id: "INV-2902", supplier: "Omega Logistics", amount: 210000, date: "2023-11-21", status: "BLOCKED", riskScore: 88 },
    { id: "INV-2903", supplier: "Aero Industries", amount: 45000, date: "2023-11-21", status: "UNDER REVIEW", riskScore: 45 },
    { id: "INV-2904", supplier: "Global Tech Inc", amount: 300000, date: "2023-11-22", status: "PENDING", riskScore: 35 },
];
