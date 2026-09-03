import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest';
import request from 'supertest';
import { eq } from 'drizzle-orm';
import { createApp } from '../src/app.js';
import { db } from '../src/db/index.js';
import { clients, personalInfo, labPanels, mentoringBenchmarkSnapshots, wearableMetricas } from '../src/models/schema.js';
import { signToken } from '../src/services/auth.service.js';

describe('lab-panels routes: guardado, aprobación, y captura de benchmark comparativo', () => {
  const app = createApp();
  const adminToken = signToken({ id: 'admin-1', role: 'admin', name: 'Admin', email: 'admin@example.com' });
  let mentoringClientId: string;

  beforeAll(async () => {
    const [client] = await db
      .insert(clients)
      .values({ name: 'Lab Panels Client', email: `lab-panels-${Date.now()}@example.com`, status: 'active', clientType: 'mentoring' })
      .returning();
    mentoringClientId = client.id;
  });

  afterAll(async () => {
    await db.delete(clients).where(eq(clients.id, mentoringClientId));
  });

  afterEach(async () => {
    await db.delete(labPanels).where(eq(labPanels.clientId, mentoringClientId));
    await db.delete(personalInfo).where(eq(personalInfo.clientId, mentoringClientId));
    await db.delete(wearableMetricas).where(eq(wearableMetricas.clientId, mentoringClientId));
    // La tabla de benchmark es intencionalmente anónima (sin client_id) —
    // no hay forma de filtrar por cliente, así que cada test la vacía entera.
    await db.delete(mentoringBenchmarkSnapshots);
  });

  it('admin guarda un panel de laboratorio (checkpoint semana 0), queda en_revision', async () => {
    const res = await request(app)
      .put(`/api/clients/${mentoringClientId}/lab-panels`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ semana: 0, fecha: '2026-08-01', datos: { cortisol: 15 } });
    expect(res.status).toBe(200);
    expect(res.body.panel.semanaNumero).toBe(0);
    expect(res.body.panel.status).toBe('en_revision');
  });

  it('guardar (PUT) por sí solo NUNCA captura benchmark — solo la aprobación lo hace', async () => {
    await db.insert(personalInfo).values({
      clientId: mentoringClientId,
      birthdate: '1985-06-15',
      cargoType: 'C-level',
      sector: 'Tecnología',
    });

    const res = await request(app)
      .put(`/api/clients/${mentoringClientId}/lab-panels`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ semana: 6, fecha: '2026-08-01', datos: { cortisol: 15, dhea: 300 } });
    expect(res.status).toBe(200);

    // Re-guardar (simula una corrección antes de aprobar) tampoco debe insertar nada.
    await request(app)
      .put(`/api/clients/${mentoringClientId}/lab-panels`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ semana: 6, fecha: '2026-08-01', datos: { cortisol: 16, dhea: 305 } });

    const rows = await db.select().from(mentoringBenchmarkSnapshots);
    expect(rows).toHaveLength(0);
  });

  it('aprobar un panel con segmentación completa captura exactamente una fila anonimizada de benchmark', async () => {
    await db.insert(personalInfo).values({
      clientId: mentoringClientId,
      birthdate: '1985-06-15', // ~41 años → banda 40-49
      cargoType: 'C-level',
      sector: 'Tecnología',
    });
    await request(app)
      .put(`/api/clients/${mentoringClientId}/lab-panels`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ semana: 6, fecha: '2026-08-01', datos: { cortisol: 15, dhea: 300, clave_invalida: 999 } });

    const approveRes = await request(app)
      .post(`/api/clients/${mentoringClientId}/lab-panels/6/approve`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({});
    expect(approveRes.status).toBe(200);
    expect(approveRes.body.panel.status).toBe('aprobado');
    expect(approveRes.body.panel.approvedAt).not.toBeNull();

    const rows = await db.select().from(mentoringBenchmarkSnapshots);
    expect(rows).toHaveLength(1);
    expect(rows[0].semanaNumero).toBe(6);
    expect(rows[0].ageBand).toBe('40-49');
    expect(rows[0].cargoType).toBe('C-level');
    expect(rows[0].sector).toBe('Tecnología');
    // Filtra a solo marcadores conocidos — nunca copia el jsonb crudo tal cual.
    expect(rows[0].markers).toEqual({ cortisol: 15, dhea: 300 });
    expect(rows[0].wearable).toHaveProperty('hrvPromedio');
  });

  it('el admin puede corregir los datos al aprobar, y el snapshot refleja la corrección', async () => {
    await db.insert(personalInfo).values({
      clientId: mentoringClientId,
      birthdate: '1985-06-15',
      cargoType: 'Fundador/Dueño',
      sector: 'Salud',
    });
    await request(app)
      .put(`/api/clients/${mentoringClientId}/lab-panels`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ semana: 0, fecha: '2026-08-01', datos: { cortisol: 999 } });

    const approveRes = await request(app)
      .post(`/api/clients/${mentoringClientId}/lab-panels/0/approve`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ datos: { cortisol: 14 } });
    expect(approveRes.status).toBe(200);
    expect(approveRes.body.panel.datos).toEqual({ cortisol: 14 });

    const rows = await db.select().from(mentoringBenchmarkSnapshots);
    expect(rows).toHaveLength(1);
    expect(rows[0].markers).toEqual({ cortisol: 14 });
  });

  it('aprobar con segmentación incompleta aprueba el panel pero omite el benchmark sin fallar', async () => {
    await db.insert(personalInfo).values({
      clientId: mentoringClientId,
      birthdate: '1985-06-15',
      sector: 'Tecnología',
      // cargoType queda sin definir a propósito.
    });
    await request(app)
      .put(`/api/clients/${mentoringClientId}/lab-panels`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ semana: 0, fecha: '2026-08-01', datos: { cortisol: 15 } });

    const approveRes = await request(app)
      .post(`/api/clients/${mentoringClientId}/lab-panels/0/approve`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({});
    expect(approveRes.status).toBe(200);
    expect(approveRes.body.panel.status).toBe('aprobado');

    const rows = await db.select().from(mentoringBenchmarkSnapshots);
    expect(rows).toHaveLength(0);
  });

  it('nunca captura benchmark para un cliente que no es de Mentoría, aunque tenga segmentación completa', async () => {
    const [nonMentoringClient] = await db
      .insert(clients)
      .values({ name: 'Non Mentoring Client', email: `lab-panels-non-mentoring-${Date.now()}@example.com`, status: 'active', clientType: 'coaching_1_1' })
      .returning();
    await db.insert(personalInfo).values({
      clientId: nonMentoringClient.id,
      birthdate: '1985-06-15',
      cargoType: 'C-level',
      sector: 'Tecnología',
    });

    await request(app)
      .put(`/api/clients/${nonMentoringClient.id}/lab-panels`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ semana: 0, fecha: '2026-08-01', datos: { cortisol: 15 } });
    const approveRes = await request(app)
      .post(`/api/clients/${nonMentoringClient.id}/lab-panels/0/approve`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({});
    expect(approveRes.status).toBe(200);

    const rows = await db.select().from(mentoringBenchmarkSnapshots);
    expect(rows).toHaveLength(0);

    await db.delete(personalInfo).where(eq(personalInfo.clientId, nonMentoringClient.id));
    await db.delete(clients).where(eq(clients.id, nonMentoringClient.id));
  });

  it('un cliente (no admin) no puede aprobar su propio panel', async () => {
    const clientToken = signToken({ id: mentoringClientId, role: 'cliente', name: 'x', email: 'x@x.com', clientType: 'mentoring' });
    await request(app)
      .put(`/api/clients/${mentoringClientId}/lab-panels`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ semana: 0, fecha: '2026-08-01', datos: { cortisol: 15 } });

    const res = await request(app)
      .post(`/api/clients/${mentoringClientId}/lab-panels/0/approve`)
      .set('Authorization', `Bearer ${clientToken}`)
      .send({});
    expect(res.status).toBe(403);
  });

  describe('Edad Biológica (PhenoAge) al aprobar', () => {
    const PHENOAGE_DATOS = {
      albumina: 45, creatinina: 0.9, glucosa: 85, pcr: 1.0,
      linfocitos_pct: 30, vcm: 90, rdw: 12.5, fosfatasa_alcalina: 70, leucocitos: 6.5,
    };

    it('calcula y guarda edad_biologica cuando el panel aprobado trae los 9 marcadores completos', async () => {
      await db.insert(personalInfo).values({ clientId: mentoringClientId, birthdate: '1986-08-01' }); // 40 años exactos en la fecha del panel
      await request(app)
        .put(`/api/clients/${mentoringClientId}/lab-panels`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ semana: 0, fecha: '2026-08-01', datos: PHENOAGE_DATOS });

      const approveRes = await request(app)
        .post(`/api/clients/${mentoringClientId}/lab-panels/0/approve`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({});
      expect(approveRes.status).toBe(200);
      // numeric(5,2) en la columna redondea a 2 decimales al guardar (30.7419 → 30.74).
      expect(Number(approveRes.body.panel.edadBiologica)).toBeCloseTo(30.74, 2);
      expect(Number(approveRes.body.panel.edadCronologicaCalculo)).toBe(40);
      expect(approveRes.body.panel.edadBiologicaCalculadaEn).not.toBeNull();
    });

    it('no calcula nada si al panel le falta uno de los 9 marcadores requeridos', async () => {
      await db.insert(personalInfo).values({ clientId: mentoringClientId, birthdate: '1986-08-01' });
      const { leucocitos: _omit, ...incompletos } = PHENOAGE_DATOS;
      await request(app)
        .put(`/api/clients/${mentoringClientId}/lab-panels`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ semana: 0, fecha: '2026-08-01', datos: incompletos });

      const approveRes = await request(app)
        .post(`/api/clients/${mentoringClientId}/lab-panels/0/approve`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({});
      expect(approveRes.status).toBe(200);
      expect(approveRes.body.panel.edadBiologica).toBeNull();
    });

    it('no calcula nada si el cliente no tiene birthdate registrado', async () => {
      await request(app)
        .put(`/api/clients/${mentoringClientId}/lab-panels`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ semana: 0, fecha: '2026-08-01', datos: PHENOAGE_DATOS });

      const approveRes = await request(app)
        .post(`/api/clients/${mentoringClientId}/lab-panels/0/approve`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({});
      expect(approveRes.status).toBe(200);
      expect(approveRes.body.panel.edadBiologica).toBeNull();
    });
  });
});
