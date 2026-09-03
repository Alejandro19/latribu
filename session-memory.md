# session-memory.md

> **Última actualización:** 2026-09-01
> **Propósito:** Resumen ejecutivo por sesión (orden cronológico) y plan de continuidad inmediato para la siguiente sesión.

---

## Resumen Ejecutivo — Sesión 2026-08-05

### 1. Cadena de bugs de login resuelta (front nuevo ↔ back nuevo)

El login de `apps/web` no conectaba con el backend real. Se diagnosticaron y corrigieron 6 problemas encadenados:
- Ruta mock en `apps/api/src/app.ts` que bypaseaba la autenticación real — eliminada.
- `credentials: 'include'` + CORS `origin: '*'` es una combinación inválida en el navegador (curl no lo detecta porque ignora CORS) — se quitó `credentials: 'include'` de todos los fetch de login/registro (la app usa Bearer tokens, no cookies, para la API).
- Faltaban exports (`decodeTokenPayload`, `fetchAuthMe`) en `apps/web/lib/api-client.ts` que rompían el bundle entero de JS.
- `middleware.ts` de Next.js lee la sesión desde una cookie (`latribu_token`), pero `saveSession()` solo escribía en `sessionStorage` — se corrigió para que también setee/borre la cookie.
- `apps/web/app/page.tsx` era un stub que redirigía siempre a `/login` — reemplazado (luego superado por el App Shell real de la otra IA en `app/(app)/`).

### 2. Theming día/noche del login portado del front viejo

Se portó el mecanismo exacto de cambio de color día/noche desde `old_index.html` (solo la sección de login, sin leer el archivo completo) a `apps/web/app/(auth)/login/page.tsx`, vía variables CSS en `globals.css` (`theme-login-light` / `theme-login-dark`) y un script inline bloqueante para evitar flash de tema incorrecto al refrescar. Se corrigió también un warning de hidratación de React agregando `suppressHydrationWarning` al `<html>`.

### 3. Verificación del backend nuevo para operaciones de admin

Se confirmó por curl (login + `/me` + creación/listado de clientes) que el backend nuevo funciona end-to-end para el flujo de admin, aunque el front nuevo todavía no tiene UI de admin propia en ese momento.

### 4. Respaldo en GitHub sin tocar producción

Se creó la rama `backup-migracion-2026-08-05` desde `main` (que estaba 148 commits adelante de `origin/main`, nunca pusheada) y se pusheó a `origin/backup-migracion-2026-08-05`. **Se dejó `origin/main` intacto a propósito**: Vercel deploya producción desde ahí y su `vercel.json` todavía apunta al monolito legacy (`index.html` / `server.js`), así que mezclar ramas ahí rompería el deploy en vivo. Todo el trabajo de la migración (mío + el de la otra IA) se sigue commiteando solo en esa rama de respaldo.

Se aprovechó para corregir gaps del `.gitignore` (`.env.local`, `.env.dev-local`, `.env.*.local`, `vendor/`, `.claude/worktrees/`) — se verificó con `git log --all` / `git log origin/main` que ningún secreto llegó nunca a `origin/main` ni a GitHub en general (solo existía en una rama local nunca pusheada).

### 5. Brief de diseño para la otra IA (`docs/design-system-oura-brief.md`)

Documento 100% textual (la otra IA no recibe imágenes) describiendo el patrón de floating-label inputs, botones pill, layout de checkout y mega-menú de referencia (Oura.com), pero manteniendo el acento dorado/terracota propio de La Tribu en vez del azul de Oura. Se marcó como convención **permanente de todo el proyecto**, no solo de una fase, e incluye una sección de disciplina de alcance (tocar solo lo pedido, no dejar mocks, listar archivos tocados al final).

### 6. Google OAuth funcional + pantalla de transición

El backend ya tenía Google OAuth completo; solo faltaba conectar el front. Se agregó:
- Botón de Google real en `/login`, con pantalla de transición ("anillo" giratorio de 3 colores + "La Tribu" + "Cargando sesión…") que se muestra durante el login por Google, por email/password, y se unificó visualmente con el loading state del AppShell (mismo anillo, mismo texto) — cero discontinuidad visual entre login y entrada a la app.
- Optimización de velocidad: el script de Google pasó a `next/script strategy="beforeInteractive"`, se agregó `<link rel="preconnect">`, y se paralelizó el fetch de `/api/config` con el polling del SDK (antes eran secuenciales y además se pedía la config dos veces por un bug propio, ya corregido).

### 7. Sign in with Apple — implementación completa pero inactiva

A petición explícita del usuario ("front + backend completos"), se implementó el flujo real de Apple completo, dejado **intencionalmente inactivo** hasta que el usuario consiga cuenta de Apple Developer:
- Backend: columna `apple_id` en `admins`/`clients` (migración `tasks/migration-2026-08-05-apple-auth.sql`), `apps/api/src/services/apple-auth.service.ts` (verificación JWKS con `jose`), endpoint `POST /api/auth/apple` (espeja exactamente el patrón de Google, responde 503 si `APPLE_CLIENT_ID` no está seteado), `/api/config` ahora expone también `appleClientId`.
- Frontend: SDK de Apple cargado igual que el de Google, botón "Continuar con Apple" que se renderiza deshabilitado mientras `appleClientId` sea `null` y se activa solo (sin más cambios de código) en cuanto se setee `APPLE_CLIENT_ID` en `apps/api/.env`.
- `packages/shared-types` requirió rebuild (`npm run build`) porque `apps/api` importa el `dist/` compilado, no `src/` directamente.

### 8. Confusión de puertos (front vs. legacy) — resuelta

`npm run dev` en la raíz del repo levanta el **backend legacy** (`nodemon server.js`, puerto 3001 por `PORT` en el `.env` raíz), no el front nuevo. Se agregaron scripts explícitos al `package.json` raíz: `dev:web` (`apps/web`, siempre puerto 3000 — ya estaba hardcodeado) y `dev:api` (`apps/api`, puerto 3003). El script `dev` original se dejó intacto por compatibilidad, con alias `dev:legacy`.

### 9. Commit y push

Todo lo anterior (excepto lo ya commiteado previamente) se commiteó en un solo commit sobre `backup-migracion-2026-08-05` (90 archivos) y se pusheó a `origin/backup-migracion-2026-08-05`.

### 10. Wizard de onboarding restyleado con el design system nuevo

Se aplicaron las guías de `docs/design-system-oura-brief.md` (floating labels, botones pill) al wizard de `/onboarding`, replicando visualmente el layout de "Información Personal" del front viejo. De paso se corrigieron asociaciones rotas `getByLabelText`/`getByRole` en 6 componentes reutilizables de `ui/` (los íconos deben ser hermanos del `<label>`, no hijos, porque el matching de RTL es por `textContent`, no por accessible-name de ARIA).

### 11. Módulo "Dispositivos y Laboratorios" (cliente tipo Mentoring) — nuevo paso 10 del wizard

Pedido explícito: extraer quirúrgicamente (sin leer completos) solo lo referido a wearables/labs de `BIO360Index.html` (732 KB) y `BIO360server.js` (107 KB) —localizados en la raíz del repo junto con los servicios reales de origen, `BIO360routes/` y `BIO360services/`— y portarlo a la arquitectura nueva, visible solo para un tipo de cliente nuevo, "Mentoring".

- **Backend:** 3 tablas nuevas (`wearable_tokens`, `wearable_metricas`, `lab_panels`, RLS `deny_all`, migración `tasks/migration-2026-08-05-dispositivos-laboratorios.sql`); `wearable.service.ts` + `whoop.service.ts` + `oura.service.ts` con OAuth y sync reales; `polar.service.ts` con OAuth real (la sync de métricas ya era un stub vacío en el origen BIO360, se mantuvo igual); Garmin no tenía servicio implementado en ningún lado del código fuente, así que su endpoint responde 503 controlado. `lab-panels.service.ts` con CRUD para los 3 checkpoints (semana 0/6/12) y OCR de 28 biomarcadores (reutiliza el mismo endpoint Google Vision que ya existía para InBody). `clientType` se agregó al payload del JWT para que el front sepa si debe mostrar el módulo sin round-trip extra. Constraint de `clients.client_type` en Postgres actualizado para aceptar `'mentoring'`.
- **Frontend:** `Module10.tsx` (selector de wearable, campos manuales de Apple Health, conectar/sincronizar/desconectar, panel de labs con OCR), agregado como **paso 10 del wizard** solo si `clientType === 'mentoring'` (el resto de tipos de cliente sigue viendo 9 pasos). Tipo "Mentoring" agregado al selector de tipo de cliente en el admin.
- **Activación pendiente:** para que WHOOP/Oura/Polar funcionen de verdad hace falta setear sus credenciales reales (`WHOOP_CLIENT_ID`/`SECRET`, `OURA_CLIENT_ID`/`SECRET`, `POLAR_CLIENT_ID`/`SECRET`) en `apps/api/.env` — hoy están en blanco a propósito y el connect responde 503 hasta que se configuren.
- Cliente de prueba creado en la BD de dev: `mentoring-demo@latribu.test` / `MentoringDemo123!` (tipo `mentoring`) para poder ver el paso 10 en `/onboarding`.

### 12. Fix de la base de datos de test (efecto colateral)

Al correr la suite completa para verificar el módulo de arriba se detectó que la BD de test (`/pruebas` en Supabase, separada de la de dev) estaba desincronizada — le faltaban varias migraciones históricas de sesiones anteriores (apple_id, evolution, community, cortisol, sleep). Se aplicaron todas cronológicamente, bajando los archivos de test rotos de 27 a 8. Los 8 restantes son preexistentes y no relacionados a este módulo (credenciales de Supabase Storage inválidas para test, y una migración vieja de julio con una columna `method` que no aplica limpio) — se dejaron sin tocar por estar fuera de alcance.

### 13. Fix de centrado de floating labels (`FloatingField.tsx`)

El usuario reportó dos bugs visuales en "Información Personal" a partir de capturas: (a) el campo "Ciudad" mostraba el label superpuesto con el placeholder de ayuda "Primero selecciona tu país" porque el código desactivaba por completo el comportamiento flotante cuando había un `placeholder` custom, dejando el label siempre centrado encima del hint; (b) preguntas largas (ej. "¿Cuáles son tus 3 frutas preferidas?") no tenían límite de ancho en el label, así que en pantallas angostas envolvían a 2 líneas y se salían de la caja de 48px. Fix: si hay `placeholder`, el label ahora flota arriba (chico) siempre en vez de desactivar el flotado; se agregó `right-3.5 truncate` a los labels de `FloatingField` y `FloatingTextarea` para que corten con "…" en vez de envolver.

### 14. Rediseño completo del módulo Entrenamiento (vista cliente)

El módulo de Entrenamiento que construyó la otra IA (`TrainingHome`, `TrainingDayView`, `TrainingPlayer`, `SessionConfirmedScreen`) tenía toda la lógica funcional (streak, protector de racha, calendario de disciplina, timers de descanso/duración, share card) pero **cero estilos** — solo `<div>`/`<button>` sin className, texto crudo sin layout. El usuario pidió unir esa lógica con el diseño visual del front viejo. Se extrajo quirúrgicamente el markup/CSS de `index.html` (funciones `renderTrainingHome`, `renderTrainingDay`, `renderTrainingPlayer`, `renderStreakBadge`, `renderWeekProgressCard`, `renderNfcConfirmationScreen`, sin leer el archivo completo) y se portó a Tailwind usando las mismas CSS custom properties que ya existían en `globals.css` (`--ink`, `--terracota`, `--sage`, `--gold`, etc. — el design system nuevo ya coincidía 1:1 con las variables del legacy).

- Nuevo archivo compartido `components/training/TrainingVisuals.tsx` (`ProgressBar`, `MiniRing`, `CategoryIcon`, `CATEGORY_LABELS`) para no duplicar SVGs entre los 3 componentes.
- **Gap de lógica encontrado y corregido:** `TrainingDayView` no tenía forma de volver a Home (sin botón atrás, sin prop `onBack`) — se agregó el prop y se conectó en `TrainingShell.tsx`.
- `SessionConfirmedScreen` pasó a ser un overlay oscuro `fixed inset-0` de pantalla completa (celebración), como en el legacy.
- Se ajustaron 3 tests (`training-home.test.tsx`, `training-player.test.tsx`, `training-shell.test.tsx`) para reflejar cambios de comportamiento intencionales: el acordeón "Nivel de disciplina" ahora arranca colapsado (antes no existía como acordeón), y se desambiguó `/Descanso/` → `/Descanso: \d+s/` porque la nueva tarjeta KPI también muestra la palabra "Descanso" como label estático. 84 tests del módulo pasan; `tsc --noEmit` limpio.
- **Fuera de alcance, no tocado:** el panel de admin de Entrenamiento (`AdminExercisePanel`, fallback `<div><h1>Entrenamiento</h1>` para rol admin) sigue sin estilo — no apareció en las capturas que mandó el usuario.
- **Preexistente, no tocado:** `test/training-home-logic.test.ts` tiene una fecha hardcodeada (`2026-07-29`) que ya quedó en una semana pasada respecto a la fecha real del sistema — falla por paso del calendario, no por este trabajo.

---

## Próximas actividades — Siguiente sesión

### Actividad 1 — Probar en navegador el módulo de Dispositivos y Laboratorios

- Loguearse como `mentoring-demo@latribu.test` / `MentoringDemo123!`, ir a `/onboarding`, confirmar que aparecen 10 pasos (no 9), y que el paso 10 respeta la línea visual del resto del wizard.
- Confirmar que un cliente que NO es tipo `mentoring` sigue viendo solo 9 pasos.

### Actividad 2 — Probar en navegador el rediseño de Entrenamiento

- Ir a `/training` como cliente y confirmar visualmente el hero card, badge de racha, protector, grid de días y el acordeón de disciplina.
- Completar un ejercicio para ver el timer de descanso y la pantalla de celebración (`SessionConfirmedScreen`).
- Si se quiere, estilar el panel de admin de Entrenamiento (`AdminExercisePanel`) — quedó pendiente, fuera de lo pedido esta sesión.

### Actividad 3 — Activar wearables reales cuando haya credenciales

- Setear `WHOOP_CLIENT_ID`/`SECRET`, `OURA_CLIENT_ID`/`SECRET`, `POLAR_CLIENT_ID`/`SECRET` en `apps/api/.env` (no requiere más cambios de código, igual que Apple Sign-In).
- Garmin no tiene servicio portado (no existía en el código fuente de BIO360) — si se necesita, habría que escribirlo desde cero.

### Actividad 4 — Activar Apple Sign-In cuando haya cuenta de desarrollador

- Crear Services ID en Apple Developer, configurar dominio/redirect URI (`{origin}/login`), setear `APPLE_CLIENT_ID` en `apps/api/.env`. No requiere más cambios de código — el botón se activa solo.

### Actividad 5 — Seguir coordinando con la otra IA

- La otra IA sigue construyendo partes del App Shell y páginas de admin/cliente bajo `apps/web/app/(app)/`. Antes de tocar esos archivos, confirmar que no estén en curso de edición activa (para evitar conflictos como el ya visto con `AdminClientDetail.tsx`/`AdminClientList.tsx`, que tuvieron errores de sintaxis que rompían el dev server entero).

