# Wizard de Onboarding — Migración Arquitectónica de LATRIBU — Design

## Contexto

Tercer sub-proyecto de la migración mayor de LATRIBU: **Fundación** (Auth +
Clientes/Admin, en `main`) → **Información Personal** (backend + página de
detalle admin, en `main`) → **Wizard de Onboarding** (este spec) →
Entrenamiento → Pagos → Wearables → Agentes de IA.

El wizard de onboarding es el flujo de 9 pasos que el cliente llena una sola
vez al empezar, hoy implementado a mano en `index.html`
(`ONBOARDING_MODULES`, líneas 1110-1210, más el bloque bespoke de módulo 3 en
`renderBodyModuleBlock`/`initModule3`/`saveModule3`, líneas 1919-2166) y
guardado como JSON libre en `personal_info.onboarding_report`. El backend que
consume este flujo ya está migrado y en `main`: `PUT
/api/clients/:id/personal-info`, antropometría, fotos de progreso, registros
InBody y el proxy de OCR (Google Vision + fallback `pdf-parse`), todos parte
del sub-proyecto Información Personal.

Todo el código nuevo vive en el mismo repo, junto al legacy — no hay corte de
producción todavía. `server.js`/`index.html` siguen corriendo en paralelo.

## Objetivo

Construir, en `apps/web`, la primera superficie de cliente del stack nuevo:
el wizard completo de 9 pasos.

- **Módulos 1, 2, 4-9** (8 módulos, ~60 campos de texto/opciones): renderizado
  genérico dirigido por un config tipado (`WIZARD_MODULES`, espejo tipado de
  `ONBOARDING_MODULES`), con las 12 reglas condicionales del legacy
  (`initFieldDependencies`) portadas como datos, y validación Zod
  campo-por-campo del lado del cliente (reemplazando el manejo suelto de
  `onboardingData`).
- **Módulo 3** (Composición Corporal): componente bespoke que reutiliza los
  endpoints ya migrados de antropometría/fotos/InBody/OCR, con subida de
  reporte InBody (PDF o foto), parseo de texto OCR por versión de reporte,
  cálculo de IMC en vivo, medidas antropométricas opcionales, fotos de
  progreso y objetivos de composición corporal (peso, grasa corporal, masa
  muscular).
- **Selector de país/ciudad** (módulo 1): puerto de `/api/countries` y
  `/api/cities/:isoCode` (públicos, sin auth, usan el paquete
  `country-state-city`) de `server.js` a `apps/api`.
- **Ruta de cliente mínima:** `/onboarding` en `apps/web`, con guard de
  sesión (`role: 'cliente'`) — sin dashboard ni nav de cliente más allá de lo
  necesario para alojar el wizard.

**Explícitamente fuera de alcance:** cualquier otra página de cliente
(dashboard, nav, otros módulos) más allá de `/onboarding`; edición del
onboarding después de completado (el legacy tampoco lo permite); los demás
módulos legacy pendientes (Entrenamiento, Nutrición, Cortisol, Descanso, Mi
Evolución, Comunidad/NFC/tarjeta Instagram); cualquier cambio a
`server.js`/`index.html`; el corte de producción.

## Arquitectura

```
apps/
  api/
    src/
      routes/
        geo.routes.ts              ← NUEVO: GET /api/countries, GET /api/cities/:isoCode (públicos)
      services/
        geo.service.ts             ← NUEVO: wrapper sobre country-state-city (getCountriesCache, getCitiesOfCountry)
  web/
    app/
      onboarding/
        page.tsx                   ← NUEVO: ruta de cliente, orquesta los 9 pasos
      (auth)/login/page.tsx         ← MODIFICAR: redirige a /onboarding si role==='cliente' y !onboardingComplete, si no a /admin/clients
    components/
      onboarding/
        WizardShell.tsx             ← NUEVO: progreso, botones Anterior/Siguiente/Finalizar, layout mínimo
        WizardField.tsx             ← NUEVO: switch por field.type (10 widgets: text, textarea, select, date, chevron, slider, segmented, chips, time, file)
        Module3.tsx                 ← NUEVO: bloque bespoke (antropometría/fotos/InBody/OCR/objetivos)
        CountryCityPicker.tsx        ← NUEVO: usa geo-client.ts
    lib/
      wizard-modules.ts             ← NUEVO: WIZARD_MODULES (config tipado) + CONDITIONAL_RULES
      onboarding-client.ts          ← NUEVO: putPersonalInfo, createAnthropometric, createPhoto, createInbodyRecord, uploadInbodyFile, callOcr, getObjetivos/updateObjetivos
      geo-client.ts                ← NUEVO: getCountries, getCities
packages/
  shared-types/
    src/
      wizard.ts                    ← NUEVO: Zod schemas por módulo (reemplaza el blob opaco del lado cliente), WizardFieldConfig type
```

**Renderizado de campos (módulos 1, 2, 4-9):** config dirigido por datos —
`WIZARD_MODULES` es un array TS tipado, espejo de `ONBOARDING_MODULES`, y
`WizardField.tsx` es un componente genérico que hace switch sobre
`field.type`. Las 12 reglas condicionales del legacy (mostrar/ocultar un
campo según el valor de otro) también quedan como un array de datos
(`CONDITIONAL_RULES`), igual que `initFieldDependencies`. Esto se eligió
sobre un componente hecho a mano por módulo porque ~70 campos con JSX
explícito duplicaría mucho código y sería más difícil de mantener en
paridad exacta con el legacy.

