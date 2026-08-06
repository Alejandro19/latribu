# Especificación Técnica — Migración Frontend La Tribu

> **De:** Monolito SPA `index.html` (HTML/CSS/JS vanilla, 6418 líneas)  
> **A:** Next.js 15 (App Router) + React 19 + TypeScript  
> **Ubicación:** `/apps/web`  
> **Backend:** Express + Drizzle ORM (ya migrado, corriendo en `server.js` y `/apps/api`)  

---

## 🧭 VISIÓN GENERAL

El archivo `index.html` contiene **toda** la aplicación frontend actual: estilos CSS (~430 líneas), layout HTML (~70 líneas), y lógica de negocio JS (~5900 líneas). La migración a Next.js 15 ya comenzó y tiene avances significativos en los módulos de dominio (Entrenamiento, Nutrición, Cortisol, Descanso, Comunidad, Evolución, etc.). Sin embargo, hay **bloques fundacionales que aún residen exclusivamente en `index.html`** y deben migrarse para completar la transición.

---

## 📊 RESUMEN DE LO YA MIGRADO (`/apps/web`)

| Módulo                    | Componente Principal               | Página                   | Estado |
|---------------------------|-------------------------------------|--------------------------|--------|
| Autenticación (login)     | `(auth)/login/page.tsx`            | `/login`                 | ✅ Migrado |
| Onboarding                | `WizardShell`, `WizardField`       | `/onboarding`            | ✅ Migrado |
| Entrenamiento             | `TrainingShell`, `TrainingHome`, etc. | `/training`           | ✅ Migrado |
| Nutrición                 | `AdminNutritionPanel`, `ClientNutritionPanel` | `/nutrition` | ✅ Migrado |
| Cortisol                  | `AdminCortisolPanel`, `ClientCortisolPanel` | `/cortisol`      | ✅ Migrado |
| Descanso                  | `RestToolsAdminPanel`, `RestToolsClientPanel` | `/rest`          | ✅ Migrado |
| Comunidad (Eventos)       | `ClientEventsPanel`, `AdminEventsPanel` | `/community/events`   | ✅ Migrado |
| Comunidad (Terapias)      | `ClientTherapiesPanel`, `AdminTherapiesPanel` | `/community/therapies` | ✅ Migrado |
| Comunidad (Reservas)      | `AdminReservationsPanel`           | `community-reservations` | ✅ Migrado |
| Evolución                 | `ClientEvolutionPanel`             | `/evolution`             | ✅ Migrado |
| Sueño                     | `AdminSleepProtocolPanel`, `ClientSleepPanel` | `/sleep-protocol` | ✅ Migrado |
| Suplementos               | `AdminSupplementsPanel`, `ClientSupplementsPanel` | `/supplements` | ✅ Migrado |
| Frases (admin)            | `PhrasesPanel`                     | `/admin/phrases`         | ✅ Migrado |
| Frases motivacionales     | `QuotesPanel`                      | (parte de admin Quotes)  | ✅ Migrado |
| Tips Cortisol (admin)     | `CortisolTipsPanel`                | `/admin/cortisol-tips`   | ✅ Migrado |
| Herramientas Descanso     | Parte de `RestToolsAdminPanel`     | `/admin/rest-tools`      | ✅ Migrado |

---
## 🔴 BLOQUES PENDIENTES DE MIGRACIÓN

Los siguientes bloques existen **solo en `index.html`** y no tienen equivalente en `/apps/web`.

---

### BLOQUE 1: SISTEMA DE AUTENTICACIÓN (Login + Registro + Google)

#### 1.1 LoginForm

| Campo | Detalle |
|---|---|
| **Nombre** | `LoginForm` |
| **Ubicación** | `/app/(auth)/login/components/LoginForm.tsx` |
| **Estado local** | `email: string`, `password: string`, `error: string \| null`, `isSubmitting: boolean` |
| **Eventos** | `handleLogin()` → `api('/api/auth/login', POST)` |
| **Conexión Backend** | `POST /api/auth/login` — devuelve `{ token, role, user, permissions, clientType, onboardingComplete, planExpired, planEndDate }` |
| **Dependencias** | Google Identity Services (`@react-oauth/google` o `gsi/client` CDN) |