---

## Resumen Ejecutivo — Sesión 2026-08-09

### 1. Módulo "Punto Ciego" (Mentoría) construido de punta a punta

Nuevo módulo premium exclusivo del tier Mentoring: Alejandro hace una evaluación inicial y refiere al cliente a un terapeuta externo curado, que da seguimiento (tareas, sesiones) dentro de la plataforma. Se escribió primero un spec completo (`docs/spec-punto-ciego.md`, con la skill `spec-driven-development`) y luego se implementó entero:

- **Backend:** 4 tablas nuevas (`therapists`, `blindspot_cases`, `blindspot_tasks`, `blindspot_session_logs`), rol nuevo de JWT `'terapeuta'` (login propio en `/api/auth/therapist/login`, middleware `therapistOnly`), `blindspot.service.ts` + `blindspot.controller.ts` + `blindspot.routes.ts` (montado en `/api/blindspot`), con separación estricta de privacidad: `adminPrivateNotes` nunca llega al terapeuta, `internalSummary` nunca llega al cliente (verificado con tests, no solo por convención). Alerta de crisis: notificación in-app + email (reusa el patrón nodemailer de `personal-info.service.ts`), con degradación silenciosa a log si no hay SMTP configurado.
- **Frontend:** vistas separadas por rol en una sola ruta `/blindspot` (`AdminBlindspotPanel`, `ClientBlindspotPanel` con `LockedOverlay` si el cliente no es `mentoring`, igual que "Descanso") + un panel de terapeuta completo bajo su propio grupo de rutas `(therapist)`.
- **Regresión propia detectada y corregida:** `drizzle-kit push` reveló que `sleep_logs`/`wearable_tokens`/`wearable_metricas`/`lab_panels` tenían constraints `UNIQUE` compuestos que existían en la BD real pero nunca se habían declarado en `schema.ts` — al hacer push los iba a borrar. Se declararon en el schema antes de aplicar nada.
- **`drizzle-kit push` no es confiable en este repo:** dos veces distintas en esta sesión se quedó colgado esperando una confirmación interactiva de TTY (truncar tabla) que nunca llega en un proceso en background — no es un cuelgue real, es un prompt invisible. Desde entonces, todo cambio de schema se aplica con un script `tsx` desechable que corre SQL directo (`ALTER TABLE ... ADD COLUMN IF NOT EXISTS`, `CREATE TABLE IF NOT EXISTS`), contando filas antes de cualquier operación potencialmente destructiva, y se borra después de usarlo. Aplicado así, sin pérdida de datos, a las dos bases (test y real) en cada cambio de esta sesión.

### 2. Login de terapeutas + sistema de recuperación de contraseña

- Login de terapeutas (`/therapist-login`) rediseñado para compartir la misma esencia visual que `/login` (logo, slogan, tema día/noche, splitscreen) pero sin Google/Apple ni registro.
- **Bug encontrado y corregido:** el `AuthProvider` global (envuelve toda la app, incluida `/therapist`) valida el token contra `/api/auth/me` en cada carga de página; ese endpoint no reconocía el rol `terapeuta` y caía al branch de cliente → 404 → cierre de sesión forzado. Se agregó el branch faltante en `me()`.
- Sistema de "¿Has olvidado tu contraseña?" genérico por email (busca en admins/clientes/terapeutas, misma respuesta siempre exista o no la cuenta), tabla `password_reset_tokens` (token de un solo uso, expira en 1h), página compartida `/reset-password`.
- Contraseña temporal para terapeutas: el admin les asigna una al crearlos (`mustChangePassword: true`); en su primer login se les fuerza a `/therapist/set-password` antes de dejarlos entrar, reemitiendo un token limpio al terminar.
- "Recuérdame" en ambos logins: solo persiste el email en `localStorage`, nunca la contraseña en texto plano (el gestor de contraseñas del navegador ya cubre eso de forma segura vía `autoComplete`).
- Tarjetas de login estandarizadas a un alto fijo (`md:min-h-[600px]`) para que no cambien de tamaño según cuántos botones tengan.

### 3. Numeración de casos, navegación y buscador

- `blindspot_cases.case_number`: columna `serial` de Postgres, se asigna sola en orden de creación. Se muestra como `#N` en los tres paneles (admin, terapeuta, cliente).
- Módulo "Punto Ciego" agregado a la navegación real (`ADMIN_NAV`/`CLIENT_NAV`/`VIEW_TO_PATH` en `lib/constants.ts`) — antes solo era alcanzable por URL directa. En el panel de cliente usa el mismo candado 🔒 que "Descanso" si el `clientType` no es `mentoring`.
- Buscador/filtro de casos en el panel admin y en el panel de terapeuta.

### 4. Rediseño completo del panel de terapeuta ("Punto Ciego")

Sidebar nuevo (`TherapistSidebar.tsx`) con los 7 módulos pedidos (Mi perfil, Mis casos, Mis clientes, Mi agenda, Recursos clínicos, Comunidad de terapeutas, Dashboards), resaltado del módulo activo reusando el patrón real que ya usa el admin (`--terracota`/`--terracota-soft` — no existe un token "coral" en `globals.css`, se reusó el existente para mantener consistencia real con el resto de la app), bloque de cuenta fijo abajo (avatar + nombre + "Terapeuta") con "Cerrar sesión". Todo vive como un mini-SPA dentro de `/therapist` (`TherapistShell.tsx`), sin rutas nuevas por módulo — los 6 módulos no construidos muestran un placeholder "Próximamente".

Único módulo construido a fondo: **Mis casos** (`TherapistCasesModule.tsx`, reemplaza a `TherapistBlindspotPanel.tsx`) — tabs Activos/En crisis/Cerrados con contador, lista con avatar+inicial, nombre+#caso, motivo corto y "última sesión hace...", badge de estado; detalle con grid de datos personales de solo lectura (Nombre, Cédula, País, Ciudad, Email, Celular), motivo/área lado a lado con labels en mayúsculas trackeadas, botón sólido de crisis con confirmación, checklist de tareas con círculo-checkbox, y "Registrar sesión" con selects de igual alto y botón negro de guardar.

- **Dato nuevo que no existía:** "Cédula" no estaba en ningún lado del modelo (`personal_info`). Se agregó la columna (migración aditiva, segura) y se expone de solo lectura al terapeuta vía `therapistGetCase`, pero **no se construyó un formulario de admin para cargarla** — hoy el admin tampoco tiene edición de ningún otro dato personal, solo lectura. Pendiente de decisión del usuario si se quiere ese formulario.
- **Decisión de seguridad tomada sin preguntar:** el spec pedido decía que el "resumen interno" de sesión lo ven "tú y el cliente", pero eso contradice la barrera de privacidad ya probada por tests (el cliente nunca debe ver `internalSummary`). Se dejó el texto original ("solo tú y Alejandro lo ven") en vez de implementar literalmente lo pedido. **Pendiente de confirmación del usuario.**
- `therapistListCases`/`therapistGetCase` se enriquecieron en el backend con nombre del cliente, fecha de última sesión y los datos personales de solo lectura (antes el terapeuta no tenía acceso a ninguno de estos datos).

### 5. Verificación

`tsc --noEmit` limpio en ambas apps en cada paso. Suite de backend sin regresiones (auth: 17→31 tests con los nuevos de forgot/reset/mustChangePassword; blindspot: 14 tests). `next build` compila todo lo nuevo — solo falla en el mismo bug preexistente y no tocado de `AdminClientDetail.tsx` (mismatch de tipos en `PersonalInfo`, fuera de alcance, ya reportado en sesiones anteriores). Fallas preexistentes no relacionadas confirmadas de nuevo: credenciales de Supabase Storage inválidas en test, un test de login obsoleto (`login-page.test.tsx`) que prueba una lógica de `router.push` que ya no existe desde el rediseño "Fase 0", y flakiness conocida por fecha relativa/timeout en `training-home-logic.test.ts`/`wizard-shell-*.test.tsx`.

### 6. Estado del working tree al cerrar la sesión

`old_index.html` (tracked, borrado) e `index.html` (nuevo, sin trackear) en la raíz quedaron **fuera del commit de esta sesión a propósito** — tocan el archivo que Vercel deploya en producción desde `origin/main` (ver Notas adicionales) y ese cambio no fue parte de ningún pedido de esta sesión ni se investigó su origen. `BIO360Index.html`/`BIO360server.js` y los binarios `apps/api/*.traineddata` se movieron a `.gitignore` (ya eran "sin trackear a propósito" mencionado en la sesión 2026-08-05, pero no estaban en `.gitignore` todavía, así que un `git add -A` los habría capturado por error).

---

## Próximas actividades — Siguiente sesión

### Actividad 1 — Decidir sobre "Cédula" y el texto del resumen interno

- Confirmar si se quiere un formulario de admin para cargar la cédula (y de paso el resto de datos personales, que hoy tampoco son editables desde el panel admin).
- Confirmar el texto correcto de la etiqueta "Resumen interno" en Registrar sesión — hoy dice "solo tú y Alejandro lo ven", el pedido original decía "tú y el cliente", lo cual no puede ser cierto sin romper la privacidad ya garantizada por tests.

### Actividad 2 — Probar en navegador el panel de terapeuta rediseñado

- Loguearse con una cuenta de terapeuta, confirmar navegación entre los 7 módulos del sidebar, y probar el flujo completo de "Mis casos": tabs, buscador, marcar crisis, agregar/completar/omitir tareas, registrar sesión.
- Probar el flujo de "olvidé mi contraseña" end-to-end en ambos logins (clientes y terapeutas) con SMTP real o revisando el link en los logs del backend si no hay SMTP configurado.

### Actividad 3 — Revisar `old_index.html` / `index.html` en la raíz

- Antes de cualquier commit futuro, entender por qué `old_index.html` (tracked) aparece borrado y hay un `index.html` nuevo sin trackear — no se tocó ni se investigó en esta sesión porque no fue parte de ningún pedido y el archivo es el que usa producción en Vercel.

### Actividad 4 — Construir los 6 módulos placeholder del panel de terapeuta

- Mi perfil (reusar la estética de rachas/medallas ya usada con clientes), Mis clientes, Mi agenda, Recursos clínicos, Comunidad de terapeutas, Dashboards — hoy son solo navegación + "Próximamente".

---

## Resumen Ejecutivo — Sesión 2026-08-09 (tarde) — Sistema de diseño premium (fase 2)

Continuación del sistema de diseño premium (Apple/Oura/Vercel) ya iniciado en fases anteriores de esta misma sesión larga (topbar horizontal para cliente y terapeuta, hero espresso/piedra, tokens nuevos). Esta parte cubrió dos prompts nuevos del usuario:

### 1. Corrección de jerarquía de contenedores (los 3 paneles)

Se eliminó el patrón de "card completa apilada" (fondo blanco + borde + radio) para todo el contenido secundario debajo de cada hero, en los 8 módulos de cliente, terapeuta (Mis casos) y ~20 archivos de admin — reemplazado por secciones abiertas separadas con `border-top` de 1px y padding vertical, dejando el borde completo solo para controles clicables (tabs, chips, filas de listado). Se agregó `mt-8` entre el topbar y el primer hero de cada pantalla, y se corrigieron badges que flotaban sueltos junto al hero (ej. racha "🔥 en riesgo" en Entrenamiento, ahora integrada dentro del hero).

### 2. Formularios: agrupación, tipografía, íconos, paleta

- **Cards agrupadas estilo Oura** en los 10 módulos de "Información Personal": se agregó metadata `group` (opcional) a `WizardFieldConfig` en `packages/shared-types/src/wizard.ts` (requirió `pnpm run build` en ese paquete para que `apps/web` viera el tipo nuevo, ya que importa el `dist/` compilado) y se anotó cada campo de `lib/wizard-modules.ts` con su grupo temático. `WizardShell.tsx` parte los campos de cada módulo en cards contiguas por grupo, cada una con ícono de línea (16px) + eyebrow mayúsculas. Módulo 3 (Composición Corporal) y Módulo 10 (Dispositivos y Laboratorios) — que son `custom` y no pasan por ese pipeline — recibieron el mismo tratamiento visual a mano, a pedido explícito del usuario tras una primera pasada incompleta.
- **Jerarquía tipográfica pregunta/respuesta**: label 12px/400/`--ink-secondary` siempre estático arriba, valor 14.5px/600/`--ink` abajo — reemplaza el floating-label animado que tenía `FloatingField.tsx` (ahora es un label fijo, ya no flota). Aplicado en todos los componentes compartidos de formulario (`FloatingField`, `SelectField`, `TimeField`, `SegmentedControl`, `ChevronStepper`, `SliderField`, `ChipGroup`) y en los `fieldStyle`/`labelStyle` locales de ~10 paneles admin/terapeuta.
- **`SelectField.tsx` — bug real encontrado y corregido**: el placeholder ("Seleccionar") nunca se mostraba visualmente cuando el campo estaba vacío — el `<span>` que dibuja el valor por encima del `<select>` nativo transparente mostraba string vacío en vez del placeholder, así que todo select sin valor se veía completamente en blanco. Corregido para mostrar "Seleccionar" en gris cuando no hay valor.
- **Emojis → íconos de línea**: nuevo archivo `components/ui/icons.tsx` con ~35 íconos SVG hand-rolled (mismo criterio que ya usaba la app, no se agregó ninguna librería de íconos como dependencia). Reemplazados todos los emojis reales encontrados por grep de rangos Unicode (🔥🔒🔔🏆🎖️📎📸🔀⚠️✅🧊🧘🏃🤝💆🩺🥗🧠), incluyendo los que se dibujaban con `fillText` en el canvas de la tarjeta de Instagram (`lib/training-card.ts` — se reemplazaron por funciones que dibujan trofeo/medalla como paths de canvas). El símbolo ✓ (check mark plano, no emoji de color) se dejó igual a propósito.
- **Chips/botones fuera de paleta — bug real encontrado y corregido**: `components/ui/ChipGroup.tsx` (el componente compartido detrás de TODOS los selectores múltiples: proteínas, carbohidratos, probióticos, suplementos, etc. en el onboarding) tenía naranja sólido hardcodeado (`var(--terracota)`) para el estado seleccionado — nunca se había retokenizado en ninguna fase anterior. Corregido al patrón de paleta (`--ink` sólido/pill). También corregido el dropzone de `FileField.tsx` (antes borde naranja sólido, ahora punteado) y luego, a pedido de seguimiento, hecho más visible (fondo con tinte, borde más marcado, ícono de clip dentro del recuadro — antes pasaba desapercibido).
- **Sliders**: `SliderField.tsx` tenía caja blanca + borde + verde viejo (`#5B7A4E`) sin retokenizar — ahora es un track delgado sin caja, con `accent-color` del dorado de marca.

### 3. Bug real encontrado detrás del error "preexistente" de toda la sesión

