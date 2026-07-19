# sessions.md

Registro de cambios por sesión de trabajo con el asistente. Cada entrada resume qué se pidió (brief.md u otra instrucción directa) y qué se modificó en el código.

---

## 2026-07-17

**Origen:** tareas descritas en `brief.md`.

- **Módulo Alimentación** (campos condicionales probióticos/suplementos): revisado, ya estaba implementado correctamente en `initFieldDependencies` (index.html). Sin cambios.
- **Módulo Historial de Salud** (duplicado de "Último chequeo médico"): revisado, no se encontró duplicado en el código actual. Sin cambios — pendiente de confirmar con el usuario si el duplicado existe en otro lugar.
- **Módulo Información Personal / Composición corporal** (preview en grid view con columna de mes para InBody, medidas antropométricas y fotos):
  - Bug encontrado: `renderM3ProgressGrid()` ya generaba la tabla con columna "Mes", pero apuntaba a un contenedor `#m3-progress-grid` que no existía en el HTML, por lo que nunca se mostraba.
  - Se agregó el contenedor `#m3-progress-grid` en `renderBodyModuleBlock()` (index.html).
  - Se agregó `m3RefreshProgressGridWithPending()` para mostrar en el grid el registro InBody recién autocompletado por OCR (aún no guardado), combinado con el historial ya guardado.
  - Se conectó esa función al final de `m3HandlePdf()`, para que el preview se actualice automáticamente justo después del autocompletado.

**Intención confirmada (skill `interview-me`):** visión general del proyecto acordada con el usuario para las próximas sesiones.

- **Outcome:** completar el desarrollo de LATRIBU en tres pasadas ordenadas — backend → frontend → seguridad. Cada pasada corrige lo existente y construye la funcionalidad que falta de los 6 módulos del portal de cliente: programa de entrenamiento (links YouTube), plan de alimentación (PDF), esquema de suplementación (PDF), técnicas de gestión de cortisol (links YouTube), comunidad de eventos, y KPIs con evolución mes a mes.
- **Usuario:** Alejandro, coach y único desarrollador; usuarios finales son sus clientes activos de coaching 1:1 (con miras a clientes internacionales y comunidad wellness a futuro, fuera de alcance por ahora).
- **Por qué ahora:** el backend existe pero está incompleto; el valor central del producto es que el cliente vea su plan y progreso desde una sola herramienta (celular, viajando, días sin sesión presencial), y que el coach tenga mejor seguimiento del progreso.
- **Éxito:** backend completo y corregido → frontend completo y corregido → pasada final de seguridad sobre todo el sistema (dado que maneja datos de salud sensibles: InBody, condiciones médicas, medicamentos).
- **Restricción:** orden estricto back → front → seguridad, no saltar pasadas.
- **Fuera de alcance por ahora:** expansión internacional (pagos, idiomas) y automatizar la asignación de contenido (sigue siendo manual + apoyo de AI para generar/ajustar planes de alimentación, como ya lo hace el usuario).

**Hallazgo urgente de seguridad (fuera del orden back→front→seguridad, atendido de inmediato):** `.env.example` estaba trackeado en git desde el commit inicial con credenciales reales en texto plano (Supabase service role key, Google Vision API key, NVIDIA NIM API key). Se reemplazó por placeholders. **Pendiente del usuario:** rotar las 3 claves en sus respectivas consolas (Supabase, Google Cloud, NVIDIA) — el archivo ya estuvo expuesto en el historial de git si hubo push al remoto (`github.com/Alejandro19/latribu`).

---

## 2026-07-18 — Pasada de Backend completa (spec-driven-development + planning-and-task-breakdown)

Spec y plan en `tasks/spec-backend.md`, `tasks/plan.md`, `tasks/todo.md`. Las 10 tareas se completaron y verificaron contra la base real de Supabase (con datos de prueba creados y eliminados al terminar cada verificación).

**Bugs de código corregidos (`server.js`, `index.html`):**
- Auto-registro público creaba cuentas **activas** con permisos completos sin intervención del coach → ahora quedan `inactive` hasta activación manual, y no se entrega token de sesión.
- `authMiddleware` solo validaba `status` del cliente en el login; una cuenta desactivada seguía teniendo acceso con su token hasta por 8h → ahora se revalida en cada request.
- `permissions` por módulo (entrenamiento/nutrición/suplementos/cortisol/comunidad/evolución) era **solo cosmético** — nunca se aplicaba en el backend. Se agregó `requirePermission()` y se conectó a los 13 endpoints correspondientes.
- Whitelist `INSERTABLE_COLUMNS` descartaba silenciosamente 9 de 13 columnas en cada insert de `bio_inbody_records` (incluyendo `mes_num`) — eliminado (el retry automático por columnas faltantes ya cubre ese caso).
- El frontend (`saveModule3`) tampoco enviaba `mes_num` ni el resto de campos de InBody al backend — corregido, ahora el grid de progreso de la sesión anterior funciona con datos reales.
- Cancelar y volver a reservar el mismo evento/terapia estaba roto (`UNIQUE(event_id, client_id)` + chequeo de duplicados sin filtrar por `status`) — corregido con upsert de status.
- Faltaba el endpoint `DELETE /api/community/therapies/:therapyId/reserve` (asimetría con eventos) — agregado.

**Gaps de infraestructura encontrados y resueltos (bloqueaban producción, no eran bugs de código):**
- La base real de Supabase no tenía columnas que `schema.sql` sí declaraba (`mes_num` en `anthropometric_records`/`progress_photos`, +8 columnas en `bio_inbody_records`, +2 en `nutrition_plans` para PDF) — migraciones en `tasks/migration-2026-07-17.sql`, aplicadas por el usuario vía SQL Editor.
- El bucket de Supabase Storage `latribu-files` **no existía** — ningún upload de archivo (fotos, videos, PDFs, chequeos médicos) había funcionado nunca en producción. Creado vía API (público, límite 25MB) con autorización del usuario.

**Funcionalidad nueva agregada:**
- Alimentación y suplementación: el cliente ahora puede ver y descargar su plan/esquema en PDF (`downloadNutritionPdf`/`downloadSupplementsPdf`, generado en el navegador desde los datos ya guardados — el coach no necesita subir un archivo, solo cargar los datos con ayuda de AI como ya lo hacía). Alimentación además permite adjuntar opcionalmente un PDF externo.

