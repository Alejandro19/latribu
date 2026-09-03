import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { eq } from 'drizzle-orm';
import { createApp } from '../src/app.js';
import { db } from '../src/db/index.js';
import { clients } from '../src/models/schema.js';
import { signToken } from '../src/services/auth.service.js';

describe('insights routes (motor de insights cruzados — exclusivo Mentoría)', () => {
  const app = createApp();
  const adminToken = signToken({ id: 'admin-1', role: 'admin', name: 'Admin', email: 'admin@example.com' });

  let mentoringClientId: string;
  let mentoringClientToken: string;
  let presencialClientId: string;
  let presencialClientToken: string;

  beforeAll(async () => {
    const [mentoringClient] = await db
      .insert(clients)
      .values({ name: 'Mentoring Client', email: `insights-mentoring-${Date.now()}@example.com`, status: 'active', clientType: 'mentoring' })
      .returning();
    mentoringClientId = mentoringClient.id;
    mentoringClientToken = signToken({ id: mentoringClientId, role: 'cliente', name: mentoringClient.name, email: mentoringClient.email, clientType: 'mentoring' });

    const [presencialClient] = await db
      .insert(clients)
      .values({ name: 'Presencial Client', email: `insights-presencial-${Date.now()}@example.com`, status: 'active', clientType: 'coaching_1_1' })
      .returning();
    presencialClientId = presencialClient.id;
    presencialClientToken = signToken({ id: presencialClientId, role: 'cliente', name: presencialClient.name, email: presencialClient.email, clientType: 'coaching_1_1' });
  });

  afterAll(async () => {
    await db.delete(clients).where(eq(clients.id, mentoringClientId));
    await db.delete(clients).where(eq(clients.id, presencialClientId));
  });

  it('bloquea (403) a un cliente Presencial que intenta acceder a sus propios insights', async () => {
    const res = await request(app)
      .get(`/api/clients/${presencialClientId}/insights`)
      .set('Authorization', `Bearer ${presencialClientToken}`);
    expect(res.status).toBe(403);
  });

  it('bloquea (403) a un cliente Presencial que intenta acceder a los insights de otro cliente por URL', async () => {
    const res = await request(app)
      .get(`/api/clients/${mentoringClientId}/insights`)
      .set('Authorization', `Bearer ${presencialClientToken}`);
    expect(res.status).toBe(403);
  });

  it('permite (200) a un cliente Mentoría acceder a sus propios insights', async () => {
    const res = await request(app)
      .get(`/api/clients/${mentoringClientId}/insights`)
      .set('Authorization', `Bearer ${mentoringClientToken}`);
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.applicable).toBe(true);
    expect(res.body.excluded).toBeNull();
    expect(res.body.modules).toHaveProperty('cortisol');
    expect(res.body.modules).toHaveProperty('sueno');
    expect(res.body.modules).toHaveProperty('entrenamiento');
    expect(res.body.modules).toHaveProperty('nutricion');
    expect(res.body.modules).toHaveProperty('puntoCiego');
    expect(res.body.modules).toHaveProperty('miEvolucion');
  });

  it('permite (200) a un admin acceder a los insights de un cliente Mentoría', async () => {
    const res = await request(app)
      .get(`/api/clients/${mentoringClientId}/insights`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    expect(res.body.applicable).toBe(true);
    expect(res.body.excluded).toBeNull();
  });

  it('un admin pidiendo insights de un cliente Presencial recibe 200 { applicable: false }, no un error', async () => {
    // mentoringOnly deja pasar siempre a los admins sin validar el tier del
    // cliente objetivo — sin este manejo, evaluateInsights lanzaría
    // NotMentoringClientError y el error handler genérico respondería 500.
    // Los paneles admin de los 6 módulos comparten un solo componente entre
    // todos los tipos de cliente, así que esto ocurriría todo el tiempo.
    const res = await request(app)
      .get(`/api/clients/${presencialClientId}/insights`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.applicable).toBe(false);
  });
});