#### 1.2 RegisterForm

| Campo | Detalle |
|---|---|
| **Nombre** | `RegisterForm` |
| **Ubicación** | `/app/(auth)/register/components/RegisterForm.tsx` |
| **Estado local** | `name: string`, `email: string`, `password: string`, `error: string \| null`, `successMessage: string \| null`, `isSubmitting: boolean` |
| **Eventos** | `handleRegister()` → `api('/api/auth/register', POST)`, `showLogin()` / `showRegister()` toggle |
| **Conexión Backend** | `POST /api/auth/register` |

#### 1.3 GoogleSignInButton

| Campo | Detalle |
|---|---|
| **Nombre** | `GoogleSignInButton` |
| **Ubicación** | `/components/auth/GoogleSignInButton.tsx` |
| **Estado local** | `googleClientId: string \| null`, `loading: boolean` |
| **Eventos** | `initGoogleSignIn()` → carga `googleClientId` de `GET /api/config`, renderiza botón de Google, `handleGoogleCredentialResponse()` → `POST /api/auth/google` |
| **Conexión Backend** | `GET /api/config`, `POST /api/auth/google` |
| **Dependencias** | `@react-oauth/google` (npm) o script `accounts.google.com/gsi/client` |

#### 1.4 AuthLoadingOverlay

| Campo | Detalle |
|---|---|
| **Nombre** | `AuthLoadingOverlay` |
| **Ubicación** | `/components/auth/AuthLoadingOverlay.tsx` |
| **Estado local** | `visible: boolean` (controlado por contexto global) |
| **Eventos** | `showAuthLoading()`, `hideAuthLoading()`, listeners `window blur/focus` para manejar popup de Google |
| **Dependencias** | — |



---

### BLOQUE 2: APP SHELL / LAYOUT PRINCIPAL

#### 2.1 AppLayout
| Campo | Detalle |
|---|---|
| Nombre | AppLayout (Server Component wrapper) |
| Ubicacion | /app/(app)/layout.tsx |
| Conexion Backend | GET /api/auth/me (middleware) |

#### 2.2 Sidebar
| Campo | Detalle |
|---|---|
| Nombre | Sidebar |
| Ubicacion | /components/layout/Sidebar.tsx |
| Estado local | `mobileOpen`, `adminHubOpen`, `unreadNotifications` |
| Eventos | `toggleMobileNav()`, `closeMobileNav()`, `toggleAdminHubMenu()` |
| Conexion Backend | GET /api/admin/notifications |

#### 2.3 MobileTopbar
| Campo | Detalle |
|---|---|
| Nombre | MobileTopbar |
| Ubicacion | /components/layout/MobileTopbar.tsx |

#### 2.4 NotificationBell
| Campo | Detalle |
|---|---|
| Nombre | NotificationBell |
| Ubicacion | /components/layout/NotificationBell.tsx |
| Estado local | `panelOpen`, `notifications[]`, `alerts[]`, `hasUnread` |
| Conexion Backend | PATCH /api/clients/:id/notifications/read-all |

#### 2.5 SidebarRing
| Campo | Detalle |
|---|---|
| Nombre | SidebarRing |
| Ubicacion | /components/layout/SidebarRing.tsx |
| Estado local | `activeArc`, `ringLabel` |

#### 2.6 UserChip
| Campo | Detalle |
|---|---|
| Nombre | UserChip |
| Ubicacion | /components/layout/UserChip.tsx |
| Eventos | `logout()` |



---

### BLOQUE 3: SISTEMA DE TEMAS Y ESTILOS (ThemeProvider)

