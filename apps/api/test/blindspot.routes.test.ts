import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest';
import request from 'supertest';
import { eq } from 'drizzle-orm';
import { createApp } from '../src/app.js';
import { db } from '../src/db/index.js';
import { clients, therapists, blindspotCases, blindspotTasks, blindspotSessionLogs, adminNotifications } from '../src/models/schema.js';
import { signToken, hashPassword } from '../src/services/auth.service.js';

describe('blindspot (Punto Ciego) routes', () => {
  const app = createApp();
  const adminToken = signToken({ id: 'admin-1', role: 'admin', name: 'Admin', email: 'admin@example.com' });

  let mentoringClientId: string;
  let mentoringClientToken: string;
  let nonMentoringClientId: string;
  let nonMentoringClientToken: string;
  let therapistAId: string;
  let therapistAToken: string;
  let therapistBId: string;
  let therapistBToken: string;

  beforeAll(async () => {
    const [mentoringClient] = await db
      .insert(clients)
      .values({ name: 'Mentoring Client', email: `mentoring-${Date.now()}@example.com`, status: 'active', clientType: 'mentoring' })
      .returning();
    mentoringClientId = mentoringClient.id;
    mentoringClientToken = signToken({ id: mentoringClientId, role: 'cliente', name: mentoringClient.name, email: mentoringClient.email, clientType: 'mentoring' });

    const [nonMentoringClient] = await db
      .insert(clients)
      .values({ name: 'Non Mentoring Client', email: `non-mentoring-${Date.now()}@example.com`, status: 'active', clientType: 'coaching_1_1' })
      .returning();
    nonMentoringClientId = nonMentoringClient.id;
    nonMentoringClientToken = signToken({ id: nonMentoringClientId, role: 'cliente', name: nonMentoringClient.name, email: nonMentoringClient.email, clientType: 'coaching_1_1' });

    const passwordHash = await hashPassword('supersecret123');
    const [therapistA] = await db
      .insert(therapists)
      .values({ name: 'Terapeuta A', email: `terapeuta-a-${Date.now()}@example.com`, passwordHash, specialty: 'Biodescodificación' })
      .returning();
    therapistAId = therapistA.id;
    therapistAToken = signToken({ id: therapistAId, role: 'terapeuta', name: therapistA.name, email: therapistA.email });

    const [therapistB] = await db
      .insert(therapists)
      .values({ name: 'Terapeuta B', email: `terapeuta-b-${Date.now()}@example.com`, passwordHash, specialty: 'Biodescodificación' })
      .returning();
    therapistBId = therapistB.id;
    therapistBToken = signToken({ id: therapistBId, role: 'terapeuta', name: therapistB.name, email: therapistB.email });
  });

  afterAll(async () => {
    await db.delete(clients).where(eq(clients.id, mentoringClientId));
    await db.delete(clients).where(eq(clients.id, nonMentoringClientId));
    await db.delete(therapists).where(eq(therapists.id, therapistAId));
    await db.delete(therapists).where(eq(therapists.id, therapistBId));
  });

  afterEach(async () => {
    await db.delete(adminNotifications).where(eq(adminNotifications.clientId, mentoringClientId));
    const cases = await db.select().from(blindspotCases).where(eq(blindspotCases.clientId, mentoringClientId));
    for (const c of cases) {
      await db.delete(blindspotTasks).where(eq(blindspotTasks.caseId, c.id));
      await db.delete(blindspotSessionLogs).where(eq(blindspotSessionLogs.caseId, c.id));
    }
    await db.delete(blindspotCases).where(eq(blindspotCases.clientId, mentoringClientId));
  });

  async function createAssignedCase() {
    const createRes = await request(app)
      .post('/api/blindspot/cases')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ clientId: mentoringClientId, initialAssessment: { motivoConsulta: 'Estrés crónico', areaPercibida: 'Liderazgo', prioridad: 'alta' } });
    expect(createRes.status).toBe(201);
    const caseId = createRes.body.case.id;

    const assignRes = await request(app)
      .patch(`/api/blindspot/cases/${caseId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ status: 'referido', therapistId: therapistAId });
    expect(assignRes.status).toBe(200);

    return caseId;
  }

  it('a non-mentoring client is blocked from every my-case route (403)', async () => {
    const res = await request(app).get('/api/blindspot/my-case').set('Authorization', `Bearer ${nonMentoringClientToken}`);
    expect(res.status).toBe(403);
  });

  it('a mentoring client with no case yet gets an empty case, not a 404', async () => {
    const res = await request(app).get('/api/blindspot/my-case').set('Authorization', `Bearer ${mentoringClientToken}`);
    expect(res.status).toBe(200);
    expect(res.body.case).toBeNull();
  });

  it('admin creates a case and assigns a therapist; the assigned therapist can access it', async () => {
    const caseId = await createAssignedCase();
    const res = await request(app).get(`/api/blindspot/therapist/cases/${caseId}`).set('Authorization', `Bearer ${therapistAToken}`);
    expect(res.status).toBe(200);
    expect(res.body.case.status).toBe('referido');
  });

  it('a therapist cannot access a case assigned to a different therapist (403)', async () => {
    const caseId = await createAssignedCase();
    const res = await request(app).get(`/api/blindspot/therapist/cases/${caseId}`).set('Authorization', `Bearer ${therapistBToken}`);
    expect(res.status).toBe(403);
  });

  it("the therapist's case detail never includes adminPrivateNotes", async () => {
    const caseId = await createAssignedCase();
    await request(app)
      .patch(`/api/blindspot/cases/${caseId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ adminPrivateNotes: 'Nota privada de Alejandro, solo para él.' });

    const res = await request(app).get(`/api/blindspot/therapist/cases/${caseId}`).set('Authorization', `Bearer ${therapistAToken}`);
    expect(res.status).toBe(200);
    expect(res.body.case.adminPrivateNotes).toBeUndefined();
  });

  it("the client's own case view never includes internalSummary, only clientNote", async () => {
    const caseId = await createAssignedCase();
    await request(app)
      .post(`/api/blindspot/therapist/cases/${caseId}/sessions`)
      .set('Authorization', `Bearer ${therapistAToken}`)
      .send({
        sessionDate: '2026-08-08',
        progressMarker: 'avance',
        internalSummary: 'Detalle clínico interno sensible que nunca debe llegar al cliente.',
        clientNote: 'Vamos muy bien, sigue con los ejercicios.',
      });

    const res = await request(app).get('/api/blindspot/my-case').set('Authorization', `Bearer ${mentoringClientToken}`);
    expect(res.status).toBe(200);
    expect(res.body.sessionLogs).toHaveLength(1);
    expect(res.body.sessionLogs[0].clientNote).toBe('Vamos muy bien, sigue con los ejercicios.');
    expect(res.body.sessionLogs[0].internalSummary).toBeUndefined();
    expect(JSON.stringify(res.body)).not.toContain('Detalle clínico interno sensible');
  });

  it('a task assigned by the therapist appears for the client, who can mark it completed', async () => {
    const caseId = await createAssignedCase();
    const taskRes = await request(app)
      .post(`/api/blindspot/therapist/cases/${caseId}/tasks`)
      .set('Authorization', `Bearer ${therapistAToken}`)
      .send({ title: 'Escribir 3 patrones que notas en ti' });
    expect(taskRes.status).toBe(201);
    const taskId = taskRes.body.task.id;

    const myCaseRes = await request(app).get('/api/blindspot/my-case').set('Authorization', `Bearer ${mentoringClientToken}`);
    expect(myCaseRes.body.tasks.some((t: { id: string }) => t.id === taskId)).toBe(true);

    const completeRes = await request(app)
      .patch(`/api/blindspot/my-case/tasks/${taskId}`)
      .set('Authorization', `Bearer ${mentoringClientToken}`);
    expect(completeRes.status).toBe(200);
    expect(completeRes.body.task.status).toBe('completada');
  });

  it('raising a crisis flag from the client sets crisisFlag and creates an admin notification', async () => {
    await createAssignedCase();
    const res = await request(app).post('/api/blindspot/my-case/help').set('Authorization', `Bearer ${mentoringClientToken}`);
    expect(res.status).toBe(200);

    const notifications = await db.select().from(adminNotifications).where(eq(adminNotifications.clientId, mentoringClientId));
    expect(notifications.some((n) => n.type === 'blindspot_crisis')).toBe(true);

    const cases = await db.select().from(blindspotCases).where(eq(blindspotCases.clientId, mentoringClientId));
    expect(cases[0].crisisFlag).toBe(true);
    expect(cases[0].crisisFlaggedBy).toBe('cliente');
  });

  it('a therapist can also raise a crisis flag for their own case', async () => {
    const caseId = await createAssignedCase();
    const res = await request(app).post(`/api/blindspot/therapist/cases/${caseId}/crisis`).set('Authorization', `Bearer ${therapistAToken}`);
    expect(res.status).toBe(200);

    const cases = await db.select().from(blindspotCases).where(eq(blindspotCases.id, caseId));
    expect(cases[0].crisisFlag).toBe(true);
    expect(cases[0].crisisFlaggedBy).toBe('terapeuta');
  });

  it('a therapist cannot raise a crisis flag on a case that is not theirs (403)', async () => {
    const caseId = await createAssignedCase();
    const res = await request(app).post(`/api/blindspot/therapist/cases/${caseId}/crisis`).set('Authorization', `Bearer ${therapistBToken}`);
    expect(res.status).toBe(403);
  });

  it('admin can acknowledge a crisis, clearing the flag', async () => {
    const caseId = await createAssignedCase();
    await request(app).post(`/api/blindspot/therapist/cases/${caseId}/crisis`).set('Authorization', `Bearer ${therapistAToken}`);
    const ackRes = await request(app).patch(`/api/blindspot/cases/${caseId}/crisis/acknowledge`).set('Authorization', `Bearer ${adminToken}`);
    expect(ackRes.status).toBe(200);

    const cases = await db.select().from(blindspotCases).where(eq(blindspotCases.id, caseId));
    expect(cases[0].crisisFlag).toBe(false);
  });

  it('a non-admin cannot create a case (403)', async () => {
    const res = await request(app)
      .post('/api/blindspot/cases')
      .set('Authorization', `Bearer ${mentoringClientToken}`)
      .send({ clientId: mentoringClientId, initialAssessment: { motivoConsulta: 'x', areaPercibida: 'y', prioridad: 'alta' } });
    expect(res.status).toBe(403);
  });

  it('a therapist can log in with valid credentials', async () => {
    const res = await request(app).post('/api/auth/therapist/login').send({ email: (await db.select().from(therapists).where(eq(therapists.id, therapistAId)))[0].email, password: 'supersecret123' });
    expect(res.status).toBe(200);
    expect(res.body.role).toBe('terapeuta');
    expect(res.body.token).toBeTruthy();
  });

  it('an inactive therapist cannot log in', async () => {
    const passwordHash = await hashPassword('anotherpass123');
    const [inactive] = await db
      .insert(therapists)
      .values({ name: 'Terapeuta Inactivo', email: `inactivo-${Date.now()}@example.com`, passwordHash, active: false })
      .returning();
    const res = await request(app).post('/api/auth/therapist/login').send({ email: inactive.email, password: 'anotherpass123' });
    expect(res.status).toBe(403);
    await db.delete(therapists).where(eq(therapists.id, inactive.id));
  });

  it('admin edits a therapist\'s name, email, specialty and phone (panel de administración de terapeutas)', async () => {
    const passwordHash = await hashPassword('editable123');
    const [editable] = await db
      .insert(therapists)
      .values({ name: 'Terapeuta Editable', email: `editable-${Date.now()}@example.com`, passwordHash })
      .returning();

    const newEmail = `editado-${Date.now()}@example.com`;
    const res = await request(app)
      .patch(`/api/blindspot/therapists/${editable.id}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'Terapeuta Editado', email: newEmail, specialty: 'Coaching Integral', phone: '3009998877' });
    expect(res.status).toBe(200);
    expect(res.body.therapist).toMatchObject({ name: 'Terapeuta Editado', email: newEmail, specialty: 'Coaching Integral', phone: '3009998877' });

    await db.delete(therapists).where(eq(therapists.id, editable.id));
  });

  it('rejects editing a therapist to an email already used by another therapist', async () => {
    const res = await request(app)
      .patch(`/api/blindspot/therapists/${therapistBId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ email: (await db.select().from(therapists).where(eq(therapists.id, therapistAId)))[0].email });
    expect(res.status).toBe(409);
  });

  it('admin deletes a therapist with no cases assigned', async () => {
    const passwordHash = await hashPassword('deleteme123');
    const [deletable] = await db
      .insert(therapists)
      .values({ name: 'Terapeuta Eliminable', email: `eliminable-${Date.now()}@example.com`, passwordHash })
      .returning();

    const res = await request(app).delete(`/api/blindspot/therapists/${deletable.id}`).set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);

    const stillThere = await db.select().from(therapists).where(eq(therapists.id, deletable.id));
    expect(stillThere).toHaveLength(0);
  });

  it('blocks deleting a therapist who has a Punto Ciego case assigned, with a friendly message', async () => {
    const caseId = await createAssignedCase();
    const res = await request(app).delete(`/api/blindspot/therapists/${therapistAId}`).set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(409);
    expect(res.body.error).toMatch(/casos de Punto Ciego asignados/);

    // El terapeuta debe seguir existiendo — el intento de borrado no debe dejarlo a medias.
    const stillThere = await db.select().from(therapists).where(eq(therapists.id, therapistAId));
    expect(stillThere).toHaveLength(1);

    await request(app)
      .patch(`/api/blindspot/cases/${caseId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ therapistId: null });
  });

  it('a non-admin cannot edit or delete a therapist', async () => {
    const patchRes = await request(app)
      .patch(`/api/blindspot/therapists/${therapistAId}`)
      .set('Authorization', `Bearer ${mentoringClientToken}`)
      .send({ name: 'Hackeado' });
    expect(patchRes.status).toBe(403);

    const deleteRes = await request(app).delete(`/api/blindspot/therapists/${therapistAId}`).set('Authorization', `Bearer ${mentoringClientToken}`);
    expect(deleteRes.status).toBe(403);
  });
});
