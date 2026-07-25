# Vence Sim — harness de simulación de bugs

> **Filosofía:** *"Si un usuario nos reporta un bug que una simulación podía haber
> reproducido, hemos fallado."* Vence Sim ejecuta escenarios reproducibles (journeys)
> contra el app **vivo** —por API y por navegador (Playwright)— con **inyección de fallos**
> y **aserción de invariantes de dominio**, y emite el resultado a observabilidad. Caza las
> clases de bug que la observabilidad pasiva NO ve: percepción del usuario, fallos de red
> del cliente, incoherencias UI↔estado, y sus propios **puntos ciegos**.

Nació del feedback de Alfonso (25/07): un bug era percepción (una ley entera "inundaba" el
test) y otro (la página "desaparecía") **no dejó ni un evento** en observabilidad porque su
conexión se cayó. Ninguna de las dos cosas la cazaba nada. Vence Sim sí.

## Integración con el sistema canary+simulaciones existente
Vence Sim NO es un sistema aparte: es la **capa de NAVEGADOR on-demand** del sistema
`docs/roadmap/canary-y-simulaciones.md`. El reparto:
- **Encontrar bugs (continuo, en AWS):** los `@Cron` de `backend/src/canary-*` — en
  particular **`canary-por-leyes-scope`** (cada 5 min) ya afirma "el modo acotado NO trae
  artículos fuera del temario" (invariante #2 de Alfonso), **autenticado** con
  `signCanaryToken`+`SMOKE_USER_ID` para bypasear el Turnstile. NO se duplica aquí.