| Campo | Detalle |
|---|---|
| Nombre | ThemeProvider + CSS Custom Properties |
| Ubicacion | /app/layout.tsx (globals.css), /lib/theme.ts |
| Estado local | `moduleTheme: 'neutral' \| 'green'`, `ringArc: ArcType`, `loginTheme: 'light' \| 'dark'` |
| Eventos | `applyModuleTheme(viewKey)`, `applyLoginTheme()` basado en hora |
| Dependencias | Google Fonts: Fraunces + Inter vía `next/font/google` |

**Variables CSS a extraer de index.html (lineas 11-19):**
```
--cream:#FBF7F1; --paper:#FFFFFF; --ink:#2B2420; --ink-soft:#6B6058;
--terracota:#C1662F; --terracota-soft:#F1DDCB; --sage:#6B8F71; --sage-soft:#E3EDE3;
--gold:#D9A441; --line:#E9E1D6; --danger:#C1462F; --radius:16px;
--ring-morning:#D9A441; --ring-afternoon:#5B7A4E; --ring-evening:#8A5FA0;
--bg-neutral:#F5F1E9; --line-neutral:#E7DFC9; --accent-neutral:#B8935A;
--bg-green:#EFF5E8; --line-green:#D9E4CE; --accent-green:#5B7A4E;
```

---

### BLOQUE 4: ADMIN DASHBOARD

| Campo | Detalle |
|---|---|
| Nombre | AdminHome |
| Ubicacion | /app/admin/page.tsx |
| Estado local | `clients[]`, `notifications[]`, `stats` |
| Eventos | carga de clientes + estadisticas |
| Conexion Backend | GET /api/clients, GET /api/admin/notifications |

---

### BLOQUE 5: ADMIN — GESTION DE CLIENTES

#### 5.1 AdminClientList
| Campo | Detalle |
|---|---|
| Nombre | AdminClientList |
| Ubicacion | /app/admin/clients/page.tsx |
| Estado local | `clients[]`, `newClient: {name, email, password}`, `error` |
| Eventos | `createClient()` → POST /api/clients |
| Conexion Backend | GET /api/clients, POST /api/clients |

#### 5.2 AdminClientDetail
| Campo | Detalle |
|---|---|
| Nombre | AdminClientDetail |
| Ubicacion | /app/admin/clients/[id]/page.tsx |
| Estado local | `client`, `clientType`, `wizardStep`, `personalInfo`, `inbodyRecords`, `anthroRecords`, `photos` |
| Eventos | `activateClient()`, `deactivateClient()`, `saveClientType()`, `setStep()` |
| Conexion Backend | GET /api/clients/:id, PATCH /api/clients/:id/client-type, PATCH /api/clients/:id/status |

#### 5.3 AdminClientSwitcher
| Campo | Detalle |
|---|---|
| Nombre | AdminClientSwitcher |
| Ubicacion | /components/admin/ClientSwitcher.tsx |
| Estado local | `search`, `selectedClientId`, `clients[]` |
| Conexion Backend | GET /api/clients |



---

### BLOQUE 6: ADMIN — NOTIFICACIONES

| Campo | Detalle |
|---|---|
| Nombre | AdminNotifications |
| Ubicacion | /components/admin/AdminNotificationsPanel.tsx |
| Estado local | `notifications[]`, `unreadCount` |
| Conexion Backend | GET /api/admin/notifications, PATCH /api/admin/notifications/:id/read |

---

### BLOQUE 7: DEEP LINKS / CONFIRMACION NFC

| Campo | Detalle |
|---|---|
| Nombre | DeepLinkHandler (logica ya en /lib/deep-link.ts) |
| Ubicacion | /app/(app)/layout.tsx |
| Estado local | `pendingAction` |
| Eventos | `captureIncomingDeepLink()`, `consumePendingActionIfAny()` |
| Conexion Backend | POST /api/clients/:id/training/confirm |

---

### BLOQUE 8: PANTALLA DE PLAN VENCIDO

| Campo | Detalle |
|---|---|
| Nombre | PlanExpiredScreen |
| Ubicacion | /components/client/PlanExpiredScreen.tsx |
| Estado local | `endDate` |
| Eventos | se activa al recibir HTTP 402 del backend |