**Pendiente para la pasada de Frontend (próxima pasada):**
- No hay botón "Cancelar reserva" en la UI de comunidad (eventos ni terapias), aunque el backend ya lo soporta.

**Pendiente para la pasada de Seguridad (última pasada):**
- CORS abierto a `origin: '*'` con todos los métodos.
- `JWT_SECRET` tiene fallback inseguro hardcodeado en el código (`'dev_secret_change_in_production'`) si la env var no está seteada.
- Posible enumeración de emails por timing en `/api/auth/login` (bcrypt.compare solo corre si el usuario existe).
- Rotar las 3 claves expuestas en `.env.example` (ver hallazgo de la sesión anterior) — sigue pendiente del usuario.

---

## 2026-07-18 — Frontend: correcciones de UX en Composición Corporal / Mi Evolución

- Campos tipo `chips` (¿Cuáles probióticos?, ¿Cuáles suplementos?) nunca tenían `id="field-<id>"` en `renderField()`, por lo que `initFieldDependencies` nunca los encontraba y el ocultamiento condicional no funcionaba pese a estar bien configurado. Corregido.
- Reestructuración de Composición Corporal / Mi Evolución a pedido del usuario: los 4 sub-módulos (composición corporal, InBody, medidas antropométricas, fotos) pasan a ser **solo de captura** — sin grids ni galerías de datos ya guardados, solo campos vacíos + etiqueta "Siguiente registro: Mes X" por sección. Todo el histórico/comparativo se movió a **Mi Evolución**: comparativa antropométrica, comparativa InBody (los 11 campos del formulario), comparación de fotos lado a lado (con preview ampliable al hacer clic), y 3 gráficos de barras simples (peso total, % grasa, masa muscular) mes a mes.
- Bug encontrado y corregido: `renderPersonalInfo()` repoblaba `onboardingData.weight/height/body_fat` desde el backend en cada render, deshaciendo cualquier intento de "limpiar" esos campos tras guardar. Se quitó esa precarga — ahora esos 3 campos se comportan como el resto (siempre vacíos, listos para un registro nuevo).
- "Cómo te sientes hoy" (check-ins de evolución) rediseñado: se reemplazaron las 5 escalas subjetivas (fuerza/ánimo/confianza/seguridad/energía) por 4 métricas concretas elegidas por el usuario — horas de sueño, adherencia al plan (%), dolor/molestias físicas, nivel de estrés (1-10). Nuevas columnas en `evolution_checkins`.
- Todos los campos de "Información Personal" se marcaron `required: true` (antes solo algunos), incluyendo los campos `chips` (antes se saltaban siempre en `validateStep`) y los campos condicionales que se activan cuando la respuesta es "Sí". Sigue sin mostrar alerts — solo borde/label en rojo (`.field.invalid`). Módulo 3 (Composición Corporal) permanece exento, como se pidió.

## 2026-07-18 — Backend: activación de módulos, tipos de cliente y notificaciones admin

**Contexto:** hasta ahora un cliente activado veía y podía usar los 6 módulos de contenido desde el primer login, sin que el coach hubiera asignado nada. Se rediseñó el flujo de activación:

- **Desbloqueo por módulo:** clientes nuevos arrancan con `permissions` en `false` para entrenamiento/nutrición/suplementación/cortisol (antes todo `true` por defecto — cambiado el `DEFAULT` de la columna). Cada módulo se desbloquea automáticamente (`unlockModule()`) la primera vez que el admin asigna contenido ahí (POST exercises, PUT nutrition / POST meals, POST supplements, POST cortisol-techniques).
- **Comunidad y Mi Evolución** se desbloquean solos en cuanto el cliente completa "Información Personal" (`requireOnboardingComplete` / `requireCommunityAccess`), sin intervención del admin.
- **Notificación al admin:** al completar el onboarding (botón "Finalizar"), se crea una fila en la nueva tabla `admin_notifications` y aparece en la nueva pestaña "Notificaciones" del panel admin (con badge de no-leídas en el nav), en vez de solo el correo que ya se enviaba.
- **Tipos de cliente** (columna nueva `clients.client_type`): Coaching 1:1, Coaching Online, Leads Wellness. El admin lo define al activar la cuenta (nueva UI en la ficha del cliente: selector de tipo + botón activar/desactivar — antes no existía ninguna forma de activar clientes desde el frontend).
  - Coaching 1:1 / Coaching Online: aplica la lógica de desbloqueo por módulo de arriba.
  - Leads Wellness: **no** ven Información Personal ni Mi Evolución (nunca); Entrenamiento/Nutrición/Suplementación quedan bloqueados para siempre; Cortisol y Comunidad se activan de inmediato al clasificar (sin esperar a que el admin asigne contenido ni a que completen onboarding — no aplica, ya que no tienen onboarding).
  - El tipo se puede cambiar después (ej. un lead que se convierte en cliente de pago) desde la misma ficha.
- Verificado end-to-end contra Supabase real con dos clientes de prueba (uno de cada flujo), 12 aserciones, todas correctas; datos de prueba eliminados al terminar.

## 2026-07-18 — Backend: membresía con fecha de vencimiento (retención)

**Motivo:** generar retención/fidelización — el sistema no tenía forma de reflejar que un cliente de pago (Coaching 1:1/Online) dejó de pagar. Se agregó:

- 3 columnas nuevas en `clients`: `plan_duration_days` (30 o 90), `plan_start_date`, `plan_end_date`. Solo aplica a `coaching_1_1`/`coaching_online` — los Leads Wellness no tienen membresía (no pagan, quedan indefinidamente en Cortisol+Comunidad).
- Renovación **manual**: no hay pasarela de pago integrada, así que el admin confirma el pago por fuera del sistema y da clic en "Marcar pago recibido / Renovar plan" (nuevo endpoint `PATCH /api/clients/:id/renew-plan`), que reinicia `plan_start_date=hoy` y recalcula `plan_end_date` según la duración elegida (30/90 días).
- **Bloqueo total** cuando `hoy > plan_end_date`: se implementó centralizado en `ownerOrAdmin` (usado por casi todas las rutas de cliente) y en la rama "coaching" de `requireCommunityAccess`, en vez de tocar cada ruta una por una — así ningún módulo queda expuesto por accidente, incluida Comunidad. Devuelve status `402` (Payment Required) específicamente, para que el frontend lo distinga de otros errores 403.
- El admin nunca se ve afectado por esta lógica (siempre pasa primero en cada middleware).
- Frontend: pantalla de bloqueo dedicada (`renderPlanExpiredScreen`) que reemplaza toda la app y muestra la fecha de vencimiento — se activa tanto al iniciar sesión (`onboardingComplete`/`planExpired` viene de `/auth/me`) como a mitad de sesión (el helper `api()` detecta cualquier respuesta `402` globalmente). Ficha del cliente en el panel admin ahora tiene sección "Membresía" (fecha inicio/fin, estado, selector 30/90 días, botón de renovar) y la lista de clientes muestra tipo + fecha de vencimiento con badge si está vencido, para detectar de un vistazo quién necesita renovar.
- Verificado end-to-end contra Supabase real: cliente con plan vigente (acceso normal), cliente con plan vencido (402 en personal-info y comunidad, `/auth/me` expone `planExpired`, renovación restaura el acceso), lead Wellness sin plan (nunca se bloquea), y admin viendo un cliente vencido sin restricciones. Todas las aserciones correctas; datos de prueba eliminados al terminar.

