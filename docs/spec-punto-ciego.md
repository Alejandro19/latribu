# Spec: Módulo "Punto Ciego"

## Objetivo

Nuevo módulo premium exclusivo del tier **Mentoría** ($4,000 USD). Alejandro hace una evaluación inicial de alto nivel a un cliente de Mentoría y, con base en eso, lo **refiere** a un terapeuta especializado (biodescodificación u otra modalidad) de una red curada. El terapeuta hace seguimiento (tareas, sesiones) **dentro de La Tribu**, no en herramientas externas, para que esa data quede en la plataforma y se use de forma recurrente.

Decidido en sesiones de council previas (no reabrir):
- Nombre visible: **"Punto Ciego"**.
- No se guarda contenido clínico crudo (transcripciones, notas clínicas detalladas) — solo estructura: tareas, marcadores de progreso, estado de caso.
- Debe existir un mecanismo de escalación de crisis visible para el terapeuta y para Alejandro.
- El activo diferenciador es el criterio de Alejandro (evaluación inicial + notas privadas), no el módulo en sí.

Éxito de la Fase 1 (MVP): Alejandro puede crear un caso, asignarlo a un terapeuta, el terapeuta puede loguearse y gestionar tareas/sesiones de sus casos asignados, y el cliente ve su propio progreso — todo sin guardar contenido clínico sensible en texto libre extenso.

## Decisiones confirmadas con el usuario

1. **Terapeuta = tercer rol con login propio.** Tabla `therapists` separada de `admins`/`clients`. Sin auto-registro — Alejandro crea la cuenta desde su panel y comparte el acceso.
2. **Visibilidad del cliente:** ve sus tareas (completas) + una nota corta opcional que el terapeuta decide escribirle tras cada sesión. El resumen interno de la sesión (para uso de terapeuta + Alejandro) NO es visible al cliente.
3. **Alerta de crisis:** notificación dentro del panel admin (reutilizando `adminNotifications`) **y** email inmediato a Alejandro g619alejandro@gmail.com reutilizando el servicio de nodemailer ya presente en `apps/api/src/services/personal-info.service.ts`.

## Tech Stack

- Monorepo existente: `apps/web` (Next.js, App Router) + `apps/api` (Express + TypeScript).
- ORM: Drizzle (`apps/api/src/models/schema.ts`).
- Auth: JWT propio (`apps/api/src/services/auth.service.ts`), roles actuales `'admin' | 'cliente'` — este spec agrega `'terapeuta'`.
- Estilos: Tailwind para vistas de cliente/terapeuta; objetos `React.CSSProperties` inline para el panel admin (convención ya usada en Cortisol/Descanso/Comunidad/Mi Evolución).
- Email transaccional: `nodemailer` (ya configurado, ver `EMAIL_FROM`/`EMAIL_TO` en `personal-info.service.ts` como referencia de patrón — para crisis se envía a Alejandro, no a `EMAIL_TO` genérico si ese valor no es el suyo; confirmar destino en implementación).

## Commands

```
Dev web:  npm run dev:web
Dev api:  npm run dev:api
Test api: npm test --workspace apps/api
Test web: npm test --workspace apps/web
Build:    npm run build
```
(Confirmar en `package.json` raíz si los scripts exactos difieren — usar los ya existentes, no inventar nuevos.)

## Modelo de datos (nuevas tablas en `apps/api/src/models/schema.ts`)

Prefijo `blindspot_` para evitar colisión con las tablas ya existentes `communityTherapies`/`therapyReservations` (que son un directorio de descuentos de terceros, no relacionadas con este módulo).

