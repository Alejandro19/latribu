// El middleware manda a /login con ?from=<ruta original con query> cuando el
// cliente entra a una ruta protegida sin sesión (ej. tapeó el sticker NFC:
// /training?m=entrenamiento&a=confirmar) — sin esto, el login siempre
// mandaba a "/" sin importar de dónde vino, y esa acción pendiente se
// perdía. Se valida que sea una ruta interna (empieza con "/" simple, no
// "//") para no habilitar un open redirect vía el parámetro from.
export function getSafeRedirectTarget(): string {
  if (typeof window === 'undefined') return '/';
  const from = new URLSearchParams(window.location.search).get('from');
  if (!from || !from.startsWith('/') || from.startsWith('//')) return '/';
  return from;
}

// Cuando el login manda a /set-password (contraseña temporal) en vez de
// directo al destino, hay que reenviar el ?from= original — si no, la
// acción pendiente (ej. el deep-link NFC) se pierde en el desvío.
export function getSetPasswordUrl(): string {
  return `/set-password?from=${encodeURIComponent(getSafeRedirectTarget())}`;
}
