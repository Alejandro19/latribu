# Entrenamiento — Compartir Tarjeta a Instagram (Design Spec)

## Contexto

Tercer sub-proyecto del módulo Entrenamiento, tras "Admin & Ejecución" y "Racha, Protector y Confirmación NFC" (ambos mergeados). El botón "Compartir" en `SessionConfirmedScreen` ya existe pero está deshabilitado con el texto "Próximamente" — este spec lo hace funcional.

El módulo Entrenamiento sigue dividido en 5 sub-proyectos:

1. Admin & Ejecución (mergeado).
2. Racha, Protector y Confirmación NFC (mergeado).
3. **Compartir tarjeta a Instagram** (este spec).
4. Quotes/Phrases — CRUD admin de frases (deferred; este spec solo agrega un endpoint de lectura genérico, no el CRUD).
5. Rest tools (deferred).

Sin corte de producción — `server.js`/`index.html` siguen corriendo en paralelo.

## Objetivo

Portar al nuevo stack:
- El dibujo de la tarjeta compartible (canvas 1080×1920, proporción de IG Stories): fila de logros (medallas/copas), sello circular con la racha, frase motivacional, marca "La Tribu".
- El mecanismo de compartir: `navigator.share` con archivo cuando el navegador lo soporta, descarga sintética como fallback.
- Un endpoint de lectura genérico `GET /training/phrase?context=` para que la tarjeta tenga su propia frase (contexto `'instagram'`, distinta de la mostrada en la pantalla de confirmación).
- Activar el botón "Compartir" en `SessionConfirmedScreen`.

## Decisiones de alcance (aprobadas)

| Punto | Decisión |
|---|---|
| Tipografía custom "Fraunces Card" (WOFF2 embebido como base64 gigante en el legacy) | **No portar.** Usar una fuente del sistema (`Georgia, serif`), preservando los pesos/itálicas que el legacy aplica en cada bloque del dibujo. |
| Endpoint `GET /training/phrase?context=` (frase distinta para la tarjeta, no la de confirmación) | **Incluir** — es genérico (cliente, sin CRUD admin), reutiliza `pickRandomPhrase` ya existente. El CRUD admin de frases sigue siendo el sub-proyecto #4, deferred. |

## Arquitectura

### Backend (`apps/api`)

**`training.service.ts` — extensión:**
- `getPhraseByContext(context: 'confirmacion' | 'instagram'): Promise<string | null>` — lee `phrases` activas, reutiliza `pickRandomPhrase` (ya existe desde el sub-proyecto anterior), retorna el texto o `null` si no hay elegibles.

**Endpoint nuevo:**
```
GET /api/clients/:id/training/phrase?context=confirmacion|instagram   ownerOrAdmin, requirePermission('training')
```
Contexto inválido → 400 (validación manual en el controller, igual que el legacy — no requiere un nuevo Zod schema ya que es un query param con 2 valores fijos).

### Frontend (`apps/web`)

- `training-client.ts` — nueva función `getPhraseByContext(clientId: string, context: 'confirmacion' | 'instagram'): Promise<string | null>`.
- `lib/training-card.ts` (NUEVO):
  - `computeAchievements(streakWeeks: number): { medalsInCurrentCycle: number; trophiesEarned: number }` — puerto directo y puro (`streakWeeks % 4`, `Math.floor(streakWeeks / 4)`).
  - `drawInstagramCard(ctx: CanvasRenderingContext2D, { streakWeeks, phrase }: { streakWeeks: number; phrase: string | null }): void` — dibuja los 4 bloques del legacy (logros, sello, frase envuelta en líneas, marca) a 1080×1920 con `CARD_SCALE = 1080 / 260`, usando `Georgia, serif` en vez de `"Fraunces Card"`.
- `lib/share-card.ts` (NUEVO):
  - `shareCanvasAsImage(canvas: HTMLCanvasElement, filename: string): Promise<void>` — convierte el canvas a blob PNG, intenta `navigator.share` si `navigator.canShare({files:[file]})` es soportado, si no genera un enlace de descarga sintético (`<a download>` + `URL.createObjectURL`/`revokeObjectURL`). Un `AbortError` (usuario cancela el share sheet) se traga silenciosamente; cualquier otro error se re-lanza para que el llamador lo muestre.
- `SessionConfirmedScreen.tsx` — gana un prop `clientId: string`. El botón "Compartir" pasa de `disabled` fijo a un handler `handleShare`: deshabilita el botón (`sharing: true`), pide la frase de contexto `'instagram'` (non-fatal: si falla, `phrase: null`), crea un `<canvas>` en memoria, llama `drawInstagramCard`, y `shareCanvasAsImage`. Cualquier error (que no sea `AbortError`, ya tragado por `shareCanvasAsImage`) se muestra como un mensaje corto en la pantalla (no `alert()`), sin bloquear el botón "Cerrar".

## Manejo de errores

- La frase de Instagram es non-fatal: si el fetch falla, la tarjeta se dibuja sin frase — mismo comportamiento que el legacy.
- `AbortError` de `navigator.share` (cancelación del usuario) se ignora silenciosamente.
- Cualquier otro error (canvas, blob, share, descarga) se muestra como mensaje corto en la pantalla; el botón "Cerrar" sigue funcionando siempre.
- El botón "Compartir" se deshabilita mientras se genera/comparte la tarjeta, para evitar dobles clicks.

## Testing

- `apps/api`: Vitest contra DB real. `GET /training/phrase`: contexto inválido → 400; dibuja correctamente de frases con `context='instagram'` o `'ambas'`; retorna `null` sin frases elegibles; gating (`ownerOrAdmin`, `requirePermission('training')`).
- `apps/web`: tests mockeados. `computeAchievements` (0, 4, 5, 11 semanas → medallas/copas esperadas). `drawInstagramCard` (spy sobre los métodos del `CanvasRenderingContext2D` mockeado — verifica llamadas con los valores correctos, incluyendo el caso sin frase y el de frase larga que se envuelve en múltiples líneas). `shareCanvasAsImage` (rama `navigator.share` nativo vs. rama descarga sintética, `AbortError` tragado, otro error re-lanzado). `SessionConfirmedScreen`: botón deshabilitado durante la generación, frase non-fatal, error visible sin bloquear "Cerrar".

## Fuera de alcance

- CRUD admin de frases (sub-proyecto #4) — este spec solo agrega un endpoint de lectura genérico.
- Rest tools (sub-proyecto #5).
- Fidelidad tipográfica exacta con el legacy (fuente custom embebida) — decisión explícita de usar fuente del sistema.
- Corte de producción / apagado del stack legacy.

## Riesgos

- Sin la fuente custom, la tarjeta generada no será visualmente idéntica a la del legacy — riesgo aceptado explícitamente por decisión del usuario.
- `navigator.share`/`canShare` con archivos no está soportado en todos los navegadores de escritorio — el fallback de descarga cubre ese caso, igual que el legacy.
- Sin corte de producción — riesgo nulo para el stack legacy.

## Tiempo estimado

Más pequeño que los dos sub-proyectos anteriores de Entrenamiento: un endpoint backend trivial + 2 archivos de lógica pura + la integración del botón. Estimo 5-6 tareas TDD.