## 2026-07-18 — Fix: fechas de membresía editables + notificación de registro nuevo

- **Bug reportado:** en la ficha del cliente, los campos "Inicio del plan" y "Vence" estaban `disabled` (eran solo de lectura, calculados automáticamente por el botón "Renovar" a partir de hoy + duración). El usuario esperaba poder escribir las fechas directamente (ej. para backdatear un pago o fijar un vencimiento exacto).
- **Fix:** los campos ahora son `<input type="date">` editables, con un botón nuevo "Guardar fechas de membresía" que llama al mismo endpoint `PATCH /api/clients/:id/renew-plan`, ahora extendido para aceptar `{ plan_start_date, plan_end_date }` directamente (calcula `plan_duration_days` como la diferencia en días) además del flujo original por duración (`{ duration_days }`, que sigue existiendo como atajo "Marcar pago recibido hoy / Renovar" para el caso común de renovar desde hoy). Se valida que `plan_end_date > plan_start_date` (400 si no).
- **Notificación de registro:** `POST /api/auth/register` ahora también crea una fila en `admin_notifications` (`type: 'new_registration'`) apenas se registra un cliente nuevo, sin esperar a que se active ni complete el onboarding — antes solo se notificaba al completar "Información Personal".
- No se requirió migración SQL (no hay columnas nuevas). Verificado contra Supabase real y servidor local: registro crea notificación correcta; renovar con fechas manuales calcula bien la duración; fecha fin <= fecha inicio devuelve 400; el flujo original por duración (30/90 días) sigue funcionando sin cambios. Todas las aserciones correctas; datos de prueba eliminados al terminar.
- **Bug adicional encontrado tras el fix de arriba:** el usuario reportó que "Guardar fechas de membresía" y "Marcar pago recibido / Renovar" no actualizaban la pantalla (aunque el backend sí guardaba). Causa: `renderAdminClientDetail` lee `client` desde el caché `state.clients` (poblado la última vez que se visitó la lista de Clientes) y nunca lo refrescaba tras un PATCH — la UI seguía mostrando los valores viejos. Corregido con un helper `applyUpdatedClient(client)` que reemplaza la entrada correspondiente en `state.clients` con la respuesta del servidor; aplicado a los 4 botones con el mismo patrón: `renewClientPlan`, `saveClientPlanDates`, `activateClient`, `deactivateClient`, `saveClientType`.
- Se agregó campo "Plan contratado" (30/90 días) en la tarjeta Membresía del panel admin, antes de las fechas de inicio/fin. El bloqueo automático al día siguiente del vencimiento ya estaba implementado (`isPlanExpired`: `hoy > plan_end_date`) — no requirió cambios.

## 2026-07-18 — Fix: Composición Corporal ya no pierde datos al navegar entre pasos del wizard

**Bug reportado:** al llenar Composición Corporal (paso 3) y hacer clic en "Guardar y continuar", el sistema guardaba de inmediato los registros (antropometría/InBody/foto) en la base de datos y limpiaba visualmente los campos — comportamiento correcto para *no reaparecer datos históricos* (pedido en una sesión anterior), pero si el cliente volvía al paso 3 con "Anterior" para corregir algo, ya no encontraba nada que editar, y un segundo guardado habría creado un registro duplicado para el mismo mes.

**Fix:** se difirió la escritura real en base de datos (antropometría, InBody, foto) del clic en "Guardar y continuar" al clic final en "Finalizar" (paso 9):
- `saveModule3()` ahora solo captura los valores del formulario en un borrador en memoria (`window._m3Draft`, vía `captureModule3Draft()`) y avanza de paso — ya no llama a las APIs de creación de registros ni limpia los campos.
- `initModule3()` (se ejecuta cada vez que se entra al paso 3, incluido al volver con "Anterior") repuebla los campos desde `window._m3Draft` si existe (`restoreModule3Draft()`), incluida la foto seleccionada (usando `DataTransfer` para reasignarla al `<input type="file">`, ya que el navegador no permite setear `.value` directamente).
- Al hacer clic en "Finalizar" (`saveOnboardingStep(9)`), se llama a `commitModule3Draft()`, que recién ahí crea los registros reales en `anthropometrics`/`inbody-records`/`photos` (con las mismas validaciones de "no crear registro vacío" que tenía antes) y limpia el borrador.
- El borrador vive solo en memoria del navegador (nunca se persiste en el servidor), así que también se pierde automáticamente si se cierra o recarga la app — cumpliendo el pedido de "solo se limpia al cerrar la app o al finalizar" sin código adicional.
- Se eliminó `clearModule3FormFields()` (quedó sin uso tras el cambio).
- Verificado por lectura de código y ejecutando el archivo a través de Node para confirmar que no quedaron errores de sintaxis ni referencias colgantes; pendiente de que el usuario lo pruebe en el navegador (este flujo depende del DOM y de `DataTransfer`, no se presta a un script de verificación de backend).

## 2026-07-18 — Se extiende el guardado diferido a los 9 módulos del onboarding (no solo Composición Corporal)

**Pedido:** "Cada módulo debe tener la misma lógica" que se implementó para Composición Corporal — el botón ya no dice "Guardar y continuar" sino solo **"Continuar"**, y ningún dato se guarda de forma definitiva hasta hacer clic en **Finalizar** (paso 9).

