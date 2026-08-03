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

**La cuenta de test tiene que estar ONBOARDEADA** (`target_oposicion`, `age`, `gender`,
`ciudad`, `onboarding_completed_at`). Si le falta uno, el modal de onboarding se abre a
pantalla completa **encima de cualquier journey autenticado** y se traga todos los clics; el
síntoma que llega es un `locator.click: Timeout` sobre un botón que existe y se ve, y se
pierde el rato buscando un bug del app que no está ahí (pasó el 28/07). Desde entonces el
runner lo detecta al navegar y falla diciendo exactamente eso. Al tocar esa fila, ojo: se
llama *"Smoke Canary (NO TOCAR)"* — solo se completan los campos de onboarding, nada más.
El perfil va cacheado 60 s (`/api/profile`), así que tras arreglarlo hay que esperar a que
expire antes de reintentar.

## Añadir un journey (el flujo que importa)
Cada bug reportado → un journey nuevo (~20 líneas) que queda como **regresión para siempre**:
1. Crea `scripts/sim/journeys/<nombre>.ts` con `export default { name, severity, as?, run(ctx) }`.
2. En `run(ctx)`: navega (`ctx.goto`), llama API (`ctx.api`), inyecta fallos
   (`ctx.injectFault(faults.networkAbort(...))`), captura (`ctx.screenshot`) y **devuelve
   invariantes** de `lib/sim/invariants` (o `{name,ok,detail}` ad-hoc).
3. Añade un caso a `journey.integration.test.ts` con un ctx simulado.
4. Corre `npm run sim -- <nombre>` contra prod.

## Verificación de RELEASE (lo único que corre solo)

Vence Sim es on-demand por diseño, con UNA excepción: al publicar una versión, el despliegue
corre los journeys marcados `postDeploy: true`.

```bash
# lo que hace el deploy (y lo que puedes lanzar tú a mano)
VERIFY_BASE_URL=https://www.vence.es SIM_AUTH_SECRET=… SMOKE_USER_ID=… SIM_EMIT=1 \
  bash scripts/verify-release.sh
```

**Por qué ahí y no en un cron:** esta clase de fallo (pintado, oclusión, z-index, un hueco mal
medido) la introduce un cambio que llega a producción; no aparece sola con el tiempo. En el
despliegue el culpable es evidente y no hace falta que CI guarde `AUTH_SECRET` — la llave con la
que se forja la sesión de cualquiera. Un cron cada 6h llegaría tarde, costaría ese secreto y
abriría exámenes reales a diario (con su desgaste: el límite es de 10 peticiones/minuto).

**No bloquea el despliegue.** Un rojo puede ser del entorno (contenedor frío, límite de
peticiones), y un guardarraíl que tumba deploys por causas ajenas se acaba desactivando. Informa
y deja el resultado en `observable_events` (`sim_journey_result`, severidad `error` si el journey
es `high`/`critical`). Cuando demuestre ser estable: `VERIFY_STRICT=1`.

**Marcar un journey para que entre aquí:** `postDeploy: true` en su definición. La lista vive en
los journeys, NO en el script de despliegue — así no se muda al cambiar de nube.

### Frontera agnóstica (AWS hoy, koigrid mañana)
| Pieza | Sabe de la nube | Qué hace |
|-------|-----------------|----------|
| `scripts/deploy-frontend.sh` | **Sí** (SSM, ECS) | resuelve el secreto y la identidad y llama al verificador |
| `scripts/verify-release.sh` | **No** | contrato: recibe URL + identidad por entorno y corre los journeys `postDeploy` |
| `lib/sim/secretos.ts` | aislada | de dónde sale `AUTH_SECRET`: `env` (defecto en koigrid) o `aws-ssm` (comodidad local) |
| `lib/sim/seleccion.ts` | No | qué journeys entran en la verificación |

Mudarse a koigrid = su script de despliegue exporta `VERIFY_BASE_URL`, `SIM_AUTH_SECRET` y
`SMOKE_USER_ID` (con `SIM_SECRET_PROVIDER=env`) y llama al mismo `verify-release.sh`. Ni el
verificador, ni los journeys, ni las invariantes cambian. Guardarraíl que lo mantiene honesto:
`__tests__/guardrails/deploy-scripts.test.ts` falla si el verificador empieza a hablar AWS o si
el deploy deja de invocarlo.

