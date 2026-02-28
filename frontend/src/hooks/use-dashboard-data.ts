import { useQuery } from "@tanstack/react-query";
import {
  MOCK_KPI,
  MOCK_DISCREPANCIES,
  MOCK_ALERTS,
  MOCK_VELOCITY,
  MOCK_NODES,
  MOCK_EDGES
} from "../lib/mockData";

// ============================================================================
// HOOKS (Wired to Mock Data)
// ============================================================================

// Helper to simulate network latency
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

export function useKPI() {
  return useQuery({
    queryKey: ["kpi"],
    queryFn: async () => {
      await delay(400); // simulate latency
      return MOCK_KPI;
    },
  });
}

export function useDiscrepancies() {
  return useQuery({
    queryKey: ["discrepancies"],
    queryFn: async () => {
      await delay(600);
      return MOCK_DISCREPANCIES;
    },
  });
}

export function useAlerts() {
  return useQuery({
    queryKey: ["alerts"],
    queryFn: async () => {
      await delay(500);
      return MOCK_ALERTS;
    },
  });
}

export function useVelocity() {
  return useQuery({
    queryKey: ["velocity"],
    queryFn: async () => {
      await delay(800);
      return MOCK_VELOCITY;
    },
  });
}

export function useNetwork() {
  return useQuery({
    queryKey: ["network-topology"],
    queryFn: async () => {
      await delay(1000); // Give the graph a second to show the cool loading text
      return { nodes: MOCK_NODES, edges: MOCK_EDGES };
    },
  });
}