`components/nutrition/NutritionPdfGenerator.tsx` fallaba el build con "Modifiers cannot appear here" desde antes de que empezara este trabajo — se había reportado repetidamente como "preexistente, fuera de alcance". Al tocar este archivo para quitarle un emoji se encontró la causa real: a la función `mdBold` le faltaba la llave de cierre `}`, lo que corría todo lo demás dentro de su cuerpo y dejaba una llave extra sobrante al final del archivo. Corregido (dos líneas) — `next build` ahora compila 100% limpio, sin ningún error.

### 4. Incidente de `git stash` — corrupción y recuperación completa

Al comparar si un test roto era preexistente, se encadenó `git stash && npx vitest run ... && git stash pop` en un solo comando con timeout de 60s. El timeout mató el proceso a mitad del `git stash pop`, dejando ~15 archivos revertidos a su versión de antes de la sesión (incluyendo el borrado completo de `FloatingField.tsx`). Se diagnosticó comparando los 116 archivos del stash contra el disco uno por uno (`git show stash@{0}:<path>` vs archivo real) y se restauró cada uno exacto (`git checkout stash@{0} -- <path>`), verificado luego byte a byte. El stash se dropeó al final, ya verificado con `tsc`, `next build` y la suite de tests. **Ningún archivo del diseño de hoy se perdió.**

### 5. Tests corregidos y hallazgos de arquitectura preexistente (no tocados)

Corregidos por regresión real de esta sesión o por mocks incompletos: `admin-training-panel.test.tsx` (faltaban mocks de `getAchievements`/`getStreak`, usados por el `AdminAchievementsPanel` agregado en una fase anterior), `training-home-logic.test.ts` (fecha hardcodeada que ya había quedado en el pasado — se fijó el reloj con `vi.useFakeTimers`), `training-home.test.tsx` y `phrases-panel.test.tsx` (queries por texto de emoji que ya no existe, actualizadas), `client-detail-page.test.tsx` (reescrito completo).

**Hallazgos de arquitectura preexistente, NO corregidos hoy (fuera de alcance, requieren decisión de producto):**
- **`client-detail-page.test.tsx` (ya corregido, pero reveló esto):** el historial de antropometría/InBody y el resumen de logros que este test esperaba ver en la página de detalle de cliente ya no se muestran ahí — un refactor real anterior a esta sesión movió esa información a "Mi Evolución" (antropometría/InBody) y al tab de Entrenamiento (`AdminAchievementsPanel`, logros). El test se reescribió para reflejar la arquitectura actual.
- **`login-page.test.tsx` (5 tests, fallo consistente, NO flaky):** `components/auth/LoginForm.tsx` — el componente que contiene la lógica real de redirección por rol/onboarding (admin→`/admin/clients`, onboarding incompleto→`/onboarding`, completo→`/training`, acción NFC pendiente→`/training`) — **no lo importa ningún archivo del proyecto**. `app/(auth)/login/page.tsx` (el que de verdad se usa) hace `window.location.href = '/'` sin condicionales, tanto para login por contraseña como por Google. Es un refactor a medias de antes de esta sesión. **Pendiente de decisión:** o se conecta `LoginForm.tsx` de verdad, o se borra como código muerto y se reescriben/eliminan estos tests.
- **`wizard-shell-finalize.test.tsx` (flaky, no determinístico):** sus 5 tests recorren los 9 pasos reales del wizard de punta a punta (~8-14s cada uno) — pasan siempre en aislamiento (verificado dos veces), pero fallan intermitentemente bajo la contención de CPU de la suite completa (~311 tests). Es un tradeoff ya documentado en los comentarios del propio archivo de test, no una regresión de esta sesión.
- Credenciales de Supabase Storage inválidas en el entorno de test — ya reportado en la sesión anterior (2026-08-09, sección "Fix de la base de datos de test"), sigue sin resolverse, no es de este trabajo.

### 6. Verificación final

`tsc --noEmit` limpio, `next build` 100% limpio (0 errores, incluyendo la ruta de nutrición que antes fallaba). Suite de tests: 302/311 pasan; los 9 restantes son los dos hallazgos preexistentes de la sección anterior (login-page: determinístico; wizard-shell-finalize: flaky), no regresiones de hoy.

---

## Próximas actividades — Siguiente sesión (actualizada 2026-08-09 tarde)

### Actividad 1 — Decidir sobre `login-page.test.tsx` / `LoginForm.tsx`

- Confirmar si se quiere restaurar el ruteo inteligente post-login (admin/onboarding-incompleto/training/acción-NFC-pendiente) conectando `components/auth/LoginForm.tsx` de verdad en `app/(auth)/login/page.tsx`, o si se prefiere borrar `LoginForm.tsx` como código muerto y simplificar/eliminar esos 5 tests para que reflejen el comportamiento actual (siempre redirige a `/`).

### Actividad 2 — Revisar flakiness de `wizard-shell-finalize.test.tsx`

- Si molesta en CI o en runs locales, evaluar correr ese archivo aislado (`vitest run test/wizard-shell-finalize.test.tsx`) o con `--pool=threads --poolOptions.threads.singleThread` en vez de subir más los timeouts — no es una regresión de código, es contención de CPU en la suite completa.

### Actividad 3 — Revisar visualmente en `dev:web` los cambios de hoy

- Cards agrupadas de Información Personal (los 10 módulos, incluidos 3 y 10), selects con "Seleccionar" visible, dropzones de archivo más visibles, jerarquía tipográfica label/valor, chips sin naranja, sliders sin caja, y la corrección de jerarquía de contenedores en los 3 paneles.

### Actividad 4 — Construir los 6 módulos placeholder del panel de terapeuta

- (Sigue pendiente de la sesión anterior, sin tocar hoy.) Mi perfil, Mis clientes, Mi agenda, Recursos clínicos, Comunidad de terapeutas, Dashboards.

---

## Resumen Ejecutivo — Sesión 2026-08-10 — Login, topbar admin, Cortisol por emoción, cards agrupadas

Sesión larga con varios pedidos encadenados del usuario. Todo en `apps/web`/`apps/api`, cero cambios en `server.js`/`index.html` (raíz).

### 1. Rediseño del login (cliente/admin y terapeuta)

Aplicado el prompt v2 del usuario (`login/page.tsx`, `therapist-login/page.tsx`): panel izquierdo `#2A2015` exclusivo de login (no reemplaza `--hero-espresso` en el resto de la app), halo radial + anillo de marca conic-gradient, panel derecho siempre `--page-bg` (se eliminó el sistema de tema día/noche `theme-login-light/dark` que hacía que el panel se viera oscuro según la hora — esa era la causa real del reclamo de legibilidad). Card `rounded-[20px]` + sombra. Los puntos 1 (bug de encoding) y 3 (logos sociales faltantes) del prompt se investigaron a fondo y **no existían** en el código actual — no se tocó nada ahí.
Iteración posterior: Google y Apple en una sola fila (antes apilados), textos cortos "Google"/"Apple", Google SDK a `theme:'outline'`/ancho 170px para que quepa junto a Apple. "¿Olvidaste tu contraseña? Recupérala" separado en texto+link (mismo patrón que el link de registro).
**Bug real encontrado y corregido:** el botón de Google desaparecía al navegar entre login/registro/recuperar y volver — `google.accounts.id.renderButton()` pinta un nodo del DOM concreto que se desmonta con cada cambio de `view`; el `ref` de objeto + efecto con `deps: []` nunca volvía a pintar en el nodo nuevo. Corregido con un callback ref (`setGoogleButtonNode`) que repinta cada vez que el nodo se remonta.
**Pendiente sin resolver, flagueado al usuario:** `reset-password/page.tsx` y `therapist/set-password/page.tsx` siguen con el sistema de tema día/noche viejo (`--lf-*` en `globals.css`) — quedarán visualmente inconsistentes con el login nuevo hasta que se decida si se migran también.

### 2. Panel admin: topbar horizontal reemplaza el sidebar vertical

A pedido explícito del usuario (revierte la decisión de la Fase 4 del plan de diseño premium, que dejaba a admin con sidebar). Nuevo `components/layout/AdminTopbar.tsx` (mismo patrón que `ClientTopbar`/`TherapistTopbar`: gradiente piedra, tabs con subrayado animado, dropdown de cuenta, colapso a drawer <1280px), con "Administración" como dropdown propio (Clientes/Frases/Roles). `AppShell.tsx` ahora siempre usa layout de columna (topbar arriba, sin fila+sidebar).
Se quitó "Información Personal" del propio menú del admin (llevaba a `/onboarding`, que es el wizard de datos del CLIENTE — el admin no tiene datos propios ahí, por eso siempre salía "no disponible"; ahora esa info se gestiona por cliente desde Administración → Clientes).
**Borrados por quedar sin uso:** `Sidebar.tsx`, `AdminNavItems.tsx`, `SidebarRing.tsx`, `UserChip.tsx`, `MobileTopbar.tsx`, y la constante `MODULE_THEME` en `lib/constants.ts` (solo la consumía `SidebarRing`).

### 3. Nutrición: PDF generado en vez de subida manual

El botón "Ver PDF"/subida manual del admin (`nt-pdf`) dependía de que alguien subiera un archivo a mano. Se restauró el generador de PDF de marca de la arquitectura anterior (`downloadNutritionPdf`, portado de `old_index.html:3865-3969` vía `git show HEAD:old_index.html`, ya que el archivo está borrado en el working tree pero sigue en el historial) — genera el documento completo (portada, macros, menú, recomendaciones, suplementos, cierre) a partir de los datos vigentes del plan, sin depender de un archivo subido. Botón "Descargar PDF" junto a "Ver más" en el panel cliente. Se quitó el input de archivo del panel admin (`AdminNutritionPanel.tsx`) y el estado/función que ya no se usaban.

### 4. Módulo Frases (admin) — restyle completo

`QuotesPanel.tsx` y `PhrasesPanel.tsx` no tenían ni una clase de estilo (HTML sin estilar desde siempre, nunca migrado). Reescritos con el mismo lenguaje visual que el resto del admin (cardStyle, labelStyle, fieldStyle, botones pill).

### 5. Roles y Perfiles — quitar "Agregar módulo", agregar "Eliminar módulo"

Se quitó `RolesAddModuleBar.tsx` (y `createModule`/`listModules` de `lib/roles-client.ts`, sin más consumidores) a pedido del usuario. Como el usuario había creado un módulo custom de prueba desde esa barra y pidió borrarlo, se agregó la capacidad de eliminar (backend: `deleteModule` en `roles.service.ts`/`roles.controller.ts`, ruta `DELETE /admin/roles/modules/:key`, solo permite borrar módulos `isCustom: true`, nunca los del sistema; frontend: botón "Eliminar" junto a cada módulo custom en `RolesMatrixTable.tsx`) — el usuario lo borra él mismo desde ahí.

### 6. Sistema de notificaciones — activado de cero

La campanita (`NotificationBell.tsx`) y la página `/admin/notifications` ya existían en el frontend pero pegaban a `/api/admin/notifications` y `/api/clients/:id/notifications`, que **no existían en el backend** (404 "Endpoint no encontrado") — las tablas `admin_notifications`/`client_notifications` ya estaban en el schema y varios servicios ya insertaban filas ahí, pero nadie las leía. Se construyeron `notifications.service.ts`/`.controller.ts`/`.routes.ts` (list + mark-as-read para ambos, montadas en `app.ts`). Se corrigió `NotificationBell.tsx` para consumir camelCase (`createdAt`/`clientId`, no `created_at`/`client_id` como el resto de la app ya migrada) y se le agregó marcar-como-leída + link "Ver cliente" (antes solo existían en la página de admin separada). Se borró esa página/componente (`admin/notifications/page.tsx`, `AdminNotificationsPanel.tsx`) y el ítem "Notificaciones" del nav admin — la campanita es ahora la única UI de notificaciones.

### 7. Cards agrupadas — panel admin y panel cliente

**Admin:** los 10 paneles admin (`Admin{Nutrition,Cortisol,Training,Rest,Evolution,Blindspot,Community}Panel`, `RestToolsAdminPanel`, `AdminAchievementsPanel`, `AdminClientDetail`) compartían el mismo `cardStyle` local con solo `borderTop` (sin caja real) — cambiado a caja completa (fondo `--paper`, borde, `--radius-card`, `marginBottom: 20`) en los 10 a la vez. Mismo arreglo en `AdminClientList.tsx` (bloques inline propios, no usaban `cardStyle`) y `RolesMatrixTable.tsx`.
**Cliente:** Entrenamiento, Nutrición, Gestión de Cortisol, Hackeando el sueño y Mi Evolución usaban `<section className="border-t border-[var(--border-hairline)] py-6">` (línea superior plana, sin caja) — convertido a `rounded-[var(--radius-card)] border border-[var(--border-hairline)] bg-[var(--paper)] p-6 mb-5` en todos los archivos (`TrainingHome.tsx`, `ClientNutritionPanel.tsx`, `ClientCortisolPanel.tsx`, `ClientRestPanel.tsx`, `EvolutionVisuals.tsx` — 5 sub-secciones ahí, incluyendo fusionar "Tu evolución física" + "KPIs principales" en una sola card ya que antes eran dos divs adyacentes sin borde inferior/superior). Punto Ciego y Comunidad ya estaban bien (no se tocaron).
De paso, las citas/mantras de Entrenamiento y Nutrición (antes un `<p>` con solo `border-b`, inconsistente) se migraron al componente compartido `MantraCard.tsx` que ya usaban Descanso/Evolución/Comunidad — se le agregó un prop `author` opcional para que Entrenamiento (que usa `MindsetQuote` con autor, no el banco de mantras genérico) también pudiera reusarlo.

### 8. Cortisol — técnica asignada por emoción

Antes, el hero "Recomendada para ti ahora" y el botón "Empezar técnica" adivinaban la técnica buscando una cuyo `title` coincidiera textualmente (case-insensitive) con un string hardcodeado en `CORTISOL_RECOMMENDATIONS` — frágil, no configurable. Se agregó columna `emotion` a `cortisol_techniques` (migración directa por script `tsx`/`postgres` desechable, aplicada a `DATABASE_URL` y `TEST_DATABASE_URL` — nunca `drizzle-kit push`, ver nota de memoria existente) + `CortisolTechniqueInputSchema` en `packages/shared-types` (requirió `pnpm run build` ahí). Admin ahora asigna, al crear/editar una técnica, la emoción a la que corresponde (select + badge dorado en la lista). Cliente: `matched = techniques.find(t => t.emotion === emotion)` manda sobre el fallback hardcodeado; "Empezar técnica" abre exactamente esa técnica.

### 9. Acordeón admin — Composición corporal con datos reales

`OnboardingSummaryAccordion.tsx` (usado en `AdminClientDetail.tsx`) solo mostraba las respuestas del wizard inicial + un texto "mira Mi Evolución". Ahora trae y muestra ahí mismo (nuevo prop `clientId`, reusa `getEvolutionData` de `evolution-client.ts` y `getPhotos` de `personal-info-client.ts`, mismos endpoints que Mi Evolución): medidas antropométricas por fecha, registros InBody completos (talla/altura, peso, peso ideal/`pesoObjetivo`, SMM, masa ósea/`masaOsea`, % grasa, IMC, grasa visceral, agua corporal ECW/TBW, BMR, link al archivo) y miniaturas de fotos de progreso.

