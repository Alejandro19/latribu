import { getSessionToken } from './api-client';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:3003';

export type WellnessIndexResult = {
  value: number;
  previousValue: number | null;
  delta: number | null;
  trend: 'up' | 'down' | 'stable' | 'none';
  componentsUsed: Record<string, number>;
};

// GET /api/clients/:id/wellness-index — índice unificado (home + Mi
// Evolución). `null` cuando no hay datos suficientes todavía — la card
// simplemente no se muestra.
export async function getWellnessIndex(clientId: string): Promise<WellnessIndexResult | null> {
  const token = getSessionToken();
  const res = await fetch(`${API_BASE_URL}/api/clients/${clientId}/wellness-index`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) return null;
  const body = await res.json();
  return body.data ?? null;
}