**Cambios:**
- Antes, cada módulo (`saveModule1()` para el módulo 1, `saveOnboardingStep()` para 2 y 4-9) hacía un `PUT /personal-info` inmediato al servidor en cada "Continuar". Ahora esos pasos **no hacen ninguna llamada al servidor** — solo actualizan `onboardingData` en memoria (vía `syncStepFieldsFromDOM`) y avanzan de paso.
- El archivo del chequeo médico (módulo 4, único campo tipo `file` de todo el wizard) tampoco se sube de inmediato: se captura en memoria (`capturePendingFiles`) y se re-adjunta visualmente si el cliente vuelve a ese paso (`restorePendingFileInputs`, con la misma técnica de `DataTransfer` usada en Composición Corporal).
- Todo el guardado real ocurre en un solo lugar, al hacer clic en **Finalizar** (paso 9): sube el archivo pendiente si existe, hace un único `PUT /personal-info` con todos los campos estructurados (módulo 1 + módulo 3) más el `onboarding_report` completo, y confirma el borrador de Composición Corporal (`commitModule3Draft`).
- Se corrigió un efecto colateral necesario para que esto funcionara: antes, `renderPersonalInfo()` volvía a pedir los datos al servidor **en cada paso** (cada `setStep()` re-renderiza la vista). Como ya no se guarda nada intermedio, eso habría sobrescrito lo recién escrito con la versión vieja del servidor. Se agregó un flag en memoria (`_personalInfoLoadedFor`) para traer los datos del servidor una sola vez por cliente/sesión, y solo se vuelve a pedir después de un Finalizar exitoso.
- Consecuencia esperada y buscada: si el cliente cierra la app a mitad del wizard sin llegar a "Finalizar", no queda nada guardado (ni siquiera el módulo 1) — coincide con lo pedido explícitamente ("el único momento donde se almacenan de manera definitiva es cuando se da clic en finalizar").
- Verificado por lectura de código y ejecución del script a través de Node (sin errores de sintaxis); pendiente prueba manual en navegador del flujo completo (llenar varios módulos, ir y volver con Anterior, y finalizar).

## 2026-07-18 — Wizard siempre arranca en blanco tras Finalizar + 4 campos fijos de fotos de progreso

**Pedido 1:** que al hacer clic en Finalizar y guardar en la base de datos, todos los módulos vuelvan a quedar limpios/vacíos por defecto (como ya pasaba en Composición Corporal).

- Se eliminó por completo la re-población de `onboardingData` desde el servidor: antes, `renderPersonalInfo()` traía `onboarding_report` guardado y prellenaba los campos con lo último ingresado. Ahora el wizard **siempre arranca en blanco** — el histórico completo sigue quedando guardado en la base de datos (visible para el admin), pero el formulario del cliente nunca se prellena con él. `renderPersonalInfo()` ya no necesita llamar al servidor en absoluto (dejó de ser `async`).
- Efecto: cada vez que el cliente entra a "Información Personal" (ya sea la primera vez o para un registro mensual posterior), ve los 9 módulos completamente vacíos, sin importar lo que haya guardado antes — consistente con lo pedido.

**Pedido 2:** en Fotos de progreso, reemplazar el selector único de ángulo + 1 campo de archivo por 4 campos fijos, cada uno con su propio adjunto: Frente, Lado Derecho, Lado Izquierdo, Espalda.

- Se agregó la constante `PHOTO_ANGLES` (`frente`, `lado_derecho`, `lado_izquierdo`, `espalda`) y se generan 4 `<input type="file">` independientes en vez de un `<select>` + 1 input.
- El borrador de módulo 3 (`captureModule3Draft`/`restoreModule3Draft`) y la confirmación final (`commitModule3Draft`) se actualizaron para manejar las 4 fotos como un diccionario por ángulo — al Finalizar se sube cada foto presente por separado (mismo endpoint `POST /photos`, llamado hasta 4 veces con el `angle` correspondiente), en vez de una sola.
- Se actualizó "Mi Evolución → Comparativa de fotos" para usar los mismos 4 ángulos con etiquetas legibles ("Lado derecho" en vez de mostrar la clave cruda); antes usaba `['frente','perfil','espalda']`, que ya no correspondía a las opciones del formulario.
- Verificado por lectura de código y ejecución del script a través de Node (sin errores de sintaxis ni referencias colgantes a `photo-angle`/`photo-file` singulares); pendiente prueba manual en navegador.

**Fix de migración relacionado:** el CHECK constraint de `progress_photos.angle` en Supabase seguía limitado a los 3 valores viejos (`frente`,`perfil`,`espalda`), causando el error "violates check constraint progress_photos_angle_check" al finalizar. Se agregó bloque a la migración (`DROP CONSTRAINT` + `ADD CONSTRAINT ... NOT VALID` para no revalidar fotos históricas con `perfil`) y se actualizó `schema.sql`. El usuario ejecutó la migración y se verificó contra Supabase real: los 4 ángulos nuevos insertan correctamente y un valor inválido sigue siendo rechazado.

### Cierre de sesión — resumen del día
Trabajo cubierto hoy: fechas de membresía editables + notificación de registro nuevo, fix de caché de estado en la ficha de cliente (admin), campo "Plan contratado" en Membresía, guardado diferido de Composición Corporal (borrador en memoria hasta Finalizar), extensión del guardado diferido a los 9 módulos del wizard (botón "Continuar", reset a blanco tras Finalizar), 4 campos fijos de ángulo en Fotos de progreso, y la migración de `progress_photos.angle` para soportarlos.

## 2026-07-18 — Rediseño completo del módulo Entrenamiento (días, categorías, reproductor secuencial, frases de mentalidad)

**Pedido (basado en referencias visuales tipo app de fitness):** que los videos de YouTube se reproduzcan dentro de la app (no un link externo), que existan 3 botones por categoría (Warm Up / Cardio / Strength) cada uno con su propio programa, que cada ejercicio muestre series/repeticiones/descanso con un temporizador y un botón de completado en secuencia lógica (uno tras otro), que el menú principal del módulo muestre frases de mentalidad (con biblioteca administrable) y los días de entrenamiento (Día 1, Día 2... según lo que defina el admin por cliente).