### 10. Verificación

`tsc --noEmit` y `next build` limpios en `apps/web` y `apps/api` en cada paso. Suite web completa corrida varias veces: siempre los mismos ~5-11 fallos de la baseline ya documentada (`login-page.test.tsx` determinístico, `wizard-shell-*.test.tsx` flaky bajo carga — varía cuál de los archivos `wizard-shell-*` falla según la corrida, nunca en aislamiento), cero regresiones nuevas atribuibles a esta sesión. Suite de `apps/api`: mismos fallos preexistentes de siempre en `storage.test.ts`/`rest-tools.routes.test.ts` (credenciales de Supabase Storage inválidas en el entorno, ya documentado en sesiones anteriores) — tests dirigidos a lo tocado hoy (`roles.routes.test.ts`, `cortisol-techniques.routes.test.ts`) pasan completos salvo esos mismos 2 de storage.

---

## Próximas actividades — Siguiente sesión (actualizada 2026-08-10)

### Actividad 1 — Decidir sobre `login-page.test.tsx` / `LoginForm.tsx`

- (Sigue sin resolver desde 2026-08-09 tarde.) Confirmar si se quiere restaurar el ruteo inteligente post-login conectando `components/auth/LoginForm.tsx` de verdad en `app/(auth)/login/page.tsx`, o si se prefiere borrar `LoginForm.tsx` como código muerto y simplificar/eliminar esos 5 tests.

### Actividad 2 — `reset-password` / `therapist/set-password` con el tema día/noche viejo

- Estas dos pantallas siguen usando `theme-login-light/dark` (`--lf-*` en `globals.css`), ahora visualmente inconsistentes con el login rediseñado (`#2A2015`/`--page-bg` fijos). Decidir si se migran al mismo patrón fijo.

### Actividad 3 — Revisar flakiness de `wizard-shell-finalize.test.tsx` (y afines)

- (Sigue sin resolver.) No es una regresión de código, es contención de CPU en la suite completa — evaluar `--pool=threads --poolOptions.threads.singleThread` o correr ese archivo aislado en CI si molesta.

### Actividad 4 — Revisar visualmente en `dev:web` los cambios de hoy

- Topbar admin (colapso <1280px, dropdown de Administración), campanita con marcar-como-leída y "Ver cliente", botón "Descargar PDF" en Nutrición, técnica por emoción en Cortisol (asignar en admin → verificar que "Empezar técnica" abra la correcta en cliente), cards agrupadas nuevas en los 5 módulos de cliente + 10 de admin, Composición corporal con datos reales en el detalle de cliente.

### Actividad 5 — Construir los 6 módulos placeholder del panel de terapeuta

- (Sigue pendiente de sesiones anteriores, sin tocar.) Mi perfil, Mis clientes, Mi agenda, Recursos clínicos, Comunidad de terapeutas, Dashboards.

---

## Resumen Ejecutivo — Sesión 2026-08-15 — Nutrición/Club/Retiros, Índice de bienestar, membresías Explorador/Premium, fotos en Comunidad

### 1. Testing NFC/QR en el celular vía túneles de cloudflared

Se diagnosticó y resolvió una cadena de bloqueos para poder probar el flujo NFC→confirmar-sesión desde el teléfono en la misma wifi que la Mac: `localhost` en una URL apunta al propio teléfono (no a la Mac) → se pasó a la IP LAN → HTTPS-Only Mode del navegador bloquea HTTP plano → Google OAuth rechaza orígenes de IP privada por completo → solución final: túneles `cloudflared` (`brew install cloudflared`), que además se caían solos por QUIC/UDP degradado en la red del usuario — corregido agregando `--protocol http2`. Los `.env.local` de `apps/web` se fueron actualizando con las URLs de túnel según iban rotando.

### 2. Ronda de bugs desde capturas de mobile

- Botones de Google/Apple desalineados en mobile: causa raíz un `width:170` fijo en `renderButton` de Google; se probó ancho dinámico y luego `ResizeObserver` (inestable, encogía el botón de Apple) — se resolvió con una altura fija `GOOGLE_APPLE_BUTTON_HEIGHT = 44` para ambos.
- Menú hamburguesa no abría en los 3 topbars: un `transform` inline siempre pisaba la clase `.open` — se sacó el inline y se agregó la regla base en CSS.
- Notificaciones desbordaban en mobile; anillo de macros de Nutrición desbordaba en mobile.
- Doble llamada a `confirmSession` bajo React Strict Mode (dev) causaba un 500 espurio — un `useRef` guard evita que el branch NFC corra dos veces por instancia de página.
- Cierre de sesión prematuro en blips de red justo después de loguearse: `refreshAuth()` trataba CUALQUIER fallo de `/auth/me` como token inválido — se agregó `AuthInvalidError` (solo en 401/403) + reintentos con backoff antes de limpiar la sesión.
- Desalineación vertical de campos en Módulos 2/6/8 del wizard de onboarding: `ChevronStepper`/`SliderField`/`TimeField` dibujan su label en fila propia arriba de la caja, distinto a `SelectField`/`FloatingField` — se corrigió una vez armando el emparejamiento de filas (`WizardShell.tsx`), pero quedó un bug real: `slider` no estaba en el set `EXTERNAL_LABEL_TYPES` que dispara la corrección de alto — con datos cargados (texto en negro, no placeholder) el desalineamiento se hacía obvio. Corregido agregando `slider` al set.

### 2b. Explorado y descartado: `LoginForm.tsx`/`login-page.test.tsx`

No se tocó — sigue como Actividad 1 pendiente (ver abajo).

### 3. Nutrición — rediseño de hero, Recetas saludables, Tips and tricks, reposicionamiento de marca (7 fases)

Prompt grande de 4 partes ejecutado con flujo research→plan→clarificar→aprobar→ejecutar (3 agentes Explore + 1 Plan + 4 `AskUserQuestion`, todas con la opción recomendada):
- **Hero de Nutrición**: rediseñado a "Meta nutricional diaria" con 3 `RingProgress` reales (% de kcal por macro: prot×4/carb×4/grasa×9), reemplazando los tiles viejos y el `MacroRing` local duplicado.
- **Recetas saludables**: tabla nueva `recipes` (PDF admin-managed, mismo patrón multer+Supabase Storage que el PDF de plan nutricional), biblioteca global vista por todos los clientes de Nutrición.
- **Tips and tricks**: tabla nueva `nutrition_tips`, mismo patrón que `cortisol_tips`, biblioteca global.
- **Comunidad → Club Wellness**: solo renombre de copy visible (constants.ts, topbars, community page) — cero cambios de rutas/tablas/nombres internos.
- **"Solicita tu membresía"**: bug real confirmado y corregido — el registro nunca devolvía token pero el frontend lo exigía para considerar éxito, así que todo registro exitoso mostraba error. Se simplificó a nombre+email sin contraseña.
- **Número de miembro automático**: secuencia Postgres (`member_number_seq`) asignada atómicamente dentro de una transacción en `updateStatus()` al pasar a `active`, con backfill retroactivo por antigüedad para clientes ya activos. Nueva `MemberCard.tsx` en el home.
- **Retiros en Club Wellness**: tercera sección junto a Eventos/Terapias, mismo sistema de reservas (tablas `community_retreats`/`retreat_reservations`), gateado igual que Terapias (bloqueado para Lead Wellness).

Migraciones SQL corridas a mano contra `DATABASE_URL` y `TEST_DATABASE_URL` (nunca `drizzle-kit push`, como siempre). Suite completa de `apps/api` (276 tests) y `apps/web` verificada sin regresiones al cierre de las 7 fases.

### 4. Fixes puntuales post-entrega

- Botón de Google roto: el túnel de cloudflared usado para las pruebas NFC ya estaba muerto y `apps/web/.env.local` seguía apuntando ahí — se volvió a `http://localhost:3003` para pruebas en el navegador de la Mac (con nota de volver a levantar el túnel si hace falta probar desde el celular).
- "Descargar PDF" quitado de la card de suplementos (y la función local que ya no se usaba).
- Texto morado del protocolo de sueño (Descanso) cambiado a negro, tanto en la vista del cliente como en el panel admin donde se escribe.
- Recetas/Tips "no aparecían": no era bug — simplemente no había contenido cargado (las secciones se ocultan vacías por diseño). Se aprovechó para mover la administración de Tips (antes sin ningún link de acceso) a una card dentro del panel admin de Nutrición, junto a Recetas — se sacó la página standalone `/admin/nutrition-tips` del hub de Administración.
- Anillos de Nutrición: ajustados de tamaño/color varias veces según feedback (más grandes → más chicos, piedra → espresso → piedra) hasta converger en 68px, un solo tono espresso con track translúcido (el track claro por defecto de `RingProgress` no se leía bien sobre fondo oscuro).
- Recetas/Tips reordenadas al final del módulo de Nutrición (después de Suplementos), no justo debajo del hero.
- Heroes de Nutrición y Club Wellness unificados a espresso plano (igual que Entrenamiento), con el mismo destello radial decorativo que ya tenía Entrenamiento/Cortisol.

### 5. Índice de bienestar — nuevo, unificado con Mi Evolución

Ya existía un "Índice de bienestar general" en Mi Evolución (40% entrenamiento/30% sueño/30% cortisol, calculado en el cliente). El pedido nuevo era un KPI en el home con pesos distintos (15/15/15/15/40 entrenamiento/nutrición/cortisol/sueño/evolución) renormalizados según qué módulos tiene realmente el tipo de cliente. Se resolvió el solape con 3 preguntas ya respondidas (todas la opción recomendada): nutrición queda siempre excluida (sin dato medible hoy), el componente "Mi Evolución" reusa el cálculo clásico existente (anidado, entrenamiento/sueño/cortisol cuentan dos veces — intencional), y se unifica en un solo índice (mismo valor en home y Mi Evolución, fuente de verdad en el backend).

Implementación: `apps/api/src/services/wellness-index.service.ts` (nuevo, consulta `client_type_module_permissions` vía `isModuleAllowedForType`), tabla `wellness_index_history` (snapshot semanal, upsert por `client_id`+lunes-de-la-semana, usado para el delta "vs. semana pasada"), endpoint `GET /api/clients/:id/wellness-index`. Frontend: `WellnessIndexCard.tsx` nueva en el home (oculta para Lead Wellness), y `ClientEvolutionPanel.tsx`/`AdminEvolutionPanel.tsx` dejaron de calcular localmente — ahora consumen el mismo endpoint. Se retiró `computeWellnessIndex` de `apps/web/lib/evolution-logic.ts` (y su test) al quedar sin callers, para no mantener dos fórmulas divergiendo con el tiempo. Hallazgo real durante la investigación: la matriz de Roles y Perfiles en la base de datos ya tenía `lead_wellness: training=false, nutrition=false` (editado a mano por Alejandro desde el admin) pero el frontend de esos dos módulos nunca capturaba el 403 (ver sección 7).

### 6. Member card — fix de logo, anillo más fino

El logo real (`BrandRing`) ya estaba en la member card — el problema era que el fondo de la card era un *gradient* mientras `BrandRing` recibía un color plano como `background`, así que el círculo interior no calzaba con el fondo real detrás (se veía como un parche, no un "donut" limpio). Fondo cambiado a plano. De paso, a pedido explícito, el trazo del anillo (`BrandRing.tsx`) se hizo ~45% más fino (`size * 0.22` → `size * 0.12`) en toda la app.

### 7. Membresías: Club Explorador / Online / Presencial / Elite

- **Nombres cara-al-cliente**: nuevo `MEMBERSHIP_LABELS` en `constants.ts` (Lead Wellness→"Club Explorador", Coaching Online→"Club Online", Coaching 1:1→"Club Presencial", Mentoring→"Club Elite"), separado de `CLIENT_TYPE_LABELS` (queda igual para admin). Aplicado en member card y en el copy hardcodeado de "plan Mentoring" en Descanso/Punto Ciego.
- **Login con dos puertas de entrada**: "Únete como Explorador" (nombre+email o Google/Apple, alta **instantánea** `status:active`/`clientType:lead_wellness`, sin contraseña, auto-login inmediato con el mismo token que un login normal) vs. "Membresía Premium" (la solicitud con aprobación manual que ya existía, sin cambios de comportamiento). Nueva función `createActiveExplorerClient` en `clients.service.ts` (asigna número de miembro atómicamente, igual que `updateStatus`). `RegisterInputSchema` ganó un campo `intent` (`explorer`|`membership_request`) — requirió rebuild de `packages/shared-types`.
- **Regla unificada de SSO**: Google/Apple con un email que no existe en la base ahora crea un Explorador activo con token de una, en vez de quedar `pending` en cola de aprobación (comportamiento anterior). Cambio de conducta real en producción, hecho a pedido explícito.
- **`<LockedBenefit variant="apply"|"upgrade">`** nuevo (`apps/web/components/ui/LockedBenefit.tsx`), envolviendo el `LockedOverlay` ya existente. Reemplazó los candados de copy hardcodeado en Terapias, Retiros y Hackeando el sueño (Club Elite específico). Se agregó además a Entrenamiento y Nutrición, que hoy NO tenían ningún manejo de 403 en el frontend (`training-client.ts`/`nutrition-client.ts` nunca chequeaban `res.status === 403`) aunque el backend ya los bloqueaba para Lead Wellness — decisión explícita de Alejandro de completar ese bloqueo visualmente ahora. `variant="apply"` queda construido pero sin caller real hoy: una cuenta `inactive` no puede ni loguearse (bloqueada en el login mismo), así que nunca llega a ver un módulo bloqueado — queda listo por si esa regla cambia más adelante.

### 8. Fotos y edición en Eventos/Terapias/Retiros (Club Wellness admin)

- Subida de foto opcional (16:9→2:1 según tipo, JPG/PNG, máx 5MB) al crear cada uno, con preview local antes de subir (`ImageField.tsx`, nuevo — `FileField.tsx` no soportaba preview de imagen). Backend: endpoint separado `POST .../:id/upload-image` por cada uno (multer + `uploadFile()`, mismo patrón que Recetas), no combinado con el create JSON existente, para no tener que tocar los schemas/tests ya validados.
- Bug real encontrado y corregido: `updateEvent`/`updateRetreat` en el backend borraban `event_date`/`start_date`/`end_date` en CUALQUIER update parcial que no repitiera esos campos (ternario sin rama `undefined`) — afectaba silenciosamente al simple botón "Desactivar". Corregido para distinguir "campo ausente = no tocar" de "campo vacío = borrar a propósito".
- Botón "Editar" agregado a las 3 listas "publicados" (antes solo Desactivar/Eliminar) — formulario inline con todos los campos + reemplazo de foto.
- Precio de retiros pasado a USD (antes formateaba como pesos colombianos).
- Tamaño de las cards de Eventos/Terapias/Retiros reducido en 2 pasadas (padding, tipografía, foto) según feedback iterativo — Eventos terminó con una foto más cuadrada (2:1) que Terapias/Retiros (2.4:1) porque se veía demasiado alargada; Retiros combinó "Fecha inicio"+"Fecha fin" en un solo campo "Fechas" y pasó a grilla de 3 columnas para ocupar menos alto.