---

### BLOQUE 9: TARJETA DE ENTRENAMIENTO (Instagram Share)

| Campo | Detalle |
|---|---|
| Nombre | TrainingShareCard |
| Ubicacion | /components/training/TrainingShareCard.tsx |
| Estado local | `generating`, `streakWeeks`, `phrase` |
| Eventos | `shareTrainingCard()` → genera canvas 1080x1920, exporta PNG |
| Conexion Backend | GET /api/clients/:id/training/phrase?context=instagram |
| Dependencias | Canvas API, Fraunces Card font (woff2 base64 en index.html lineas 3158-3162) |

---

### BLOQUE 10: GENERACION DE PDF (Plan Nutricional)

| Campo | Detalle |
|---|---|
| Nombre | NutritionPdfGenerator |
| Ubicacion | /components/nutrition/NutritionPdfGenerator.tsx |
| Estado local | `plan`, `supplements[]`, `menu[]`, `recommendations[]` |
| Eventos | `downloadNutritionPdf()` → abre ventana nueva con HTML imprimible |
| Dependencias | CSS de impresion (index.html lineas 3862-3903) |

---

### BLOQUE 11: SISTEMA DE NAVEGACION Y RUTEO

#### 11.1 ClientNavItems
| Campo | Detalle |
|---|---|
| Nombre | ClientNavItems |
| Ubicacion | /components/layout/ClientNavItems.tsx |
| Estado local | `currentView` (derivado de usePathname) |
| Eventos | renderizado condicional segun CLIENT_NAV (matriz de visibilidad) |

**Matriz CLIENT_NAV (index.html lineas 732-740):**
- personal-info → visible si clientType !== 'lead_wellness'
- training → lead_wellness o permissions.training === true
- nutrition → lead_wellness o permissions.nutrition === true
- cortisol → permissions.cortisol === true
- rest → lead_wellness o onboardingComplete === true
- community → lead_wellness o onboardingComplete === true
- evolution → siempre visible

#### 11.2 AdminNavItems
| Campo | Detalle |
|---|---|
| Nombre | AdminNavItems |
| Ubicacion | /components/layout/AdminNavItems.tsx |
| Estado local | `hubOpen`, `unreadNotifications` |


---

### BLOQUE 12: API CLIENT UNIFICADO + GESTION DE SESION

| Campo | Detalle |
|---|---|
| Nombre | ApiClient (extender /lib/api-client.ts actual) |
| Ubicacion | /lib/api-client.ts |
| Estado local | Cache en memoria (Map, TTL 20s), invalidacion en mutaciones |
| Eventos | `api(path, opts)` — wrapper de fetch con token JWT automatico, cache GET, deteccion HTTP 402 |
| Dependencias | API_BASE_URL de variable de entorno |

---

### BLOQUE 13: COMPONENTES UI REUTILIZABLES

Componentes de formulario y display a extraer del CSS vanilla del index.html:

| Componente | CSS Original | Ubicacion sugerida |
|---|---|---|
| SegmentedControl | .segmented-group, .segmented-cell | /components/ui/SegmentedControl.tsx |
| ChevronStepper | .chevron-field, .chevron-stack | /components/ui/ChevronStepper.tsx |
| SliderField | .slider-field, .slider-top | /components/ui/SliderField.tsx |
| TimeField | .time-field | /components/ui/TimeField.tsx |
| SelectField | .select-field, .select-arrow | /components/ui/SelectField.tsx |
| ChipGroup | .chip, .chip.selected | /components/ui/ChipGroup.tsx |
| Accordion | .accordion-item, .accordion-header | /components/ui/Accordion.tsx |
| DayTile | .day-tile, .active-day, .completed-day, .locked-day | /components/ui/DayTile.tsx |
| CategoryTile | .category-tile, .tile-active, .tile-done | /components/ui/CategoryTile.tsx |
| KpiTile | .kpi-tile, .kpi-row | /components/ui/KpiTile.tsx |
| ProgressBar | renderProgressBar() | /components/ui/ProgressBar.tsx |
| MiniRing | .mini-ring, renderMiniRing() | /components/ui/MiniRing.tsx |
| StreakBadge | .streak-badge, .risk, .celebrate | /components/ui/StreakBadge.tsx |
| WeekDots | .week-dots, .wdot | /components/ui/WeekDots.tsx |
| LockedOverlay | .locked-preview, .unlock-card | /components/ui/LockedOverlay.tsx |
| Toast | .app-toast, .show | /components/ui/Toast.tsx |
| MantraCard | .mantra-card | /components/ui/MantraCard.tsx |
| IdentityHeader | .identity-header | /components/ui/IdentityHeader.tsx |
| BreathCircles | renderBreathCircles() SVG | /components/ui/BreathCircles.tsx |
| Badge | .badge, .warn | /components/ui/Badge.tsx |
| EmptyState | .empty-state | /components/ui/EmptyState.tsx |