**Estado del wizard:** un único `useState` en `page.tsx` (objeto
`wizardData`, equivalente a `onboardingData`), pasado a cada paso. Módulo 3
mantiene su propio sub-estado (equivalente a `window._m3Draft`) — nada se
persiste al backend hasta el clic en "Finalizar" del paso 9. En ese momento
se ejecuta, en este orden: `PUT personal-info` (con `complete: true`) →
crear registro de antropometría si hay datos → subir fotos si hay archivos →
crear registro InBody si el OCR se completó. Si algo fallara a mitad de esta
secuencia, se muestra el error tal cual — el legacy tampoco tiene rollback
transaccional aquí, y este spec no introduce uno.

**Ruteo y guard:** `/onboarding` requiere sesión con `role: 'cliente'`
(redirige a `/login` si no hay token). Si `onboardingComplete` ya es `true`,
redirige directamente a la pantalla de confirmación (no se puede reentrar a
editar). Al completar exitosamente el paso 9, se muestra una pantalla de
confirmación simple ("Datos guardados, tu coach te contactará") — no hay
redirección a un dashboard porque todavía no existe ninguna otra página de
cliente en `apps/web`.

**Validación:** `packages/shared-types/src/wizard.ts` define un schema Zod
por módulo config-driven, generado a partir de `WIZARD_MODULES` — cada campo
`required` se valida antes de avanzar de paso, igual que `validateStep` del
legacy. El payload final que llega a `PUT personal-info` sigue enviando
`onboarding_report` como el objeto completo (el backend ya lo valida como
blob opaco, eso no cambia), pero ahora el *cliente* lo arma con garantía de
tipos en cada campo antes de enviarlo.

**Módulo 3 (Composición Corporal) y OCR:** `Module3.tsx` reproduce el bloque
bespoke del legacy:

- **Composición corporal + objetivos:** peso/estatura/% grasa + 3 preguntas
  de objetivo (peso, grasa corporal, masa muscular) — se guardan junto con
  el resto del payload de `personal-info` (campos `weight`/`height`/
  `body_fat`) y como `client.objetivos` vía el endpoint de clientes ya
  migrado en Fundación.
- **InBody con OCR:** el cliente sube PDF o foto → se redimensiona/comprime
  en el navegador (máx. 1600px, JPEG calidad 0.85 si es imagen, igual que
  `m3HandlePdf`) → se envía a `POST /api/clients/:id/ocr-vision` (ya
  migrado) → el texto vuelve al cliente y `parseOcrText()` (puerto fiel de
  `m3ParseOcrText`, función pura, con detección de versión de reporte)
  rellena los campos numéricos + IMC calculado en vivo. El archivo original
  se sube aparte a `POST /api/clients/:id/inbody-upload`.
- **Medidas antropométricas:** cintura/brazos/hombros/piernas/glúteo —
  opcionales (el legacy los excluye a propósito de los campos requeridos,
  igual que "Ángulo de fase").
- **Fotos de progreso:** un input de archivo por ángulo (`PHOTO_ANGLES`),
  sube a `POST /api/clients/:id/photos`.

**Selector de país/ciudad:** `geo.routes.ts`/`geo.service.ts` portan
`/api/countries` y `/api/cities/:isoCode` de `server.js` — mismo paquete
`country-state-city`, misma lista de países prioritarios (`PRIORITY_ISO`),
mismo cache en memoria. Endpoints públicos, sin `authMiddleware`.

## Testing

- Vitest + Testing Library en `apps/web`, mockeando `onboarding-client.ts`/
  `geo-client.ts` (mismo patrón que Información Personal).
- Flujo end-to-end del wizard (9 pasos + validación de campos requeridos +
  reglas condicionales) probado con Testing Library simulando clics reales,
  no solo unit tests de `WizardField` aislado.
- `parseOcrText()` se prueba con fixtures de texto reales por versión de
  reporte InBody detectada en el legacy — sin red, es cómputo local.
- `apps/api`: tests de integración reales para `geo.routes.ts` contra el
  paquete `country-state-city` (sin mocks, es cómputo local).

## Fuera de alcance (explícito)

- Dashboard de cliente, nav de cliente, cualquier otro módulo cliente-facing
  más allá de `/onboarding`.
- Edición del onboarding después de completado.
- Los módulos legacy restantes (Entrenamiento, Nutrición, Cortisol, Descanso,
  Mi Evolución, Comunidad/NFC/tarjeta Instagram).
- Cualquier cambio a `server.js`/`index.html`, corte de producción.

## Riesgos

- `country-state-city` es una dependencia nueva en `apps/api` — verificar
  que su output (`getAllCountries`, `getCitiesOfCountry`) sea idéntico al
  que usa `server.js` (misma librería, solo se porta el wrapper).
- El parseo de OCR (`m3ParseOcrText`) depende de patrones de texto
  específicos por versión de reporte InBody — si Google Vision cambia el
  formato de salida, el port fiel no lo detecta hasta que se pruebe con un
  reporte real; se acepta el mismo riesgo que ya tiene el legacy.
- Es la primera superficie de cliente real del stack nuevo — sin tráfico
  real todavía, mismo riesgo aceptado de "código sin consumidor" que
  Fundación e Información Personal.

## Tiempo estimado

2-3 semanas para un desarrollador solo — más grande que Información
Personal por el volumen de campos (~70) y la complejidad bespoke de módulo
3, pero el patrón de capas/Zod/Vitest ya está probado tres veces.
