import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import request from 'supertest';
import { eq } from 'drizzle-orm';
import { createApp } from '../src/app.js';
import { db } from '../src/db/index.js';
import { clients, trainingCompletions, trainingProtectorUses, phrases, achievementLogs, mindsetQuotes } from '../src/models/schema.js';
import { signToken } from '../src/services/auth.service.js';

describe('training routes', () => {
  const app = createApp();
  let adminToken: string;
  let clientId: string;
  let clientToken: string;

  beforeAll(async () => {
    adminToken = signToken({ id: 'admin-1', role: 'admin', name: 'Admin', email: 'admin@example.com' });
    const [client] = await db
      .insert(clients)
      .values({
        name: 'Training Client',
        email: `training-${Date.now()}@example.com`,
        passwordHash: 'x',
        clientType: 'coaching_1_1',
        permissions: { training: true },
      })
      .returning();
    clientId = client.id;
    clientToken = signToken({ id: clientId, role: 'cliente', name: client.name, email: client.email });
  });

  afterAll(async () => {
    await db.delete(trainingCompletions).where(eq(trainingCompletions.clientId, clientId));
    await db.delete(trainingProtectorUses).where(eq(trainingProtectorUses.clientId, clientId));
    await db.delete(clients).where(eq(clients.id, clientId));
  });

  it('rejects an invalid training_days value', async () => {
    const res = await request(app)
      .patch(`/api/clients/${clientId}/training-days`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ training_days: 9 });
    expect(res.status).toBe(400);
  });

  it('sets training_days as admin', async () => {
    const res = await request(app)
      .patch(`/api/clients/${clientId}/training-days`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ training_days: 3 });
    expect(res.status).toBe(200);
    expect(res.body.client.trainingDays).toBe(3);
  });

  it('rejects a client setting their own training_days', async () => {
    const res = await request(app)
      .patch(`/api/clients/${clientId}/training-days`)
      .set('Authorization', `Bearer ${clientToken}`)
      .send({ training_days: 5 });
    expect(res.status).toBe(403);
  });

  it('fails confirm-session when the client has no training_days', async () => {
    const [noDaysClient] = await db
      .insert(clients)
      .values({
        name: 'No Days Client',
        email: `nodays-${Date.now()}@example.com`,
        passwordHash: 'x',
        clientType: 'coaching_1_1',
        permissions: { training: true },
      })
      .returning();
    const noDaysToken = signToken({ id: noDaysClient.id, role: 'cliente', name: noDaysClient.name, email: noDaysClient.email });
    const res = await request(app)
      .post(`/api/clients/${noDaysClient.id}/training/confirm-session`)
      .set('Authorization', `Bearer ${noDaysToken}`)
      .send({ tz: 'America/Mexico_City' });
    expect(res.status).toBe(400);
    await db.delete(clients).where(eq(clients.id, noDaysClient.id));
  });

  it('confirms a session and inserts training_completions for day 1', async () => {
    const res = await request(app)
      .post(`/api/clients/${clientId}/training/confirm-session`)
      .set('Authorization', `Bearer ${clientToken}`)
      .send({ tz: 'America/Mexico_City' });
    expect(res.status).toBe(200);
    expect(res.body.alreadyConfirmedToday).toBe(false);
    expect(res.body.dayNumber).toBe(1);

    const completions = await db.select().from(trainingCompletions).where(eq(trainingCompletions.clientId, clientId));
    expect(completions).toHaveLength(1);
    expect(completions[0].dayNumber).toBe(1);
    expect(completions[0].source).toBe('manual');
  });

  it('reports alreadyConfirmedToday on a second call the same day and does not insert a duplicate row', async () => {
    const res = await request(app)
      .post(`/api/clients/${clientId}/training/confirm-session`)
      .set('Authorization', `Bearer ${clientToken}`)
      .send({ tz: 'America/Mexico_City' });
    expect(res.status).toBe(200);
    expect(res.body.alreadyConfirmedToday).toBe(true);

    const completions = await db.select().from(trainingCompletions).where(eq(trainingCompletions.clientId, clientId));
    expect(completions).toHaveLength(1);
  });

  it('lists training completions', async () => {
    const res = await request(app).get(`/api/clients/${clientId}/training-completions`).set('Authorization', `Bearer ${clientToken}`);
    expect(res.status).toBe(200);
    expect(res.body.completions).toHaveLength(1);
  });

  describe('GET /training/streak', () => {
    it('computes streakWeeks=0 for a client with no completions', async () => {
      const [freshClient] = await db
        .insert(clients)
        .values({ name: 'Streak Client', email: `streak-${Date.now()}@example.com`, passwordHash: 'x', clientType: 'coaching_1_1', trainingDays: 3, permissions: { training: true } })
        .returning();
      const freshToken = signToken({ id: freshClient.id, role: 'cliente', name: freshClient.name, email: freshClient.email });

      const res = await request(app)
        .get(`/api/clients/${freshClient.id}/training/streak?tz=America/Mexico_City`)
        .set('Authorization', `Bearer ${freshToken}`);
      expect(res.status).toBe(200);
      expect(res.body.streak.streakWeeks).toBe(0);
      expect(res.body.streak.sessionsRequiredThisWeek).toBe(3);
      expect(res.body.streak.protectorAvailable).toBe(true);

      await db.delete(clients).where(eq(clients.id, freshClient.id));
    });

    it('computes streakWeeks=1 when this week already meets trainingDays', async () => {
      const [twoDayClient] = await db
        .insert(clients)
        .values({ name: 'Two Day Client', email: `twoday-${Date.now()}@example.com`, passwordHash: 'x', clientType: 'coaching_1_1', trainingDays: 2, permissions: { training: true } })
        .returning();
      const token2 = signToken({ id: twoDayClient.id, role: 'cliente', name: twoDayClient.name, email: twoDayClient.email });

      const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Mexico_City' }).format(new Date());
      await db.insert(trainingCompletions).values([
        { clientId: twoDayClient.id, dayNumber: 1, completedDate: today, source: 'manual' },
        { clientId: twoDayClient.id, dayNumber: 2, completedDate: today, source: 'manual' },
      ]);

      const res = await request(app)
        .get(`/api/clients/${twoDayClient.id}/training/streak?tz=America/Mexico_City`)
        .set('Authorization', `Bearer ${token2}`);
      expect(res.status).toBe(200);
      expect(res.body.streak.streakWeeks).toBe(1);
      expect(res.body.streak.sessionsDoneThisWeek).toBe(2);

      await db.delete(trainingCompletions).where(eq(trainingCompletions.clientId, twoDayClient.id));
      await db.delete(clients).where(eq(clients.id, twoDayClient.id));
    });

    it('falls back to the gym timezone for an invalid tz value instead of throwing', async () => {
      const [freshClient] = await db
        .insert(clients)
        .values({ name: 'Bad Tz Client', email: `badtz-${Date.now()}@example.com`, passwordHash: 'x', clientType: 'coaching_1_1', trainingDays: 1, permissions: { training: true } })
        .returning();
      const freshToken = signToken({ id: freshClient.id, role: 'cliente', name: freshClient.name, email: freshClient.email });

      const res = await request(app)
        .get(`/api/clients/${freshClient.id}/training/streak?tz=Not/A_Real_Timezone`)
        .set('Authorization', `Bearer ${freshToken}`);
      expect(res.status).toBe(200);
      expect(res.body.streak.streakWeeks).toBe(0);

      await db.delete(clients).where(eq(clients.id, freshClient.id));
    });
  });

  describe('POST /training/use-protector', () => {
    it('marks the current week protected and reflects it in the streak', async () => {
      const [protClient] = await db
        .insert(clients)
        .values({ name: 'Protector Client', email: `protector-${Date.now()}@example.com`, passwordHash: 'x', clientType: 'coaching_1_1', trainingDays: 4, permissions: { training: true } })
        .returning();
      const protToken = signToken({ id: protClient.id, role: 'cliente', name: protClient.name, email: protClient.email });

      const res = await request(app)
        .post(`/api/clients/${protClient.id}/training/use-protector`)
        .set('Authorization', `Bearer ${protToken}`)
        .send({ tz: 'America/Mexico_City' });
      expect(res.status).toBe(200);
      expect(res.body.streak.protectorUsedThisWeek).toBe(true);
      expect(res.body.streak.streakWeeks).toBe(1);

      await db.delete(clients).where(eq(clients.id, protClient.id));
    });

    it('does not insert a duplicate protector row for the same week', async () => {
      const [protClient] = await db
        .insert(clients)
        .values({ name: 'Protector Client 2', email: `protector2-${Date.now()}@example.com`, passwordHash: 'x', clientType: 'coaching_1_1', trainingDays: 4, permissions: { training: true } })
        .returning();
      const protToken = signToken({ id: protClient.id, role: 'cliente', name: protClient.name, email: protClient.email });

      await request(app).post(`/api/clients/${protClient.id}/training/use-protector`).set('Authorization', `Bearer ${protToken}`).send({ tz: 'America/Mexico_City' });
      await request(app).post(`/api/clients/${protClient.id}/training/use-protector`).set('Authorization', `Bearer ${protToken}`).send({ tz: 'America/Mexico_City' });

      const rows = await db.select().from(trainingProtectorUses).where(eq(trainingProtectorUses.clientId, protClient.id));
      expect(rows).toHaveLength(1);

      await db.delete(clients).where(eq(clients.id, protClient.id));
    });

    it('rejects a client using another client\'s protector (IDOR guard via ownerOrAdmin)', async () => {
      const [victim] = await db
        .insert(clients)
        .values({ name: 'Victim Client', email: `victim-${Date.now()}@example.com`, passwordHash: 'x', clientType: 'coaching_1_1', trainingDays: 3, permissions: { training: true } })
        .returning();
      const [attacker] = await db
        .insert(clients)
        .values({ name: 'Attacker Client', email: `attacker-${Date.now()}@example.com`, passwordHash: 'x', clientType: 'coaching_1_1', trainingDays: 3, permissions: { training: true } })
        .returning();
      const attackerToken = signToken({ id: attacker.id, role: 'cliente', name: attacker.name, email: attacker.email });

      const res = await request(app)
        .post(`/api/clients/${victim.id}/training/use-protector`)
        .set('Authorization', `Bearer ${attackerToken}`)
        .send({ tz: 'America/Mexico_City' });
      expect(res.status).toBe(403);

      await db.delete(clients).where(eq(clients.id, victim.id));
      await db.delete(clients).where(eq(clients.id, attacker.id));
    });
  });

  describe('POST /training/confirm-session (extended)', () => {
    beforeAll(async () => {
      // Clean up any lingering phrases before this describe block
      await db.delete(phrases);
    });

    it('returns a streak object and a null phrase when there are no active phrases', async () => {
      const [freshClient] = await db
        .insert(clients)
        .values({ name: 'Confirm Ext Client', email: `confirmext-${Date.now()}@example.com`, passwordHash: 'x', clientType: 'coaching_1_1', trainingDays: 1, permissions: { training: true } })
        .returning();
      const freshToken = signToken({ id: freshClient.id, role: 'cliente', name: freshClient.name, email: freshClient.email });

      const res = await request(app)
        .post(`/api/clients/${freshClient.id}/training/confirm-session`)
        .set('Authorization', `Bearer ${freshToken}`)
        .send({ tz: 'America/Mexico_City' });
      expect(res.status).toBe(200);
      expect(res.body.dayNumber).toBe(1);
      expect(res.body.streak.streakWeeks).toBe(1);
      expect(res.body.phrase).toBeNull();

      await db.delete(clients).where(eq(clients.id, freshClient.id));
    });

    it('draws an active "confirmacion"-context phrase when one exists', async () => {
      const [phraseRow] = await db.insert(phrases).values({ text: 'Cada sesión cuenta.', context: 'confirmacion', active: true }).returning();
      const [freshClient] = await db
        .insert(clients)
        .values({ name: 'Phrase Client', email: `phrase-${Date.now()}@example.com`, passwordHash: 'x', clientType: 'coaching_1_1', trainingDays: 1, permissions: { training: true } })
        .returning();
      const freshToken = signToken({ id: freshClient.id, role: 'cliente', name: freshClient.name, email: freshClient.email });

      const res = await request(app)
        .post(`/api/clients/${freshClient.id}/training/confirm-session`)
        .set('Authorization', `Bearer ${freshToken}`)
        .send({ tz: 'America/Mexico_City' });
      expect(res.status).toBe(200);
      expect(res.body.phrase).toBe('Cada sesión cuenta.');

      await db.delete(phrases).where(eq(phrases.id, phraseRow.id));
      await db.delete(clients).where(eq(clients.id, freshClient.id));
    });

    it('inserts an achievement_logs medalla only on the transition to a completed week, never twice', async () => {
      const [twoDayClient] = await db
        .insert(clients)
        .values({ name: 'Achievement Client', email: `achievement-${Date.now()}@example.com`, passwordHash: 'x', clientType: 'coaching_1_1', trainingDays: 1, permissions: { training: true } })
        .returning();
      const token = signToken({ id: twoDayClient.id, role: 'cliente', name: twoDayClient.name, email: twoDayClient.email });

      await request(app).post(`/api/clients/${twoDayClient.id}/training/confirm-session`).set('Authorization', `Bearer ${token}`).send({ tz: 'America/Mexico_City' });
      // Segunda llamada el mismo día: alreadyConfirmedToday=true, no debe insertar otra medalla.
      await request(app).post(`/api/clients/${twoDayClient.id}/training/confirm-session`).set('Authorization', `Bearer ${token}`).send({ tz: 'America/Mexico_City' });

      const logs = await db.select().from(achievementLogs).where(eq(achievementLogs.clientId, twoDayClient.id));
      expect(logs).toHaveLength(1);
      expect(logs[0].type).toBe('medalla');

      await db.delete(achievementLogs).where(eq(achievementLogs.clientId, twoDayClient.id));
      await db.delete(clients).where(eq(clients.id, twoDayClient.id));
    });

    it('does not insert an achievement when the week is completed via the protector', async () => {
      const [protClient] = await db
        .insert(clients)
        .values({ name: 'No Achievement Client', email: `noachievement-${Date.now()}@example.com`, passwordHash: 'x', clientType: 'coaching_1_1', trainingDays: 2, permissions: { training: true } })
        .returning();
      const token = signToken({ id: protClient.id, role: 'cliente', name: protClient.name, email: protClient.email });

      await request(app).post(`/api/clients/${protClient.id}/training/use-protector`).set('Authorization', `Bearer ${token}`).send({ tz: 'America/Mexico_City' });
      await request(app).post(`/api/clients/${protClient.id}/training/confirm-session`).set('Authorization', `Bearer ${token}`).send({ tz: 'America/Mexico_City' });

      const logs = await db.select().from(achievementLogs).where(eq(achievementLogs.clientId, protClient.id));
      expect(logs).toHaveLength(0);

      await db.delete(clients).where(eq(clients.id, protClient.id));
    });

    it('records a medalla for two separate streak cycles that both reach streakWeeks=1 (week_number must not collide)', async () => {
      const [twoDayClient] = await db
        .insert(clients)
        .values({ name: 'Weeknum Client', email: `weeknum-${Date.now()}@example.com`, passwordHash: 'x', clientType: 'coaching_1_1', trainingDays: 1, permissions: { training: true } })
        .returning();
      const token = signToken({ id: twoDayClient.id, role: 'cliente', name: twoDayClient.name, email: twoDayClient.email });

      // Ciclo 1: "hoy" se fija hace 4 semanas — confirm-session inserta la sesión del día 1,
      // completa la semana y dispara la primera medalla (streakWeeks=1).
      vi.useFakeTimers({ toFake: ['Date'] });
      try {
        const fourWeeksAgo = new Date();
        fourWeeksAgo.setUTCDate(fourWeeksAgo.getUTCDate() - 28);
        vi.setSystemTime(fourWeeksAgo);

        const res1 = await request(app)
          .post(`/api/clients/${twoDayClient.id}/training/confirm-session`)
          .set('Authorization', `Bearer ${token}`)
          .send({ tz: 'America/Mexico_City' });
        expect(res1.status).toBe(200);
        expect(res1.body.streak.streakWeeks).toBe(1);
      } finally {
        // Ciclo 2 se ejecuta con el reloj real: sin ninguna sesión en las semanas
        // intermedias, la racha se rompió y arranca de nuevo en streakWeeks=1, con
        // el mismo valor de streakWeeks que el ciclo anterior pero una semana calendario
        // real distinta.
        vi.useRealTimers();
      }

      const res2 = await request(app)
        .post(`/api/clients/${twoDayClient.id}/training/confirm-session`)
        .set('Authorization', `Bearer ${token}`)
        .send({ tz: 'America/Mexico_City' });
      expect(res2.status).toBe(200);
      expect(res2.body.streak.streakWeeks).toBe(1);

      const logs = await db.select().from(achievementLogs).where(eq(achievementLogs.clientId, twoDayClient.id));
      expect(logs).toHaveLength(2);
      expect(logs.every((l) => l.type === 'medalla')).toBe(true);
      const weekNumbers = new Set(logs.map((l) => l.weekNumber));
      expect(weekNumbers.size).toBe(2);

      await db.delete(achievementLogs).where(eq(achievementLogs.clientId, twoDayClient.id));
      await db.delete(trainingCompletions).where(eq(trainingCompletions.clientId, twoDayClient.id));
      await db.delete(clients).where(eq(clients.id, twoDayClient.id));
    });
  });

  describe('GET /training/achievements', () => {
    it('is admin-only', async () => {
      const [freshClient] = await db
        .insert(clients)
        .values({ name: 'Achievements View Client', email: `achview-${Date.now()}@example.com`, passwordHash: 'x', clientType: 'coaching_1_1' })
        .returning();
      const clientToken = signToken({ id: freshClient.id, role: 'cliente', name: freshClient.name, email: freshClient.email });

      const res = await request(app).get(`/api/clients/${freshClient.id}/training/achievements`).set('Authorization', `Bearer ${clientToken}`);
      expect(res.status).toBe(403);

      await db.delete(clients).where(eq(clients.id, freshClient.id));
    });

    it('lists achievements ordered by earned_at descending', async () => {
      const [freshClient] = await db
        .insert(clients)
        .values({ name: 'Achievements List Client', email: `achlist-${Date.now()}@example.com`, passwordHash: 'x', clientType: 'coaching_1_1' })
        .returning();
      await db.insert(achievementLogs).values([
        { clientId: freshClient.id, type: 'medalla', weekNumber: 1 },
        { clientId: freshClient.id, type: 'medalla', weekNumber: 2 },
      ]);

      const res = await request(app).get(`/api/clients/${freshClient.id}/training/achievements`).set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(200);
      expect(res.body.achievements).toHaveLength(2);

      await db.delete(achievementLogs).where(eq(achievementLogs.clientId, freshClient.id));
      await db.delete(clients).where(eq(clients.id, freshClient.id));
    });
  });

  describe('GET /training/phrase', () => {
    beforeAll(async () => {
      // Clean up any lingering phrases from previous test runs
      await db.delete(phrases);
    });

    it('rejects an invalid context', async () => {
      const res = await request(app)
        .get(`/api/clients/${clientId}/training/phrase?context=bogus`)
        .set('Authorization', `Bearer ${clientToken}`);
      expect(res.status).toBe(400);
    });

    it('returns null when there are no eligible phrases', async () => {
      const res = await request(app)
        .get(`/api/clients/${clientId}/training/phrase?context=instagram`)
        .set('Authorization', `Bearer ${clientToken}`);
      expect(res.status).toBe(200);
      expect(res.body.phrase).toBeNull();
    });

    it('draws a phrase matching the requested context', async () => {
      const [igPhrase] = await db
        .insert(phrases)
        .values({ text: 'Frase de Instagram', context: 'instagram', active: true })
        .returning();
      const [confirmPhrase] = await db
        .insert(phrases)
        .values({ text: 'Frase de confirmación', context: 'confirmacion', active: true })
        .returning();

      const res = await request(app)
        .get(`/api/clients/${clientId}/training/phrase?context=instagram`)
        .set('Authorization', `Bearer ${clientToken}`);
      expect(res.status).toBe(200);
      expect(res.body.phrase).toBe('Frase de Instagram');

      await db.delete(phrases).where(eq(phrases.id, igPhrase.id));
      await db.delete(phrases).where(eq(phrases.id, confirmPhrase.id));
    });

    it('draws a phrase whose context is "ambas" for either context', async () => {
      const [bothPhrase] = await db
        .insert(phrases)
        .values({ text: 'Frase para ambas', context: 'ambas', active: true })
        .returning();

      const res = await request(app)
        .get(`/api/clients/${clientId}/training/phrase?context=confirmacion`)
        .set('Authorization', `Bearer ${clientToken}`);
      expect(res.status).toBe(200);
      expect(res.body.phrase).toBe('Frase para ambas');

      await db.delete(phrases).where(eq(phrases.id, bothPhrase.id));
    });

    it('rejects a client requesting another client\'s phrase', async () => {
      const [otherClient] = await db
        .insert(clients)
        .values({ name: 'Other Phrase Client', email: `otherphrase-${Date.now()}@example.com`, passwordHash: 'x', clientType: 'coaching_1_1', permissions: { training: true } })
        .returning();
      const res = await request(app)
        .get(`/api/clients/${otherClient.id}/training/phrase?context=instagram`)
        .set('Authorization', `Bearer ${clientToken}`);
      expect(res.status).toBe(403);
      await db.delete(clients).where(eq(clients.id, otherClient.id));
    });
  });

  describe('GET /quote-of-the-day and PATCH /assigned-quote', () => {
    it('rejects a client using assigned-quote (admin-only)', async () => {
      const res = await request(app)
        .patch(`/api/clients/${clientId}/assigned-quote`)
        .set('Authorization', `Bearer ${clientToken}`)
        .send({ quote_id: null });
      expect(res.status).toBe(403);
    });

    it('returns null from quote-of-the-day when there is no assignment and no active pool', async () => {
      const res = await request(app)
        .get(`/api/clients/${clientId}/quote-of-the-day`)
        .set('Authorization', `Bearer ${clientToken}`);
      expect(res.status).toBe(200);
      expect(res.body.quote).toBeNull();
    });

    it('assigns a quote and returns it from quote-of-the-day even when inactive', async () => {
      const [created] = await db.insert(mindsetQuotes).values({ quote: 'Frase asignada', active: false }).returning();

      const assignRes = await request(app)
        .patch(`/api/clients/${clientId}/assigned-quote`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ quote_id: created.id });
      expect(assignRes.status).toBe(200);
      expect(assignRes.body.client.assignedQuoteId).toBe(created.id);

      const qotdRes = await request(app)
        .get(`/api/clients/${clientId}/quote-of-the-day`)
        .set('Authorization', `Bearer ${clientToken}`);
      expect(qotdRes.status).toBe(200);
      expect(qotdRes.body.quote.id).toBe(created.id);

      const clearRes = await request(app)
        .patch(`/api/clients/${clientId}/assigned-quote`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ quote_id: null });
      expect(clearRes.status).toBe(200);
      expect(clearRes.body.client.assignedQuoteId).toBeNull();

      await db.delete(mindsetQuotes).where(eq(mindsetQuotes.id, created.id));
    });

    it('falls back to the active pool for quote-of-the-day when the client has no assignment', async () => {
      const [created] = await db.insert(mindsetQuotes).values({ quote: 'Frase del pool activo', active: true }).returning();

      const res = await request(app)
        .get(`/api/clients/${clientId}/quote-of-the-day`)
        .set('Authorization', `Bearer ${clientToken}`);
      expect(res.status).toBe(200);
      expect(res.body.quote).not.toBeNull();
      expect(res.body.quote.id).toBe(created.id);

      await db.delete(mindsetQuotes).where(eq(mindsetQuotes.id, created.id));
    });
  });
});