```typescript
// ==== PUNTO CIEGO MODULE (módulo Mentoring) ====

export const therapists = pgTable('therapists', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull(),
  email: text('email').notNull().unique(),
  passwordHash: text('password_hash').notNull(),
  specialty: text('specialty'), // ej. "Biodescodificación"
  phone: text('phone'),
  active: boolean('active').notNull().default(true),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
});

export const blindspotCases = pgTable('blindspot_cases', {
  id: uuid('id').primaryKey().defaultRandom(),
  clientId: uuid('client_id').notNull().references(() => clients.id, { onDelete: 'cascade' }),
  therapistId: uuid('therapist_id').references(() => therapists.id),
  status: text('status').notNull().default('evaluando'), // evaluando | referido | en_proceso | cerrado
  initialAssessment: jsonb('initial_assessment').notNull().default({}), // { motivoConsulta, areaPercibida, prioridad }
  adminPrivateNotes: text('admin_private_notes'), // SOLO visible para admin, nunca al terapeuta ni al cliente
  crisisFlag: boolean('crisis_flag').notNull().default(false),
  crisisFlaggedAt: timestamp('crisis_flagged_at', { withTimezone: true }),
  crisisFlaggedBy: text('crisis_flagged_by'), // 'cliente' | 'terapeuta' | 'admin'
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
});

export const blindspotTasks = pgTable('blindspot_tasks', {
  id: uuid('id').primaryKey().defaultRandom(),
  caseId: uuid('case_id').notNull().references(() => blindspotCases.id, { onDelete: 'cascade' }),
  title: text('title').notNull(),
  description: text('description'),
  dueDate: date('due_date'),
  status: text('status').notNull().default('pendiente'), // pendiente | completada | omitida
  createdBy: uuid('created_by').notNull().references(() => therapists.id),
  completedAt: timestamp('completed_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
});

export const blindspotSessionLogs = pgTable('blindspot_session_logs', {
  id: uuid('id').primaryKey().defaultRandom(),
  caseId: uuid('case_id').notNull().references(() => blindspotCases.id, { onDelete: 'cascade' }),
  sessionDate: date('session_date').notNull(),
  progressMarker: text('progress_marker').notNull(), // avance | estable | retroceso | cerrado
  internalSummary: text('internal_summary'), // privado: terapeuta + admin. Copy en UI advierte: sin detalle clínico sensible.
  clientNote: text('client_note'), // opcional, corto, visible al cliente
  createdBy: uuid('created_by').notNull().references(() => therapists.id),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
});

export type Therapist = typeof therapists.$inferSelect;
export type BlindspotCase = typeof blindspotCases.$inferSelect;
export type BlindspotTask = typeof blindspotTasks.$inferSelect;
export type BlindspotSessionLog = typeof blindspotSessionLogs.$inferSelect;
```

**Límite deliberado de diseño:** `internalSummary` y `description`/`title` de tareas deben tratarse como campos cortos y estructurados en la UI (placeholder y copy de advertencia: "No incluyas detalles clínicos sensibles ni transcripciones aquí — usa esto como bitácora de seguimiento, no como historia clínica"). No se agrega límite de caracteres duro a nivel de base de datos para no ser frágiles, pero sí a nivel de UI (ej. `maxLength` en el textarea, ~500 caracteres).

## Roles y permisos

- Agregar `'terapeuta'` a la unión de roles en `TokenPayload` (`apps/api/src/services/auth.service.ts`).
- Nuevo endpoint de login: `POST /api/auth/therapist/login` (email + password) → firma JWT con `{ id, role: 'terapeuta', name, email }`, mismo patrón que `signToken` para admin/cliente.
- Nuevo middleware `therapistOnly` (paralelo a `adminOnly` en `auth.middleware.ts`): `if (req.user?.role !== 'terapeuta') return unauthorized(...)`.
- Nuevo middleware `caseAccessOnly`: para rutas `/api/blindspot/therapist/cases/:id*`, verifica `blindspotCases.therapistId === req.user.id` antes de permitir acceso — un terapeuta nunca ve casos que no son suyos.
- Admin: acceso total, pero las acciones de creación de caso deben validar que el `client.clientType === 'mentoring'` (reusar la misma lógica que `isMentoringClient` en `apps/web/lib/rest-logic.ts`, replicada en el backend — hoy ese helper vive solo en `apps/web`, hay que espejarlo en `apps/api` o exponerlo desde un paquete compartido si existe).
- Cliente: solo puede leer/actualizar su propio caso (`ownerOrAdmin`-style), y solo si `clientType === 'mentoring'` — si no, la ruta responde 403 y el front muestra un estado "bloqueado" en vez de la vista completa.

## API Endpoints (`apps/api/src/routes/blindspot.routes.ts` + controller/service correspondientes)

