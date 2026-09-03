import { eq, asc } from 'drizzle-orm';
import { CLIENT_TYPES, type ClientTypeCounts, type ModuleAccessMatrix } from '@latribu/shared-types';
import { db } from '../db/index.js';
import { permissionModules, clientTypeModulePermissions, type PermissionModule } from '../models/schema.js';
import * as clientsService from './clients.service.js';
import * as therapistsService from './therapists.service.js';
import { invalidateModuleAccessCache, isModuleAllowedForType } from './type-module-access.service.js';

export type PersonalInfoVariant = 'standard' | 'mentoring' | 'none';

// Mentoring gana si ambas están en true — es la variante superset (incluye
// el módulo 10 · dispositivos y laboratorios), misma regla que usa la
// pantalla de admin para el aviso de confirmación.
export async function resolvePersonalInfoVariant(clientType: string): Promise<PersonalInfoVariant> {
  const [standard, mentoring] = await Promise.all([
    isModuleAllowedForType(clientType, 'personal_info'),
    isModuleAllowedForType(clientType, 'personal_info_mentoring'),
  ]);
  if (mentoring) return 'mentoring';
  if (standard) return 'standard';
  return 'none';
}

function slugifyModuleKey(label: string): string {
  return label
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '') // quita los acentos que deja NFD (á → a + ´)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '') || 'modulo';
}

export async function listModules(): Promise<PermissionModule[]> {
  return db.select().from(permissionModules).orderBy(asc(permissionModules.sortOrder));
}

export async function createModule(label: string): Promise<PermissionModule> {
  const existing = await listModules();
  const existingKeys = new Set(existing.map((m) => m.key));
  const baseKey = slugifyModuleKey(label);
  let key = baseKey;
  let suffix = 2;
  while (existingKeys.has(key)) {
    key = `${baseKey}_${suffix}`;
    suffix += 1;
  }
  const nextSortOrder = existing.reduce((max, m) => Math.max(max, m.sortOrder), -1) + 1;

  const [module] = await db
    .insert(permissionModules)
    .values({ key, label, sortOrder: nextSortOrder, isCustom: true })
    .returning();

  // Fila sin marcar para cada tipo de cliente — un módulo nuevo arranca
  // cerrado hasta que un admin lo habilite explícitamente desde la matriz.
  await db.insert(clientTypeModulePermissions).values(
    CLIENT_TYPES.map((clientType) => ({ clientType, moduleKey: key, allowed: false }))
  );

  invalidateModuleAccessCache();
  return module;
}

// Solo se pueden borrar módulos custom (creados desde la matriz) — los
// módulos base del sistema (isCustom: false) no tienen esta opción para
// evitar que un admin rompa el gating de un módulo real por error.
export async function deleteModule(key: string): Promise<{ deleted: boolean; reason?: string }> {
  const [module] = await db.select().from(permissionModules).where(eq(permissionModules.key, key)).limit(1);
  if (!module) return { deleted: false, reason: 'Módulo no encontrado.' };
  if (!module.isCustom) return { deleted: false, reason: 'No se puede borrar un módulo del sistema.' };
  await db.delete(permissionModules).where(eq(permissionModules.key, key));
  invalidateModuleAccessCache();
  return { deleted: true };
}

export async function getMatrix(): Promise<{ modules: PermissionModule[]; matrix: ModuleAccessMatrix }> {
  const modules = await listModules();
  const rows = await db.select().from(clientTypeModulePermissions);

  const matrix: ModuleAccessMatrix = {};
  for (const clientType of CLIENT_TYPES) {
    matrix[clientType] = {};
    for (const module of modules) {
      matrix[clientType][module.key] = false;
    }
  }
  for (const row of rows) {
    if (!matrix[row.clientType]) matrix[row.clientType] = {};
    matrix[row.clientType][row.moduleKey] = row.allowed;
  }
  return { modules, matrix };
}

export async function saveMatrixColumn(clientType: string, permissions: Record<string, boolean>): Promise<void> {
  for (const [moduleKey, allowed] of Object.entries(permissions)) {
    await db
      .insert(clientTypeModulePermissions)
      .values({ clientType, moduleKey, allowed })
      .onConflictDoUpdate({
        target: [clientTypeModulePermissions.clientType, clientTypeModulePermissions.moduleKey],
        set: { allowed, updatedAt: new Date() },
      });
  }
  invalidateModuleAccessCache();
}

export async function getCounts(): Promise<ClientTypeCounts> {
  const clients = await clientsService.listClients();
  const counts: Record<string, number> = {};
  for (const clientType of CLIENT_TYPES) counts[clientType] = 0;
  for (const client of clients) {
    if (client.status !== 'active') continue;
    counts[client.clientType] = (counts[client.clientType] ?? 0) + 1;
  }
  const therapist = await therapistsService.countActiveTherapists();
  return { ...counts, therapist } as ClientTypeCounts;
}
