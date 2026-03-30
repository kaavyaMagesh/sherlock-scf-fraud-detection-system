import { useQuery } from "@tanstack/react-query";

const API_BASE = 'http://localhost:3000/api';
const HEADERS = {
  'Content-Type': 'application/json',
  'x-lender-id': '1'
};

export function useKPI() {
  return useQuery({
    queryKey: ["kpi"],
    queryFn: async () => {
      const res = await fetch(`${API_BASE}/kpi`, { headers: HEADERS });
      if (!res.ok) throw new Error('Failed to fetch KPI');
      return await res.json();
    },
    refetchInterval: 5000
  });
}

export function useDiscrepancies() {
  return useQuery({
    queryKey: ["discrepancies"],
    queryFn: async () => {
      const res = await fetch(`${API_BASE}/discrepancies`, { headers: HEADERS });
      if (!res.ok) throw new Error('Failed to fetch discrepancies');
      return await res.json();
    },
    refetchInterval: 10000
  });
}

export function useAlerts() {
  return useQuery({
    queryKey: ["alerts"],
    queryFn: async () => {
      const res = await fetch(`${API_BASE}/alerts`, { headers: HEADERS });
      if (!res.ok) throw new Error('Failed to fetch alerts');
      const data = await res.json();
      return data.map((alert: any) => ({
        id: alert.id,
        fingerprint: alert.invoice_number || `INV-${alert.invoice_id}`,
        priority: alert.severity ? alert.severity.toLowerCase() : 'high',
        amount: 0,
        date: alert.created_at
      }));
    },
    refetchInterval: 5000
  });
}

export function useVelocity() {
  return useQuery({
    queryKey: ["velocity"],
    queryFn: async () => {
      const res = await fetch(`${API_BASE}/velocity`, { headers: HEADERS });
      if (!res.ok) throw new Error('Failed to fetch velocity');
      return await res.json();
    },
  });
}

export function useNetwork() {
  return useQuery({
    queryKey: ["network-topology"],
    queryFn: async () => {
      // 1. Check for retail overrides first
      const localData = localStorage.getItem("sherlock-retail-topology");
      if (localData) {
        return JSON.parse(localData);
      }

      // 2. Fetch real topology
      const res = await fetch(`${API_BASE}/graph/topology`, { headers: HEADERS });
      if (!res.ok) throw new Error('Failed to fetch topology');
      const topology = await res.json();

      const mappedNodes = topology.nodes.map((n: any) => ({
        id: n.id,
        label: `${n.name}\n(${n.tier || 'T1'})`,
        tier: n.tier || 'T1',
        riskScore: n.tier === 'T3' ? 85 : 20,
        isFlagged: n.tier === 'T3'
      }));

      const mappedEdges = topology.edges.map((e: any, idx: number) => ({
        id: idx + 1,
        source: e.source,
        target: e.target,
        type: "normal",
        label: `$${e.total_volume}`
      }));

      return { nodes: mappedNodes, edges: mappedEdges };
    },
    refetchInterval: 10000
  });
}

export function useInvoiceQueue() {
  return useQuery({
    queryKey: ["invoice-queue"],
    queryFn: async () => {
      const res = await fetch(`${API_BASE}/lender/1/portfolio`, { headers: HEADERS });
      if (!res.ok) throw new Error('Failed to fetch portfolio');
      const invoices = await res.json();

      return invoices.map((inv: any) => ({
        id: inv.invoice_number,
        supplier: "Supplier ID: " + (inv.supplier_id || '?'),
        amount: parseFloat(inv.amount),
        date: inv.invoice_date,
        status: inv.status,
        riskScore: inv.risk_score || 0
      }));
    },
    refetchInterval: 5000
  });
}