**Decisiones confirmadas con el usuario antes de construir** (ver preguntas de esa sesión): cada día tiene sus propias 3 categorías con contenido independiente (no categorías globales fijas); se reemplazan los campos viejos "Método" y "Sección" del formulario admin por "Día" + "Categoría"; las frases son un pool global administrable, con posibilidad de fijar una frase puntual por cliente; el avance entre ejercicios es manual (el cliente marca "Completado", corre un temporizador de descanso visible, y al llegar a cero o al saltar avanza al siguiente).

**Cambios de base de datos** (migración añadida a `tasks/migration-2026-07-17.sql`, pendiente de ejecutar):
- Tabla nueva `mindset_quotes` (quote, author, active) con RLS `deny_all`, igual que el resto de tablas.
- `clients.training_days` (1-7) y `clients.assigned_quote_id` (referencia opcional a una frase fija para ese cliente).
- `exercises`: se agregan `day_number` (1-7) y `category` (`warmup`/`cardio`/`strength`); se migran los valores viejos de `method`/`section` a la categoría más cercana antes de **eliminar esas dos columnas** (ya no se usan en ningún lado del código).

**Backend nuevo:**
- CRUD de frases para el admin: `GET/POST/PATCH/DELETE /api/admin/quotes`.
- `GET /api/clients/:id/quote-of-the-day`: devuelve la frase fija del cliente si tiene una asignada, si no una aleatoria del pool activo.
- `PATCH /api/clients/:id/training-days` y `PATCH /api/clients/:id/assigned-quote` (ambos adminOnly).
- Los endpoints existentes de `exercises` (POST/PUT/DELETE) no cambiaron de forma — ya aceptaban el body genérico vía `dbInsert`/`dbUpdate`, solo cambió qué campos manda el frontend.

**Frontend — módulo Entrenamiento rediseñado en 3 pantallas (navegación en memoria, sin cambiar de ruta):**
1. **Menú principal**: tarjeta con la frase de mentalidad + grilla de "Día 1, Día 2..." según `client.training_days` (si el admin no lo ha configurado, mensaje explicando que falta definirlo). Para el admin agrega además: selector de días + selector de frase asignada, y el formulario de "Agregar ejercicio" ahora con Día + Categoría.
2. **Vista de día**: 3 botones Warm Up / Cardio / Strength con conteo de ejercicios (deshabilitado si no hay ninguno); el admin ve además la lista de ejercicios de ese día con opción de eliminar.
3. **Reproductor secuencial**: video de YouTube embebido (`<iframe>`, se admite cualquier formato de URL — watch/youtu.be/shorts) o el video subido como archivo si no hay YouTube; tarjetas de Series/Repeticiones/Descanso; botón "Marcar completado" que dispara un temporizador de descanso (parseado desde el campo texto, acepta segundos o `mm:ss`) con opción de saltarlo; botones Anterior/Siguiente; mensaje de cierre al completar el último ejercicio de la categoría.
- Nueva vista admin **"Frases"** en el nav (`renderAdminQuotes`): agregar/activar-desactivar/eliminar frases de la biblioteca.
- Se aplicó la guía de la skill `frontend-ui-engineering` (paleta propia del proyecto, sin "estética de IA", estados vacíos, jerarquía tipográfica, accesible por teclado al ser todo `<button>`).

**Pendiente:**
1. El usuario debe correr la migración actualizada en Supabase (agrega `mindset_quotes`, columnas nuevas de `clients`/`exercises`, y elimina `method`/`section` de `exercises`).
2. Verificación end-to-end contra Supabase real pendiente de que la migración se aplique (no se puede probar `mindset_quotes` ni los nuevos campos de `exercises` hasta entonces).
3. Prueba manual en navegador del reproductor (temporizador, embed de YouTube, secuencia completa) — depende del DOM/`setInterval`, no se presta a script de verificación de backend.

**Verificado end-to-end contra Supabase real tras la migración:** biblioteca de frases (crear/listar/activar/desactivar), frase fija por cliente vs. aleatoria del pool excluyendo inactivas, ejercicios con `day_number`/`category` (columnas `method`/`section` confirmadas eliminadas), días de entrenamiento asignables, y bloqueo 403 para Leads Wellness. Todas las aserciones correctas.

## 2026-07-18 — Ajustes al módulo Entrenamiento (orden de categorías + Cardio) y rediseño del resumen admin

**Pedido 1:** orden fijo de categorías Warm Up → Strength → Cardio (antes Warm Up/Cardio/Strength); cuando la categoría es Cardio, la sesión mide **duración** en vez de series/repeticiones.
- Se agregó columna `exercises.duration` (texto libre, mismo formato que `rest_time`: segundos o `mm:ss`).
- Formulario admin: el selector de categoría ahora alterna los campos visibles (`toggleExerciseCategoryFields()`) — Cardio oculta Series/Repeticiones y muestra Duración.
- Reproductor del cliente: para Cardio se muestran los KPI de Duración/Descanso (sin Series/Repeticiones) y el botón principal es "Medir duración" en vez de "Marcar completado" — inicia un cronómetro regresivo (`startCardioDuration`/`stopCardioDuration`) que, al llegar a cero o al detenerlo manualmente, marca el ejercicio completado y entra al mismo flujo de descanso que las demás categorías.
- Se renombró `parseRestSeconds` a `parseTimeToSeconds` (ya se usa tanto para descanso como para duración).

**Pedido 2:** en la ficha del cliente (admin), simplificar "Resumen de onboarding" a lo más relevante (nombre completo, edad, celular, ciudad, profesión, fecha de finalización del plan) y reemplazar la tarjeta "Últimos datos enviados" (que solo mostraba 4 campos fijos) por acordeones con **todas** las respuestas del formulario inicial, organizadas por los mismos 9 módulos del wizard.
- Nueva función `calculateAge(birthdate)` y `renderOnboardingAnswersAccordion(personalInfo, report)` — reutiliza `ONBOARDING_MODULES` para generar un acordeón por módulo con sus preguntas/respuestas reales (incluye campos tipo `chips` unidos por coma); el módulo 1 y 3 usan las columnas estructuradas de `personal_info` en vez de `onboarding_report` (son los únicos que no se guardan ahí).

**Migración añadida** a `tasks/migration-2026-07-17.sql`: `ALTER TABLE exercises ADD COLUMN IF NOT EXISTS duration TEXT;` — pendiente de que el usuario la ejecute.

## 2026-07-18 — "Nivel de disciplina": candado semanal por día + calendario mensual + barra de progreso