### 9. Verificación

`tsc --noEmit` y `next build` limpios en `apps/web` y `apps/api` en cada fase. Suites completos corridos repetidas veces a lo largo de la sesión: siempre la misma baseline ya documentada (`login-page.test.tsx` determinístico por `router.push` vs. `window.location.href`, `wizard-shell-finalize.test.tsx`/`training.routes.test.ts` flaky por contención de CPU bajo carga completa, ~15 tests de Supabase Storage con credenciales inválidas en este entorno) — cero regresiones nuevas atribuibles a esta sesión, siempre reconfirmadas corriendo el archivo sospechoso aislado antes de descartarlas.

### 10. Commit y push

Todo lo de esta sesión (167 archivos) se commiteó en un solo commit sobre `backup-migracion-2026-08-05` y se pusheó a `origin/backup-migracion-2026-08-05`. Se dejó fuera a propósito `index.html` (raíz, 567KB) — copia de referencia del monolito legacy, sin trackear en git igual que `BIO360*`.

---

## Próximas actividades — Siguiente sesión (actualizada 2026-08-15)

### Actividad 1 — Decidir sobre `login-page.test.tsx` / `LoginForm.tsx`

- (Sigue sin resolver desde 2026-08-09 tarde.) Confirmar si se quiere restaurar el ruteo inteligente post-login conectando `components/auth/LoginForm.tsx` de verdad en `app/(auth)/login/page.tsx`, o si se prefiere borrar `LoginForm.tsx` como código muerto y simplificar/eliminar esos 5 tests (los mismos que siguen fallando en la suite completa por testear `router.push`, que la página real no usa).

### Actividad 2 — `reset-password` / `therapist/set-password` con el tema día/noche viejo

- (Sigue sin resolver.) Estas dos pantallas siguen usando `theme-login-light/dark` (`--lf-*` en `globals.css`), visualmente inconsistentes con el login/set-password nuevos (`#2A2015`/`--page-bg` fijos).

### Actividad 3 — Construir los 6 módulos placeholder del panel de terapeuta

- (Sigue pendiente de varias sesiones atrás, sin tocar.) Mi perfil, Mis clientes, Mi agenda, Recursos clínicos, Comunidad de terapeutas, Dashboards.

### Actividad 4 — Revisar visualmente en `dev:web` los cambios de hoy

- Login con las dos puertas de entrada (Explorador auto-login, Premium con solicitud), `<LockedBenefit>` en los 5 módulos donde se aplicó, member card con el anillo/fondo corregido, subida de fotos en Eventos/Terapias/Retiros + botón Editar, Índice de bienestar en el home. Todo se verificó por tests/tsc/build, no hay confirmación visual en navegador real de esta sesión.

### Actividad 5 — `variant="apply"` de `<LockedBenefit>` sin caller real

- Queda construido y probado pero nunca se dispara en la app hoy (una cuenta `inactive` no puede loguearse, así que nunca ve un módulo bloqueado). Si en algún momento se decide dejar loguear a cuentas pendientes con todo bloqueado en vez de rechazarlas en el login, ahí se conectaría.

---

## Resumen Ejecutivo — Sesión 2026-08-18 — Módulo de cuenta (perfil/membresía/privacidad) y pago digital con Stripe

### 1. Integración de `AceptacionRegistro` + `PanelConfiguracion` en un módulo de cuenta real

`PanelConfiguracion.jsx` (creado en otra sesión como mock 100% estático) se movió a `components/account/` y se conectó de punta a punta:
- **Perfil**: `PUT /api/clients/:id` (ya existía) ganó validación de email duplicado, que no tenía — un cliente podía pisar el email de otro sin aviso, solo fallaba con un error crudo de Postgres.
- **Membresía**: reusa la misma key SWR de `MemberCard.tsx` (`['client-detail-for-member-card', clientId]`) — cero fetch nuevo.
- **Privacidad y datos**: lectura nueva de `legal_acceptances` (antes solo se podía insertar, nunca leer) vía `apps/api/src/services/account.service.ts`; "Actualizar mi autorización" reabre el `AceptacionRegistro.jsx` real en vez de duplicar el formulario de consentimiento. "Descargar mis datos" es un export mínimo (perfil + membresía + historial legal) a propósito — mediciones/Oura/nutrición quedaron fuera de alcance por decisión explícita.
- **Dispositivos**: reusa `wearable-client.ts` ya existente (conectar/desconectar Oura).
- **Notificaciones**: columna nueva `notification_preferences` (jsonb) en `clients` — lo único genuinamente nuevo del módulo, según lo esperado.
- **Solicitud de eliminación de cuenta**: columna nueva `deletion_requested_at`, idempotente, visible en `admin/clientes` (lista y detalle) con botón "Marcar como resuelta". No dispara ningún borrado real — es evidencia para que un humano contacte al cliente.
- Nuevo módulo backend `account.{service,controller,routes}.ts`, montado en `/api/account`, siempre `req.user.id` (nunca `:id` de otro cliente).
- **Hallazgo real**: cambiar el correo desde el panel rompía el re-login por Google/Apple, porque ambos flujos buscan al cliente por email primero — se agregó respaldo por `googleId`/`appleId` en `googleLogin`/`appleLogin` (`auth.controller.ts`).
- Dropdown del avatar en `ClientTopbar.tsx` rediseñado a pedido explícito posterior: de botones-píldora con borde propio a filas ícono+texto sin borde, con hairline separando "cabecera" de "navegación" de "sesión" — nuevo componente `AccountMenuRow` pensado para escalar sin rediseñar. 2 íconos nuevos en `ui/icons.tsx` (`IconSettings`, `IconLogout`).

### 2. Pago digital con Stripe para membresías (pago único, no suscripción)

Coexiste con el pago en efectivo (aprobación manual del admin, sin tocar). Alejandro confirmó explícitamente: el webhook de Stripe activa la membresía solo con la confirmación del pago, sin pasar por esa cola de aprobación.

- **Hallazgo real importante**: el campo de vencimiento (`clients.plan_end_date`) y la función que lo calcula (`clientsService.renewPlan`) ya existían desde antes — pero estaban huérfanos, sin ningún botón real en producción que los llamara (el flujo de aprobación en efectivo nunca los toca). El webhook de Stripe es el primer consumidor real de esa función en toda la app.
- **Hallazgo real**: `mentoring` no estaba en `ACTIVE_PLAN_TYPES` (`auth.service.ts`) — un cliente Elite nunca se marcaba como vencido sin importar la fecha. Se agregó a pedido explícito de Alejandro.
- **Blocker real resuelto**: `PlanExpiredScreen` bloquea TODA la app sin ninguna salida — sin ajustar esto, un cliente ya vencido nunca podría llegar a la pantalla de pago para volver a pagar. Se agregó una excepción de ruta en `AppShell.tsx` (`pathname !== "/configuracion/membresias"`) + un botón "Renovar membresía" nuevo en esa pantalla.
- 2 tablas nuevas: `membership_prices` (5 filas fijas — Presencial/Online 1 y 3 meses, Elite 3 meses —, editables desde un panel admin nuevo en `/admin/membership-prices`, mismo patrón que "Roles y Perfiles") y `membership_payments` (ledger + mecanismo de idempotencia: Stripe puede reenviar el mismo evento de webhook más de una vez). Precios en tabla de DB, no env vars, porque Alejandro espera que cambien y no quiere depender de un redeploy.
- **Detalle técnico crítico**: el webhook (`/api/stripe/webhook`) se monta en `app.ts` ANTES del `express.json()` global, con su propio `express.raw()` — Stripe exige el body sin parsear para verificar la firma. Es el primer middleware `raw` del proyecto.
- El endpoint que crea el `PaymentIntent` (`POST /api/account/membership/checkout`) NUNCA activa nada — valida server-side la combinación tier/duración (nunca confía en lo que manda el cliente; ej. Elite solo se puede pagar a 3 meses) y solo arma el pago. Únicamente el webhook, tras verificar la firma, activa la membresía reusando en secuencia `updateStatus`/`updateClientType`/`renewPlan` ya existentes.
- Frontend nuevo: `/configuracion/membresias` (`PanelMembresias.tsx`) con Stripe Elements (`PaymentElement`). Estados explícitos por card: seleccionando → pagando → confirmando → activo — **nunca marca "activo" solo porque `stripe.confirmPayment()` no tiró error**; hace polling contra `GET /api/account/membership/payments/:id` (nuestro backend, que solo lo sabe con certeza tras el webhook) hasta ver `succeeded`.
- `MemberCard.tsx` y la sección Membresía del panel de cuenta ya muestran el vencimiento (mismo dato/hook, sin fetch nuevo) — acento dorado (no rojo, la card no tenía ningún color de alerta) si venció.

### 3. Commit

Todo lo de esta sesión, más trabajo de sesiones anteriores que seguía sin commitear (candados de topbar/`moduleAccess` resuelto contra la matriz real, accesos rápidos del inicio condicionados a datos reales cargados), se commiteó en 2 commits sobre `backup-migracion-2026-08-05`, **sin pushear** (no pedido explícitamente). Quedaron fuera del commit, sin investigar su origen: `Documentos/` e `index.html` (raíz) — no tienen relación con este trabajo.

### 4. Verificación

`tsc --noEmit` limpio en `apps/api`/`apps/web`/`packages/shared-types`. Suites completos corridos varias veces: la única baseline de fallas es la ya documentada (`login-page.test.tsx` determinístico, `wizard-shell-finalize.test.tsx` flaky por CPU, ~15 tests de Supabase Storage con credenciales inválidas en este entorno) — cero regresiones nuevas atribuibles a esta sesión. Verificación visual en navegador real: pendiente de Alejandro (todo el desarrollo se hizo por tests/tsc, sin acceso a browser en este entorno).

---

## Resumen Ejecutivo — Sesión 2026-08-15 → 2026-08-22 — Membresías v2 (Wompi + paquetes + TRM), acceso no restrictivo, y validación real de pagos

Sesión larga, con pruebas reales de Alejandro en el navegador intercaladas (primera vez en el proyecto que el flujo de pago se prueba de punta a punta con datos reales, no solo tests). Cubre dos features grandes más una batería de bugs reales encontrados durante esa validación.

### 1. Membresías v2 — paquetes de clases, puente TRM para Elite, proveedor unificado

Construido sobre la interfaz `PaymentProvider` de la sesión anterior (Stripe ya andaba). Reemplaza "elige el primer proveedor disponible" (bug real: en cuanto había `STRIPE_SECRET_KEY` cargada, Wompi dejaba de usarse aunque fuera el proveedor real del día) por un mapeo fijo tier→proveedor en `apps/api/src/services/payment-providers/tier-routing.ts`: Presencial y Online siempre Wompi, Elite usa Stripe si está disponible y si no cae al puente TRM.

- **Club Presencial** pasa a ser paquete de clases (8/12/16) × plazo (1/3 meses), 6 combinaciones de precio reales. `sessions_total`/`sessions_remaining` nuevas en `clients`, descontadas por el mismo botón "Completar día" de Entrenamiento (`training.service.ts::confirmSession`) — sin endpoint nuevo. Vencimiento sin excepciones ya estaba cubierto por infraestructura existente (ver más abajo, sección 3, esto cambió).
- **Club Elite** vía Wompi (mientras no haya Stripe) convierte el precio de referencia USD a COP con la TRM oficial de datos.gov.co (`trm.service.ts`) + margen configurable (`WOMPI_ELITE_MARGIN`), cacheada hasta 48h si la API falla — nunca un valor inventado. TRM/fecha/margen se auditan por transacción en `membership_payments`.
- **Aprobación diferenciada** (regla confirmada explícitamente por Alejandro, no la recomendación binaria original): un pago activa la membresía automático solo si el cliente ya tenía una membresía paga activa antes (upgrade/renovación); si es su primera membresía paga (viene de Lead Wellness o pendiente), el pago queda confirmado pero la activación espera aprobación manual del admin (`membership_payments.requires_approval`), visible en `admin/clientes` con historial de pagos y botón "Aprobar y activar".
- Nuevas tablas/columnas: `membership_prices.package_size` (+ unique de 3 columnas), `clients.sessions_total/sessions_remaining`, `membership_payments.package_size/requires_approval/applied_at/trm_used/trm_date/margin_applied`.

### 2. Bug real de moneda con Wompi (encontrado probando un pago real)

Al probar el primer pago real con las llaves de sandbox de Wompi, el widget tiraba `"Ingresa una moneda válida: COP, USD, GTQ."`. Causa: `wompi.provider.ts` pasaba la moneda tal cual la maneja el resto del sistema (minúscula, `'cop'`) tanto en la firma de integridad como al widget — Wompi exige mayúscula. Corregido normalizando a mayúscula solo en el borde con Wompi (firma + respuesta), sin tocar la convención interna minúscula que comparte con Stripe.

### 3. Acceso no restrictivo para membresías vencidas (estilo Oura) — reemplaza el bloqueo total

Pedido explícito de Alejandro: un cliente vencido debe poder seguir navegando la app con normalidad (banner + corona indicando qué perdió), en vez del bloqueo total que existía (`PlanExpiredScreen` reemplazaba toda la pantalla). **Decisión confirmada explícitamente**: esto reemplaza el bloqueo total incluso para Presencial, pero la regla "sin excepciones" de vencimiento de la sesión anterior se preserva acotada a un solo punto — no se puede registrar más clases de un paquete vencido (`blockExpiredPresencialSession`, nuevo middleware, montado solo en `confirm-session`). `ownerOrAdmin` dejó de bloquear por cuenta (era el mecanismo que antes cumplía esa regla de forma demasiado amplia).

- `apps/web/lib/module-access.ts` — `getModuleAccessState(moduleId, {moduleAccess, planExpired})` → `'ok' | 'expired' | 'not_included'`, única fuente de verdad reusada por el topbar y las cards del home (antes las cards del home no tenían ningún candado, usaban una lógica de "¿hay datos?" no relacionada — se les agregó el criterio de permisos real).
- Corona nueva (`IconCrown`/`CrownBadge`, SVG propio estilo Tabler, sin librería nueva) reemplaza el candado en módulos vencidos-pero-incluidos; el candado sigue igual para módulos nunca incluidos. Clic en un módulo vencido abre un modal en vez de navegar.
- `PlanExpiredScreen.tsx` eliminado; `MembershipExpiredBanner.tsx` nuevo, persistente en todas las pantallas del cliente.
- Webhook: cuando un veterano hace upgrade de tier (no una simple renovación), ahora sí se notifica al admin (antes solo se notificaba en la cola de aprobación).
- **Refinamiento visual pedido después**: banner rediseñado como franja translúcida superpuesta al borde inferior del topbar (`rgba` + `backdrop-filter: blur`), íconos pasados a variantes rellenas (`ti-crown-filled`/`ti-alert-triangle-filled`, el "agujero" de la exclamación logrado con `fill-rule="evenodd"` para que funcione sobre cualquier fondo), corona de cards escalada a 26px/15px (definitiva, distinta de los 14px/8px del topbar).

