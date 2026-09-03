import { getSessionToken } from './api-client';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:3003';

async function authorizedRequest<T>(path: string, method: string, body?: unknown): Promise<T> {
  const token = getSessionToken();
  const res = await fetch(`${API_BASE_URL}${path}`, {
    method,
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: body != null ? JSON.stringify(body) : undefined,
  });
  return res.json();
}

export type MindsetQuote = {
  id: string;
  quote: string;
  author: string | null;
  active: boolean;
};

export async function listQuotes(): Promise<MindsetQuote[]> {
  const body = await authorizedRequest<{ success: boolean; quotes: MindsetQuote[]; error?: string }>('/api/admin/quotes', 'GET');
  if (!body.success) throw new Error(body.error || 'Error al obtener las frases.');
  return body.quotes;
}

export async function createQuote(quote: string, author: string | null): Promise<MindsetQuote> {
  const body = await authorizedRequest<{ success: boolean; quote: MindsetQuote; error?: string }>('/api/admin/quotes', 'POST', {
    quote,
    author,
  });
  if (!body.success) throw new Error(body.error || 'Error al crear la frase.');
  return body.quote;
}

export async function updateQuote(
  id: string,
  patch: { quote?: string; author?: string | null; active?: boolean }
): Promise<MindsetQuote> {
  const body = await authorizedRequest<{ success: boolean; quote: MindsetQuote; error?: string }>(
    `/api/admin/quotes/${id}`,
    'PATCH',
    patch
  );
  if (!body.success) throw new Error(body.error || 'Error al actualizar la frase.');
  return body.quote;
}

export async function deleteQuote(id: string): Promise<void> {
  const body = await authorizedRequest<{ success: boolean; error?: string }>(`/api/admin/quotes/${id}`, 'DELETE');
  if (!body.success) throw new Error(body.error || 'Error al eliminar la frase.');
}

export async function getQuoteOfTheDay(clientId: string): Promise<MindsetQuote | null> {
  const body = await authorizedRequest<{ success: boolean; quote: MindsetQuote | null; error?: string }>(
    `/api/clients/${clientId}/quote-of-the-day`,
    'GET'
  );
  if (!body.success) throw new Error(body.error || 'Error al obtener la frase del día.');
  return body.quote;
}

export async function assignQuote(clientId: string, quoteId: string | null): Promise<void> {
  const body = await authorizedRequest<{ success: boolean; error?: string }>(`/api/clients/${clientId}/assigned-quote`, 'PATCH', {
    quote_id: quoteId,
  });
  if (!body.success) throw new Error(body.error || 'Error al asignar la frase.');
}

export async function getClientAssignedQuoteId(clientId: string): Promise<string | null> {
  const body = await authorizedRequest<{ success: boolean; client: { assignedQuoteId: string | null }; error?: string }>(
    `/api/clients/${clientId}`,
    'GET'
  );
  if (!body.success) throw new Error(body.error || 'Error al obtener el cliente.');
  return body.client.assignedQuoteId;
}
