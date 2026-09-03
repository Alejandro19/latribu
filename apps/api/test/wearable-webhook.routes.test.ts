import { describe, it, expect, beforeAll, afterAll, afterEach, vi } from 'vitest';
import crypto from 'crypto';
import request from 'supertest';
import { eq } from 'drizzle-orm';

vi.mock('../src/services/whoop.service.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../src/services/whoop.service.js')>();
  return { ...actual, sincronizarWhoop: vi.fn().mockResolvedValue({ sincronizados: 3 }) };
});

const { createApp } = await import('../src/app.js');
const { db } = await import('../src/db/index.js');
const { clients, wearableTokens } = await import('../src/models/schema.js');
const whoopService = await import('../src/services/whoop.service.js');

const CLIENT_SECRET = 'test-whoop-client-secret';

// Esquema real de WHOOP (developer.whoop.com/docs/developing/webhooks/):
// base64(HMAC-SHA256(timestamp + body crudo, client_secret)).
function sign(timestamp: string, body: string): string {
  return crypto.createHmac('sha256', CLIENT_SECRET).update(timestamp + body).digest('base64');
}

describe('POST /api/webhooks/wearable/whoop', () => {
  const app = createApp();
  let clientId: string;

  beforeAll(async () => {
    const [client] = await db
      .insert(clients)
      .values({ name: 'Webhook Client', email: `webhook-whoop-${Date.now()}@example.com`, status: 'active', clientType: 'mentoring' })
      .returning();
    clientId = client.id;
    await db.insert(wearableTokens).values({ clientId, dispositivo: 'whoop', accessToken: 'fake', whoopUserId: '12345' });
  });

  afterAll(async () => {
    await db.delete(clients).where(eq(clients.id, clientId));
  });

  afterEach(() => {
    delete process.env.WHOOP_CLIENT_SECRET;
    vi.mocked(whoopService.sincronizarWhoop).mockClear();
  });

  it('returns 503 when WHOOP_CLIENT_SECRET is not configured', async () => {
    delete process.env.WHOOP_CLIENT_SECRET;
    const res = await request(app).post('/api/webhooks/wearable/whoop').send({ user_id: '12345' });
    expect(res.status).toBe(503);
  });

  it('rejects a request with an invalid signature', async () => {
    process.env.WHOOP_CLIENT_SECRET = CLIENT_SECRET;
    const body = JSON.stringify({ user_id: '12345' });
    const res = await request(app)
      .post('/api/webhooks/wearable/whoop')
      .set('Content-Type', 'application/json')
      .set('X-WHOOP-Signature-Timestamp', '1234567890')
      .set('X-WHOOP-Signature', 'not-a-valid-signature')
      .send(body);
    expect(res.status).toBe(401);
    expect(whoopService.sincronizarWhoop).not.toHaveBeenCalled();
  });

  it('triggers a re-sync for the client mapped to the provider user id, with a valid signature', async () => {
    process.env.WHOOP_CLIENT_SECRET = CLIENT_SECRET;
    const timestamp = '1234567890';
    const body = JSON.stringify({ user_id: '12345' });
    const res = await request(app)
      .post('/api/webhooks/wearable/whoop')
      .set('Content-Type', 'application/json')
      .set('X-WHOOP-Signature-Timestamp', timestamp)
      .set('X-WHOOP-Signature', sign(timestamp, body))
      .send(body);
    expect(res.status).toBe(200);
    expect(whoopService.sincronizarWhoop).toHaveBeenCalledWith(clientId);
  });

  it('debounces a second webhook within 60s of the last sync — never re-syncs twice in a row', async () => {
    process.env.WHOOP_CLIENT_SECRET = CLIENT_SECRET;
    await db.update(wearableTokens).set({ lastSyncAt: new Date() }).where(eq(wearableTokens.clientId, clientId));

    const timestamp = '1234567890';
    const body = JSON.stringify({ user_id: '12345' });
    const res = await request(app)
      .post('/api/webhooks/wearable/whoop')
      .set('Content-Type', 'application/json')
      .set('X-WHOOP-Signature-Timestamp', timestamp)
      .set('X-WHOOP-Signature', sign(timestamp, body))
      .send(body);
    expect(res.status).toBe(200);
    expect(whoopService.sincronizarWhoop).not.toHaveBeenCalled();
  });

  it('acks silently when the provider user id has no mapped client', async () => {
    process.env.WHOOP_CLIENT_SECRET = CLIENT_SECRET;
    const timestamp = '1234567890';
    const body = JSON.stringify({ user_id: 'unknown-user-999' });
    const res = await request(app)
      .post('/api/webhooks/wearable/whoop')
      .set('Content-Type', 'application/json')
      .set('X-WHOOP-Signature-Timestamp', timestamp)
      .set('X-WHOOP-Signature', sign(timestamp, body))
      .send(body);
    expect(res.status).toBe(200);
    expect(whoopService.sincronizarWhoop).not.toHaveBeenCalled();
  });
});
