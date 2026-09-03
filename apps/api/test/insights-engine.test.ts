import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { eq } from 'drizzle-orm';
import { db } from '../src/db/index.js';
import { clients, personalInfo, labPanels, wearableMetricas } from '../src/models/schema.js';
import { resolverRangoOptimo } from '../src/services/insights/rango-optimo.js';
import { resolverFaseCiclo, isPeriodConfirmationDue } from '../src/services/insights/fase-ciclo.js';
import { evaluateInsights, NotMentoringClientError } from '../src/services/insights/engine.js';
import { upsertWeeklyReflection } from '../src/services/checkins.service.js';
import { weeklyReflections } from '../src/models/schema.js';

describe('resolverRangoOptimo (MEV-03 — rango por género/edad)', () => {
  it('usa el mismo rango para un marcador fijo sin importar el género', () => {
    expect(resolverRangoOptimo('glucosa', { gender: 'Masculino', birthdate: null })).toEqual({ min: 70, max: 100 });
    expect(resolverRangoOptimo('glucosa', { gender: 'Femenino', birthdate: null })).toEqual({ min: 70, max: 100 });
  });

  it('resuelve testosterona total con bandas radicalmente distintas por género', () => {
    expect(resolverRangoOptimo('testosterona_total', { gender: 'Masculino', birthdate: null })).toEqual({ min: 400, max: 800 });
    expect(resolverRangoOptimo('testosterona_total', { gender: 'Femenino', birthdate: null })).toEqual({ min: 15, max: 70 });
  });

  it('resuelve DHEA-S por banda de edad dentro del mismo género', () => {
    expect(resolverRangoOptimo('dhea', { gender: 'Masculino', birthdate: '2000-01-01' })).toEqual({ min: 300, max: 450 }); // ~25 años
    expect(resolverRangoOptimo('dhea', { gender: 'Masculino', birthdate: '1980-01-01' })).toEqual({ min: 150, max: 350 }); // ~45 años
    expect(resolverRangoOptimo('dhea', { gender: 'Masculino', birthdate: '1960-01-01' })).toEqual({ min: 70, max: 260 }); // ~65 años
  });

  it('resuelve estradiol según etapa hormonal en mujeres, no solo género', () => {
    expect(resolverRangoOptimo('estradiol', { gender: 'Masculino', birthdate: null })).toEqual({ min: 20, max: 40 });
    expect(resolverRangoOptimo('estradiol', { gender: 'Femenino', birthdate: null, hormonalStatus: 'Ciclo menstrual natural y regular' })).toEqual({ min: 30, max: 400 });
    expect(resolverRangoOptimo('estradiol', { gender: 'Femenino', birthdate: null, hormonalStatus: 'Posmenopausia' })).toEqual({ min: 0, max: 30 });
  });

  it('no asume una banda para género no binario/no informado en marcadores dependientes', () => {
    expect(resolverRangoOptimo('testosterona_total', { gender: 'Otro', birthdate: null })).toBeNull();
    expect(resolverRangoOptimo('dhea', { gender: 'Otro', birthdate: '1990-01-01' })).toBeNull();
  });
});