## Catálogo de invariantes (`lib/sim/invariants.ts`)
- `questionsWithinSelection` — ninguna pregunta fuera de lo seleccionado (bug Alfonso #2).
- `recoveredFromBlip` / `retriesAreBounded` — resiliencia de red del cliente (bug #1).
- `mixedInclusionIsWarned` — visibilidad del caso "ley entera + acotada".
- `requestIsScopedTo` — la llamada va a la oposición esperada.
- `floatingControlIsReachable` — un control flotante **se pinta Y recibe el clic** (bug Manolo,
  28/07: la barra del examen se pegaba detrás de la cabecera, visible en el DOM pero sorda al
  clic). Juzga con `elementFromPoint`, no con `isVisible()`, porque lo segundo era cierto
  mientras estaba roto; y compara la altura contra el **borde real** de la cabecera, que cambia
  con la sesión y el ancho. Reutilízalo para cualquier elemento pegajoso/flotante nuevo.
- `failureWasObserved` — **meta-invariante**: un fallo visible SIN evento = punto ciego.

## Barrido continuo de RUTAS — recorrer la app como un usuario (T-487)

```bash
npm run sim:rutas -- --plan              # QUÉ visitaría, sin abrir navegador ni tocar nada
npm run sim:rutas                        # lo recorre y lo juzga
npm run sim:rutas -- --pasada 3 --emit   # rota los ejemplares y publica en observabilidad
```

**Qué cubre que no cubría nada.** Un journey afirma cosas de dominio de UNA pantalla; los canary
de AWS son de API. Nadie miraba la app **como la ve una persona** salvo cuando alguien lo pedía —
y el motivo estaba escrito aquí mismo: *«Fargate no tiene chromium»*. Esto es la capa que faltaba.

**804 páginas, 168 FORMAS.** Cada oposición tiene su propio directorio con un envoltorio de ~21
líneas sobre un componente compartido, así que **el código es común y lo que cambia son los
datos**. De ahí las dos coberturas:

| | cómo se cubre | coste |
|---|---|---|
| **código** | una visita por FORMA | 168 visitas, no 804 |
| **datos** | rotar el ejemplar entre pasadas (`--pasada`) | el ciclo completo son 128 pasadas, y el comando lo dice |

**Los dos frenos, que son diseño y no detalle:**

1. **No autodenegarse el servicio.** Un barrido interno ya tumbó parte del sitio, y con una réplica
   no lo degrada: lo para entero. Ritmo limitado (`--rpm`, 10 por defecto) y una visita por forma.
2. **No ensuciar los datos con los que decidimos.** Las rutas que sirven preguntas alimentan
   `daily_questions_served`, el ranking y **el antifraude** — abrir preguntas sin responderlas es
   la firma de `harvest_no_answer`. Van clasificadas aparte y **fuera por defecto** (`--clases`).

**Lo que no se puede visitar se DICE.** Una ruta cuyo parámetro no tiene valor real en la BD sale
en «fuera de esta pasada», nunca como visitada. Inventarse un id daría un 404 que el oráculo
leería como página rota, y un detector que se autoinventa hallazgos deja de leerse en una semana.

### El oráculo (`lib/sim/oraculo.ts`) — lo que faltaba no era Playwright

| veredicto | qué es | va al bus como |
|---|---|---|
| **rota** | 5xx · la pantalla de error de la app · un 200 que no pinta nada · subpetición con 5xx | `error` → **dispara correo** |
| **sospechosa** | 404 en una ruta que existe en el código · hidratación · errores de consola | `warn` → se lee en el panel |
| **punto ciego** | estaba rota **y no generó ni una señal** | destacado en la alerta |

El punto ciego reutiliza `failureWasObserved`, la meta-invariante que ya existía: dos criterios
para el mismo hecho no protegen el doble, se contradicen.

**Calibración medida, no intuida.** La primera pasada real dio **12 de 12 rutas «sospechosas» por
el mismo 401 de `/api/auth/token`** — la app preguntando «¿quién eres?» sin sesión. Se descarta
**solo yendo anónimo**, porque ese mismo 401 **con** sesión sí es un defecto.

### Sin silos: esto llega a Salud del sistema

El barrido publica en `observable_events` (`sim_ruta_rota` por ruta, `sim_barrido_pasada` de
resumen) y lo vigila la regla **`sim_ruta_rota`** de `backend/src/alerts/alert-rules.ts`, que manda
correo y sale en `/admin/salud-sistema`. Las sanas **no** se publican una a una: 168 filas verdes
por pasada ahogarían el bus.

**Y los journeys también avisan** (T-491): `sim_journey_result` con severidad `error` lo vigila la
regla **`sim_journey_fallido`**, con ventana de 3 h — corta a propósito, porque estos journeys
corren atados a un deploy o a alguien reproduciendo un bug, y un fallo viejo ya no dice nada del
estado actual. El aviso trae el nombre del journey, la invariante que cayó y el `npm run sim -- …`
para reproducirlo.

> Ese evento llevaba **sin vigilancia desde que existe el harness**: no aparecía en ninguna regla
> ni entre las señales benignas, y el catch-all no lo cubría porque exige 150 del mismo tipo en una
> hora. Un journey en rojo tras un despliegue se veía solo en el log del deploy.

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
