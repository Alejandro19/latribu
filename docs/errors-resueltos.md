# Errores Resueltos — La Tribu

> Archivo de registro de errores solucionados durante el desarrollo/migración.
> **Propósito**: Documentar cada error y su solución para evitar repetirlo en el futuro.
> 
> **Regla**: Antes de implementar cualquier cambio, revisa si hay un error similar documentado aquí.

---

## Configuración actual de conexión Frontend ↔ API Nuevo

### Arquitectura
- **API Nuevo**: `apps/api/` — Express + TypeScript, puerto `3003`
  - `.env` en `apps/api/.env` con DATABASE_URL, JWT_SECRET, GOOGLE_CLIENT_ID, PORT=3003
  - Comando: `npx tsx watch src/index.ts` 
- **API Antiguo**: `server.js` en raíz, puerto `3001` — **NO USAR, en proceso de migración**
- **Frontend**: `apps/web/` — Next.js 15, puerto `3000`
  - `.env.local` en `apps/web/.env.local` con `NEXT_PUBLIC_API_BASE_URL=http://localhost:3003`
  - Comando: `next dev --port 3000`
- **CORS**: `apps/api/src/app.ts` permite `http://localhost:3000`, `http://localhost:3002`, `https://latribu-oficial.vercel.app`

> ⚠️ **IMPORTANTE**: El `JWT_SECRET` del API nuevo (`apps/api/.env`) es diferente al del API antiguo (`server.js` / root `.env`). Esto es intencional durante la migración: los tokens se generan y verifican dentro del mismo API. No mezclar tokens entre ambientes.

### Endpoints de Auth verificados (API Nuevo)
| Endpoint | Método | Estado |
|---|---|---|
| `/api/auth/login` | POST | ✅ Funciona (credenciales manuales) |
| `/api/auth/google` | POST | ✅ Funciona (Google OAuth) |
| `/api/auth/register` | POST | ✅ Funciona |
| `/api/auth/me` | GET | ✅ Funciona (requiere JWT) |
| `/api/auth/change-password` | POST | ✅ Configurado |
| `/api/config` | GET | ✅ Devuelve googleClientId |

### Flujo de Google Login
1. Frontend (`login/page.tsx`) hace `GET /api/config` → obtiene `googleClientId`
2. Inicializa Google Identity Services con ese `client_id`
3. Usuario hace clic en "Continuar con Google" → Google devuelve `credential`
4. Frontend envía `POST /api/auth/google` con `{ credential }` al API nuevo
5. API nuevo (`auth.controller.ts`) verifica el token con `google-auth-library`, busca/crea el usuario

---

## Errores Registrados

### [2026-04-08] Front nuevo "desaparece" tras refresh — token inválido no redirige a login
- **Contexto**: `apps/web/lib/auth-context.tsx` — `refreshAuth()`, `apps/web/middleware.ts`
- **Error**: Al hacer refresh en una página protegida del front nuevo (`localhost:3000`), la página cargaba brevemente y luego desaparecía (pantalla en blanco o redirección inconsistente a `/login`).
- **Causa**: 
  1. El middleware de Next.js solo verifica la **existencia** de la cookie `latribu_token`, no su validez. Si la cookie existe, permite el acceso a páginas protegidas.
  2. `refreshAuth()` validaba el token contra el API nuevo. Si el token era inválido (JWT_SECRET diferente entre APIs, token expirado), llamaba a `logout()` que limpiaba `sessionStorage` y el estado React, pero la página ya estaba renderizada, causando un flash inconsistente.
- **Solución**: 
  - En el `catch` de `refreshAuth()`, en vez de llamar a `logout()` (que solo actualiza estado local), se usa `clearSession()` + `window.location.href = '/login'` para forzar una navegación completa. Esto permite que el middleware de Next.js evalúe correctamente la ausencia de cookie y redirija a `/login` como es debido.
  - Se eliminó la dependencia circular `refreshAuth` → `logout` → `refreshAuth` del `useCallback`.
- **Prevención**: 
  - **Siempre** que se invalide una sesión (token expirado, cuenta inactiva, JWT_SECRET mismatch), usar `window.location.href` para forzar una recarga completa, no solo `router.push` del cliente. Así el middleware puede re-evaluar el estado real de autenticación.
  - Mantener el `JWT_SECRET` documentado en la sección de Configuración arriba.