**Pedido:** al completar todos los ejercicios de todas las categorías de un día, poder marcar ese "Día N" como completado; en el menú principal mostrar un calendario mensual tipo "nivel de disciplina" con chulito/x por fecha; si el Día 1 no se completó esa semana, los días siguientes (Día 2, 3...) aparecen bloqueados con candado hasta completarlo; y mostrar siempre una barra de progreso mientras el cliente marca ejercicios como completados.

**Decisiones confirmadas con el usuario:** la "semana" para el candado es la semana calendario (lunes a domingo) — se reinicia cada lunes, sin importar qué tan lejos había llegado la semana anterior. El chulito del calendario marca cualquier fecha en la que el cliente completó al menos un "Día N" (no exige que coincida con un día específico asignado a esa fecha).

**Base de datos:** tabla nueva `training_completions` (client_id, day_number, completed_date, `UNIQUE(client_id, day_number, completed_date)` para evitar duplicados) — migración agregada a `tasks/migration-2026-07-17.sql`, pendiente de ejecutar.

**Backend:** `GET/POST /api/clients/:id/training-completions` (ownerOrAdmin + requirePermission('training')). El POST es idempotente por fecha (si ya existe un registro para ese día+fecha, lo devuelve en vez de duplicar).

**Frontend:**
- `getWeekStart()`/`isDayCompletedThisWeek()`/`isDayUnlocked()`: Día 1 siempre desbloqueado; Día N (N>1) requiere que Día N-1 tenga un `training_completions` con fecha dentro de la semana calendario actual. El admin nunca ve el candado (siempre puede entrar a cualquier día para gestionar ejercicios).
- Menú principal: los botones "Día N" bloqueados se deshabilitan con indicador 🔒 y no navegan a ningún lado (no exponen el contenido); tarjeta nueva "Nivel de disciplina" con calendario del mes actual (`renderDisciplineCalendar`) — ✓ verde en fechas con al menos un día completado, ✕ en fechas pasadas sin completar, neutro en fechas futuras.
- Vista de día: barra de progreso (`renderProgressBar`) del día completo (ejercicios completados de todas las categorías / total) + botón "Marcar entrenamiento del día como completado" (habilitado solo cuando el 100% de los ejercicios del día están marcados en la sesión actual; una vez marcado, se reemplaza por un badge y ya no se puede volver a marcar esa semana).
- Reproductor: barra de progreso agregada bajo el encabezado, mostrando el avance dentro de la categoría actual (Warm Up/Strength/Cardio) mientras el cliente va marcando ejercicios.
- Nota de diseño: el "día completado" depende del estado de sesión en memoria (`trainingUI.completed`, igual que el resto del reproductor) — pensado para completarse en una sola sesión de entrenamiento; no se persiste el detalle por ejercicio, solo el evento final "Día N completado" vía `training_completions`.

**Pendiente:** el usuario debe correr la migración actualizada (agrega `training_completions`) antes de poder probar/verificar esta función.

## 2026-07-18 — Calendario más compacto, ajustes de barra de progreso, campana de alertas, semana/día del plan, y frases como afirmaciones

Serie de ajustes rápidos sobre lo construido:

- **Calendario "Nivel de disciplina"**: los íconos seguían viéndose enormes porque el grid ocupaba el ancho completo de la tarjeta (7 columnas de card muy ancho). Se limitó `.cal-grid` a `max-width:280px` centrado, y se redujo aún más el tamaño de texto de número/check.
- **Meta del nivel de disciplina**: se corrigió para medirse contra los días de entrenamiento semanales del cliente × 4 (mes estándar de 4 semanas) en vez de contra todos los días del mes calendario — ej. 3 días/semana → meta de 12 al mes.
- **Progreso visible sin expandir**: el % ahora se muestra como una barra compacta (no solo texto) junto al título "Nivel de disciplina" en la cabecera del acordeón.
- **Campana de alertas para clientes** (`🔔` en el pie del sidebar, solo visible para clientes): calculada en el cliente sin tabla nueva, a partir de datos que ya existen — (1) ritmo de entrenamiento: compara cuántos "Día N" debería llevar completados a estas alturas de la semana (prorrateado por día de la semana transcurrido) contra los realmente completados; (2) adherencia nutricional: si el último check-in de Mi Evolución tiene `adherence_pct < 70`. Si hay alguna alerta, aparece un punto rojo sobre la campana; al hacer clic se despliega un panel con los mensajes. Se calcula una vez al iniciar sesión (`loadClientAlerts()` en `boot()`).
- **"Semana X · Día Y" en el menú principal de Entrenamiento**: texto sutil bajo el encabezado, calculado desde `client.plan_start_date` (o `created_at` si no tiene membresía) para la semana, y desde cuántos días ya completó esta semana calendario para el día correspondiente (`getCurrentPlanWeekAndDay`).
- **Frases con conexión personal**: la tarjeta de frase ahora antecede la frase con "Hola [nombre del cliente], repite después de mí:" y se sugiere (placeholder + descripción en el panel admin) redactarlas como afirmaciones en primera persona (ej. "Estoy trabajando en mi cuerpo con amor y disciplina") en vez de citas genéricas.

No se requirió migración ni cambios de backend — todo se resolvió con los datos ya disponibles.

## 2026-07-18 — Campana en la esquina superior, notificaciones de módulo asignado, adjuntos de Composición Corporal en la ficha admin, y flechas de regreso

**1. Campana reubicada + notificaciones de módulo desbloqueado:**
- La campana (🔔) se movió del pie del menú lateral a una barra superior nueva (`#main-topbar`, esquina superior derecha del contenido), solo visible para clientes.
- Nueva tabla `client_notifications` (persistente, a diferencia de las alertas semanales que son solo calculadas): cada vez que `unlockModule()` desbloquea un módulo por primera vez (entrenamiento, nutrición, suplementación, cortisol), se inserta automáticamente `"Ahora tienes acceso a tu módulo de {módulo}."`. Nuevos endpoints `GET /api/clients/:id/notifications` y `PATCH /api/clients/:id/notifications/read-all` (se marcan como leídas al abrir el panel de la campana).
- El punto rojo de la campana ahora refleja tanto las notificaciones persistentes sin leer como las alertas semanales calculadas (atraso en entrenamiento / adherencia nutricional baja); el panel desplegable muestra ambas.

