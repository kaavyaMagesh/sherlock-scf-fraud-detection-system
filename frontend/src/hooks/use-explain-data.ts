import { useQuery } from "@tanstack/react-query";

const API_BASE = 'http://localhost:3000/api';

const getHeaders = (lenderId: string) => ({
  'Content-Type': 'application/json',
  'x-lender-id': lenderId,
  'Authorization': `Bearer ${localStorage.getItem('token')}`
});

export function useExplainData(invoiceId: string | number | null) {
  const lenderId = localStorage.getItem('sherlock-lender-id') || '1';

  return useQuery({
    queryKey: ["explain-data", invoiceId, lenderId],
    queryFn: async () => {
      if (!invoiceId) return null;
      const res = await fetch(`${API_BASE}/explain/${invoiceId}`, { headers: getHeaders(lenderId) });
      if (!res.ok) {
        let errorMsg = 'Failed to fetch explain data';
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
    enabled: !!invoiceId,
  });
}