---

### BLOQUE 14: MIDDLEWARE DE AUTENTICACION Y RUTAS PROTEGIDAS

| Campo | Detalle |
|---|---|
| Nombre | middleware.ts |
| Ubicacion | /apps/web/middleware.ts |
| Eventos | Verifica JWT, redirige a /login si no autenticado, maneja planExpired |
| Conexion Backend | GET /api/auth/me (validacion de token) |

---

### BLOQUE 15: MANEJO DE ERRORES GLOBAL

| Campo | Detalle |
|---|---|
| Nombre | AppErrorBoundary + ToastProvider |
| Ubicacion | /app/(app)/layout.tsx (Client wrapper) |
| Estado local | `error`, `toasts[]` |
| Eventos | Captura errores no manejados, muestra toast, redirige a login si 401 |





---

## 📁 ARBOL DE ARCHIVOS PROPUESTO

```
apps/web/
├── app/
│   ├── layout.tsx                    # Root layout (fonts, theme provider, metadata)
│   ├── middleware.ts                  # [NUEVO] Auth middleware
│   ├── globals.css                    # CSS custom properties + Tailwind
│   ├── (auth)/
│   │   ├── login/
│   │   │   ├── page.tsx              # Login page (parcial)
│   │   │   └── components/
│   │   │       ├── LoginForm.tsx      # [NUEVO]
│   │   │       ├── RegisterForm.tsx   # [NUEVO]
│   │   │       └── GoogleSignIn.tsx   # [NUEVO]
│   │   └── register/
│   │       └── page.tsx              # [NUEVO]
│   ├── (app)/
│   │   ├── layout.tsx                # [NUEVO] App shell (sidebar + main)
│   │   ├── training/page.tsx         # ✅ Migrado
│   │   ├── nutrition/page.tsx        # ✅ Migrado
│   │   ├── cortisol/page.tsx         # ✅ Migrado
│   │   ├── rest/page.tsx             # ✅ Migrado
│   │   ├── community/...             # ✅ Migrado
│   │   ├── evolution/page.tsx        # ✅ Migrado
│   │   ├── sleep-protocol/page.tsx   # ✅ Migrado
│   │   ├── supplements/page.tsx      # ✅ Migrado
│   │   ├── onboarding/page.tsx       # ✅ Migrado
│   │   └── admin/
│   │       ├── page.tsx              # [NUEVO] Admin dashboard
│   │       ├── clients/
│   │       │   ├── page.tsx          # [NUEVO] Lista clientes
│   │       │   └── [id]/page.tsx     # [NUEVO] Detalle cliente
│   │       └── ... (phrases, community-*, cortisol-tips, rest-tools) # ✅ Migrado
│   └── plan-vencido/
│       └── page.tsx                  # [NUEVO]
├── components/
│   ├── auth/
│   │   ├── AuthLoadingOverlay.tsx    # [NUEVO]
│   │   ├── GoogleSignInButton.tsx    # [NUEVO]
│   │   └── PlanExpiredScreen.tsx     # [NUEVO]
│   ├── layout/
│   │   ├── AppShell.tsx              # [NUEVO]
│   │   ├── Sidebar.tsx               # [NUEVO]
│   │   ├── SidebarRing.tsx           # [NUEVO]
│   │   ├── MobileTopbar.tsx          # [NUEVO]
│   │   ├── NotificationBell.tsx      # [NUEVO]
│   │   ├── UserChip.tsx              # [NUEVO]
│   │   ├── ClientNavItems.tsx        # [NUEVO]
│   │   └── AdminNavItems.tsx         # [NUEVO]
│   ├── admin/
│   │   ├── ClientSwitcher.tsx        # [NUEVO]
│   │   ├── AdminHomePanel.tsx        # [NUEVO]
│   │   ├── AdminClientList.tsx       # [NUEVO]
│   │   ├── AdminClientDetail.tsx     # [NUEVO]
│   │   └── AdminNotificationsPanel.tsx # [NUEVO]
│   ├── ui/
│   │   ├── SegmentedControl.tsx      # [NUEVO]
│   │   ├── ChevronStepper.tsx        # [NUEVO]
│   │   ├── SliderField.tsx           # [NUEVO]
│   │   ├── TimeField.tsx             # [NUEVO]
│   │   ├── SelectField.tsx           # [NUEVO]
│   │   ├── ChipGroup.tsx             # [NUEVO]
│   │   ├── Accordion.tsx             # [NUEVO]
│   │   ├── DayTile.tsx               # [NUEVO]
│   │   ├── CategoryTile.tsx          # [NUEVO]
│   │   ├── KpiTile.tsx               # [NUEVO]
│   │   ├── ProgressBar.tsx           # [NUEVO]
│   │   ├── MiniRing.tsx              # [NUEVO]
│   │   ├── StreakBadge.tsx           # [NUEVO]
│   │   ├── WeekDots.tsx              # [NUEVO]
│   │   ├── LockedOverlay.tsx         # [NUEVO]
│   │   ├── Toast.tsx                 # [NUEVO]
│   │   ├── MantraCard.tsx            # [NUEVO]
│   │   ├── IdentityHeader.tsx        # [NUEVO]
│   │   ├── BreathCircles.tsx         # [NUEVO]
│   │   ├── Badge.tsx                 # [NUEVO]
│   │   └── EmptyState.tsx            # [NUEVO]
│   ├── training/                     # ✅ Migrado (TrainingShell, Home, DayView, Player, SessionConfirmed)
│   │   └── TrainingShareCard.tsx     # [NUEVO]
│   ├── nutrition/                    # ✅ Migrado (AdminPanel, ClientPanel)
│   │   └── NutritionPdfGenerator.tsx # [NUEVO]
│   ├── cortisol/                     # ✅ Migrado
│   ├── rest/                         # ✅ Migrado
│   ├── community/                    # ✅ Migrado
│   ├── evolution/                    # ✅ Migrado
│   ├── sleep/                        # ✅ Migrado
│   ├── supplements/                  # ✅ Migrado
│   └── onboarding/                   # ✅ Migrado
├── lib/
│   ├── api-client.ts                 # [MODIFICAR] Extender con cache, 402 detection
│   ├── auth-context.tsx              # [NUEVO] React Context para sesion
│   ├── theme.ts                      # [NUEVO] Constantes MODULE_THEME, ARC_COLOR_VAR
│   ├── constants.ts                  # [NUEVO] CLIENT_NAV, ADMIN_NAV, MANTRA_BANK, etc.
│   ├── alerts.ts                     # [NUEVO] Client alerts (training atrasado, adherencia)
│   ├── pdf-generator.ts              # [NUEVO] PDF de plan nutricional
│   ├── deep-link.ts                  # ✅ Migrado
│   ├── share-card.ts                 # ✅ Migrado
│   ├── training-card.ts              # [MODIFICAR] Extender con drawInstagramCard
│   ├── training-client.ts            # ✅ Migrado
│   ├── training-day-logic.ts         # ✅ Migrado
│   ├── training-home-logic.ts        # ✅ Migrado
│   ├── training-timer-logic.ts       # ✅ Migrado
│   └── ... (demas libs ya migradas)  # ✅ Migrado
```