**Admin** (`adminOnly`):
- `POST /api/blindspot/cases` — crea caso (referral) para un cliente mentoring, con `initialAssessment`.
- `GET /api/blindspot/cases` — lista todos los casos (dashboard admin).
- `GET /api/blindspot/cases/:id` — detalle completo, incluye `adminPrivateNotes`.
- `PATCH /api/blindspot/cases/:id` — actualizar status / asignar `therapistId` / editar `adminPrivateNotes`.
- `PATCH /api/blindspot/cases/:id/crisis/acknowledge` — marcar alerta de crisis como atendida.
- `POST /api/blindspot/therapists` / `GET /api/blindspot/therapists` / `PATCH /api/blindspot/therapists/:id` — alta, listado y desactivación de terapeutas.

**Terapeuta** (`therapistOnly` + `caseAccessOnly` donde aplique):
- `GET /api/blindspot/therapist/cases` — casos asignados a mí.
- `GET /api/blindspot/therapist/cases/:id` — detalle (sin `adminPrivateNotes`).
- `POST /api/blindspot/therapist/cases/:id/tasks` — asignar tarea.
- `PATCH /api/blindspot/therapist/cases/:id/tasks/:taskId` — actualizar tarea.
- `POST /api/blindspot/therapist/cases/:id/sessions` — registrar sesión (`progressMarker`, `internalSummary`, `clientNote` opcional).
- `POST /api/blindspot/therapist/cases/:id/crisis` — levantar alerta de crisis → dispara notificación + email a Alejandro.

**Cliente** (`ownerOrAdmin`-style, scoped a su propio caso):
- `GET /api/blindspot/my-case` — status, terapeuta asignado, tareas, timeline de `progressMarker` + `clientNote` (nunca `internalSummary`).
- `PATCH /api/blindspot/my-case/tasks/:taskId` — marcar tarea propia como completada.
- `POST /api/blindspot/my-case/help` — "necesito ayuda urgente" → levanta `crisisFlag` desde el lado del cliente, misma notificación + email.

## Notificaciones y alerta de crisis

- Reutilizar la tabla `adminNotifications` existente, agregando un nuevo `type: 'blindspot_crisis'` (y `'blindspot_case_created'` si se quiere visibilidad de nuevos casos) — no crear tabla de notificaciones nueva.
- Al setear `crisisFlag = true` (desde cliente o terapeuta): insertar en `adminNotifications` + enviar email inmediato a Alejandro reutilizando `nodemailer` con el mismo patrón de `personal-info.service.ts` (confirmar en implementación cuál es la dirección real de Alejandro, no asumir que `EMAIL_TO` genérico ya apunta a él).
- El email debe incluir: nombre del cliente, quién levantó la alerta (cliente/terapeuta), y un link directo al caso en el panel admin.

## Vistas de UI

### 1. Admin (Alejandro) — `apps/web/app/(app)/blindspot/page.tsx` → `AdminBlindspotPanel`
Sigue el patrón "Mi Evolución": panel de gestión completo en `React.CSSProperties` inline.
- Tabla de todos los casos: cliente, status, terapeuta asignado, última sesión, badge rojo si `crisisFlag` activo.
- Detalle de caso: formulario de evaluación inicial (`initialAssessment` estructurado, no texto libre extenso), selector de terapeuta, textarea de `adminPrivateNotes`, timeline de sesiones (marcador + resumen interno, visible solo aquí), lista de tareas (solo lectura desde admin), botón de "atender alerta de crisis".
- Pantalla de gestión de terapeutas: alta/edición/desactivación (nombre, email, especialidad, activo/inactivo). Al crear, genera contraseña temporal que Alejandro comparte manualmente con el terapeuta (sin flujo de invitación por email en el MVP — se puede agregar después).

