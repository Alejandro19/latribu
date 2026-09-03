# Fundación — Migración Arquitectónica de LATRIBU — Design

## Contexto

Primer sub-proyecto de una migración mayor de LATRIBU, descompuesta en:
**Fundación** (este spec) → Pagos → Wearables → Agentes de IA — cada uno con
su propio ciclo spec → plan → implementación.

LATRIBU aún no ha lanzado a producción y no hay fecha límite — la prioridad
es invertir en una base sólida antes de agregar funciones nuevas. El stack
actual (un `index.html` monolítico + `server.js` Express, ambos sin
TypeScript, sin capas, con acceso a datos vía Supabase-js/PostgREST) ya
tiene, gracias a Fase 0, tests de auth/permisos y CI — pero esa red de
seguridad es específica del stack actual y no migra automáticamente.

## Objetivo

Migrar la arquitectura completa (frontend, backend en capas, base de datos,
autenticación, testing) al nuevo stack, y migrar **completamente** los
módulos de Auth + Clientes/Admin como referencia funcional de punta a
punta. El resto de los módulos existentes de LATRIBU (Entrenamiento,
Nutrición, Cortisol, Descanso, Mi Evolución, Información Personal,
Comunidad, NFC, tarjeta de Instagram) quedan fuera de este spec — se
migran después, repitiendo el patrón aquí establecido, como trabajo de
seguimiento más mecánico y de menor riesgo de diseño.

"Clientes/Admin" en este spec significa el CRUD y las acciones administrativas
sobre las tablas `clients`/`admins` tal como existen hoy en `server.js` bajo
`/api/clients*`: listar, crear, leer, actualizar, eliminar, y los patches de
permisos/estado/tipo de cliente/renovación de plan. No incluye personal-info,
antropometría, fotos, ni registros InBody — esos viven en los módulos
"Información Personal"/"Mi Evolución", fuera de alcance de este spec.

Como el alcance es parcial, **no hay corte de producción en esta fase** —
el nuevo stack se construye en paralelo al actual, sin reemplazarlo
todavía. La decisión de cuándo cortar producción se toma cuando el resto
de los módulos esté migrado (fuera de este spec).

## Decisiones de stack

| Decisión | Elegido | Por qué |
|---|---|---|
| Frontend | React + Next.js (App Router) | Ecosistema más grande, más recursos/ejemplos, más fácil contratar a futuro |
| Rol de Next.js | SPA — mayormente `'use client'` | No hay contenido público que necesite SEO/SSR; todo vive detrás de login, igual que hoy |
| Backend | Express + TypeScript, en capas | Bajo cold-start en serverless (se descartó NestJS por esto), ahora con estructura Routes → Controllers → Services → Models |
| ORM | Drizzle | Sin motor/binario propio (a diferencia de Prisma) — arranque más rápido en funciones serverless, alineado con el objetivo de despliegue ligero |
| Validación runtime | Zod | TypeScript no valida en tiempo de ejecución; Zod sí, y se integra con Drizzle (`drizzle-zod`) evitando duplicar definiciones |
| Autenticación | JWT + bcrypt propio, migrado a TS | Mismo hardening ya construido en Fase 0 (sin fallback inseguro, mismo modelo de roles), solo tipado — no se introduce Auth.js en esta fase |
| Testing | Vitest (backend y frontend) | Un solo framework para todo el stack nuevo, mismo principio de Fase 0: tests reales contra una base de datos de pruebas dedicada, nunca mocks ni producción |
| Storage de archivos | Se mantiene Supabase Storage | Es una API independiente de cómo se accede a la base de datos — cero migración de archivos existentes, cero riesgo |
| Estructura de repo | Monorepo, npm workspaces | Un repo con `apps/web` y `apps/api`, cada uno desplegado como su propio proyecto en Vercel; tipos compartidos vía `packages/shared-types` |

## Arquitectura

```
latribu/
  apps/
    web/                          ← Next.js (App Router), React + TypeScript
      app/(auth)/                 ← login
      app/admin/clients/          ← módulo de referencia: admin ve/gestiona clientes
    api/                          ← Express + TypeScript
      src/
        routes/
          auth.routes.ts
          clients.routes.ts
        controllers/
          auth.controller.ts      ← valida con Zod, maneja req/res
          clients.controller.ts
        services/
          auth.service.ts         ← lógica de negocio pura (bcrypt, jwt.sign/verify)
          clients.service.ts
        models/                   ← esquema Drizzle (tablas admins, clients, etc.)
        db/                       ← conexión Drizzle + carpeta de migraciones generadas
  packages/
    shared-types/                 ← tipos/esquemas Zod compartidos entre web y api
```

Cada dominio (auth, clients) sigue el mismo patrón de 4 capas: **Routes**
define endpoints y delega; **Controllers** valida entrada con Zod y maneja
HTTP; **Services** contiene la lógica de negocio pura; **Models** define el
esquema Drizzle y la persistencia, independiente de cómo se consulta.

**Base de datos:** Drizzle con conexión directa a Postgres (la misma base
de Supabase, ya no vía PostgREST/Supabase-js). Drizzle Kit genera
migraciones automáticamente a partir de cambios en el esquema —
reemplazando el proceso manual de pegar SQL en el editor de Supabase para
las tablas que se migren.

**Testing:** Vitest para backend y componentes de frontend. Mismo
principio que Fase 0 — un proyecto Postgres de pruebas dedicado (puede ser
el mismo proyecto Supabase de pruebas de Fase 0, accedido ahora vía Drizzle
en vez de PostgREST), nunca contra producción.

## Fuera de alcance (explícito)

- Los 7 módulos restantes de la app existente (Entrenamiento, Nutrición,
  Cortisol, Descanso, Mi Evolución, Información Personal, Comunidad, NFC,
  tarjeta de Instagram) — se migran después, como trabajo de seguimiento.
- Pagos, extracción de datos de wearables, agentes de IA — sub-proyectos
  separados, posteriores a esta Fundación.
- Ambiente de staging formal — los preview deployments automáticos de
  Vercel por PR son suficientes por ahora; una URL de staging persistente
  se evalúa más cerca del corte de producción.
- Cualquier corte de producción / reemplazo de la app actual.
- Auth.js/NextAuth — se mantiene JWT propio.

## Riesgos

- Es una reescritura real de dos módulos (no solo config) — el riesgo
  principal es de diseño/patrón, no de alcance descontrolado, ya que el
  alcance quedó explícitamente acotado a Auth + Clientes/Admin.
- Migrar de Supabase-js/PostgREST a conexión directa vía Drizzle cambia
  cómo se manejan políticas de acceso a nivel de fila (RLS) si existieran
  — a verificar contra `schema.sql` si alguna tabla depende de RLS de
  Supabase en vez de control de acceso a nivel de aplicación (el patrón
  actual de LATRIBU parece controlar acceso en `server.js`, no en RLS, lo
  cual simplifica esto, pero vale confirmarlo en el plan de implementación).
- Sin corte de producción, existe el riesgo de que este nuevo código quede
  como un experimento no terminado si el impulso se pierde — mitigado por
  no tener fecha límite pero sí un objetivo de negocio claro (invertir en
  la base antes de comercializar).

## Tiempo estimado

3-5 semanas para un desarrollador solo, dado que incluye aprender Next.js
App Router, Drizzle y el patrón en capas por primera vez, además de migrar
dos módulos completos con sus tests.
