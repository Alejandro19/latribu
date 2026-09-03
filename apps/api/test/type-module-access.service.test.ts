import { describe, it, expect } from 'vitest';
import { eq, and } from 'drizzle-orm';
import { db } from '../src/db/index.js';
import { clientTypeModulePermissions } from '../src/models/schema.js';
import { isModuleAllowedForType, invalidateModuleAccessCache, getResolvedModuleAccess } from '../src/services/type-module-access.service.js';

describe('type-module-access.service', () => {
  it('reads the seeded matrix correctly', async () => {
    // Sembrado por 2026-08-10-roles-and-profiles-matrix.sql — coaching_1_1
    // siempre tiene training en true.
    expect(await isModuleAllowedForType('coaching_1_1', 'training')).toBe(true);
  });

  it('defaults to false for an (type, module) pair not present in the matrix', async () => {
    expect(await isModuleAllowedForType('coaching_1_1', 'un_modulo_que_no_existe')).toBe(false);
  });

  it('reflects a change on the next call after invalidateModuleAccessCache()', async () => {
    // isModuleAllowedForType cachea toda la matriz en memoria — sin invalidar
    // el cache, un UPDATE directo a la tabla no se vería hasta el próximo
    // reinicio del proceso. invalidateModuleAccessCache() es justo lo que
    // roles.service.ts llama después de cada guardado desde la pantalla de
    // admin, para que el cambio aplique en la siguiente request.
    await isModuleAllowedForType('coaching_1_1', 'community'); // fuerza a llenar el cache

    await db
      .update(clientTypeModulePermissions)
      .set({ allowed: false })
      .where(and(eq(clientTypeModulePermissions.clientType, 'coaching_1_1'), eq(clientTypeModulePermissions.moduleKey, 'community')));

    expect(await isModuleAllowedForType('coaching_1_1', 'community')).toBe(true); // cache viejo, todavía no refleja el cambio

    invalidateModuleAccessCache();
    expect(await isModuleAllowedForType('coaching_1_1', 'community')).toBe(false); // ahora sí

    // Restaura el seed original.
    await db
      .update(clientTypeModulePermissions)
      .set({ allowed: true })
      .where(and(eq(clientTypeModulePermissions.clientType, 'coaching_1_1'), eq(clientTypeModulePermissions.moduleKey, 'community')));
    invalidateModuleAccessCache();
  });
});

describe('getResolvedModuleAccess', () => {
  it('resuelve un módulo bloqueado por la matriz (tipo ausente de la matriz → cerrado por defecto)', async () => {
    const access = await getResolvedModuleAccess('un_tipo_que_no_existe', {});
    expect(access.training).toBe(false);
  });

  it('resuelve un módulo bloqueado por el permiso fino del cliente, aunque la matriz lo permita', async () => {
    // coaching_1_1/training está sembrado en true en la matriz — el AND con
    // permissions.training===false debe seguir bloqueándolo, igual que
    // requirePermission.
    const access = await getResolvedModuleAccess('coaching_1_1', { training: false });
    expect(access.training).toBe(false);
  });

  it('no bloquea un módulo ausente de `permissions` (undefined !== false)', async () => {
    // coaching_1_1/training está sembrado en true en la matriz — una clave
    // ausente en `permissions` (ej. "rest"/"blindspot", que nunca están en
    // el default de clients.permissions) no debe tratarse como bloqueada
    // por esa capa fina.
    const access = await getResolvedModuleAccess('coaching_1_1', {});
    expect(access.training).toBe(true);
  });

  it('blindspot nunca queda accesible para un tipo no-mentoring, ni si la matriz lo marcara true por error de admin', async () => {
    // Simula que un admin marcó blindspot:true para coaching_1_1 desde Roles
    // y Perfiles — el guard mentoringOnly (blindspot-access.middleware.ts)
    // igual bloquearía la ruta real; este AND explícito asegura que el valor
    // client-facing nunca sea más permisivo que eso.
    await db
      .update(clientTypeModulePermissions)
      .set({ allowed: true })
      .where(and(eq(clientTypeModulePermissions.clientType, 'coaching_1_1'), eq(clientTypeModulePermissions.moduleKey, 'blindspot')));
    invalidateModuleAccessCache();

    const access = await getResolvedModuleAccess('coaching_1_1', {});
    expect(access.blindspot).toBe(false);

    // Restaura el seed original.
    await db
      .update(clientTypeModulePermissions)
      .set({ allowed: false })
      .where(and(eq(clientTypeModulePermissions.clientType, 'coaching_1_1'), eq(clientTypeModulePermissions.moduleKey, 'blindspot')));
    invalidateModuleAccessCache();
  });

  it('mentoring sí puede acceder a blindspot cuando la matriz lo permite (sembrado true)', async () => {
    const access = await getResolvedModuleAccess('mentoring', {});
    expect(access.blindspot).toBe(true);
  });
});