### 2. Cliente (mentee) — misma ruta `page.tsx`, renderiza `ClientBlindspotPanel` si `role === 'cliente' && clientType === 'mentoring'`
Tailwind, consistente con el resto de vistas de cliente.
- Si `clientType !== 'mentoring'`: estado bloqueado/upsell en vez del panel (mismo patrón que otros módulos exclusivos de mentoring).
- Si `status === 'evaluando'`: mensaje "Tu evaluación está en proceso con Alejandro".
- Si tiene terapeuta asignado: nombre del terapeuta, lista de tareas (pendientes/completadas, marcar como hecha), timeline simple con `progressMarker` + `clientNote` cuando exista (sin `internalSummary`).
- Bloque discreto de "¿necesitas ayuda urgente?" que dispara `POST /my-case/help`.

### 3. Terapeuta — ruta independiente, ej. `apps/web/app/(therapist)/blindspot/page.tsx`, con su propio login en `apps/web/app/(therapist)/login/page.tsx`
**Decisión de diseño:** shell propio y minimalista, separado del layout `(app)` actual (que asume solo admin/cliente en su navegación). Menor riesgo de romper el layout existente que intentar inyectar un tercer rol ahí.
- Login simple (email + password) contra `/api/auth/therapist/login`.
- Lista de mis casos asignados (nombre del cliente, status, última actividad).
- Detalle de caso: evaluación inicial de Alejandro (contexto, sin `adminPrivateNotes`), lista de tareas (crear/editar/marcar completada/omitida), registro de sesión (fecha, `progressMarker`, `internalSummary`, `clientNote` opcional), botón prominente y siempre visible de "Marcar caso en crisis".

## Testing Strategy

- Backend: tests de integración por endpoint en `apps/api/test/` siguiendo el patrón de `ocr.routes.test.ts` — cubrir explícitamente: (a) un terapeuta no puede acceder a casos que no son suyos (`caseAccessOnly`), (b) un cliente no-mentoring recibe 403 en todas las rutas de `/my-case`, (c) levantar `crisisFlag` dispara la notificación (mockear `nodemailer`).
- Frontend: tests de render por rol en `apps/web/test/`, siguiendo el patrón de `admin-community-panel.test.tsx` — verificar que `ClientBlindspotPanel` nunca renderiza `internalSummary` aunque venga en la respuesta de API (defensa en profundidad, no confiar solo en que el backend no lo mande).

## Boundaries

- **Siempre:** validar `clientType === 'mentoring'` en el backend antes de cualquier operación de este módulo (nunca confiar solo en el gating del frontend). Correr tests antes de cada commit.
- **Preguntar primero:** cambios al schema de `blindspot_*` una vez haya datos reales cargados (migraciones destructivas), agregar cualquier integración de calendario/scheduling (fuera de alcance del MVP), exponer `internalSummary` al cliente en cualquier futuro cambio.
- **Nunca:** guardar transcripciones o contenido clínico extenso en `internalSummary`/`description` — la UI debe advertir esto explícitamente. Nunca permitir que un terapeuta lea casos de otro terapeuta. Nunca commitear credenciales de email/nodemailer.

## Success Criteria

- [ ] Alejandro puede crear un caso para un cliente mentoring y asignarle un terapeuta.
- [ ] El terapeuta puede loguearse, ver solo sus casos asignados, asignar tareas y registrar sesiones.
- [ ] El cliente ve sus tareas y el `clientNote` (si existe), nunca el `internalSummary`.
- [ ] Levantar una alerta de crisis (desde cliente o terapeuta) genera una notificación en el panel admin Y un email a Alejandro.
- [ ] Un cliente con `clientType !== 'mentoring'` no puede acceder a ninguna ruta de este módulo (403 verificado por test).
- [ ] Un terapeuta no puede acceder a un caso que no le fue asignado (403 verificado por test).

## Open Questions

1. ¿Cuál es la dirección de email real donde Alejandro quiere recibir las alertas de crisis? (`g629alejandro@gmai.com` actual en `personal-info.service.ts` puede no ser la correcta para esto).
2. ¿El terapeuta necesita poder ver el historial completo de biomarcadores/wearables del cliente (módulo Dispositivos y Laboratorios), o su acceso debe limitarse estrictamente a lo relacionado con Punto Ciego? (Asumido: Si tiene acceso a Información Personal,tambien a su propio caso).
3. ¿Se requiere flujo de invitación por email para terapeutas en el MVP, o basta con que Alejandro comparta la contraseña temporal manualmente? (Asumido: manual para el MVP).