describe('resolverFaseCiclo (cálculo de fase de ciclo menstrual)', () => {
  const cycleLengthDays = 28;

  function daysAgo(n: number): string {
    const d = new Date();
    d.setDate(d.getDate() - n);
    return d.toISOString().slice(0, 10);
  }

  it('no calcula nada si el ciclo no es natural', () => {
    expect(resolverFaseCiclo({ hormonalStatus: 'Uso método anticonceptivo hormonal', lastPeriodDate: daysAgo(10), cycleLengthDays })).toBeNull();
  });

  it('no calcula nada sin fecha de último período', () => {
    expect(resolverFaseCiclo({ hormonalStatus: 'Ciclo menstrual natural y regular', lastPeriodDate: null, cycleLengthDays })).toBeNull();
  });

  it('no muestra el widget si la fecha está vencida (más de duración + 10 días)', () => {
    expect(resolverFaseCiclo({ hormonalStatus: 'Ciclo menstrual natural y regular', lastPeriodDate: daysAgo(50), cycleLengthDays })).toBeNull();
  });

  it('ubica la fase menstrual en los primeros días del ciclo', () => {
    const resultado = resolverFaseCiclo({ hormonalStatus: 'Ciclo menstrual natural y regular', lastPeriodDate: daysAgo(2), cycleLengthDays });
    expect(resultado?.fase).toBe('menstrual');
    expect(resultado?.confianza).toBe('alta');
  });

  it('ubica la fase lútea tardía (premenstrual) al final del ciclo', () => {
    const resultado = resolverFaseCiclo({ hormonalStatus: 'Ciclo menstrual natural y regular', lastPeriodDate: daysAgo(26), cycleLengthDays });
    expect(resultado?.fase).toBe('lutea_tardia');
  });

  it('marca confianza "estimado" cuando el ciclo es irregular', () => {
    const resultado = resolverFaseCiclo({ hormonalStatus: 'Ciclo menstrual natural pero irregular', lastPeriodDate: daysAgo(2), cycleLengthDays });
    expect(resultado?.confianza).toBe('estimado');
  });

  describe('isPeriodConfirmationDue (Fase C — ventana ±2 días, nunca calendario fijo)', () => {
    it('no está vigente lejos de la fecha esperada', () => {
      expect(isPeriodConfirmationDue({ hormonalStatus: 'Ciclo menstrual natural y regular', lastPeriodDate: daysAgo(10), cycleLengthDays })).toBe(false);
    });

    it('está vigente dentro de la ventana ±2 días alrededor del día esperado', () => {
      expect(isPeriodConfirmationDue({ hormonalStatus: 'Ciclo menstrual natural y regular', lastPeriodDate: daysAgo(cycleLengthDays - 1), cycleLengthDays })).toBe(true);
      expect(isPeriodConfirmationDue({ hormonalStatus: 'Ciclo menstrual natural y regular', lastPeriodDate: daysAgo(cycleLengthDays + 5), cycleLengthDays })).toBe(true);
    });

    it('deja de insistir después de duración_ciclo + 10 días sin confirmar', () => {
      expect(isPeriodConfirmationDue({ hormonalStatus: 'Ciclo menstrual natural y regular', lastPeriodDate: daysAgo(cycleLengthDays + 11), cycleLengthDays })).toBe(false);
    });

    it('nunca se activa para ciclo no natural', () => {
      expect(isPeriodConfirmationDue({ hormonalStatus: 'Uso método anticonceptivo hormonal', lastPeriodDate: daysAgo(cycleLengthDays), cycleLengthDays })).toBe(false);
    });
  });
});

function daysAgoISO(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().slice(0, 10);
}