---

## 🔌 MAPA COMPLETO DE RUTAS API (index.html → Backend Express)

| Ruta API | Metodos | Uso en index.html | Modulo |
|---|---|---|---|
| /api/config | GET | `initGoogleSignIn()` | Auth |
| /api/auth/login | POST | `handleLogin()` | Auth |
| /api/auth/register | POST | `handleRegister()` | Auth |
| /api/auth/google | POST | `handleGoogleCredentialResponse()` | Auth |
| /api/auth/me | GET | `boot()` | Auth |
| /api/clients | GET, POST | `ensureClientsLoaded()`, `createClient()` | Admin Clients |
| /api/clients/:id | GET | Multiple lugares | Admin Detail |
| /api/clients/:id/client-type | PATCH | `activateClient()`, `saveClientType()` | Admin Detail |
| /api/clients/:id/status | PATCH | `activateClient()`, `deactivateClient()` | Admin Detail |
| /api/clients/:id/personal-info | GET | `renderPersonalInfo()` | Onboarding |
| /api/clients/:id/onboarding | POST | wizard submit | Onboarding |
| /api/clients/:id/anthropometrics | GET, POST | `initModule3()` | Onboarding M3 |
| /api/clients/:id/photos | GET, POST | `initModule3()` | Onboarding M3 |
| /api/clients/:id/inbody-records | GET, POST | `initModule3()` | Onboarding M3 |
| /api/clients/:id/inbody/ocr | POST | `m3HandlePdf()` | Onboarding M3 |
| /api/clients/:id/exercises | GET, POST, PUT, DELETE | `renderTraining()` | Training |
| /api/clients/:id/training-completions | GET | `renderTraining()` | Training |
| /api/clients/:id/training/confirm | POST | NFC confirm | Training |
| /api/clients/:id/training/streak | GET | `renderTraining()` | Training |
| /api/clients/:id/training/achievements | GET | `renderTraining()` admin | Training |
| /api/clients/:id/training/phrase | GET | `shareTrainingCard()` | Training Share |
| /api/clients/:id/quote-of-the-day | GET | `renderTraining()` | Training |
| /api/clients/:id/nutrition-plan | GET, POST | `renderNutrition()` | Nutrition |
| /api/clients/:id/supplements | GET, POST | `renderNutrition()` | Nutrition |
| /api/clients/:id/cortisol-techniques | GET, POST | `renderCortisol()` | Cortisol |
| /api/clients/:id/cortisol-completions | GET | `renderCortisol()` | Cortisol |
| /api/clients/:id/cortisol-checkin | GET | `renderCortisol()` | Cortisol |
| /api/clients/:id/cortisol-tip-of-the-day | GET | `renderCortisol()` | Cortisol |
| /api/clients/:id/rest-tools | GET | `renderRest()` | Rest |
| /api/clients/:id/evolution | GET, POST | `renderEvolution()` | Evolution |
| /api/clients/:id/notifications | GET | `loadClientAlerts()` | Client Alerts |
| /api/clients/:id/notifications/read-all | PATCH | `toggleClientAlertsPanel()` | Client Alerts |
| /api/clients/:id/sleep-protocol | GET | sleep protocol | Sleep |
| /api/admin/notifications | GET | `boot()` admin | Admin |
| /api/admin/quotes | GET, POST | `renderAdminQuotes()` | Admin Quotes |
| /api/admin/cortisol-tips | GET, POST | `renderAdminCortisol()` | Admin Cortisol |
| /api/admin/rest-tools | GET, POST | `renderAdminRest()` | Admin Rest |
| /api/admin/rest-tools/:id | PUT, DELETE | `updateRestTool()`, `deleteRestTool()` | Admin Rest |
| /api/admin/rest-tools/:id/upload-audio | POST | `uploadRestToolAudio()` | Admin Rest |
| /api/community/events | GET, POST, PUT, DELETE | `renderCommunity()` | Community |
| /api/community/therapies | GET, POST, PUT, DELETE | `renderCommunity()` | Community |
| /api/community/reservations | GET, POST | admin community | Community |
| /api/admin/phrases | GET, POST | `renderAdminPhrases()` | Admin Phrases |