### 4. Bug real grave: `plan_end_date`/`plan_start_date`/`plan_duration_days` en snake_case, backend siempre devolvió camelCase

Encontrado mientras se investigaban campos vacíos reportados por Alejandro en `AdminClientDetail`. El backend (Drizzle) nunca serializó estos 3 campos en snake_case — siempre fueron `planEndDate`/`planStartDate`/`planDurationDays`, confirmado pegándole directo a la API corriendo. Pero **5 componentes del frontend** (`AdminClientDetail`, `AdminClientList`, `MemberCard`, `PanelConfiguracion`, `PanelMembresias`) leían la versión snake_case, que nunca existió en la respuesta real — bug preexistente a esta sesión, nunca detectado porque los tests mockeaban el shape (snake_case) igual de mal que el código, sin validar contra la forma real de la API. Efecto real: `isCurrentlyActiveFor` en `PanelMembresias` siempre devolvía falso, así que un cliente con membresía vigente nunca veía "Vigente hasta" — solo el formulario de pago, con riesgo real de pago duplicado. Corregido en los 5 archivos + el tipo `ClientDetail`.

### 5. Bug real de UX en la confirmación de pago (Stripe y Wompi)

Encontrado probando pagos reales. Dos problemas encadenados:
- El mensaje "Pago confirmado" nunca se veía — como el refetch del cliente (`mutate()`) resolvía casi al instante en local, la card saltaba directo a "Vigente hasta" sin mostrar el mensaje (el chequeo de `active` tenía prioridad sobre `justConfirmed` en el render).
- Al corregir eso con un timer de 2.5s, apareció un bug peor: si a los 2.5s el webhook todavía no había marcado al cliente activo, la card volvía a renderizar el mismo formulario de Stripe con el `clientSecret` ya usado (PaymentIntent ya confirmado) → `"Unhandled payment Element loaderror"` + un botón "Pagar" fantasma.
- Solución final (pedida explícitamente, estilo confirmación bancaria): el checkout se limpia apenas se confirma el pago (nunca se remonta), y el mensaje de éxito/rechazo se queda fijo en pantalla con un botón "Aceptar" explícito — nunca un timer. El rechazo también gana su propio mensaje ("El pago fue rechazado...") con botón "Reintentar", en vez de solo un texto de error chico que reseteaba la card en silencio.

### 6. Rediseño de las cards de Membresías + ajustes menores de admin

Labels ("Clases"/"Duración") sobre cada grupo de selectores, las 3 cards con la misma altura (flexbox + `margin-top: auto` empujando precio/botón al fondo), jerarquía de precio (label muted + valor grande), Elite diferenciada (borde dorado 2px + badge "Mentoría Premium" en la misma fila que el título). Además: menú admin "Crear Usuario" → "Clientes"; nueva columna "Plan" en el historial de pagos y campo "Plan pagado" en la card de Membresía del admin, concatenando paquete+plazo (`formatPlanDetail`, ej. "12 clases / 3 meses").

### 7. Infraestructura de túneles para probar desde el celular (hallazgo operativo importante)

Para que Wompi confirme pagos hace falta que su webhook llegue a algo público — se usó `cloudflared tunnel --url` (quick tunnel, sin cuenta) hacia `:3003`. Al intentar probar el NFC físico del gimnasio (`/training?m=entrenamiento&a=confirmar`) se descubrió que **clientes reales ya dependen de un túnel de este tipo apuntando a `:3000`**, porque el software todavía no está deployado (solo corre en el `localhost` de la compu de Alejandro). Se encontraron y cerraron 2 túneles huérfanos de 13 días atrás consumiendo ~97% de CPU cada uno — sin saber que uno de ellos era el link real del NFC, se rompió al cerrarlo. Se repuso con un túnel nuevo (URL distinta, hay que reprogramar el tag NFC). **Los túneles quick de Cloudflare generan una URL aleatoria nueva cada vez que se reinician — nunca se puede recuperar la misma** — cualquier cosa física (como un tag NFC) que dependa de esa URL se rompe cada vez que el túnel se cae.

Adicionalmente se encontró que `apps/web/.env.local` tenía `NEXT_PUBLIC_API_BASE_URL=http://localhost:3003` — desde el celular eso apunta al propio celular, no a la compu de Alejandro, rompiendo silenciosamente TODO login (email/contraseña y Google) al entrar por el túnel del front. Se cambió temporalmente al túnel del API para poder probar desde el celular — **pendiente de confirmar si ya funciona, y de decidir si se revierte a `localhost` cuando se termine de probar desde el celular**.

Alejandro no tiene dominio propio todavía, así que un túnel de Cloudflare con nombre fijo no es viable hoy (necesita un dominio dado de alta en Cloudflare). Decisión explícita: por ahora seguir con el túnel efímero; la solución de fondo (dominio + túnel fijo, o deploy real a Vercel/Railway/Render, ambos evaluados) queda pendiente de retomar.

### 8. Verificación

Suites completas de `apps/api` y `apps/web` corridas repetidamente durante toda la sesión, siempre con el mismo baseline conocido sin regresiones nuevas: 15 tests de Supabase Storage (credenciales inválidas en este entorno), 5 de `login-page.test.tsx` (determinístico, ver Actividad pendiente), y `wizard-shell-*`/`admin-roles-page.test.tsx` (flaky por contención de CPU bajo suite completa, confirmado repetidas veces corriéndolos aislados). `tsc --noEmit` limpio en ambos workspaces en cada punto de control. A diferencia de sesiones anteriores, esta vez hubo verificación real en navegador (Alejandro probando pagos/NFC/Google login en vivo), que fue justamente lo que encontró los bugs reales de las secciones 2, 4, 5 y 7 — ningún test los había detectado.

---

## Resumen Ejecutivo — Sesión 2026-08-31 → 2026-09-02

### 1. Edad Biológica vía PhenoAge (Levine et al. 2018) — Evolution / Ephi-Metrics (Prompt 02 §6)

Continuación de una conversación previa (comprimida por límite de contexto) donde ya se habían completado los §1-§5 de `docs/PROMPT-02-CORRECCIONES.md`. Se implementó el cálculo de "Edad biológica" con la fórmula PhenoAge original — coeficientes verificados contra el paquete de referencia `dayoonkwon/BioAge` (`phenoage_calc.R`, rama `orig=TRUE`) y confirmados explícitamente con Alejandro antes de programar el cálculo (regla del propio pedido: nunca aproximar ni inventar coeficientes).

Hallazgos clave antes de escribir código:
- El prototipo (`docs/Ephirox - Producto.dc.html`) ubica "Edad biológica" en la pantalla **Evolution** ("Ephi-Metrics"), no en "Baseline" como decía el texto del pedido — se siguió el prototipo, por la regla ya establecida "si algo no coincide con el prototipo, gana el prototipo".
- De los 8 marcadores nuevos que pedía el prompt, solo 5 eran genuinamente nuevos (Albúmina, % Linfocitos, VCM, RDW, Fosfatasa Alcalina); Creatinina, Glucosa, Leucocitos y PCR ya existían en el panel de 32 marcadores (algunos en otra unidad) — se reutilizaron con conversión de unidad en el cálculo, sin duplicar campos, mismo criterio que ya regía para PCR.
- Los 5 marcadores nuevos se agregaron a `MarkerId`/OCR/IA pero deliberadamente NO a `FIXED_MARKER_RANGES`: se verificó leyendo `Documentos/Matriz_Reglas_Mentoria.xlsx` directamente (parseado con Python/zipfile, sin abrir Excel) que esos 5 marcadores no tienen un "rango óptimo" definido ahí — agregarles uno inventado habría contaminado el sistema de Punto Ciego con un rango sin respaldo del negocio.
- "Sin cálculos parciales" se implementó como: el cálculo de PhenoAge en sí nunca corre con datos incompletos (requiere los 9 marcadores + birthdate del cliente), pero el guardado general del panel de laboratorio sigue tolerando marcadores no detectados como siempre lo hizo (no se agregó un gate nuevo que hubiera roto el flujo de OCR+IA existente).

Archivos nuevos: `apps/api/src/services/phenoage.ts` (fórmula pura + validación de completitud, 6 tests), `apps/api/src/services/biological-age.service.ts` (único punto que calcula y persiste, llamado solo al aprobar un panel), `apps/web/components/evolution/BiologicalAgeCard.tsx`. Migración: `lab_panels` gana `edad_biologica`/`edad_cronologica_calculo`/`edad_biologica_calculada_en` — la edad cronológica se congela en el momento del cálculo (edad del cliente en la fecha del panel, no la actual) para que el histórico no cambie si se corrige el birthdate después.

### 2. Bugs reales en la integración de Oura (módulo Sleep) — reportados por Alejandro con capturas comparando contra la app oficial de Oura

Investigación siguiendo el protocolo de "mostrar el código y confirmar la causa antes de corregir". Se leyó `wearable_metricas` real de la base de datos (incluido `rawData.sleep`/`rawData.readiness` crudos de Oura) para el cliente y fechas exactas que Alejandro reportó, en vez de asumir.

- **"REM y Ligero cruzados" — descartado.** El mapeo por nombre de campo (`rem_sleep_duration→suenoRemMinutos`, `light_sleep_duration→suenoLigeroMinutos`, etc. en `oura.service.ts`) es correcto, verificado 1:1 contra el payload crudo guardado. La discrepancia real: Ephirox mostraba la noche del 30→31 ago (última completa disponible en ese momento) mientras Alejandro comparaba contra la app de Oura, que ya mostraba la noche del 31 ago→1 sep — dos noches distintas, confirmado además cruzando capturas reales de la app de Oura (pestañas "Yesterday"/"Today" con puntajes y porcentajes distintos, coincidiendo exacto con las dos filas de la base de datos).
- **Bug real #1 — "Despierto" siempre mostraba 0:00.** Se calculaba como `total-(profundo+rem+ligero)` en vez de usar el `awake_time` real que Oura manda; como `total_sleep_duration` de Oura ya excluye el tiempo despierto por definición, esa resta daba ~0 casi siempre. Fix: nueva columna `sueno_despierto_minutos`, mapeada desde `awake_time`; el cálculo por resta queda solo de fallback para Whoop/Polar (que todavía no lo reportan).
- **Bug real #2 — la sincronización podía "vaciar" la vista de Sleep.** Confirmado con la fila real: Oura publica el readiness de un día antes que el detalle de sueño de esa misma noche; `ClientRestPanel` tomaba `metrics[0]` (fecha más reciente) a ciegas como "Anoche", así que una fila parcial (solo readiness) desplazaba a la última noche completa y mostraba ceros — sin que nada se hubiera borrado realmente. Fix: se toma la fila más reciente que **sí tiene** `suenoTotalMinutos`; si ninguna la tiene, cae al empty state ya existente.
- Se ocultó también `MantraCard` (frase de motivación) del header de Sleep, a pedido explícito.

### 3. Sincronización automática al abrir Sleep + botón "Sincronizar ahora" (objetivo: que Ephirox y Oura estén alineados cada mañana)

Se investigó si el webhook de Oura (`wearable-webhook.controller.ts`, ya existía como esqueleto) era el mecanismo correcto para esto. Se confirmó vía el OpenAPI real de Oura (mirror en `github.com/api-evangelist/oura-ring`, generado desde la spec pública) el flujo completo de creación de suscripciones (`POST /v2/webhook/subscription`), pero se encontraron dos gaps que impiden confiar en ese camino hoy: (a) no existe ningún código en el repo que cree/renueve una suscripción real con Oura — el endpoint receptor nunca ha recibido un evento real; (b) ni el OpenAPI ni ninguna fuente verificable documenta el schema exacto del payload de entrega ni el esquema de firma (el código ya traía un comentario reconociendo esto). Construirlo a ciegas habría significado adivinar un contrato externo no confirmado — se decidió NO hacerlo, mismo criterio aplicado con los coeficientes de PhenoAge.

Fix implementado en su lugar, reutilizando el pull ya existente y probado (`sincronizarOura` vía `POST /wearable/:dispositivo/sync`):
- Auto-sync silencioso al montar `ClientRestPanel` (salvo que ya haya habido un sync hace menos de 5 min).
- Botón "Sincronizar ahora" visible en el hero de Sleep (antes esa función solo existía escondida en `Module10.tsx`, onboarding de uso único).

**Verificado en vivo con datos reales** (no solo con tests): se disparó `sincronizarOura` manualmente para el cliente real y se confirmó contra la base de datos que el readiness del 1 sep sí llega, pero el detalle de sueño de esa misma noche seguía sin estar disponible del lado de Oura incluso en una sincronización fresca — esto descarta un bug de fechas/parámetros en nuestro código (mismos parámetros, mismo request, el readiness sí llegó) y confirma que es un retraso de disponibilidad específico de la API pública de Oura (la app del teléfono usa un pipeline interno más rápido que lo que exponen a integraciones de terceros). Pendiente de confirmar la próxima sesión si se resuelve solo (debería, vía el auto-sync) o si persiste más de 24h.

### 4. Rebrand — un solo isotipo, cabecera (§7) y tarjeta de membresía

Se implementó la cabecera según spec §7 (toggle de tema, campana de notificaciones, botón de cerrar sesión, favicon) y se rediseñó `MemberCard.tsx` como credencial de 2 columnas siguiendo la imagen de referencia que compartió Alejandro.

Después llegó "PROMPT 03 · Isotipo definitivo (aperturas contrapuestas)" — un spec formal que ordenaba descartar el logo de un solo arco y unificar todo el repo en un único componente `Isotipo` (`apps/web/components/ui/Isotipo.tsx`, viewBox `0 0 132 132`) con dos anillos de apertura contrapuesta + punto central, con geometría exacta (radios, `stroke-dasharray`, `rotate`) y tiers de tamaño dados por el prompt. Reemplaza a `BrandRing.tsx` (borrado) en los 10 puntos de uso reales (login, invitación, set-password, reset-password, login/set-password de terapeuta, los 3 topbars, `MemberCard`). También se regeneró `favicon.svg` con la misma geometría reducida y se borraron `app/icon.tsx`/`app/apple-icon.tsx` — generaban un logo dinámico vía `next/og` que pisaba en silencio el `favicon.svg` real declarado en `metadata.icons`. Verificado con `rg` que no queda ninguna geometría vieja (`dasharray="330 60"`, `rotate(-58`) ni un segundo lugar con viewBox `0 0 132 132` fuera del propio componente y el favicon.

### 5. Cuatro bugs reportados con capturas después del rebrand

Alejandro reportó cuatro problemas en una sola tanda de capturas; los cuatro eran reales y se corrigieron por separado:

