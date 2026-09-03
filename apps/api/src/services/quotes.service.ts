import { eq } from 'drizzle-orm';
import { db } from '../db/index.js';
import { clients, mindsetQuotes, type Client, type MindsetQuote } from '../models/schema.js';

export async function listQuotes(): Promise<MindsetQuote[]> {
  return db.select().from(mindsetQuotes);
}

export async function createQuote(quote: string, author: string | null): Promise<MindsetQuote> {
  const [created] = await db.insert(mindsetQuotes).values({ quote, author }).returning();
  return created;
}

export async function updateQuote(
  id: string,
  patch: { quote?: string; author?: string | null; active?: boolean }
): Promise<MindsetQuote | null> {
  const [updated] = await db
    .update(mindsetQuotes)
    .set({ ...patch, updatedAt: new Date() })
    .where(eq(mindsetQuotes.id, id))
    .returning();
  return updated ?? null;
}

export async function deleteQuote(id: string): Promise<void> {
  await db.delete(mindsetQuotes).where(eq(mindsetQuotes.id, id));
}

// Puerto de /api/clients/:id/quote-of-the-day del legacy (server.js:942-955):
// una asignación explícita gana incluso si está inactiva (active solo filtra
// el pool aleatorio de respaldo, no una asignación directa).
export async function getQuoteOfTheDay(clientId: string): Promise<MindsetQuote | null> {
  const rows = await db.select().from(clients).where(eq(clients.id, clientId)).limit(1);
  const assignedId = rows[0]?.assignedQuoteId;
  if (assignedId) {
    const assigned = await db.select().from(mindsetQuotes).where(eq(mindsetQuotes.id, assignedId)).limit(1);
    if (assigned[0]) return assigned[0];
  }
  const pool = await db.select().from(mindsetQuotes).where(eq(mindsetQuotes.active, true));
  if (pool.length === 0) return null;
  return pool[Math.floor(Math.random() * pool.length)];
}

export async function assignQuote(clientId: string, quoteId: string | null): Promise<Client | null> {
  const [client] = await db
    .update(clients)
    .set({ assignedQuoteId: quoteId, updatedAt: new Date() })
    .where(eq(clients.id, clientId))
    .returning();
  return client ?? null;
}
