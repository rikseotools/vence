# Harness E2E autenticado (Playwright) — verificar un bug en el navegador real

Sistema **reutilizable** para probar en un navegador real, logueado, cualquier flujo del
app. Se monta una vez; cada verificación futura es un fichero corto en `e2e/authed/`.

## Filosofía: agnóstico by contract
Lo único que se acopla a un entorno se aísla detrás de un contrato → migrar de AWS a
koigrid (u otro) NO toca los tests:

| Qué | Cómo se cambia |
|---|---|
| **Target** (qué URL se prueba) | env `E2E_BASE_URL` (proyecto `authenticated`) |
| **Auth** (cómo se inicia sesión) | contrato `SessionProvider` (`e2e/helpers/sessionProvider.ts`) → `storage` \| `bridge` \| `koigrid` vía `E2E_SESSION_PROVIDER` |
| **Cleanup** (borrar datos creados) | contrato `Cleaner` (`e2e/helpers/cleaner.ts`) sobre `E2E_DATABASE_URL` (pg estándar) |

Los **page objects** y **specs** hablan con la UI renderizada → 100% reutilizables entre entornos.

## Estructura
```
e2e/
  config/env.ts            # toda la config por env (target, cuenta, provider, BD)
  auth.setup.ts            # SETUP: crea la sesión una vez → e2e/.auth/state.json
  fixtures/test.ts         # test.extend → { page (logueada), testFlow, evolution }
  helpers/
    sessionProvider.ts     # contrato + registro de providers
    providers/             # storageStateProvider (captura manual) · bridgeMintProvider (mint)
    cleaner.ts             # contrato Cleaner + pgCleaner
  pageObjects/             # TestFlow (arrancar/responder) · EvolutionPanel (cronología)
  authed/*.spec.ts         # los tests autenticados (reutilizan la sesión)
```

## ⚠️ ESTOS SPECS NO LOS EJECUTA CI — léelo antes de escribir uno (T-713, 08/08/2026)

**6 de los 8 specs no se ejecutaban nunca**, y no estaban rotos: ningún workflow invoca el
proyecto que los recoge. `prod` (cron cada 6 h) y `preview-aws` filtran por `smoke-*`; el proyecto
`authenticated` solo corre con `npm run test:e2e:auth`, que no aparece en ningún workflow. Y
`preview-aws` se dispara en `pull_request`, un evento que aquí no ocurre nunca porque se empuja
directo a `main`.

**Por qué importa más de lo que parece:** los 6 huérfanos se escribieron justo porque un fallo se
había escapado de todas las demás capas — el registro de IP roto **27 días en silencio**
([T-314]), el envío explícito de impugnaciones ([T-198]), el configurador de leyes (regresión
`442bc679`). Un test que nadie ejecuta no es una capa: ocupa el sitio de la que sí hacía falta.

**Mientras no se decida dónde corren, escribir un spec en `e2e/authed/` NO cuenta como capa de
robustez.** Si necesitas cobertura automática hoy, la alternativa viva son las simulaciones de
`scripts/sim/*` (mismo Playwright, mismo camino de sesión) o un canario.

Guardarraíl: `__tests__/guardrails/specsEjecutados.guardrail.test.ts` — trinquete con los 6
declarados; **ninguno nuevo puede entrar** y la lista solo encoge.

## Autenticarse (elige provider con `E2E_SESSION_PROVIDER`)
- **`own-mint` (recomendado, T-713):** acuña la cookie Auth.js con `AUTH_SECRET`, el MISMO camino
  que ya usan las simulaciones con navegador (`mintOwnAuthCookie` + `cookieForPlaywright`). Cero
  login manual y cero dependencia de Supabase — es el único que podría correr desatendido.
  ```bash
  AUTH_SECRET=… E2E_USER_ID=<uuid> E2E_SESSION_PROVIDER=own-mint npm run test:e2e:auth
  ```
- **`storage` (fiable, por defecto):** login manual UNA vez → se reutiliza.
  ```bash
  E2E_BASE_URL=https://www.vence.es npm run e2e:login:capture   # abre navegador, te logueas, se guarda
  ```
- **`bridge` (LEGACY, no usar):** acuña por **Supabase**, que quedó CONGELADO el 04/07/2026, y
  confía en que el bridge legacy —en drenaje— hidrate la sesión. Se conserva por historia; para
  cualquier cosa nueva, `own-mint`.

## Correr / escribir un test
```bash
npm run test:e2e:auth            # todos los specs de e2e/authed/ (target = E2E_BASE_URL)
npm run test:e2e:auth:headed     # viéndolo en el navegador
```
Un test nuevo (ejemplo real, `e2e/authed/question-evolution.spec.ts`):
```ts
import { test, expect } from '../fixtures/test'
test('...', async ({ testFlow, evolution }) => {
  await testFlow.goto('/test/repaso-fallos-v2')
  await testFlow.answer('A')
  await testFlow.waitAnswerSaved()          // fuerza la carrera del guardado
  await evolution.open()
  expect(await evolution.currentRowCount()).toBeLessThanOrEqual(1)  // el bug daba 2
})
```

## Secuencia "con dientes" (prueba el bug Y el fix)
1. Corre el spec contra el código **VIEJO** (prod antes de desplegar / preview) → debe **FALLAR**.
2. **Despliega** el fix.
3. Corre otra vez → **PASA**. Bug reproducido y fix demostrado en UI real.

## Higiene de datos
Los specs que ESCRIBEN (responder preguntas) registran `since` y borran con `Cleaner` lo
que crearon (`purgeSince`) → no inflan las estadísticas de la cuenta. Preferir **cuenta de
test dedicada**; si se usa una real, el cleanup es obligatorio.

> El estado de sesión (`e2e/.auth/`) está en `.gitignore` — son credenciales vivas, NUNCA se commitea.