- **Logo "exageradamente grande y grotesco" en la esquina superior izquierda.** El tamaño quedó en 74px tras aplicar la tabla del Prompt 03 al pie de la letra, pero se veía desproporcionado en los tres topbars (`ClientTopbar`, `AdminTopbar`, `TherapistTopbar`). Reducido a 40px.
- **El PDF de nutrición mostraba el texto plano "Ephirox" en vez del logo real.** La lógica real de generación vive inline en `ClientNutritionPanel.tsx` (`window.open` + `document.write` + `print()`) — se confirmó en el proceso que `NutritionPdfGenerator.tsx` es código muerto, nunca importado en ningún lado. Se incrustó primero el SVG de `Documentos/brand/ephirox-lockup-horizontal-oro.svg`, pero su wordmark (relleno `#F5F1E8`) daba ~1.1:1 de contraste contra el fondo claro del PDF (`#EDE6DC`) — casi ilegible impreso; no se corrigió a ciegas, se dejó flagueado. Alejandro confirmó el cambio a la variante `ephirox-lockup-horizontal-negro.svg` (monocromática, `#0B0A08`), que sí contrasta bien sobre el fondo claro del PDF.
- **Configuración quedaba en pantalla negra con el toggle en CLARO.** Causa raíz: `screenForPathname()` (`apps/web/lib/theme.ts`) no tenía entrada para `/configuracion`, así que caía al fallback `"dashboard"`, que siempre fuerza `dark-brand` sin importar el toggle. Se agregó `/configuracion` a `TOGGLEABLE_MODULE_PATHS` — y, como el script anti-flash de `ThemeRoot.tsx` duplica a propósito esta lógica en un string inline (no puede importar el módulo real porque corre antes de que React hidrate), se actualizó también ahí para que ambos no se desincronicen.
- **Con el toggle en CLARO, títulos/subtítulos/nombres de campo casi no se leían en casi todos los módulos.** Causa raíz: `--eph-body`/`--eph-muted`/`--eph-faint` en `tema.css` usaban las mismas opacidades que los temas oscuros, lo que da mucho menos contraste real sobre fondo claro. Se subieron las opacidades solo dentro del bloque `[data-theme="light-premium"]` (ej. `--eph-body` de 0.50 a 0.70).

Bug adicional reportado a mitad de la misma conversación: los campos de subir documentos quedaban con fondo negro sólido en tema CLARO (chocando con el blanco), pero se veían bien en CARBÓN. Causa raíz: `FileField.tsx`/`ImageField.tsx`/`EmptyState.tsx` tenían el patrón de rayas (hatch) de placeholder hardcodeado con los hex exactos de `dark-carbon` (`#121110`/`#181614`) en vez de usar el token `--eph-hatch`, que sí está definido correctamente por tema en `tema.css`. Reemplazados los tres por `var(--eph-hatch)`.

### 6. Reintentos automáticos en segundo plano hasta que Oura tenga la noche completa (extiende la sección 3)

El auto-sync simple de la sección 3 dejaba a veces la vista de Sleep con el aviso de "sin datos de hoy" si el detalle de sueño de Oura aún no estaba listo en el momento exacto del sync. Se agregó reintento automático en `ClientRestPanel.tsx`: si tras sincronizar la noche de hoy sigue sin `suenoTotalMinutos`, se reintenta cada 60s (`RETRY_INTERVAL_MS`) hasta 4 veces (`MAX_RETRY_ATTEMPTS`) o hasta que la noche quede completa, lo que ocurra primero — con un aviso visible ("Oura todavía está procesando el detalle de esta noche — seguimos intentando en segundo plano") mientras tanto. El `setTimeout` del reintento se guarda en un ref y se limpia tanto al desmontar como antes de cada sync manual nuevo, para no acumular reintentos huérfanos. No cambia el diagnóstico de fondo (sigue siendo un retraso del lado de Oura, no de Ephirox) — solo evita que el cliente tenga que volver a darle "Sincronizar ahora" a mano varias veces la misma mañana.

**Gotcha de testing encontrado y corregido:** activar `vi.useFakeTimers()` desde el arranque de un test (en `beforeEach`) rompe `findByText`/`waitFor` de Testing Library, porque esos helpers reintentan internamente vía `setTimeout` — si ese `setTimeout` ya está falseado y nadie lo avanza, se cuelgan esperando para siempre (`Test timed out`). Patrón correcto usado en `client-rest-panel.test.tsx`: dejar que la carga inicial real termine primero (`await screen.findByText(...)` con timers reales), activar `vi.useFakeTimers()` recién después, y de ahí en adelante usar `await vi.advanceTimersByTimeAsync(ms)` + aserciones síncronas (`getByText`/`queryByText`), nunca `findByText`/`waitFor`, mientras los timers sigan falseados.

### 7. El menú principal ("/") también sigue el toggle CARBÓN/CLARO

Mismo tipo de causa raíz que el bug de Configuración (sección 5): `screenForPathname()` no tenía una rama explícita para `"/"`, así que cualquier ruta no cubierta —incluida la home— caía al fallback `"dashboard"` (`dark-brand` fijo). Se agregó `if (pathname === "/") return "module";` tanto en `theme.ts` como en el script inline de `ThemeRoot.tsx`. Test de regresión agregado en `theme.test.ts`.

### 8. El eslogan del PDF de nutrición quedaba fuera de sitio (debajo del ícono, no del naming)

Alejandro reportó que en el header del PDF "Redefining limits." se veía desorganizado. Causa raíz: el ícono y la palabra "EPHIROX" viven en un solo SVG combinado (`EPHIROX_LOCKUP_SVG`), y el `<p>` del tagline es un bloque aparte, alineado a la izquierda del contenedor — es decir, alineado con el borde izquierdo del ÍCONO, no con donde empieza a leerse "EPHIROX" (que arranca más a la derecha, después del ícono). Fix: se calculó el offset horizontal exacto donde arranca el trazo de la "E" dentro del SVG combinado (`x≈184` de un viewBox de 530 de ancho, escalado al ancho real renderizado de 210px ≈ 74px) y se aplicó como `margin-left` al tagline del header, sin tocar el trazo vectorial. Aprovechando el cambio, se reemplazó también el cierre del documento (que hasta ahora usaba "Ephirox" en texto plano con una fuente web, no el logo real) por el mismo `EPHIROX_LOCKUP_SVG` a menor tamaño, para que el naming se vea idéntico (mismo trazo vectorial de marca) arriba y abajo del documento.

**Verificado visualmente, no solo leyendo el código:** se extrajo el CSS+SVG reales del componente a un HTML standalone en el scratchpad y se renderizó con Chrome en modo headless (`--screenshot`) para confirmar el resultado antes de dar el cambio por bueno — el tagline efectivamente quedó alineado bajo la "E" de "EPHIROX" y no bajo el ícono.

### 9. Variante negra del logo en el PDF de nutrición (decisión tomada)

Alejandro confirmó cambiar `ephirox-lockup-horizontal-oro.svg` por `ephirox-lockup-horizontal-negro.svg` (monocromática, `#0B0A08`) en el header y el cierre del PDF de nutrición — resuelve el problema de contraste flagueado en la sección 8. Mismo geometría, solo cambian los colores de relleno/trazo.

### 10. Sistema unificado de "Rituales" — fusión de los 3 check-ins dispersos

Pedido explícito de Alejandro: fusionar el pulso de ánimo, el check-in matutino de Stress (energía/tensión/claridad) y la reflexión semanal en dos bloques del Dashboard — **Ritual Diario** y **Ritual Semanal** — con un mismo mecanismo de expandido/pendiente ↔ colapsado/completado, reutilizable y parametrizado por cadencia.

**Investigación previa (corrigió la premisa del pedido original):** el pulso de ánimo y la reflexión semanal YA vivían juntos en una sola tarjeta del Dashboard (`CheckinCard.tsx`, montada en `app/(app)/page.tsx`) — no en Workout, como decía el pedido. Solo el check-in matutino de Stress vivía en otro módulo con otro modelo de acceso (`requirePermission('cortisol')`, más amplio que el `mentoringOnly` de los otros dos). Esto simplificó la fusión.

**Decisiones confirmadas con Alejandro antes de implementar:**
- Acceso del Ritual Diario = Mentoría (mismo gate que ánimo/reflexión). Consecuencia aceptada: un cliente no-Mentoría que hoy podía responder el check-in de Stress deja de poder hacerlo — ve un resumen de solo lectura permanentemente vacío.
- Caso borde encontrado en la investigación: ni siquiera un cliente Mentoría tiene garantizado el acceso a Stress (matriz de tipo + override por cliente, ambos pueden estar en `false`). El Ritual Diario chequea esto con `getModuleAccessState('cortisol', ...)` y, si no hay acceso, muestra solo la pregunta de ánimo — nunca llama al endpoint de morning-checkin en ese caso, para evitar un 403 garantizado.
- Nombres internos bajo `components/rituals/` (`DailyRitualCard`, `WeeklyRitualCard`, `RitualCheckinCard`) para no colisionar con el concepto ya existente de "Ritual" en Stress (`cortisolTechniques.isRitual` / "The Rox Ritual", técnicas curadas por el admin, no relacionado).
- Ventana del Ritual Semanal: originalmente domingo, luego ampliada a sábado+domingo (ver sección 11).

**Implementación (sin tocar tablas, endpoints ni fórmulas):**
- `DailyRitualCard`: un solo botón "Guardar ritual" postea a `daily-checkin` y (si hay acceso) a `morning-checkin`, los mismos dos endpoints de siempre — la fórmula de Activación Matutina/Carga Cognitiva no cambia, solo el lugar donde se capturan los datos.
- `WeeklyRitualCard`: mismas 3 preguntas y endpoint de siempre (`weekly-reflection`), ahora con ventana de aparición.
- Stress ya no tiene su propio formulario de check-in matutino (`MorningCheckinPrompt.tsx`, borrado) — `MorningCheckinSummary.tsx` muestra un resumen de solo lectura con 3 estados (sin acceso / Mentoría sin dato hoy / con dato).
- `CheckinCard.tsx` se dividió: ánimo y reflexión semanal migraron a `rituals/`, y `PeriodConfirmationCard.tsx` se quedó solo con la pregunta de período (sin cambios de comportamiento).
- Backend (`checkins.service.ts`, único archivo tocado): `getCheckinsStatus` ganó `dailyStreakDays`/`weeklyStreakWeeks` (funciones puras, mismo patrón que `computeConsecutiveDaysOverThreshold` y `computeTrainingStreakState`) y `weeklyRitualWindowOpen`.
- Como todo ya hacía upsert por día/semana, "editar la respuesta" no necesitó backend nuevo: solo reabrir el formulario precargado.

Antes de implementar se investigó a fondo (agente Explore + lecturas directas) dónde vivía cada uno de los 3 check-ins, su modelo de acceso, y el blast radius completo (incluido que `insights/engine.ts` lee la reflexión semanal para refrescar el baseline de Mentoría) — se armó un plan formal (`/plan`) revisado antes de escribir código, dado el tamaño y las decisiones de arquitectura involucradas.

### 11. Ajustes de comportamiento y diseño de Rituales, pedidos tras ver el resultado inicial

Alejandro pidió tres cambios después de ver el resumen de la implementación:

- **Los dos Rituales ya nunca desaparecen del Dashboard.** Antes, el Ritual Semanal se ocultaba por completo fuera de su ventana. Ahora se queda visible pero **bloqueado** (ícono de candado + "Se habilita el sábado y domingo — vuelve entonces para responder", sin formulario ni botón) — a propósito: verlo ahí sabiendo que se habilitará genera más retentiva que ocultarlo. `RitualCheckinCard` ganó este tercer estado (además de pendiente/completado).
- **Ventana ampliada de domingo a sábado+domingo** (`isSundayUTC` → `isWeekendUTC` en `checkins.service.ts`).
- **Diseño visual igualado al de Workout**: ambos Rituales pasaron de ir apilados verticalmente a un grid de 2 columnas lado a lado, con el mismo `border` + `p-6` + `var(--eph-surface)`/`var(--eph-line)` que ya usan las cards "Tu semana"/"Protector de racha disponible" de `TrainingHome.tsx` — el estado bloqueado reutiliza exactamente ese mismo patrón visual (círculo con ícono + texto al lado), en vez de inventar uno nuevo.

### 12. Dos bugs de UI reportados sueltos, corregidos en el camino

- **Card de "Índice de rendimiento" sin borde en tema CLARO.** Era la única card del menú principal sin `border` declarado (`WellnessIndexCard.tsx`) — las demás (MemberCard, tiles de acceso rápido, Workout) ya usaban `var(--eph-line)`. Corregido agregando el mismo borde. Después, a pedido de Alejandro, esta card se ocultó del todo del Dashboard y la tarjeta de membresía subió a la 3ra posición (justo tras los dos Rituales — no la 2da literal, para no romper el requisito de que los Rituales sean "los dos primeros bloques" ya confirmado).
- **"Recetas saludables" y "Tips and tricks" en Nutrition sin card propia.** Usaban solo un `border-top` de separador, a diferencia de "Esquema de suplementación" y el resto del módulo (card completa con borde + fondo + padding). Igualadas al mismo patrón.

### 13. Verificación

`tsc --noEmit` limpio en ambos paquetes en cada punto de control. Suites completas corridas repetidamente: `apps/web` (427 tests) y `apps/api` (490-508 tests) sin regresiones nuevas — los únicos fallos son los ya documentados como pre-existentes y no relacionados (`login-page.test.tsx`, `wizard-shell-finalize.test.tsx`, y ocasionalmente `onboarding-page.test.tsx`/`onboarding-approvals.routes.test.ts`/`wearable-baseline.test.ts` por contención de CPU bajo la suite completa — confirmados limpios corriéndolos aislados). Se agregaron ~20 tests nuevos para el sistema de Rituales (`daily-ritual-card.test.tsx`, `weekly-ritual-card.test.tsx`, `morning-checkin-summary.test.tsx`, `checkins-streaks.test.ts`).

**Pendiente, no verificado por Claude:** el flujo completo de Ritual Diario/Semanal (guardar → colapsar → editar) no se probó en un navegador real con sesión autenticada de un cliente Mentoría — solo vía tests con mocks, `tsc` y una captura de Chrome headless para el fix del PDF. Alejandro debe confirmarlo en vivo.

---

## Próximas actividades — Siguiente sesión (actualizada 2026-09-02)

### Actividad 1 — Confirmar que el login desde el celular ya funciona

- Verificar que el fix de `NEXT_PUBLIC_API_BASE_URL` (apuntado al túnel del API) resolvió el login por email/contraseña Y el botón de Google (este último además necesitaba el dominio del túnel del front agregado a "Authorized JavaScript origins" en Google Cloud Console — ya hecho por Alejandro, pendiente de confirmar que propagó). Decidir si `NEXT_PUBLIC_API_BASE_URL` vuelve a `localhost:3003` cuando se deje de probar desde el celular, o se documenta el swap como parte del flujo normal de pruebas mobile.

### Actividad 2 — Resolver la fragilidad de infraestructura para el NFC del gimnasio (bloqueante real, clientes reales dependen de esto)

- Elegir entre: (a) comprar un dominio + túnel de Cloudflare con nombre fijo, o (b) deploy real a Vercel (`apps/web`) + Railway/Render (`apps/api`), gratis y sin comprar dominio. Alejandro pateó la decisión para más adelante — de mientras, cualquier reinicio de su compu o caída del túnel corta el check-in de clientes reales hasta que alguien reprograme el NFC a mano.

