import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

const API_BASE = 'http://localhost:3000/api';

const getHeaders = () => ({
  'Content-Type': 'application/json',
  'x-lender-id': localStorage.getItem('sherlock-lender-id') || '1'
});

export function useKPI() {
  const lenderId = localStorage.getItem('sherlock-lender-id') || '1';
  return useQuery({
    queryKey: ["kpi", lenderId],
    queryFn: async () => {
      const res = await fetch(`${API_BASE}/kpi`, { headers: getHeaders() });
      if (!res.ok) throw new Error('Failed to fetch KPI');
      return await res.json();
    },
    refetchInterval: 5000
  });
}

export function useDiscrepancies() {
  const lenderId = localStorage.getItem('sherlock-lender-id') || '1';
  return useQuery({
    queryKey: ["discrepancies", lenderId],
    queryFn: async () => {
      const res = await fetch(`${API_BASE}/discrepancies`, { headers: getHeaders() });
      if (!res.ok) throw new Error('Failed to fetch discrepancies');
      return await res.json();
    },
    refetchInterval: 10000
  });
}

export function useAlerts() {
  const lenderId = localStorage.getItem('sherlock-lender-id') || '1';
  return useQuery({
    queryKey: ["alerts", lenderId],
    queryFn: async () => {
      const res = await fetch(`${API_BASE}/alerts`, { headers: getHeaders() });
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
  const lenderId = localStorage.getItem('sherlock-lender-id') || '1';
  return useQuery({
    queryKey: ["velocity", lenderId],
    queryFn: async () => {
      const res = await fetch(`${API_BASE}/velocity`, { headers: getHeaders() });
      if (!res.ok) throw new Error('Failed to fetch velocity');
      return await res.json();
    },
  });
}

export function useNetwork() {
  const lenderId = localStorage.getItem('sherlock-lender-id') || '1';
  return useQuery({
    queryKey: ["network-topology", lenderId],
    queryFn: async () => {
      // 1. Check for retail overrides first
      const localData = localStorage.getItem("sherlock-retail-topology");
      if (localData) {
        return JSON.parse(localData);
      }

      // 2. Fetch real topology
      const res = await fetch(`${API_BASE}/graph/topology`, { headers: getHeaders() });
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

export function useCompanies() {
  const lenderId = localStorage.getItem('sherlock-lender-id') || '1';
  const { data, isLoading: isLoadingCompanies, error: companiesError, refetch: refetchCompanies } = useQuery({
    queryKey: ["companies", lenderId],
    queryFn: async () => {
      const res = await fetch(`${API_BASE}/identity/companies`, { headers: getHeaders() });
      if (!res.ok) throw new Error('Failed to fetch companies');
      return await res.json();
    },
  });

  return { companies: data, isLoadingCompanies, companiesError, refetchCompanies };
}

export function useCreateCompany() {
  const queryClient = useQueryClient();
  const lenderId = localStorage.getItem('sherlock-lender-id') || '1';
  return useMutation({
    mutationFn: async (company: { name: string; tier?: number }) => {
      const res = await fetch(`${API_BASE}/identity/companies`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify(company),
      });
      if (!res.ok) throw new Error('Failed to create company');
      return await res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["companies", lenderId] });
    },
  });
}

export function useInvoiceDetail(id: string | null) {
  const lenderId = localStorage.getItem('sherlock-lender-id') || '1';
  return useQuery({
    queryKey: ["invoice-detail", id, lenderId],
    queryFn: async () => {
      if (!id) return null;
      const res = await fetch(`${API_BASE}/invoices/${id}`, { headers: getHeaders() });
      if (!res.ok) throw new Error('Failed to fetch invoice details');
      return await res.json();
    },
    enabled: !!id,
  });
}

export function useInvoiceQueue() {
  const lenderId = localStorage.getItem('sherlock-lender-id') || '1';
  return useQuery({
    queryKey: ["invoice-queue", lenderId],
    queryFn: async () => {
      const res = await fetch(`${API_BASE}/lender/${lenderId}/portfolio`, { headers: getHeaders() });
      if (!res.ok) throw new Error('Failed to fetch portfolio');
      const invoices = await res.json();

      return invoices.map((inv: any) => ({
        dbId: inv.id,
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