### [2026-08-05] Login del front nuevo no conectaba con el backend migrado (cadena de 6 fallos)
- **Contexto**: `apps/api/src/app.ts`, `apps/api/src/index.ts`, `apps/web/lib/api-client.ts`, `apps/web/lib/auth-context.tsx`, `apps/web/middleware.ts`, `apps/web/app/page.tsx`, `apps/web/app/(auth)/login/page.tsx`.
- **Error**: Al intentar loguearse contra la DB de pruebas migrada, la UI mostraba "Error de conexión. Intenta de nuevo." y, tras arreglos parciales, el login "funcionaba" pero rebotaba a `/login` borrando los campos (parecía un refresh).
- **Causa** (varios problemas apilados, cada uno ocultaba al siguiente):
  1. El proceso de `apps/api` no estaba corriendo (nada escuchaba en el puerto 3003) → `fetch` fallaba de raíz.
  2. `app.ts` tenía una ruta mock (`app.post('/api/auth/login', ...)`) registrada **antes** del `authRouter` real — puente temporal que otra IA dejó al no poder instalar el OAuth de Google. Interceptaba todo login y devolvía éxito falso sin tocar la DB. Se comprobó que el login real **no depende** de Google OAuth (`/api/auth/google` sólo se usa para ese flujo y responde 503 controlado si falta `GOOGLE_CLIENT_ID`), así que el mock nunca fue necesario.
  3. `apps/web/lib/api-client.ts` mandaba `credentials: 'include'` en los fetch de login/register, incompatible con `cors({ origin: '*', credentials: true })` del backend — el navegador rechaza esa combinación (`Access-Control-Allow-Origin: *` + `Allow-Credentials: true`) y el `fetch()` lanza una excepción que caía en el `catch` de "Error de conexión" — **curl no lo detecta** porque no aplica reglas CORS, por eso parecía un problema de servidor.
  4. `auth-context.tsx` (envuelve toda la app vía `providers.tsx`) importaba `decodeTokenPayload` y `fetchAuthMe` desde `api-client.ts`, pero ese archivo (reescrito en una migración "Fase 0" simplificada) no los exportaba → rompía el bundle de JS completo, causando que el formulario hiciera submit nativo (recarga y borra campos) en vez de ejecutar el handler de React.
  5. `middleware.ts` sólo lee el token de una **cookie** (`latribu_token`), pero `saveSession()` sólo lo guardaba en `sessionStorage` — el middleware corre en el servidor y no tiene acceso a `sessionStorage`. Además `login/page.tsx` escribía a `sessionStorage` directo en vez de llamar a `saveSession()`, saltándose el fix.
  6. `app/page.tsx` ("/", destino tras login) era un stub sin terminar que hacía `router.push('/login')` incondicionalmente, sin mirar si había sesión — el Bloque 2 (App Shell/Dashboard) del plan de migración aún no existe.
- **Solución**:
  1. Levantar el backend (`npm run dev` en `apps/api`).
  2. Eliminar la ruta mock de `app.ts`; el `authRouter` real ya valida contra la DB.
  3. Quitar `credentials: 'include'` de los fetch de login/register (la app usa Bearer token, no cookies, en el resto de los `*-client.ts`).
  4. Agregar `decodeTokenPayload` (decodifica el JWT en el cliente sin verificar firma) y `fetchAuthMe` (`GET /api/auth/me` con Bearer) a `api-client.ts`.
  5. `saveSession`/`clearSession` ahora también setean/borran la cookie `latribu_token`; `login/page.tsx` usa `saveSession()` en vez de tocar `sessionStorage` directo.
  6. Reemplazar el stub de `/` por una pantalla temporal que usa `useAuth()` para mostrar la sesión activa (nombre, email, rol) y logout, mientras no se migra el AdminHome/Dashboard real.
- **Prevención**:
  - Si el login falla con "Error de conexión" **genérico** (no un mensaje de credenciales), sospechar de CORS o servidor caído antes que de la lógica de auth — probar con `curl` primero (curl ignora CORS, así que si curl funciona y el navegador no, es CORS).
  - No usar `credentials: 'include'` en fetch si la app no usa cookies para auth (revisar si el resto de los `*-client.ts` usan `Authorization: Bearer`).
  - Cualquier archivo "Fase 0 simplificado" que reemplace un módulo compartido (como `api-client.ts`) debe re-exportar todo lo que otros archivos ya importan de él, o el bundle entero se rompe silenciosamente en el navegador (revisar con `grep -rn "from .*api-client"` antes de simplificar).
  - Si el middleware de Next.js valida por cookie, la sesión debe guardarse en cookie, no sólo en `sessionStorage`/`localStorage`.

### [2026-08-05] Tema día/noche del login parpadeaba al refrescar (flash del tema equivocado)
- **Contexto**: `apps/web/app/(auth)/login/page.tsx`, `apps/web/app/globals.css`, `apps/web/app/layout.tsx`.
- **Error**: Al cargar `/login`, la página mostraba brevemente el tema claro (blanco) y luego, tras ~1s, cambiaba al tema correcto según la hora.
- **Causa**: El tema día/noche se calculaba con `useState(false)` + `useEffect(() => setIsNight(...), [])` — React pinta primero con el valor inicial (`false` = día) y recién después de montar en el cliente corrige el valor real, generando un salto visible en cada carga/refresh.
- **Solución**: Se portó el mecanismo del front antiguo (`old_index.html`, sólo se leyó esa sección puntual, no el archivo completo): un `<script>` inline (`dangerouslySetInnerHTML`) que corre **antes de que React hidrate**, calcula `new Date().getHours() < 18` y aplica la clase `theme-login-light`/`theme-login-dark` directo en `document.documentElement`. Los estilos usan variables CSS (`--lh-*`/`--lf-*` en `globals.css`) en vez de clases condicionales de React, así no dependen del ciclo de render. Se agregó `suppressHydrationWarning` en `<html>` (`layout.tsx`) porque React compara el HTML servido vs. el DOM real y marca como "mismatch" un cambio que es intencional (mismo patrón que usa `next-themes`).
- **Prevención**: Cualquier UI que dependa de `Date()`/hora local del dispositivo y deba estar correcta en el primer pintado (sin flash) necesita fijarse con un script síncrono antes de la hidratación de React, no con `useEffect` — `useEffect` siempre corre después del primer paint.

<!-- Formato:
### [YYYY-MM-DD] Título descriptivo
- **Contexto**: ¿Dónde ocurrió? (archivo, módulo, entorno)
- **Error**: Descripción del error/fallo
- **Causa**: ¿Por qué ocurrió?
- **Solución**: ¿Cómo se resolvió?
- **Prevención**: ¿Cómo evitarlo en el futuro?
-->

---

*Última actualización: 2026-08-05*

