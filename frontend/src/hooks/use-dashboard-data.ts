import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

const API_BASE = 'http://localhost:3000/api';

const getHeaders = () => ({
  'Content-Type': 'application/json',
  'x-lender-id': localStorage.getItem('sherlock-lender-id') || '1'
});

export function useKPI() {
  const lenderId = localStorage.getItem('sherlock-lender-id') || '4';
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
  const lenderId = localStorage.getItem('sherlock-lender-id') || '4';
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
  const lenderId = localStorage.getItem('sherlock-lender-id') || '4';
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
  const lenderId = localStorage.getItem('sherlock-lender-id') || '4';
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
  const lenderId = localStorage.getItem('sherlock-lender-id') || '4';
  return useQuery({
    queryKey: ["network-topology", lenderId],
    queryFn: async () => {
      // Fetch real topology
      const res = await fetch(`${API_BASE}/graph/topology`, { headers: getHeaders() });
      if (!res.ok) throw new Error('Failed to fetch topology');
      const topology = await res.json();

      const normalizeTier = (tier: any) => {
        if (typeof tier === "string") return tier;
        if (typeof tier === "number") return `T${tier}`;
        return "T1";
      };

      const mappedNodes = topology.nodes.map((n: any) => {
        const avg = Number(n.avg_risk_score || 0);
        const maxR = Number(n.max_risk_score || 0);
        const status = n.current_status || "UNKNOWN";
        return {
          tier: normalizeTier(n.tier),
          riskScore: maxR > 0 ? maxR : avg,
          avgRiskScore: avg,
          maxRiskScore: maxR,
          id: n.id,
          label: n.name,
          totalVolume: Number(n.total_volume || 0),
          activeInvoices: Number(n.active_invoices || 0),
          status,
          hasTradeEdge: Boolean(n.has_trade_edge),
          hasBlockedInvoice: Boolean(n.has_blocked_invoice),
          hasReviewInvoice: Boolean(n.has_review_invoice),
          latestInvoiceStatus: n.latest_invoice_status ?? null,
          isFlagged: status === "BLOCKED" || status === "REVIEW",
        };
      });

      const mappedEdges = topology.edges.map((e: any, idx: number) => ({
        id: idx + 1,
        source: e.source,
        target: e.target,
        type: e.edge_type || "normal",
        label: `$${e.total_volume}`,
        totalVolume: Number(e.total_volume || 0),
        invoiceCount: Number(e.invoice_count || 0),
        goodsCategory: e.goods_category || null,
        firstSeen: e.first_seen || null,
        lastSeen: e.last_seen || null,
        relationshipAgeDays: Number(e.relationship_age_days || 0),
        highVolumeFlag: Boolean(e.high_volume_flag),
        newEdgeFlag: Boolean(e.new_edge_flag)
      }));

      return { nodes: mappedNodes, edges: mappedEdges };
    },
    refetchInterval: 10000
  });
}

export function useCascadeExposure(rootPoId: string | number | null) {
  const lenderId = localStorage.getItem('sherlock-lender-id') || '4';
  return useQuery({
    queryKey: ["cascade-exposure", lenderId, rootPoId],
    queryFn: async () => {
      if (!rootPoId) return null;
      const res = await fetch(`${API_BASE}/graph/cascade/${rootPoId}`, { headers: getHeaders() });
      if (!res.ok) throw new Error('Failed to fetch cascade exposure');
      return await res.json();
    },
    enabled: !!rootPoId,
    refetchInterval: 10000
  });
}

export function useContagionImpact(entityId: string | number | null) {
  const lenderId = localStorage.getItem('sherlock-lender-id') || '4';
  return useQuery({
    queryKey: ["contagion-impact", lenderId, entityId],
    queryFn: async () => {
      if (!entityId) return null;
      const res = await fetch(`${API_BASE}/graph/contagion/${entityId}`, { headers: getHeaders() });
      if (!res.ok) throw new Error('Failed to fetch contagion impact');
      return await res.json();
    },
    enabled: !!entityId,
    refetchInterval: 10000
  });
}

export function useEntityAlerts(entityId: string | number | null) {
  const lenderId = localStorage.getItem('sherlock-lender-id') || '4';
  return useQuery({
    queryKey: ['alerts-entity', lenderId, entityId],
    queryFn: async () => {
      if (!entityId) return [];
      const res = await fetch(`${API_BASE}/alerts?entityId=${encodeURIComponent(String(entityId))}`, { headers: getHeaders() });
      if (!res.ok) throw new Error('Failed to fetch entity alerts');
      return await res.json();
    },
    enabled: !!entityId,
  });
}

export function useCompanies() {
  const lenderId = localStorage.getItem('sherlock-lender-id') || '4';
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
  const lenderId = localStorage.getItem('sherlock-lender-id') || '4';
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
  const lenderId = localStorage.getItem('sherlock-lender-id') || '4';
  return useQuery({
    queryKey: ["invoice-detail", id, lenderId],
    queryFn: async () => {
      if (!id) return null;
      const res = await fetch(`${API_BASE}/invoices/${id}`, { headers: getHeaders() });
      if (!res.ok) {
        let errorMsg = 'Failed to fetch invoice details';
        try {
          const errData = await res.json();
          if (errData.error) errorMsg = errData.error;
        } catch (e) {
          // Fall back to generic message
        }
        throw new Error(errorMsg);
      }
      return await res.json();
    },
    enabled: !!id,
  });
}

