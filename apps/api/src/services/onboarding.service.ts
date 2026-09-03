import { eq, and } from 'drizzle-orm';
import { db } from '../db/index.js';
import { wearableTokens, labPanels, bioInbodyRecords } from '../models/schema.js';
import { findClientById } from './clients.service.js';
import { getPersonalInfoByClientId, upsertPersonalInfo } from './personal-info.service.js';

export type OnboardingMissingItem = 'wearable' | 'lab_week0' | 'inbody';

export type FinalizeOnboardingResult =
  | { ok: true }
  | { ok: false; missing: OnboardingMissingItem[] };

async function validateMentoringOnboarding(clientId: string): Promise<OnboardingMissingItem[]> {
  const missing: OnboardingMissingItem[] = [];

  const [wearableRows, [labWeek0], [inbodyRow], info] = await Promise.all([
    db.select({ id: wearableTokens.id }).from(wearableTokens).where(eq(wearableTokens.clientId, clientId)).limit(1),
    db.select().from(labPanels).where(and(eq(labPanels.clientId, clientId), eq(labPanels.semanaNumero, 0))).limit(1),
    db.select({ id: bioInbodyRecords.id }).from(bioInbodyRecords).where(eq(bioInbodyRecords.clientId, clientId)).limit(1),
    getPersonalInfoByClientId(clientId),
  ]);

  const hasOAuthWearable = wearableRows.length > 0;
  const hasAppleHealthManual = !!info?.appleHealthConnected;
  if (!hasOAuthWearable && !hasAppleHealthManual) missing.push('wearable');

  const hasLabWeek0 = !!labWeek0 && Object.keys((labWeek0.datos as Record<string, unknown>) || {}).length > 0;
  if (!hasLabWeek0) missing.push('lab_week0');

  if (!inbodyRow) missing.push('inbody');

  return missing;
}

// Único punto que marca personal_info.completed_at — para Mentoría, primero
// exige wearable + laboratorio semana 0 + InBody (ver plan: "el sistema no
// debe permitir marcar el onboarding como completo si falta cualquiera de
// los tres"). Cliente 1:1 conserva el comportamiento actual sin ningún gate.
export async function finalizeOnboarding(clientId: string): Promise<FinalizeOnboardingResult> {
  const client = await findClientById(clientId);
  if (client?.clientType === 'mentoring') {
    const missing = await validateMentoringOnboarding(clientId);
    if (missing.length > 0) return { ok: false, missing };
  }
  await upsertPersonalInfo(clientId, { complete: true });
  return { ok: true };
}
