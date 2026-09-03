// Fuente única de verdad para "¿puede este cliente entrar a este módulo
// ahora mismo?" — el topbar y las cards del home deben llamar a esta misma
// función en vez de repetir la condición "vencido + incluido en la matriz"
// cada uno por su lado.
export type ModuleAccessState = "ok" | "expired" | "not_included";

export function getModuleAccessState(
  moduleId: string,
  ctx: { moduleAccess: Record<string, boolean>; planExpired: boolean }
): ModuleAccessState {
  // moduleAccess ya llega resuelto del backend contra la matriz real de
  // Roles y Perfiles (getResolvedModuleAccess, apps/api) — solo contiene los
  // módulos gateados. Una key ausente (ej. "personal-info") nunca es
  // "vencida" ni "no incluida": simplemente no es un módulo de membresía.
  if (!(moduleId in ctx.moduleAccess)) return "ok";
  if (ctx.moduleAccess[moduleId] === false) return "not_included";
  return ctx.planExpired ? "expired" : "ok";
}