**2. Adjuntos de Composición Corporal visibles para el admin:**
- Se agregaron columnas `bio_inbody_records.file_url`/`file_name` — antes el flujo de OCR de InBody solo extraía texto y descartaba el PDF/foto original, nunca se guardaba. Ahora, al subir el archivo en Composición Corporal, también se sube a Storage (`POST /api/clients/:id/inbody-upload`) y su URL viaja junto con el registro al confirmarse (Finalizar).
- El acordeón "Respuestas del formulario inicial" del admin, en el Módulo 3, ahora muestra: cada registro InBody con enlace "Ver / descargar PDF" (o "Sin archivo adjunto" para registros históricos sin el nuevo campo), la tabla completa de medidas antropométricas con botón "Descargar PDF" (reutiliza `printAsPdf`), y las fotos de progreso agrupadas por ángulo con miniatura + enlace de descarga.

**3. Flechas de regreso para el admin dentro de los módulos del cliente:**
- Antes, al entrar como admin a Entrenamiento/Nutrición/etc. desde la ficha de un cliente, no había forma de volver salvo re-navegar manualmente. Se agregó un botón "← Volver a la ficha del cliente" en la barra superior (`#main-topbar`), visible automáticamente para el admin en cualquier vista de `CLIENT_NAV` — no fue necesario tocar cada módulo individualmente, se resolvió centralizado en `renderTopbar()`.

**Migración añadida** a `tasks/migration-2026-07-17.sql`: tabla `client_notifications`, columnas `bio_inbody_records.file_url`/`file_name` — pendiente de que el usuario la ejecute antes de poder verificar/probar estas tres funciones.

## 2026-07-18 — Rediseño visual completo de LATRIBU (sistema de diseño nuevo)

**Pedido:** aplicar un nuevo sistema de diseño (documento `prompt_claude_code_latribu.md` provisto por el usuario) a toda la app — tipografía Fraunces/Inter, temas de fondo por módulo (neutro/verde), un "anillo de ritmo" de tres arcos como elemento de marca, mantras por módulo, y varios componentes reutilizables — sin tocar la funcionalidad existente, aplicado también al login.

**Decisión previa acordada con el usuario:** el documento de diseño incluye un módulo "Descanso" que no existía — el usuario pidió construirlo con lógica simple ahora y sumarle funcionalidad real después, en vez de omitirlo.

**Enfoque técnico (para minimizar riesgo sobre la funcionalidad existente):** en vez de reescribir cada color hardcodeado del archivo, se implementó el theming vía **variables CSS en cascada**: `.theme-neutral`/`.theme-green` (aplicadas a `.main`) definen `--tint`, `--tint-line`, `--accent`; los componentes ya existentes (`.card`, `.btn-primary`, `.kpi-tile`, `.day-tile`, `.category-tile`, `.chip.selected`, `.accordion-toggle`, `.wizard-dot.current`) se actualizaron para leer `var(--accent, var(--terracota))` / `var(--tint-line, var(--line))` en vez del color fijo — así, con un solo cambio de clase en `.main` por módulo, todo su contenido se retiñe automáticamente sin tocar la lógica de cada render function.

**Elementos nuevos:**
- **Anillo de ritmo**: SVG de 3 arcos (mañana/dorado, tarde/salvia, noche/terracota-morado) — versión "maestra" en el sidebar (el arco del módulo activo se ilumina, label de texto debajo) y versión "mini" (círculo simple del acento del módulo) en cada panel, vía `applyModuleTheme(viewKey)` llamado en cada `renderNav()`/`renderMain()`.
- **`renderIdentityHeader(title, subtitle, mantraText, mantraLead)`**: helper reutilizable que reemplazó el `<div class="page-header">` de Información Personal, Entrenamiento, Nutrición, Suplementación, Cortisol, Comunidad y Mi Evolución — sin alterar ninguna lógica de datos/eventos debajo del encabezado.
- **Banco de mantras** (`MANTRA_BANK`) por módulo, rotando aleatoriamente en cada render — Entrenamiento sigue usando su propio sistema de frases administrables (quote-of-the-day) en vez del banco fijo, ahora mostrado con el mismo componente visual.
- **Orden de navegación** actualizado siguiendo el recorrido del anillo (mañana→tarde→noche→balance): Información Personal, Entrenamiento, Nutrición, Suplementación, Cortisol, Descanso, Comunidad, Mi Evolución. Puntos de color junto a cada ítem del menú anticipan el arco correspondiente.
- **Transición entre módulos**: fade + `translateY` (~450ms) vía una clase CSS re-disparada en cada `renderMain()`.
- **Login rediseñado**: mismo anillo (estático, los 3 arcos balanceados) sobre el wordmark, fondo neutro del sistema, wordmark en tinta oscura (no color de acento) según la regla de color del documento.
- **Cortisol**: se agregó un `breath-hero` (tres círculos concéntricos + mensaje contextual con la primera técnica asignada) antes de la lista de técnicas existente, sin quitar nada.
- **Módulo Descanso** (nuevo, `renderRest`): horas de sueño reales del último check-in de Mi Evolución (`GET /evolution`, sin backend nuevo); calidad de sueño y hora de dormir se muestran honestamente como "—" (no hay dato aún, no se inventó); checklist de rutina nocturna de 4 ítems (estado solo de sesión, no persiste — a propósito, como base simple); pillrow de sonidos para dormir marcado como "Próximamente". Sin migración ni endpoints nuevos.

**Qué NO se tocó:** ningún endpoint, `onclick`, id de formulario, flujo de guardado, ni dato existente — todos los cambios son de encabezado/envoltorio visual o CSS. Verificado releyendo cada función modificada y comprobando que la lógica interna (fetch, ids, handlers) quedó idéntica.

**Pendiente:** revisión visual en navegador (Node solo valida sintaxis JS/CSS, no verifica que el resultado se vea bien); no requiere migración ni reinicio de servidor backend (cambios 100% de `index.html`).

## 2026-07-18 — Ajuste: se quita el mini-ring, más jerarquía tipográfica en encabezados

- Se eliminó el `mini-ring` (círculo pequeño) de la esquina superior derecha de cada panel — el usuario sintió que no aportaba.
- `identity-header`/`mantra-card` ajustados para mayor contraste: título del módulo más grande y en negrita (30px), subtítulo reducido a etiqueta pequeña en mayúsculas, y la frase de mentalidad creció (20px) para tener más protagonismo visual.

