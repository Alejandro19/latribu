# Todo: LATRIBU — Backend (pasada 1 de 3)

## Task 1: Auditar auth y gestión de clientes ✅

**Description:** Revisar login, registro, cambio de contraseña, y el CRUD de clientes (crear, listar, ver, editar, borrar, permisos, status) para admin y cliente. Corregir bugs encontrados.

**Acceptance criteria:**
- [x] Login de admin y de cliente devuelve un JWT válido y rechaza credenciales inválidas con el status correcto
- [x] `ownerOrAdmin`/`adminOnly` bloquean correctamente accesos cruzados entre clientes
- [x] CRUD de clientes funciona completo desde el panel admin

**Verification:**
- [x] Manual: probar cada endpoint de `/api/auth/*` y `/api/clients*` con curl, como admin y como cliente
- [x] Confirmar que un cliente no puede leer/editar datos de otro cliente

**Resultado:** auto-registro ahora queda `inactive` y sin token; `authMiddleware` revalida status en cada request (antes solo al login); `requirePermission()` agregado y conectado a los 13 endpoints de los 6 módulos asignables (antes `permissions` era solo cosmético en el frontend).

---

## Task 2: Auditar composición corporal (personal-info, anthropometrics, photos, InBody) ✅

**Acceptance criteria:**
- [x] Guardar/leer info personal funciona, incluyendo upload de `checkup_file`
- [x] Medidas antropométricas y fotos se guardan con `mes_num` correcto y aparecen en el grid de progreso
- [x] OCR de InBody extrae y guarda registros correctamente, incluyendo todos los campos

**Resultado:** encontrado y corregido un whitelist `INSERTABLE_COLUMNS` que descartaba silenciosamente 9 de las 13 columnas de `bio_inbody_records` en cada insert; el frontend (`saveModule3`) tampoco enviaba esos campos ni `mes_num` — corregido en `index.html`. Además, la base real de Supabase no tenía las columnas (`mes_num` en 3 tablas, +8 columnas en `bio_inbody_records`) aunque `schema.sql` sí las declaraba — migración aplicada por el usuario (`tasks/migration-2026-07-17.sql`). Verificado end-to-end.

---

## Task 3: Auditar entrenamiento (exercises + upload de video) ✅

**Acceptance criteria:**
- [x] Admin puede crear/editar/borrar ejercicios
- [x] Upload de video guarda el archivo y actualiza `video_url`
- [x] Cliente puede ver sus ejercicios asignados

**Resultado:** sin bugs de código; bloqueado por el bucket de Storage faltante (ver Task 4). Verificado end-to-end tras crear el bucket.

---

## Task 4: Auditar alimentación (nutrition_plans + meals) y agregar descarga de PDF ✅

**Acceptance criteria:**
- [x] Cliente puede ver y descargar su plan de alimentación en PDF
- [x] Admin puede además adjuntar un PDF externo (opcional)

**Resultado:** el diseño cambió respecto al plan original tras aclarar con el usuario: el coach genera el plan con ayuda de AI (datos estructurados ya existentes), no necesariamente sube un archivo. Se implementó `downloadNutritionPdf()` en el frontend (genera PDF vía impresión del navegador desde los datos ya guardados) más un upload opcional (`pdf_url`/`pdf_name` en `nutrition_plans`, endpoint `/nutrition/upload-pdf`) para cuando el coach sí tenga un PDF aparte. **Bloqueador encontrado y resuelto:** el bucket `latribu-files` de Supabase Storage no existía — nunca había funcionado ningún upload de archivo en producción (fotos, videos, PDFs, chequeos). Bucket creado (público, límite 25MB).

---

## Task 5: Auditar suplementación (supplements) y agregar descarga de PDF ✅

**Acceptance criteria:**
- [x] Cliente puede ver y descargar su esquema de suplementación en PDF

**Resultado:** mismo criterio que Task 4 — `downloadSupplementsPdf()` client-side, sin upload (no aplica: `supplements` es una lista de filas, no un documento único). CRUD existente revisado sin bugs.

---

## Task 6: Auditar gestión de cortisol (cortisol_techniques + upload de video) ✅

**Resultado:** estructuralmente idéntico al patrón ya verificado en exercises (mismo upload a Storage). Sin bugs nuevos.

---

## Task 7: Auditar comunidad (events, therapies, reservations) ✅

**Acceptance criteria:**
- [x] Admin puede crear/editar/borrar eventos y terapias
- [x] Cliente puede reservar y cancelar, sin poder duplicar una reserva activa

**Resultado:** bug real encontrado — cancelar y volver a reservar el mismo evento/terapia estaba roto (el `UNIQUE(event_id, client_id)` del schema impedía un nuevo insert tras cancelar, y el chequeo de duplicados no filtraba por `status`). Corregido en ambos endpoints de reserva (upsert de status en vez de solo insert). Además, faltaba por completo el endpoint `DELETE /api/community/therapies/:therapyId/reserve` — el frontend permite reservar terapias pero nunca pudo cancelarlas. Agregado. **Pendiente para la pasada de frontend:** no hay botón "Cancelar reserva" en la UI ni para eventos ni para terapias, aunque el backend ya lo soporta.

---

## Task 8: Auditar evolución/KPIs (evolution_checkins) ✅

**Resultado:** sin bugs. El endpoint ya cruza `evolution_checkins` + `anthropometric_records` + `bio_inbody_records` por cliente, tal como pedía el criterio de éxito.

---

## Task 9: Revisar consistencia general de errores/status codes ✅

**Resultado:** sin cambios de código necesarios. El helper `err(res, message, status = 400)` ya defaultea a 400 (no 500) para validación, y los 61 usos de status 500 en el archivo están correctamente limitados a bloques `catch` de errores reales de servidor.

---

## Task 10: Actualizar sessions.md ✅

Ver entrada correspondiente en `sessions.md`.
