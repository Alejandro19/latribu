# Implementation Plan: LATRIBU — Backend (pasada 1 de 3)

## Overview

Auditar y corregir el backend existente (Express + Supabase) módulo por módulo, siguiendo el mismo orden en que un cliente los usaría (identidad → composición corporal → los 6 módulos de contenido asignado), y cerrar el único gap funcional conocido: PDF descargable en alimentación y suplementación. Cada tarea es una rebanada vertical: un módulo completo (schema + endpoints), no una capa horizontal.

## Architecture Decisions

- Se mantiene el patrón actual: rutas planas en `server.js`, sin separar en controladores/servicios (evitar refactor estructural no pedido).
- PDF de alimentación/suplementación: columnas `pdf_url`/`pdf_name` en `nutrition_plans` y `supplements`, mismo patrón que `video_url`/`video_name` de `exercises` — reutiliza el multer `upload` y el bucket de Supabase Storage ya configurados.
- Hallazgos de seguridad (CORS `*`, `JWT_SECRET` con fallback inseguro, falta de rate limiting, etc.) se anotan en `sessions.md` conforme aparecen, pero se resuelven en la pasada 3 (Seguridad), no aquí — evita mezclar objetivos de esta pasada.

## Task List

### Phase 1: Foundation (identidad y acceso)

- [ ] Task 1: Auditar auth y gestión de clientes
- [ ] Task 2: Auditar composición corporal (personal-info, anthropometrics, photos, InBody)

### Checkpoint: Foundation
- [ ] Login/registro/cambio de contraseña funcionan para admin y cliente
- [ ] CRUD de clientes (crear, listar, editar, permisos, status) funciona para admin
- [ ] Los 4 sub-módulos de composición corporal (info personal, medidas, fotos, InBody) guardan y devuelven datos correctamente

### Phase 2: Los 6 módulos de contenido

- [ ] Task 3: Auditar entrenamiento (exercises + upload de video)
- [ ] Task 4: Auditar alimentación (nutrition_plans + meals) y agregar PDF
- [ ] Task 5: Auditar suplementación (supplements) y agregar PDF
- [ ] Task 6: Auditar gestión de cortisol (cortisol_techniques + upload de video)
- [ ] Task 7: Auditar comunidad (events, therapies, reservations)
- [ ] Task 8: Auditar evolución/KPIs (evolution_checkins)

### Checkpoint: Los 6 módulos
- [ ] Cada módulo soporta crear/leer/actualizar/borrar sin errores, probado manualmente como admin y como cliente (según corresponda)
- [ ] Alimentación y suplementación permiten subir y descargar un PDF por cliente
- [ ] `schema.sql` refleja cualquier columna nueva agregada

### Phase 3: Cierre de la pasada

- [ ] Task 9: Revisar consistencia general (manejo de errores, mensajes, códigos HTTP) entre todos los endpoints tocados
- [ ] Task 10: Actualizar `sessions.md` con el resumen de la pasada de backend y la lista de hallazgos de seguridad pendientes para la pasada 3

### Checkpoint: Backend completo
- [ ] Todos los criterios de aceptación de las Tasks 1-9 cumplidos
- [ ] Lista de hallazgos de seguridad documentada y visible para la pasada 3
- [ ] Listo para pasar a la pasada de Frontend

## Risks and Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| Bugs ocultos solo se detectan probando manualmente cada endpoint (no hay tests automatizados) | Medio | Verificación manual explícita por tarea, documentada en cada checkpoint |
| Cambios de schema (columnas PDF) requieren migración en Supabase real, no solo en `schema.sql` | Medio | Task 4/5 incluyen aplicar el `ALTER TABLE` en Supabase, no solo editar el archivo local |
| Mezclar fixes de seguridad "fáciles" con esta pasada puede desviar el alcance | Bajo | Se documentan en `sessions.md`, no se corrigen aquí (ver Architecture Decisions) |

## Open Questions

- Ninguna pendiente — resueltas en `tasks/spec-backend.md`.