export function useInvoiceQueue() {
  const lenderId = localStorage.getItem('sherlock-lender-id') || '4';
  return useQuery({
    queryKey: ["invoice-queue", lenderId],
    queryFn: async () => {
      const res = await fetch(`${API_BASE}/lender/${lenderId}/portfolio`, { headers: getHeaders() });
      if (!res.ok) throw new Error('Failed to fetch portfolio');
      const invoices = await res.json();

      return invoices.map((inv: any) => ({
        dbId: inv.id,
        id: inv.invoice_number,
        supplier: inv.supplier_name || `Supplier ID: ${inv.supplier_id ?? "?"}`,
        amount: parseFloat(inv.amount),
        date: inv.invoice_date,
        status: inv.status,
        riskScore: inv.risk_score ?? 0
      }));
    },
    refetchInterval: 5000
  });
}

export function useInvoiceAudits(id: string | null) {
  const lenderId = localStorage.getItem('sherlock-lender-id') || '4';
  return useQuery({
    queryKey: ["invoice-audits", id, lenderId],
    queryFn: async () => {
      if (!id) return null;
      const res = await fetch(`${API_BASE}/invoices/${id}/audits`, { headers: getHeaders() });
      if (!res.ok) throw new Error('Failed to fetch audits');
      return await res.json();
    },
    enabled: !!id,
  });
}

export function useReEvaluateInvoice() {
  const queryClient = useQueryClient();
  const lenderId = localStorage.getItem('sherlock-lender-id') || '4';
  return useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`${API_BASE}/invoices/${id}/re-evaluate`, {
        method: 'POST',
        headers: getHeaders(),
      });
      if (!res.ok) throw new Error('Failed to re-evaluate');
      return await res.json();
    },
    onSuccess: (_, id) => {
      // Precise invalidation so the currently open invoice drawer refetches immediately.
      queryClient.invalidateQueries({ queryKey: ["invoice-detail", id, lenderId] });
      queryClient.invalidateQueries({ queryKey: ["invoice-audits", id, lenderId] });
      queryClient.invalidateQueries({ queryKey: ["invoice-queue", lenderId] });
      queryClient.invalidateQueries({ queryKey: ["kpi", lenderId] });
    },
    onError: (err) => {
      // Keep it simple: UI component will also read from console.
      console.error('Re-evaluate invoice failed:', err);
    }
  });
}

export function usePos() {
  const lenderId = localStorage.getItem('sherlock-lender-id') || '4';
  return useQuery({
    queryKey: ["pos", lenderId],
    queryFn: async () => {
      // We will add a new endpoint for this or use an existing one if available
      const res = await fetch(`${API_BASE}/identity/pos`, { headers: getHeaders() });
      if (!res.ok) return [];
      return await res.json();
    },
  });
}

export function useGrns() {
  const lenderId = localStorage.getItem('sherlock-lender-id') || '4';
  return useQuery({
    queryKey: ["grns", lenderId],
    queryFn: async () => {
      const res = await fetch(`${API_BASE}/identity/grns`, { headers: getHeaders() });
      if (!res.ok) return [];
      return await res.json();
    },
  });
}

export function useSubmitInvoice() {
  const queryClient = useQueryClient();
  const lenderId = localStorage.getItem('sherlock-lender-id') || '4';
  return useMutation({
    mutationFn: async (invoice: any) => {
      const res = await fetch(`${API_BASE}/invoices`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify(invoice),
      });
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.error || 'Failed to submit invoice');
      }
      return await res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["invoice-queue", lenderId] });
      queryClient.invalidateQueries({ queryKey: ["kpi", lenderId] });
      queryClient.invalidateQueries({ queryKey: ["alerts", lenderId] });
    },
  });
}

export function useScenarios() {
  const lenderId = localStorage.getItem('sherlock-lender-id') || '4';
  return useQuery({
    queryKey: ["scenarios", lenderId],
    queryFn: async () => {
      const res = await fetch(`${API_BASE}/scenarios`, { headers: getHeaders() });
      if (!res.ok) throw new Error('Failed to fetch scenarios');
      return await res.json();
    },
  });
}

export function useManualOverrideInvoice() {
  const queryClient = useQueryClient();
  const lenderId = localStorage.getItem('sherlock-lender-id') || '4';

  return useMutation({
    mutationFn: async ({ id, reason }: { id: string; reason: string }) => {
      const res = await fetch(`${API_BASE}/invoices/${id}/override`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({ reason, auditorId: 'dashboard_simulator' }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Failed to override invoice');
      }
      return await res.json();
    },
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: ["invoice-detail", vars.id, lenderId] });
      queryClient.invalidateQueries({ queryKey: ["invoice-queue", lenderId] });
      queryClient.invalidateQueries({ queryKey: ["kpi", lenderId] });
      queryClient.invalidateQueries({ queryKey: ["alerts", lenderId] });
    },
  });
}
