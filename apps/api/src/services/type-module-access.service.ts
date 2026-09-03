import { db } from '../db/index.js';
import { clientTypeModulePermissions } from '../models/schema.js';

// Cache en memoria de la matriz completa tipo-de-cliente × módulo — son pocas
// filas (9 módulos base + los que agregue un admin) así que cachear evita una
// consulta extra en CADA request autenticado. Se invalida en cada guardado
// desde roles.service.ts, así que un cambio en la matriz aplica desde la
// siguiente request de cualquier cliente, sin esperar a que cierre sesión.
let cache: Map<string, boolean> | null = null;

function cacheKey(clientType: string, moduleKey: string): string {
  return `${clientType}::${moduleKey}`;
}

async function loadCache(): Promise<Map<string, boolean>> {
  const rows = await db.select().from(clientTypeModulePermissions);
  const map = new Map<string, boolean>();
  for (const row of rows) {
    map.set(cacheKey(row.clientType, row.moduleKey), row.allowed);
  }
  return map;
}

export function invalidateModuleAccessCache(): void {
  cache = null;
}

// Un (tipo, módulo) que no está en la matriz (ej. un módulo recién creado
// antes de que se le guarde ninguna fila) se trata como no permitido — el
// mismo comportamiento "cerrado por defecto" del sistema anterior.
export async function isModuleAllowedForType(clientType: string, moduleKey: string): Promise<boolean> {
  if (!cache) cache = await loadCache();
  return cache.get(cacheKey(clientType, moduleKey)) ?? false;
}

// Todo módulo gateado por requirePermission(...) en algún router — confirmado
// por grep de apps/api/src/routes/*.ts. 'personal-info' queda afuera a
// propósito: usa requirePersonalInfoAccess, un gate distinto con su propia
// lógica de visibilidad ya correcta en el frontend (CLIENT_NAV).
export const GATED_MODULE_KEYS = ['training', 'nutrition', 'cortisol', 'community', 'evolution', 'rest', 'blindspot'] as const;

// Vista "puedo acceder a este módulo" para un cliente, expuesta en las
// respuestas de auth (ver auth.controller.ts) para que el frontend (topbar,
// candados de módulo) refleje exactamente la matriz de Roles y Perfiles en
// vez de una lista hardcodeada que se desincroniza cada vez que un admin
// edita la matriz. Reusa isModuleAllowedForType (la misma función que usa el
// gate real requirePermission) y replica su segundo chequeo
// (permissions[key] === false) — así este valor nunca puede desincronizarse
// de lo que el backend realmente permite.
export async function getResolvedModuleAccess(
  clientType: string,
  // `clients.permissions` es una columna jsonb sin `.$type<>()` — llega como
  // `unknown` desde Drizzle en cada call site (ver clients.service.ts).
  permissions: unknown
): Promise<Record<string, boolean>> {
  const permissionsMap = (permissions && typeof permissions === 'object' ? permissions : null) as Record<string, boolean> | null;
  const entries = await Promise.all(
    GATED_MODULE_KEYS.map(async (moduleKey) => {
      const allowedByType = await isModuleAllowedForType(clientType, moduleKey);
      const allowedByPermission = !permissionsMap || permissionsMap[moduleKey] !== false;
      // blindspot tiene además un guard hardcodeado aparte
      // (mentoringOnly, blindspot-access.middleware.ts) que la matriz por sí
      // sola no refleja — un admin podría en teoría marcar blindspot:true
      // para otro tipo desde Roles y Perfiles sin que ese guard se entere.
      // AND explícito para que este valor nunca sea más permisivo que los
      // dos gates reales combinados.
      const allowed = moduleKey === 'blindspot' ? clientType === 'mentoring' && allowedByType : allowedByType;
      return [moduleKey, allowed && allowedByPermission] as const;
    })
  );
  return Object.fromEntries(entries);
}