---

## 🗺️ ORDEN DE MIGRACION RECOMENDADO

### Fase 0 — Fundacion (Critico, bloquea todo lo demas)
1. Middleware de autenticacion + AuthContext
2. ApiClient unificado (extender `/lib/api-client.ts`)
3. CSS Design System (custom properties + Tailwind config)
4. LoginForm + RegisterForm + GoogleSignInButton + AuthLoadingOverlay
5. AppShell con Sidebar, MobileTopbar, SidebarRing

### Fase 1 — Layout + Navegacion
6. ClientNavItems + AdminNavItems
7. UserChip + NotificationBell
8. PlanExpiredScreen
9. DeepLinkHandler en AppShell
10. Toast System + ErrorBoundary

### Fase 2 — Admin
11. AdminClientSwitcher
12. AdminHome
13. AdminClientList + AdminClientDetail
14. AdminNotificationsPanel

### Fase 3 — Componentes UI Genericos
15. 21 componentes (SegmentedControl, Accordion, DayTile, KpiTile, etc.)

### Fase 4 — Features Complementarias
16. TrainingShareCard
17. NutritionPdfGenerator

### Fase 5 — Integracion Final
18. Conectar todas las paginas al AppShell
19. Remover index.html
20. Pruebas E2E




---

## 🎨 DEPENDENCIAS EXTERNAS DETECTADAS