### Actividad 3 — Activar el cobro real de Wompi/Stripe con montos de producción

- Sandbox ya validado end-to-end esta sesión (pago real de prueba, corrección del bug de moneda, confirmación con botón "Aceptar"). Falta que Alejandro decida cuándo pasar las llaves `pub_prod_`/`prod_integrity_`/`prod_events_` de Wompi (ya las compartió una vez, no se cargaron a propósito por ser de producción) y confirme los montos reales de Stripe para Online cuando ese tier deje de usar el puente Wompi.

### Actividad 4 — Decidir sobre `login-page.test.tsx` / `LoginForm.tsx`

- (Sigue sin resolver desde 2026-08-09 tarde.) Confirmar si se quiere restaurar el ruteo inteligente post-login conectando `components/auth/LoginForm.tsx` de verdad en `app/(auth)/login/page.tsx`, o si se prefiere borrar `LoginForm.tsx` como código muerto y simplificar/eliminar esos 5 tests.

### Actividad 5 — Construir los 6 módulos placeholder del panel de terapeuta

- (Sigue pendiente de varias sesiones atrás, sin tocar.) Mi perfil, Mis clientes, Mi agenda, Recursos clínicos, Comunidad de terapeutas, Dashboards.

### Actividad 6 — Confirmar que el auto-sync + reintentos de Sleep resolvió el retraso de Oura (actualizada 2026-09-01)

- Al cierre de la sesión anterior, el detalle de sueño del 1 sep todavía no estaba disponible en la API de Oura. Además del auto-sync ya implementado, esta sesión se agregó el reintento automático en segundo plano (sección 6 del resumen: hasta 4 intentos cada 60s). Si para la próxima sesión el retraso sigue sin resolverse incluso después de agotar los 4 reintentos automáticos (~4 minutos) Y de que pasen más de 24h, eso sí sería una señal real de que hay algo roto del lado de Ephirox y ameritaría investigar más a fondo — hasta entonces, sigue siendo un retraso conocido de la API pública de Oura.

### Actividad 7 — Si se quiere que el webhook de Oura sirva como respaldo instantáneo real

- Hoy `wearable-webhook.controller.ts` tiene el endpoint receptor pero **nunca se creó una suscripción real con Oura** — nadie le ha pedido a Oura que mande eventos. Para que funcione de verdad hace falta: (a) implementar la creación/renovación de la suscripción (`POST /v2/webhook/subscription`, requiere `x-client-id`/`x-client-secret`, ver OpenAPI real en `github.com/api-evangelist/oura-ring`), (b) el handshake de verificación que Oura hace contra `callback_url` al crear la suscripción (no documentado con certeza, hay que confirmarlo contra el comportamiento real de Oura al intentarlo), y (c) confirmar el schema de firma exacto contra el primer evento real recibido — no antes, para no adivinar un contrato externo. No es urgente: el auto-sync + reintentos al abrir Sleep (secciones 3 y 6) ya resuelve el objetivo práctico de "datos alineados cada mañana" sin depender de esto.

### Actividad 8 — Confirmar si se quiere commitear los cambios pendientes de `WizardShell.tsx`/`TrainingHome.tsx`/`TrainingShell.tsx`/`training-client.ts` (arrastrada de una tarea anterior)

- Estos archivos (y sus tests) quedaron modificados sin commitear desde la tarea de fusión de encabezados Baseline/Workout, de antes de esta sesión — no forman parte del trabajo de rebrand/Oura/Rituales de esta sesión y no se tocaron ni se commitearon con él a propósito (disciplina de un commit por tarea). Siguen esperando confirmación.

### Actividad 9 — Confirmar en vivo el flujo completo de Ritual Diario / Ritual Semanal (nueva, 2026-09-02)

- Ver sección 10-11 del resumen de esta sesión. Todo lo implementado pasa `tsc`, tests con mocks y la suite completa, pero nadie (ni Claude ni Alejandro) probó el ciclo completo guardar → colapsar → editar en un navegador real con sesión de un cliente Mentoría — incluido el caso borde de un cliente Mentoría sin acceso a Stress (debería mostrar solo la pregunta de ánimo) y el estado bloqueado del Ritual Semanal fuera de sábado/domingo.

---

## Notas adicionales

- **No modificar `server.js` ni `index.html` (raíz):** son el monolito legacy que Vercel sigue deployando en producción desde `origin/main`. Todo desarrollo nuevo va en `apps/api` / `apps/web`, commiteado en `backup-migracion-2026-08-05`.
- **`BIO360Index.html`, `BIO360server.js`, `BIO360routes/`, `BIO360services/` (raíz):** copia de referencia del monolito legacy usada solo para extraer quirúrgicamente el módulo de Dispositivos y Laboratorios (sección 11). Quedan sin trackear en git a propósito (son archivos grandes de solo consulta, no forman parte de la arquitectura nueva) — no leerlos completos, solo con grep/sed dirigido.
- **Puertos:** backend nuevo `:3003`, front nuevo `:3000`, backend legacy `:3001` (ver sección 8). Usar `npm run dev:api` / `npm run dev:web` desde la raíz para evitar confusión.
- **Dos bases de datos Supabase separadas:** dev (`DATABASE_URL` en `apps/api/.env`) y test (`TEST_DATABASE_URL` en `apps/api/.env.test`) — las migraciones de `tasks/*.sql` hay que aplicarlas a mano en ambas, no se sincronizan solas.
- **Nunca commitear/pushear a `origin/main` directamente** — riesgo real de romper el deploy de producción en Vercel.
- **Nunca cambiar de rama, commitear o pushear sin pedido explícito del usuario en ese turno**, incluso si ya se autorizó antes en la misma sesión.
- **Nunca encadenar `git stash` con un comando largo y `git stash pop` en una sola invocación de shell** (ej. `git stash && npx vitest run && git stash pop`) — si el comando del medio se corta por timeout, el `stash pop` puede quedar aplicado a medias y corromper archivos silenciosamente (visto en la sesión 2026-08-09 tarde). Si hace falta comparar contra un estado previo, usar `git show <ref>:<path>` para leer sin tocar el working tree, o ejecutar cada paso (`stash`, el comando, `stash pop`) como llamadas separadas.
- **Cambios de schema (nueva columna/tabla):** nunca `drizzle-kit push` (se cuelga esperando confirmación de un TUI invisible en background). Escribir un script `tsx` desechable con el paquete `postgres` (mismo patrón que `apps/api/src/db/index.ts`), correr el DDL a mano (`ALTER TABLE ... ADD COLUMN IF NOT EXISTS ...`) contra `DATABASE_URL` y `TEST_DATABASE_URL` (las dos, no se sincronizan solas), borrar el script al terminar, y reflejar el cambio a mano en `apps/api/src/models/schema.ts` (Drizzle no lo detecta solo).
- **Panel admin usa topbar horizontal (`AdminTopbar.tsx`), no sidebar** desde la sesión 2026-08-10 — `Sidebar.tsx`/`AdminNavItems.tsx`/`SidebarRing.tsx`/`UserChip.tsx`/`MobileTopbar.tsx` fueron borrados por quedar sin uso. Los tres roles (cliente, terapeuta, admin) usan topbar horizontal ahora, ninguno usa sidebar vertical.
- **API camelCase, no snake_case:** las respuestas del backend (Drizzle) usan las mismas keys camelCase que las columnas TS del schema (`createdAt`, `clientId`, etc.), nunca snake_case — si un componente nuevo espera `created_at`/`client_id` lo más probable es que esté copiado de un patrón legacy y haya que corregirlo, no que el backend esté mal.
- **Cuidado con `campo ? new Date(campo) : null` en updates parciales de servicios `updateX()`:** si el campo no viene en el `input` (undefined), ese ternario igual evalúa a `null` y borra el valor existente en la base — a diferencia de `campo ?? undefined` (que sí deja el valor intacto cuando falta). Encontrado y corregido en `events.service.ts`/`retreats.service.ts` (2026-08-15): togglear "Desactivar" borraba silenciosamente la fecha del evento. Antes de escribir un `updateX()` nuevo con campos de fecha, usar el patrón correcto: `campo !== undefined ? (campo ? new Date(campo) : null) : undefined`. Vale la pena revisar si el mismo patrón roto existe en otros `updateX()` no tocados todavía.
- **Webhooks de terceros (Stripe y cualquier futuro) necesitan el body crudo:** montar esa ruta específica en `app.ts` ANTES del `express.json()` global, con su propio `express.raw({ type: 'application/json' })` — si se monta después, la firma nunca verifica porque el body ya llegó parseado a objeto. Ver `apps/api/src/routes/stripe-webhook.routes.ts` (sesión 2026-08-18) como referencia del patrón.
- **`membership_prices` arranca en $0 para los 5 planes** (Presencial/Online/Elite) hasta que Alejandro los cargue desde `/admin/membership-prices` — el checkout de Stripe rechaza pagar un plan en $0 a propósito (`PriceNotConfiguredError`, 409). Cualquier prueba end-to-end del pago necesita esto cargado primero.
- **API camelCase, no snake_case (reforzado con un caso real, sesión 2026-08-22):** ya estaba anotado acá arriba, pero se confirmó pegándole directo a la API corriendo que `planEndDate`/`planStartDate`/`planDurationDays` NUNCA fueron snake_case — 5 componentes del frontend llevaban ese bug desde antes de esta sesión, sin que ningún test lo detectara porque los mocks copiaban el mismo error. Antes de confiar en un campo nuevo del lado del frontend, verificar contra una respuesta real de la API (`curl` o el Network tab), no solo contra el tipo TS declarado — el tipo puede estar mal y nadie lo notó.
- **Wompi exige la moneda en MAYÚSCULA** (`COP`/`USD`/`GTQ`) tanto en la firma de integridad como en el payload del widget — el resto del sistema (incluido Stripe) usa minúscula como convención interna. Normalizado en el borde, dentro de `wompi.provider.ts` (`createCharge`), nunca en las capas de arriba.
- **Probar pagos/NFC/Google login desde el celular necesita DOS túneles, no uno:** uno para `apps/web` (:3000, lo que el celular visita) y otro para `apps/api` (:3003, lo que ese frontend necesita llamar). Si `apps/web/.env.local` sigue apuntando `NEXT_PUBLIC_API_BASE_URL` a `http://localhost:3003`, el celular interpreta "localhost" como sí mismo y todo login falla en silencio (incluido Google, que además necesita el dominio del túnel de `apps/web` agregado a "Authorized JavaScript origins" en Google Cloud Console — cambios ahí tardan de minutos a un par de horas en propagar).
- **Los túneles "quick" de `cloudflared` (sin cuenta) generan una URL aleatoria nueva cada vez que se reinician — nunca se recupera la misma.** Cualquier cosa física o durable que dependa de esa URL (como un tag NFC del gimnasio) se rompe cada vez que el túnel se cae, y hay que reprogramarla a mano. Antes de matar un proceso `cloudflared` "huérfano" de una sesión anterior, confirmar que no sea un link real en uso — en esta sesión uno de dos túneles de 13 días de antigüedad resultó ser el NFC físico que usan clientes reales del gimnasio. La solución de fondo (dominio propio + túnel con nombre fijo, o deploy real) sigue pendiente — ver Actividad 2 de la sección de próximas actividades.
- **Oura: los datos de sueño (REM/Ligero/Profundo/Despierto) pueden tardar horas en aparecer en la API pública v2 después de que ya se ven en la app del teléfono** (sesión 2026-08-31→09-01) — la app usa un pipeline interno más rápido que lo que exponen a integraciones de terceros. Antes de asumir que un re-sync "no trajo lo de hoy" es un bug de Ephirox, cruzar contra el `readiness` del mismo día: si ese sí llegó con los mismos parámetros de fecha, confirma que el sync funciona bien y el retraso es solo de Oura, no de nuestro código.
- **Para leer un `.xlsx` sin abrir Excel ni instalar `openpyxl`:** es un zip — `python3 -c "import zipfile; z = zipfile.ZipFile(path); ..."` sobre `xl/sharedStrings.xml` + `xl/worksheets/sheetN.xml` (mapear el nombre de hoja a `sheetN.xml` vía `xl/_rels/workbook.xml.rels`) alcanza para extraer filas/columnas sin dependencias nuevas. Usado en la sesión 2026-08-31→09-01 para verificar `Documentos/Matriz_Reglas_Mentoria.xlsx` antes de inventar rangos "óptimos" para marcadores nuevos.
- **Para inspeccionar/verificar hipótesis contra datos reales de producción (no solo tests):** un script `tsx` desechable con el paquete `postgres` apuntando a `DATABASE_URL` (mismo patrón que las migraciones manuales, ver más arriba) sirve también para leer filas reales y confirmar o descartar una causa raíz antes de tocar código — usado en la sesión 2026-08-31→09-01 para descartar un bug de mapeo de Oura comparando contra el `rawData` crudo guardado, y para verificar en vivo (re-disparando `sincronizarOura`) que un fix realmente resolvía lo reportado. Siempre borrar el script al terminar.
- **`vi.useFakeTimers()` desde el `beforeEach` de un test cuelga `findByText`/`waitFor` de Testing Library** (sesión 2026-08-31→09-01, `client-rest-panel.test.tsx`): esos helpers reintentan internamente vía `setTimeout`, y si ese `setTimeout` ya está falseado y nadie lo avanza, se quedan esperando para siempre (`Test timed out in 5000ms`). Patrón correcto: dejar que la carga inicial real del componente termine primero con timers reales, activar `vi.useFakeTimers()` recién después de esa primera aserción, y de ahí en adelante usar `await vi.advanceTimersByTimeAsync(ms)` + aserciones síncronas (`getByText`/`queryByText`) — nunca `findByText`/`waitFor` — mientras los timers sigan falseados.
- **`screenForPathname()` (`apps/web/lib/theme.ts`) tiene un fallback silencioso a `"dashboard"` (siempre `dark-brand`, sin toggle) para cualquier ruta sin entrada explícita** — ya causó dos bugs reales de "pantalla negra en tema claro" (Configuración y el menú principal "/", sesión 2026-08-31→09-01). El script anti-flash de `ThemeRoot.tsx` duplica esta misma lista a propósito en un string inline (no puede importar el módulo real porque corre antes de la hidratación de React) — cualquier ruta nueva que deba seguir el toggle hay que agregarla en AMBOS lugares o vuelve a aparecer el mismo bug.
- **Para verificar visualmente un cambio de CSS/HTML sin un navegador con GUI disponible en la sesión (sin MCP de Chrome DevTools configurado):** `"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" --headless --disable-gpu --no-sandbox --screenshot=out.png --window-size=W,H --virtual-time-budget=3000 "file:///ruta/al.html"` renderiza un HTML local a PNG sin abrir ventana — sirve para confirmar de verdad un ajuste visual (ej. alineación de texto) en vez de asumir por lectura de código. Usado en la sesión 2026-08-31→09-01 para confirmar que el eslogan del PDF de nutrición quedó alineado bajo el naming (sección 8). Requiere extraer el HTML/CSS real a un archivo standalone primero si vive embebido en un string de TS/JS.
