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

## Autenticarse (elige provider con `E2E_SESSION_PROVIDER`)
- **`storage` (fiable, por defecto):** login manual UNA vez → se reutiliza.
  ```bash
  E2E_BASE_URL=https://www.vence.es npm run e2e:login:capture   # abre navegador, te logueas, se guarda
  ```
- **`bridge` (cero login manual, spike):** acuña la sesión programáticamente (necesita
  `SUPABASE_SERVICE_ROLE_KEY` + `E2E_USER_EMAIL`). Se valida en la 1ª corrida; si no
  hidrata, usa `storage`.

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
