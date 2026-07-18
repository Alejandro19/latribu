# Spec: LATRIBU — Backend (pasada 1 de 3: back → front → seguridad)

## Objective

Dejar el backend de LATRIBU completo y correcto, sirviendo los 6 módulos del portal de cliente (entrenamiento, alimentación, suplementación, gestión de cortisol, comunidad de eventos, evolución/KPIs) más InBody/composición corporal, para que Alejandro (coach, único desarrollador) pueda asignar contenido a sus clientes activos de coaching 1:1 y ellos lo consulten desde una sola herramienta.

Éxito = cada endpoint de cada módulo funciona correctamente, los datos que el schema modela se pueden crear/leer/actualizar/borrar sin bugs, y el gap conocido (PDF de alimentación/suplementación) queda cerrado.

## Tech Stack

- Node.js + Express 4
- Supabase (Postgres + Storage) vía `@supabase/supabase-js`, con RLS `deny_all` — todo el acceso pasa por el backend con la service role key
- Auth propia: bcryptjs + jsonwebtoken (JWT), sin Supabase Auth
- Multer (memoria) para uploads de archivos/fotos/videos
- Google Cloud Vision para OCR de reportes InBody
- Frontend: `index.html` estático servido por el mismo Express (sin build step, un solo archivo)
- Deploy: Vercel (visto en commits recientes de routing)

## Commands

```
Start:  npm start        (node server.js)
Dev:    npm run dev       (nodemon server.js)
Test:   no configurado todavía (sin test script)
Lint:   no configurado todavía
```

## Project Structure

```
server.js       → todo el backend: rutas, middlewares, lógica (1131 líneas, monolítico)
schema.sql       → esquema completo de Postgres/Supabase, ya modela los 6 módulos
index.html       → todo el frontend (onboarding + portal), un solo archivo
tasks/           → spec.md, plan.md, todo.md de esta iniciativa (nuevo)
sessions.md      → bitácora de cambios por sesión
```

No hay separación en rutas/controladores/servicios — todo vive en `server.js`. Esta pasada de backend **no** incluye reestructurar en múltiples archivos salvo que se decida explícitamente (evitar un refactor grande no pedido).

## Code Style

Patrón existente a seguir (de `server.js`):

```js
app.post('/api/clients/:id/supplements', authMiddleware, adminOnly, async (req, res) => {
  try {
    const { name, brand, dose, timing, benefit, category } = req.body;
    const { data, error } = await supabase.from('supplements').insert({
      client_id: req.params.id, name, brand, dose, timing, benefit, category
    }).select().single();
    if (error) throw error;
    res.json({ supplement: data });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});
```

- Rutas REST bajo `/api/...`, agrupadas por recurso (`/api/clients/:id/<módulo>`)
- Middlewares de autorización explícitos por ruta: `authMiddleware`, `adminOnly`, `ownerOrAdmin`
- try/catch por endpoint, error como `{ error: e.message }` con status 500 genérico (mejorable, pero se mantiene el patrón salvo que la pasada de seguridad lo cambie)
- Sin capa de validación de input aparte de checks manuales — se respeta el patrón actual en esta pasada

## Testing Strategy

- No hay suite automatizada hoy. Para esta pasada: verificación manual por endpoint tocado (llamada real vía curl/Postman o desde el frontend) antes de dar una tarea por terminada.
- No se introduce un framework de testing en esta pasada (fuera de alcance — se evalúa en una pasada futura si Alejandro lo pide).

## Boundaries

- **Siempre:** verificar manualmente cada endpoint modificado antes de marcarlo hecho; mantener el patrón de auth existente (`authMiddleware`/`adminOnly`/`ownerOrAdmin`) en cualquier ruta nueva; actualizar `schema.sql` si se agregan columnas/tablas.
- **Preguntar primero:** cualquier cambio de schema que borre o migre datos existentes; agregar dependencias nuevas al `package.json`; cualquier cambio que toque `CORS`/`JWT_SECRET`/seguridad (se documenta ahora, se corrige en la pasada de seguridad salvo que Alejandro pida adelantarlo); `git push`.
- **Nunca:** commitear secretos reales (ya hubo un incidente con `.env.example`, corregido); tocar `node_modules/`, `vendor/`, `.git/`; eliminar el patrón RLS `deny_all` de Supabase.

## Success Criteria

- [ ] Todos los endpoints existentes (auth, clients, personal-info, anthropometrics, photos, inbody-records, exercises, nutrition/meals, supplements, cortisol-techniques, community events/therapies + reservations, evolution) probados manualmente y sin errores conocidos
- [ ] Gap de PDF cerrado: `nutrition_plans` y `supplements` soportan subir y descargar un PDF por cliente (columnas `pdf_url`/`pdf_name`), siguiendo el mismo patrón de upload ya usado en `exercises`/`cortisol_techniques` (video)
- [ ] Hallazgos de seguridad detectados durante esta pasada quedan documentados en `sessions.md` para la pasada 3, no resueltos a medias aquí
- [ ] `schema.sql` actualizado si se agregan columnas/tablas nuevas

## Decisions (antes Open Questions)

1. **PDF de alimentación/suplementación:** columna `pdf_url` (+ `pdf_name`) en `nutrition_plans` y `supplements`, mismo patrón que `video_url`/`video_name` en `exercises`. Un PDF activo a la vez por módulo/cliente — no se versiona historial por ahora.
2. **InBody/medidas/fotos:** se incluye en el alcance de esta pasada de backend, junto con el resto de módulos.