## 2026-07-18 — "Héroes" por módulo (documento `prompt_claude_code_heroes_1.md`)

**Pedido:** aplicar el patrón "una pieza protagonista + máximo dos secciones de soporte" a los 7 módulos, con una composición de hero distinta por módulo (no repetir la misma estructura eyebrow/título/meta/botón en los 7), según seis variantes especificadas por el usuario.

**Principio seguido en todas:** cuando el diseño pedía una cifra o dato que hoy no se registra en ningún lado (calidad de sueño, hora de dormir, "técnicas completadas esta semana", participantes reales de un evento), se mostró honestamente como dato pendiente/placeholder en vez de inventarlo. Nunca se expuso información identificable de otros clientes (el hero de Comunidad usa avatares decorativos genéricos, no fotos/nombres reales, para no filtrar quién asistirá a un evento).

- **Entrenamiento** (hero de texto, fondo oscuro `#2B2621→#3A322A`): eyebrow "HOY · DÍA N · CATEGORÍA", título = el siguiente ejercicio pendiente real del día actual (según `getCurrentPlanWeekAndDay` + `trainingUI.completed`), barra de progreso real, botón "Comenzar sesión" que salta directo a ese ejercicio (`startTodaySession()`, nueva función que reutiliza `trainingUI`/`renderTrainingPlayer` ya existentes).
- **Nutrición** (hero dividido, verde `#3E4A34→#4C5C40`): eyebrow/título de la próxima comida real (`meals[0]`), mini-anillos con los macros **meta** del plan (protein_g/carbs_g/fat_g) — sin simular una "adherencia" que no se mide.
- **Cortisol** (hero centrado, verde claro `#EFF5E8→#DCE8CC`): se restyleó el `breath-hero` que ya existía (círculos de respiración) a la paleta y tamaños del documento; botón "Empezar técnica" abre el video real de la primera técnica asignada si tiene.
- **Descanso** (cifra gigante, índigo `#241C30→#332740`): "ANOCHE DORMISTE" + horas reales del último check-in formateadas "Xh Ym"; se quitó la tarjeta `kpi-row` que mostraba lo mismo dos veces.
- **Mi Evolución** (cifra gigante, ámbar `#4A3510→#5C4318`): "TU RACHA" con una racha de días consecutivos calculada de verdad a partir de `training_completions` (`calculateStreak()`, nueva función, mismo endpoint ya usado en Entrenamiento) + sesiones totales + cambio real de peso entre el primer y último registro antropométrico.
- **Comunidad** (avatares, terracota oscuro `#3A2418→#4A311F`): stack de 3 círculos decorativos (sin datos de personas reales) + el próximo evento real (título/fecha/lugar).
- **Información Personal** (anillo grande, mismo oscuro que Entrenamiento): anillo SVG con el % real de avance del formulario (`paso actual / 9`), título del módulo actual del wizard.

Ningún endpoint, dato guardado, ni flujo de guardado se modificó — todo lo anterior es HTML/CSS nuevo insertado justo debajo de cada mantra, más 3 funciones auxiliares pequeñas (`startTodaySession`, `calculateStreak`, `formatSleepHours`) que solo leen datos ya obtenidos por cada pantalla. Verificado con Node (sintaxis JS y balance de llaves CSS); pendiente revisión visual del usuario en navegador.

## 2026-07-18 — Login: hero dividido con aura de color y tema automático por hora del día

**Pedido** (documento `prompt_claude_code_login_tema.md`): rediseñar el login como dos paneles lado a lado (hero de marca + formulario), con un tema completo que se intercambia entre los dos paneles según la hora real del navegador — antes de las 18:00 un tema, desde las 18:00 el otro — sin usar `prefers-color-scheme` (eso es preferencia del sistema operativo, no la hora del día).

- **Estructura nueva**: `.login-hero` (flex:1, anillo de marca + wordmark + slogan + 3 manchas de color difuminadas de fondo tipo "aura") + `.login-form-panel` (380px fijo, título "Bienvenida de vuelta" + los mismos campos/formularios de siempre, sin tocar `handleLogin()`/`handleRegister()`/`showRegister()`/`showLogin()`).
- **Tema por hora**: `getLoginTheme()` usa `new Date().getHours() < 18` (hora local del navegador, no la del servidor). `applyLoginTheme()` alterna las clases `.theme-login-light`/`.theme-login-dark` en `#login-view`, cada una con su propio set de variables CSS (`--lh-*` para el panel hero, `--lf-*` para el panel formulario) — los dos paneles intercambian toda la paleta entre un tema y otro, tal como pedía el documento, no solo 2-3 valores sueltos.
- Se re-evalúa al cargar la página, al cerrar sesión (`logout()`), y cada 5 minutos (`setInterval`) por si alguien deja la pestaña de login abierta cruzando las 6pm — con `transition: background/color .6s ease` en los elementos relevantes para que el cambio se sienta gradual.
- Se limpiaron reglas CSS viejas de rediseños anteriores del login que quedaban sin usar o en conflicto (`#login-view`/`.login-card` duplicados, `.login-card p.sub` muerta).

Sin cambios de backend ni de lógica de autenticación — 100% visual. Verificado con Node (sintaxis JS y balance de llaves CSS); pendiente que el usuario lo confirme visualmente en ambos horarios (puede forzarlo temporalmente cambiando la hora del sistema, o pedírmelo para agregar un query param de prueba si lo prefiere).

**Ajuste final de la sesión:** el login se recentró en una tarjeta de máx. 840px con bordes redondeados y sombra (`.login-shell`) sobre fondo neutro, en vez de ocupar el 100% del viewport; y el título "Bienvenida de vuelta" (lenguaje de género específico) se cambió a "Qué bueno verte de nuevo" (neutral).

### Cierre de sesión — resumen del día
Trabajo cubierto: rediseño completo del sistema visual de LATRIBU (tipografía Fraunces/Inter, temas neutro/verde por módulo, anillo de ritmo, mantras, componentes reutilizables) aplicado a los 7 módulos + nuevo módulo Descanso; héroes protagonistas distintos por módulo (6 variantes, siempre con datos reales, nunca inventados); rediseño del login con hero dividido + aura de color + tema automático por hora del día, luego recentrado y con copy neutral. Ningún endpoint ni flujo de guardado se tocó en todo el pase de diseño — cambios 100% en `index.html` (HTML/CSS/JS de presentación).
