import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { eq, and } from 'drizzle-orm';
import { createApp } from '../src/app.js';
import { db } from '../src/db/index.js';
import { clients, permissionModules, clientTypeModulePermissions } from '../src/models/schema.js';
import { signToken } from '../src/services/auth.service.js';

describe('roles (Roles y Perfiles) admin routes', () => {
  const app = createApp();
  const adminToken = signToken({ id: 'admin-1', role: 'admin', name: 'Admin', email: 'admin@example.com' });

  let clientId: string;
  let clientToken: string;
  const createdModuleKeys: string[] = [];

  beforeAll(async () => {
    const [client] = await db
      .insert(clients)
      .values({ name: 'Roles Test Client', email: `roles-test-${Date.now()}@example.com`, passwordHash: 'x', clientType: 'coaching_1_1' })
      .returning();
    clientId = client.id;
    clientToken = signToken({ id: clientId, role: 'cliente', name: client.name, email: client.email });
  });

  afterAll(async () => {
    for (const key of createdModuleKeys) {
      await db.delete(clientTypeModulePermissions).where(eq(clientTypeModulePermissions.moduleKey, key)).catch(() => {});
      await db.delete(permissionModules).where(eq(permissionModules.key, key)).catch(() => {});
    }
    await db.delete(clients).where(eq(clients.id, clientId));
  });

  it('rejects a client on every roles route', async () => {
    const getModules = await request(app).get('/api/admin/roles/modules').set('Authorization', `Bearer ${clientToken}`);
    expect(getModules.status).toBe(403);
    const getMatrix = await request(app).get('/api/admin/roles/matrix').set('Authorization', `Bearer ${clientToken}`);
    expect(getMatrix.status).toBe(403);
    const getCounts = await request(app).get('/api/admin/roles/counts').set('Authorization', `Bearer ${clientToken}`);
    expect(getCounts.status).toBe(403);
  });

  it('lists the 9 seeded base modules', async () => {
    const res = await request(app).get('/api/admin/roles/modules').set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    const keys = res.body.modules.map((m: { key: string }) => m.key);
    expect(keys).toEqual(
      expect.arrayContaining([
        'personal_info', 'personal_info_mentoring', 'training', 'nutrition',
        'cortisol', 'rest', 'blindspot', 'community', 'evolution',
      ])
    );
  });

  it('creates a module, slugifying accents/spaces from the label, unchecked for every client type', async () => {
    const res = await request(app)
      .post('/api/admin/roles/modules')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ label: 'Nutrición Deportiva' });
    expect(res.status).toBe(201);
    expect(res.body.module.key).toBe('nutricion_deportiva');
    expect(res.body.module.isCustom).toBe(true);
    createdModuleKeys.push(res.body.module.key);

    const rows = await db
      .select()
      .from(clientTypeModulePermissions)
      .where(eq(clientTypeModulePermissions.moduleKey, 'nutricion_deportiva'));
    expect(rows).toHaveLength(2);
    expect(rows.every((r) => r.allowed === false)).toBe(true);
  });

  it('dedupes a colliding key by suffixing _2', async () => {
    const first = await request(app)
      .post('/api/admin/roles/modules')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ label: 'Test Colisión' });
    createdModuleKeys.push(first.body.module.key);

    const second = await request(app)
      .post('/api/admin/roles/modules')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ label: 'Test Colisión' });
    createdModuleKeys.push(second.body.module.key);

    expect(first.body.module.key).toBe('test_colision');
    expect(second.body.module.key).toBe('test_colision_2');
  });

  it('rejects an invalid client_type param on matrix save', async () => {
    const res = await request(app)
      .put('/api/admin/roles/matrix/not_a_real_type')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ permissions: { training: true } });
    expect(res.status).toBe(400);
  });

  it('saves only the targeted column, leaving other client types untouched', async () => {
    const before = await db
      .select()
      .from(clientTypeModulePermissions)
      .where(and(eq(clientTypeModulePermissions.clientType, 'mentoring'), eq(clientTypeModulePermissions.moduleKey, 'rest')));
    const beforeMentoring = before[0]?.allowed;

    const res = await request(app)
      .put('/api/admin/roles/matrix/coaching_1_1')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ permissions: { rest: false } });
    expect(res.status).toBe(200);

    const after = await db
      .select()
      .from(clientTypeModulePermissions)
      .where(and(eq(clientTypeModulePermissions.clientType, 'mentoring'), eq(clientTypeModulePermissions.moduleKey, 'rest')));
    expect(after[0]?.allowed).toBe(beforeMentoring);

    // Restaura el seed original (rest=true para coaching_1_1).
    await request(app)
      .put('/api/admin/roles/matrix/coaching_1_1')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ permissions: { rest: true } });
  });

  it('accepts both personal_info variants marked true on the same column without rejecting the save', async () => {
    const res = await request(app)
      .put('/api/admin/roles/matrix/mentoring')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ permissions: { personal_info: true, personal_info_mentoring: true } });
    expect(res.status).toBe(200);

    const rows = await db
      .select()
      .from(clientTypeModulePermissions)
      .where(eq(clientTypeModulePermissions.clientType, 'mentoring'));
    const personalInfo = rows.find((r) => r.moduleKey === 'personal_info');
    const personalInfoMentoring = rows.find((r) => r.moduleKey === 'personal_info_mentoring');
    expect(personalInfo?.allowed).toBe(true);
    expect(personalInfoMentoring?.allowed).toBe(true);

    // Restaura el estado real esperado (solo mentoring en true) para no dejar
    // el resto de la suite de integración con un seed distinto al esperado.
    await request(app)
      .put('/api/admin/roles/matrix/mentoring')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ permissions: { personal_info: false, personal_info_mentoring: true } });
  });

  it('returns counts for the 2 client types plus therapist', async () => {
    const res = await request(app).get('/api/admin/roles/counts').set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    expect(res.body.counts).toHaveProperty('coaching_1_1');
    expect(res.body.counts).toHaveProperty('mentoring');
    expect(res.body.counts).toHaveProperty('therapist');
    expect(res.body.counts.coaching_1_1).toBeGreaterThanOrEqual(1); // el cliente creado en beforeAll
  });
});