describe('evaluateInsights (motor completo, integración con DB)', () => {
  let clientId: string;

  afterAll(async () => {
    if (clientId) {
      await db.delete(wearableMetricas).where(eq(wearableMetricas.clientId, clientId));
      await db.delete(labPanels).where(eq(labPanels.clientId, clientId));
      await db.delete(personalInfo).where(eq(personalInfo.clientId, clientId));
      await db.delete(clients).where(eq(clients.id, clientId));
    }
  });

  it('rechaza clientes que no son de Mentoría', async () => {
    const [client] = await db
      .insert(clients)
      .values({ name: 'Non Mentoring', email: `insights-engine-non-mentoring-${Date.now()}@example.com`, status: 'active', clientType: 'coaching_1_1' })
      .returning();
    await expect(evaluateInsights(client.id)).rejects.toThrow(NotMentoringClientError);
    await db.delete(clients).where(eq(clients.id, client.id));
  });

  it('excluye del motor a una clienta embarazada o en lactancia', async () => {
    const [client] = await db
      .insert(clients)
      .values({ name: 'Pregnant Mentoring', email: `insights-engine-pregnant-${Date.now()}@example.com`, status: 'active', clientType: 'mentoring' })
      .returning();
    await db.insert(personalInfo).values({ clientId: client.id, gender: 'Femenino', hormonalStatus: 'Embarazada o en lactancia' });

    const result = await evaluateInsights(client.id);
    expect(result.excluded).toBe('embarazo_lactancia');

    await db.delete(personalInfo).where(eq(personalInfo.clientId, client.id));
    await db.delete(clients).where(eq(clients.id, client.id));
  });

  it('CORT-07 (Potasio fuera de rango) anula cualquier otra sugerencia de Cortisol del mismo checkpoint', async () => {
    const [client] = await db
      .insert(clients)
      .values({ name: 'Safety Priority Client', email: `insights-engine-safety-${Date.now()}@example.com`, status: 'active', clientType: 'mentoring' })
      .returning();
    clientId = client.id;
    await db.insert(personalInfo).values({
      clientId,
      gender: 'Masculino',
      birthdate: '1990-01-01',
      // stress_level: 8 hace verdadera la condición de CORT-01 — la prueba
      // confirma que la regla de seguridad la suprime, no que nunca se evaluó.
      onboardingReport: { stress_level: 8 },
    });
    await db.insert(labPanels).values({
      clientId,
      semanaNumero: 0,
      fecha: new Date().toISOString().slice(0, 10),
      // Potasio fuera de rango (seguridad) + cortisol alto (dispararía CORT-01
      // si no fuera por la prioridad de seguridad).
      datos: { potasio: 6.0, cortisol: 22 },
    });

    // HRV en tendencia bajista sostenida: 21 días previos altos, últimos 7 bajos.
    const rows = [];
    for (let i = 34; i >= 8; i--) rows.push({ clientId, dispositivo: 'oura', fecha: daysAgoISO(i), hrvNocturno: 80 });
    for (let i = 7; i >= 1; i--) rows.push({ clientId, dispositivo: 'oura', fecha: daysAgoISO(i), hrvNocturno: 60 });
    await db.insert(wearableMetricas).values(rows);

    const result = await evaluateInsights(clientId);
    if (result.excluded !== null) throw new Error('No debería excluirse.');
    expect(result.modules.cortisol).toHaveLength(1);
    expect(result.modules.cortisol[0].id).toBe('CORT-07');
    expect(result.modules.cortisol[0].tipo).toBe('derivar_medico');
  });

  it('CORT-09 (Neurowellness) dispara solo con HRV bajando cuando ninguna otra regla de cortisol coincide', async () => {
    const [client] = await db
      .insert(clients)
      .values({ name: 'Cort09 Only Client', email: `insights-engine-cort09-only-${Date.now()}@example.com`, status: 'active', clientType: 'mentoring' })
      .returning();
    await db.insert(personalInfo).values({ clientId: client.id, gender: 'Masculino', birthdate: '1990-01-01' });
    // Sin lab panel: ningún CORT-01..08 puede disparar (todos dependen de un
    // marcador de laboratorio), así que CORT-09 queda como única señal.
    const rows = [];
    for (let i = 34; i >= 8; i--) rows.push({ clientId: client.id, dispositivo: 'oura', fecha: daysAgoISO(i), hrvNocturno: 80 });
    for (let i = 7; i >= 1; i--) rows.push({ clientId: client.id, dispositivo: 'oura', fecha: daysAgoISO(i), hrvNocturno: 60 });
    await db.insert(wearableMetricas).values(rows);

    const result = await evaluateInsights(client.id);
    if (result.excluded !== null) throw new Error('No debería excluirse.');
    expect(result.modules.cortisol).toHaveLength(1);
    expect(result.modules.cortisol[0].id).toBe('CORT-09');
    expect(result.modules.cortisol[0].validoHastaProximoCheckpoint).toBeUndefined();

    await db.delete(wearableMetricas).where(eq(wearableMetricas.clientId, client.id));
    await db.delete(personalInfo).where(eq(personalInfo.clientId, client.id));
    await db.delete(clients).where(eq(clients.id, client.id));
  });

  it('CORT-09 se suprime cuando coincide con una regla de cortisol más específica (CORT-01)', async () => {
    const [client] = await db
      .insert(clients)
      .values({ name: 'Cort09 Suppressed Client', email: `insights-engine-cort09-suppressed-${Date.now()}@example.com`, status: 'active', clientType: 'mentoring' })
      .returning();
    await db.insert(personalInfo).values({
      clientId: client.id,
      gender: 'Masculino',
      birthdate: '1990-01-01',
      onboardingReport: { stress_level: 8 },
    });
    await db.insert(labPanels).values({
      clientId: client.id,
      semanaNumero: 0,
      fecha: new Date().toISOString().slice(0, 10),
      datos: { cortisol: 22 }, // sin potasio fuera de rango — CORT-07 no interfiere
    });
    const rows = [];
    for (let i = 34; i >= 8; i--) rows.push({ clientId: client.id, dispositivo: 'oura', fecha: daysAgoISO(i), hrvNocturno: 80 });
    for (let i = 7; i >= 1; i--) rows.push({ clientId: client.id, dispositivo: 'oura', fecha: daysAgoISO(i), hrvNocturno: 60 });
    await db.insert(wearableMetricas).values(rows);

    const result = await evaluateInsights(client.id);
    if (result.excluded !== null) throw new Error('No debería excluirse.');
    expect(result.modules.cortisol.find((r) => r.id === 'CORT-01')).toBeDefined();
    expect(result.modules.cortisol.find((r) => r.id === 'CORT-09')).toBeUndefined();

    await db.delete(wearableMetricas).where(eq(wearableMetricas.clientId, client.id));
    await db.delete(labPanels).where(eq(labPanels.clientId, client.id));
    await db.delete(personalInfo).where(eq(personalInfo.clientId, client.id));
    await db.delete(clients).where(eq(clients.id, client.id));
  });

  it('usa la weekly_reflection más reciente en vez de la foto fija del onboarding para stress_level', async () => {
    const [client] = await db
      .insert(clients)
      .values({ name: 'Fresh Baseline Client', email: `insights-engine-fresh-baseline-${Date.now()}@example.com`, status: 'active', clientType: 'mentoring' })
      .returning();
    await db.insert(personalInfo).values({
      clientId: client.id,
      gender: 'Masculino',
      birthdate: '1990-01-01',
      // Onboarding dice estrés bajo (2) — si el motor no se actualizara,
      // CORT-01 nunca dispararía sin importar cuánto haya subido el estrés real.
      onboardingReport: { stress_level: 2 },
    });
    await db.insert(labPanels).values({
      clientId: client.id, semanaNumero: 0, fecha: new Date().toISOString().slice(0, 10),
      datos: { cortisol: 22 },
    });
    const rows = [];
    for (let i = 34; i >= 8; i--) rows.push({ clientId: client.id, dispositivo: 'oura', fecha: daysAgoISO(i), hrvNocturno: 80 });
    for (let i = 7; i >= 1; i--) rows.push({ clientId: client.id, dispositivo: 'oura', fecha: daysAgoISO(i), hrvNocturno: 60 });
    await db.insert(wearableMetricas).values(rows);

    // Sin reflexión todavía: CORT-01 no dispara (stress_level=2 del onboarding).
    const before = await evaluateInsights(client.id);
    if (before.excluded !== null) throw new Error('No debería excluirse.');
    expect(before.modules.cortisol.find((r) => r.id === 'CORT-01')).toBeUndefined();

    // Reflexión semanal reciente con estrés alto (8) — el motor debe usarla.
    await upsertWeeklyReflection(client.id, { estresCronico: 8 });
    const after = await evaluateInsights(client.id);
    if (after.excluded !== null) throw new Error('No debería excluirse.');
    expect(after.modules.cortisol.find((r) => r.id === 'CORT-01')).toBeDefined();

    await db.delete(weeklyReflections).where(eq(weeklyReflections.clientId, client.id));
    await db.delete(wearableMetricas).where(eq(wearableMetricas.clientId, client.id));
    await db.delete(labPanels).where(eq(labPanels.clientId, client.id));
    await db.delete(personalInfo).where(eq(personalInfo.clientId, client.id));
    await db.delete(clients).where(eq(clients.id, client.id));
  });
});