- **Reproducir + validar fix (on-demand, navegador):** **Vence Sim** — lo que a los canary
  de API les falta: **inyección de fallos de red** (repro exacto de #1), **sesión de usuario
  en navegador real**, **screenshots**, e incoherencias UI↔estado.
- Comparten sink (`observable_events`), `alerts-engine` y la cuenta de test `SMOKE_USER_ID`.

### El bucle encontrar → reproducir → fixear
1. Llega un feedback (o un canary se pone rojo).
2. **Reproducir** con Vence Sim: `npm run sim` o un journey nuevo de ~20 líneas.
3. **Fixear** y re-correr el journey hasta verde.
4. El journey queda como **regresión permanente**; si el invariante es de API, se añade al
   `canary-por-leyes-scope` (o un canary hermano) para vigilancia continua.

## Cuándo usarlo (frases-gatillo)
- *"simula el bug de X"*, *"reproduce el fallo de X"*, *"corre las simulaciones"*,
  *"pasa vence sim"*, *"añade un journey para X"*, o al triar un feedback de bug (paso 1
  del manual de feedback: reproducir a ciencia cierta).

## Arquitectura
| Pieza | Qué es | Testeable |
|-------|--------|-----------|
| `lib/sim/types.ts` | modelo + `verdictOf` (veredicto determinista) | ✅ unit |
| `lib/sim/invariants.ts` | **invariantes de dominio** (el juicio real) | ✅ unit |
| `lib/sim/session.ts` | acuñar sesión de la **auth propia** (Auth.js RS256, SIN Supabase) | ✅ unit (round-trip) |
| `lib/sim/faults.ts` | catálogo de fallos inyectables (chaos) | ✅ unit |
| `lib/sim/report.ts` | reporte + puente a `observable_events` | ✅ unit |
| `lib/sim/journey.ts` | contrato `Journey` + `JourneyCtx` | — |
| `scripts/sim/run.ts` | **runner**: Playwright + API + screenshots + emit | integración |
| `scripts/sim/journeys/*.ts` | los escenarios de navegador (on-demand) | ✅ integración (ctx simulado) |
| `backend/src/canary-por-leyes-scope/*` | **canary AWS existente** (`@Cron */5`) del invariante #2 | ✅ (del sistema) |

**Capas de seguridad:** unit (`__tests__/sim/*`) + integración (`journey.integration.test.ts`,
journey contra ctx simulado) + **canary continuo en AWS** (`canary-por-leyes-scope`, ya
existente) + observabilidad (`sim_journey_result`) + screenshots por paso.

## Cómo correr
```bash
# todos los journeys contra prod (sin emitir)
npm run sim
# filtrar por nombre
npx tsx scripts/sim/run.ts por-leyes
# emitiendo a observable_events (necesita DATABASE_URL)
SIM_AUTH_SECRET=… SIM_EMIT=1 npm run sim
# unit + integración del propio harness
npm run sim:test
```
Salida: resumen por journey + invariantes fallidas, reporte JSON y **screenshots** en
`sim-reports/<ts>/<journey>/`. Exit 1 si falla un journey `critical`/`high`.

### Identidad (auth PROPIA — Supabase PROHIBIDO — cuenta de TEST)
Los journeys con `as:` corren como la **cuenta de test del sistema** (`SMOKE_USER_ID`, la
misma que usan los canary de API), **NUNCA un cliente real**, forjando la cookie de sesión
Auth.js (`__Secure-authjs.session-token`) cifrada con `AUTH_SECRET`. Resolución:
- Identidad: `SIM_IDENTITY_USER_ID` → `SMOKE_USER_ID` (SSM `/vence-backend/SMOKE_USER_ID`).
  Sin ninguna → el runner **SALTA** el journey autenticado (no falla).
- Secreto: **env-first** `SIM_AUTH_SECRET`/`AUTH_SECRET`, y en dev fallback a SSM
  (`/vence-frontend/AUTH_SECRET`, requiere perfil AWS con `ssm:GetParameter`).
> ⚠️ El bridge Supabase (`bridgeMintProvider`) está **muerto** (Supabase desconectado). No
> usarlo. Nota: los canary de API usan `signCanaryToken` (Bearer); Vence Sim forja **cookie**
> porque prueba el NAVEGADOR — un Bearer no monta la sesión de la UI.

## Añadir un journey (el flujo que importa)
Cada bug reportado → un journey nuevo (~20 líneas) que queda como **regresión para siempre**:
1. Crea `scripts/sim/journeys/<nombre>.ts` con `export default { name, severity, as?, run(ctx) }`.
2. En `run(ctx)`: navega (`ctx.goto`), llama API (`ctx.api`), inyecta fallos
   (`ctx.injectFault(faults.networkAbort(...))`), captura (`ctx.screenshot`) y **devuelve
   invariantes** de `lib/sim/invariants` (o `{name,ok,detail}` ad-hoc).
3. Añade un caso a `journey.integration.test.ts` con un ctx simulado.
4. Corre `npm run sim -- <nombre>` contra prod.

## Catálogo de invariantes (`lib/sim/invariants.ts`)
- `questionsWithinSelection` — ninguna pregunta fuera de lo seleccionado (bug Alfonso #2).
- `recoveredFromBlip` / `retriesAreBounded` — resiliencia de red del cliente (bug #1).
- `mixedInclusionIsWarned` — visibilidad del caso "ley entera + acotada".
- `requestIsScopedTo` — la llamada va a la oposición esperada.
- `failureWasObserved` — **meta-invariante**: un fallo visible SIN evento = punto ciego.

## Canary continuo en AWS (ya existe — NO se duplica)
La vigilancia continua del invariante #2 la hace **`backend/src/canary-por-leyes-scope`**
(`@Cron('*/5 * * * *')` en Fargate, como `health-sweep`): afirma que el "test por leyes"
acotado NO trae artículos fuera del temario, **autenticado** con `signCanaryToken` +
`SMOKE_USER_ID` (bypasea el Turnstile), emite a `observable_events` y el `alerts-engine`
alerta. Si el fixture de Alfonso (celador_murcia) aporta cobertura, se **añade a ese
canary**, no uno nuevo.

Vence Sim es la capa **de navegador on-demand** que ese canary no puede cubrir (Fargate no
tiene chromium): recuperación de red, badge/aviso, sesión de usuario real, screenshots.
Se corre con `npm run sim` al reproducir un bug o validar un fix pre-deploy.

## Observabilidad
Cada corrida emite `observable_events` con `event_type='sim_journey_result'`,
`endpoint='/sim/<journey>'`, `severity` (info si pasa; error/warn si falla según criticidad)
y `metadata` con invariantes, `firstFailure`, duración e identidad. Consulta:
```sql
SELECT severity, metadata->>'journey', metadata->>'passed', metadata->>'firstFailure'
FROM observable_events WHERE event_type='sim_journey_result' ORDER BY created_at DESC;
```

## Cómo lo hacen los profesionales (referencia)
Vence Sim compone las prácticas estándar en un harness propio: synthetic monitoring
(canary), fault injection/chaos (route interception), record-replay del journey real del
usuario, visual/screenshots, y cross-check con observabilidad. No sustituye a los tests
unitarios ni a la observabilidad pasiva — los **complementa** cerrando el hueco de
"reproducir lo que el usuario vive".