| Dependencia | Tipo | Uso en index.html | Equivalente Next.js |
|---|---|---|---|
| Google Fonts (Fraunces + Inter) | CSS CDN | link en head (linea 8) | next/font/google |
| Google Identity Services | JS CDN | script accounts.google.com/gsi/client (linea 9) | @react-oauth/google (npm) |

---

## 📝 CONSTANTES A EXTRAER DE index.html → /lib/constants.ts

- CLIENT_NAV (lineas 732-740) — matriz de navegacion cliente
- ADMIN_NAV (lineas 753-763) — items de navegacion admin
- ADMIN_HUB_SUBITEMS (lineas 766-769)
- CLIENT_TYPE_LABELS (linea 764)
- MODULE_THEME (lineas 743-751) — tema visual por modulo
- ARC_COLOR_VAR (linea 752) — colores de arco del anillo
- MANTRA_BANK (lineas 960-993) — mantras por modulo
- FIELD_ICONS (lineas 1363-1373) — iconos SVG por tipo de campo
- CATEGORY_ICONS (lineas 2634-2638) — iconos de categoria
- DEFAULT_CORTISOL_TECHNIQUES (~3970-4003)
- CORTISOL_EMOTIONS (4005-4012)
- CORTISOL_RECOMMENDATIONS (4014-4021)
- COACH_WHATSAPP_NUMBER (1029)

---

## ⚠️ RIESGOS Y CONSIDERACIONES

1. **Estado global mutable:** `state` → React Context + estado local
2. **Manipulacion directa DOM:** `getElementById`, `innerHTML`, `classList` → React state + JSX
3. **Templates en strings:** `el.innerHTML = ...` → JSX
4. **Google Sign-In:** Usar @react-oauth/google, probar flujo completo
5. **Canvas API:** Solo cliente (\"use client\")
6. **PDF generation:** Evaluar @react-pdf/renderer vs ventana nueva
7. **Cache API:** Preservar TTL 20s en ApiClient
8. **Client alerts:** Hook useClientAlerts
9. **Mobile first:** Mantener sidebar colapsable
10. **SEO:** App detras de login, no requiere SSR/ISR

---

> Generado: Abril 2026 | Version: 1.0.0 | Archivo origen: /index.html (6418 lineas)
