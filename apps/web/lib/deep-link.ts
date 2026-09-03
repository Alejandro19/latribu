const PENDING_ACTION_KEY = 'lt_pending_action';
const PENDING_ACTION_TTL_MS = 60 * 60 * 1000; // 1 hora

export type PendingAction = { m: string; a: string };
type StoredPendingAction = { m: string; a: string; ts?: number };

export function captureIncomingDeepLink(search: string): void {
  const params = new URLSearchParams(search);
  const m = params.get('m');
  const a = params.get('a');
  if (!m || !a) return;
  window.localStorage.setItem(PENDING_ACTION_KEY, JSON.stringify({ m, a, ts: Date.now() }));
}

export function getPendingAction(): PendingAction | null {
  const raw = window.localStorage.getItem(PENDING_ACTION_KEY);
  if (!raw) return null;
  let parsed: StoredPendingAction;
  try {
    parsed = JSON.parse(raw) as StoredPendingAction;
  } catch {
    return null;
  }
  // Un cliente que tapea el sticker pero no termina de loguearse (deja la pestaña
  // abierta, cierra la app, etc.) no debe recibir una sesión fantasma confirmada
  // días después. Si falta ts (valor guardado antes de este fix), no se descarta.
  if (typeof parsed.ts === 'number' && Date.now() - parsed.ts > PENDING_ACTION_TTL_MS) {
    clearPendingAction();
    return null;
  }
  return { m: parsed.m, a: parsed.a };
}

export function clearPendingAction(): void {
  window.localStorage.removeItem(PENDING_ACTION_KEY);
}

export function isTrainingConfirmAction(action: PendingAction | null): boolean {
  return action !== null && action.m === 'entrenamiento' && action.a === 'confirmar';
}
