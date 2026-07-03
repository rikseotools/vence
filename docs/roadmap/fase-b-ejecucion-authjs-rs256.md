# Fase B — Plan de ejecución: emisor de tokens Supabase Auth → Auth.js (RS256/JWKS)

> **Qué es esto:** el plan paso-a-paso, listo para ejecutar, de la **Fase B** del
> roadmap [`auth-agnostico-jwks-y-rls.md`](./auth-agnostico-jwks-y-rls.md). Aquel
> doc define el QUÉ y el porqué; **este define el CÓMO** (comandos exactos, diffs,
> tests, secuencia de flags, rollback y precondiciones).
>
> **Por qué importa para AWS:** Fase B es **prerrequisito de §3.1 del roadmap de
> migración** [`migracion-vercel-a-aws.md`](./migracion-vercel-a-aws.md) (migrar la
> BD a Postgres portable RDS/Neon). No se puede soltar Supabase mientras el **emisor
> de tokens** y `auth.users` sigan siendo de Supabase. Cerrar Fase B + Fase C4
> (drop RLS) = la BD pasa a ser un `DATABASE_URL` cambiable → **cierra el SPOF del
> 503** documentado en [`incidente-answer-save-503-01-06.md`](./incidente-answer-save-503-01-06.md).
>
> **Estado:** 🟢 **FLIP EN PROD Y ESTABLE (4º intento, 2026-07-03, `vence-frontend:320`).** Tras 3 intentos fallidos (ver §POST-MORTEM), el **bridge server-side** (opción (a) del post-mortem) cerró el session-gap: `/api/auth/token`, si no hay sesión Auth.js pero llega un Bearer Supabase HS256 válido, acuña el RS256 desde él (server-side, sin pelear con el AuthProvider ni con localStorage). Verificación del 4º intento: **E2E real contra PROD** con sesión de usuario real (token HS256 mintado con el secreto de SSM, inyectado en Playwright contra `www.vence.es`) → `/api/auth/token` 200 / 401×0, `/api/v2` 12×200 / 0 flood, AuthProvider NO borró localStorage, sesión persiste. **Verificado con USUARIOS REALES (1,5h post-flip): 10 usuarios logueados distintos respondieron 65 preguntas, 9 crearon tests, 3 completados; 0 usuarios fallando auth; 0 errores runtime; sin caída de actividad al atravesar los flips (`test_questions` ~300-921/h estable).** Observabilidad: warn dentro de banda histórica (100% anónimo), home 200, rollout 2/2.
>
> **Fix follow-up (`:319`, commit `72299dd3`):** bajo el flip, `signOut` no bastaba con cerrar la sesión Auth.js — la sesión Supabase seguía en localStorage y el bridge la re-hidrataba → **auto-relogin tras "cerrar sesión"**. `authjsAdapter.signOut` ahora **borra la clave `sb-<ref>-auth` de localStorage** antes de `nextSignOut` (regex `LEGACY_SB_KEY_RE` compartida lector/borrado) → logout real. +test de regresión (15/15). Residual conocido: un usuario con el bundle `:318` **cacheado** que cierre sesión aún se auto-reloguea hasta refrescar el JS (benigno, autocura).
>
> **2º hueco del flip — PANEL ADMIN caía 401 (`:320`, commit `fb1b94a3`):** el guard `guardAdminApi` (proxy, `lib/security/adminApiGuard.ts`) validaba SOLO con `supabase.auth.getUser` (remoto), y Supabase NO reconoce los RS256 → tras el flip TODO el panel admin daba 401 (dashboard, pending-counts, unread-sales, validation-errors, oep-signals…). Regular v2 iba bien (su `verifyAuth` enruta por alg); el guard del proxy se quedó atrás — el roadmap lo retiraba en el **paso 6** de B4 pero el flip (paso 3) fue antes. **Fix:** el guard enruta por alg (edge-safe): RS256 → `verifyJwtRs256` (jose/JWKS, pubkey en env), HS256 → `getUser` remoto (legacy intacto). **Adelanta parcialmente el paso 6.** Verificado en prod: RS256-admin→200, HS256-admin→200, RS256-no-admin→403, sin-token→401. +4 tests de regresión en `__tests__/middleware/adminGuard.test.ts` (17/17). **Lección (repetida): el gate E2E del flip probó `/api/v2` normal pero NO los endpoints admin — el mismo patrón que dejó pasar el FK (1er intento) y el session-gap (2º/3º): cubrir TODAS las superficies de auth, no solo la principal.**
>
> **GHA auto-deploy DESACTIVADO** (push-trigger eliminado de `frontend-deploy.yml`, commit `789d02aa`). Rollback a `:317` (build supabase) a un comando. **Pendiente de cierre:** ver §"Siguiente paso" abajo.

---

## 👉 Siguiente paso (dónde estamos: **paso 4** de la secuencia B4)

El flip está hecho y estable; ahora corren en paralelo la **rama HS256** (doble-aceptación) y el **bridge**, que llevan a los usuarios con sesión Supabase viva sin re-login. `JWT_LOCAL_VERIFY_MODE=on` **ya está** puesto (`:319`).

**1. AHORA — dejar reposar ~1 semana y vigilar (NO tocar el emisor).** No hay código que escribir; es soak deliberado antes del punto de no retorno. Durante la ventana las sesiones Supabase se migran solas a Auth.js (token ~1h → al expirar, re-login Google = 1 clic; el bridge descarta expirados). Vigilar a diario:
   - `SELECT count(*) FILTER (WHERE severity='error') FROM observable_events WHERE event_type='auth' AND created_at > now()-interval '1 day'` → debe seguir **0**.
   - **0 usuarios logueados fallando auth** (auth/warn con `userId`); actividad `test_questions`/`tests` en su banda normal.
   - Medir el **drenaje de sesiones Supabase** con **`node scripts/fase-b-drenaje.cjs [días]`** (requiere `source .env.local`): reporta usuarios DISTINTOS por día que acuñan token vía `bridge` (aún dependen de su sesión Supabase legacy) vs `authjs_session` (ya migrados). Se alimenta del evento `auth_token_minted {via}` instrumentado en `app/api/auth/token/route.ts` (commit `025e40db`). **Requiere desplegar esa instrumentación (`:320+`) para empezar a recoger** — hasta entonces el script reporta "sin datos". Cuando `bridge` → ~0 varios días seguidos → luz verde al paso 2.

**2. Paso 5 de B4 (PUNTO DE NO RETORNO) — retirar la rama HS256 + el bridge.** Solo cuando (1) haya pasado ~1 semana limpia y (2) el drenaje confirme que quedan ~0 sesiones Supabase vivas. Quita la doble-aceptación de los verificadores (`verifyAuth` solo RS256), elimina la rama bridge de `/api/auth/token` y el `getLegacySupabaseAccessToken`/`clearLegacySupabaseSession` del `authjsAdapter` (con esto muere también el residual del auto-relogin por caché). Reversible con revert **hasta** este merge; después ya no.

**3. En paralelo — Fase C4 (drop RLS `auth.uid()`).** Independiente del emisor pero cierra el desacople para AWS. Precondición pendiente: **cerrar el último `.from` de cliente user-scoped** (`loadProblematicArticles`, canary) — si no, al dropar RLS hay fuga cross-user. C1+C2+C3 ya llevan reposando en prod.

**4. Loose end operativo — deploy.** El auto-deploy quedó **desactivado** (solo `workflow_dispatch`; el `push:` metía builds supabase por sorpresa). Estado:
   - ✅ **Path manual robusto hecho:** `scripts/deploy-frontend.sh` — build+push+deploy ATÓMICO con un solo SHA (arregla el tag-mismatch de los scripts de scratchpad), clona la task def VIVA (hereda AUTH_JWT_*, mode=on, pooler), rolling + `wait services-stable` + smoke. Rollback impreso al final. Es el path fiable mientras GHA esté manual.
   - ⚠️ **El YAML de `frontend-deploy.yml` YA es correcto** (pasa `NEXT_PUBLIC_AUTH_PROVIDER`/`_LIFECYCLE_VIA_API` como build-args desde GH secrets, re-aplica todos los secretos runtime, solo `workflow_dispatch`). **El landmine está en los GH SECRETS:** si `NEXT_PUBLIC_AUTH_PROVIDER` está vacío, un dispatch manual construiría bundle **supabase** → des-fliparía prod. **ACCIÓN PENDIENTE (Manuel, requiere `gh auth login` o UI de GitHub):** `gh secret set NEXT_PUBLIC_AUTH_PROVIDER --body authjs` + `gh secret set NEXT_PUBLIC_AUTH_LIFECYCLE_VIA_API --body true`. Con eso, un `workflow_dispatch` produce bundle flip correcto y CI vuelve a ser usable/seguro.
   - Re-activar el `push:` trigger: solo tras lo anterior + endurecer que no pise deploys (ya hay `concurrency` con cancel-in-progress).

**5. ✅ HECHO — GATE E2E de superficies de auth** (`scripts/fase-b-auth-surfaces-check.cjs`, commit pendiente). Con un token RS256 (el que emite el flip) ejercita UN endpoint de cada guard distinto y comprueba códigos: **verifyAuth** (regular v2 `topic-progress/theme-stats` → 200 admin/no-admin, 401 sin token), **guardAdminApi** (`/api/v2/admin/dashboard` + `/api/admin/pending-counts` → 200 admin, 403 no-admin, 401 sin token, + HS256 legacy 200), **authenticateFinanceRequest** (`/api/finance/transfers` → 200 admin, 403 no-admin, 401 sin token). 11/11 verde contra prod el 03/07. **Es el gate que habría evitado los 3 huecos del día.** Uso: `node scripts/fase-b-auth-surfaces-check.cjs [baseUrl]` (requiere `SUPABASE_JWT_SECRET` de SSM). **Correr ANTES de desplegar cualquier cambio de auth.** Pendiente menor: cablearlo en CI/pre-deploy como gate obligatorio (hoy es manual).

**6. Pulir (menor) — blip de token transitorio.** Bajo el flip, si `/api/auth/token` falla un instante (frío / cooldown del singleflight de `authHeaders.ts`), `getAuthHeaders` devuelve vacío → una petición admin puntual sale sin Bearer → 401 `hadAuthHeader:false` (se autocorrige al siguiente intento; visto 1 vez el 03/07). No rompe nada, pero para pulir: manejo de `refresh_token` / reintento con backoff en la adquisición de token. No urgente.

**7. Higiene — allowlist admin duplicada.** `ADMIN_EMAILS` está en `lib/security/adminApiGuard.ts` Y en `lib/auth/adminEmails.ts` (riesgo de drift). Unificar en una sola fuente (la de `adminEmails.ts`, client-safe) cuando se toque el paso 6 de B4.

**8. Desbloqueo final.** Cerrar Fase B (pasos 5-8) + C4 deja la BD como un `DATABASE_URL` cambiable → habilita **§3.1 de `migracion-vercel-a-aws.md`** (migrar Postgres a RDS/Neon) y cierra el SPOF del 503.

---

## 🔴 POST-MORTEM: por qué falló el flip (3 intentos, 2026-07-03)

**NO re-intentar el flip hasta resolver el §"session-gap" de abajo.** Tres despliegues del flip, tres incidentes en prod (flood de 401 + rollback):

1. **1er intento (`:312`, mañana):** flip hecho **ANTES de re-apuntar los FKs a `auth.users`** → `create_organic_user` de usuario nuevo violaba `user_profiles_id_fkey` (23503) → sin `session.user.id` → `/api/auth/token` 401 → cascada. **Resuelto** con el re-point de 52 FKs (Fase 1). NO era el "iss missing" (ruido).

2. **2º intento (`:314`):** con el FK arreglado, **volvió el flood** — pero la maquinaria funciona (0 CallbackRouteError/RS256/resolveAppUser). Causa = **SESSION-GAP**: los usuarios ACTIVOS tienen sesión Supabase pero NO sesión Auth.js. Al flipear el cliente a authjs, `getAccessToken()`→`/api/auth/token` da 401 (no hay sesión Auth.js) → sus hooks bombardean `/api/v2` con 401 ANTES de que el bootstrap los redirija. El bootstrap-redirect actuaba demasiado tarde y era disruptivo.

3. **3er intento (`:316`):** implementé un **fallback**: `authjsAdapter` cae al token Supabase de localStorage (verificado por mode=on HS256). Verificado en local con sesión sintética inyectada (16 unit + integración 13/200). **Y AUN ASÍ FLOODEÓ EN PROD.** El log del navegador reveló por qué: **el propio `AuthProvider` (contexts/AuthContext) pre-hidrata de localStorage y BORRA la sesión Supabase** cuando el primer `INITIAL_SESSION` llega sin usuario Auth.js (`🧹 localStorage limpiado (token expirado)`) → destruye la fuente del fallback antes de que el adapter la use. Además `getLegacySupabaseSession` no parseaba el formato real de supabase-js. **El test local dio falsa confianza (3ª vez) porque inyectaba una sesión sintética y no ejercía la lógica de borrado del AuthProvider.**

**RAÍZ del session-gap:** el cutover de IdP toca MÁS que el adapter. El `AuthProvider` tiene su propia gestión de sesión (pre-hydrate + clear-on-no-user) que pelea con cualquier fallback de cliente. **Opciones a diseñar (con calma, no en caliente):**
- (a) **Bridge server-side:** `/api/auth/token`, si no hay sesión Auth.js pero llega un Bearer Supabase HS256 válido, acuña RS256 desde él (resolviendo email→user_profiles.id). Los usuarios existentes siguen sin re-login; NO depende de localStorage ni pelea con el AuthProvider. **Probablemente la vía correcta.**
- (b) Que el AuthProvider NO borre la sesión Supabase durante la ventana de cutover (flag).
- (c) Aceptar re-login forzado, pero SIN flood: no montar los hooks/no llamar `/api/v2` hasta tener sesión.
- **Verificar SIEMPRE contra el escenario REAL** (sesión Supabase de verdad + AuthProvider vivo), no una inyección sintética.

**GOTCHA que agravó todo: GHA auto-despliega en cada push.** "GHA no despliega" era FALSO. `frontend-deploy.yml` construye+despliega en push a main (paths NO-ignorados), con los build-args `NEXT_PUBLIC_AUTH_*` **sin setear** → build supabase/lifecycle-false. Metió `:315` (push 87222dc) y `:317` (push f234b80) por sorpresa, revirtiendo deploys manuales y complicando rollbacks (3 deployments concurrentes → hubo que parar tareas a mano). **Desactivar el push-trigger de GHA antes de retomar** (editar solo el workflow NO auto-dispara: está en `paths-ignore`). GOTCHA rollback: `:313` no arrancaba por 2 deployments compitiendo → rollback real fue a `:315` (GHA supabase, probado-corriendo). El fix buggy además **borró la sesión Supabase** de los usuarios que tocaron `:316` → re-login (molestia real).

## ⚠️ Precondiciones (NO empezar si falta una)

**§0 — Precondiciones de ESQUEMA y VERIFICACIÓN (las que faltaron el 03/07 y rompieron prod):**
- ✅ **Re-point de los 53 FKs `auth.users`→`user_profiles`** (Fase 1, aplicada 03/07). Sin esto, `create_organic_user` de un usuario nuevo viola `user_profiles_id_fkey` → registro roto. Verificar: `SELECT count(*) FROM pg_constraint WHERE contype='f' AND confrelid='auth.users'::regclass AND connamespace='public'::regnamespace` = 0.
- ⏳ **Cerrar los `.from` de cliente user-scoped** (`loadProblematicArticles` canary) — si no, al dropar RLS (C4) hay fuga cross-user. C4 es parte del cierre de Fase B/C.
- ⏳ **Fix `resolveAppUser`**: para un usuario que está en `auth.users` sin perfil, hoy genera un UUID NUEVO en vez de reusar el suyo (tras el backfill del 03/07 no hay ninguno, pero conviene por robustez).
- ⏳ **Manejo del session-gap**: al flipear, los usuarios con sesión Supabase NO tienen sesión Auth.js → `/api/auth/token` 401 hasta re-login. Decidir: bootstrap silencioso vs re-login forzado en franja de bajo tráfico.
- 🚨 **GATE OBLIGATORIO — harness E2E con login Google real** (`scratchpad/authjs-e2e-validate.cjs`): signin→callback→`/api/auth/session` con `user.id`→`/api/auth/token` RS256→Bearer `/api/v2/*` 200. La validación "en dormido" NO vale (no crea sesión real). Este gate es lo que habría evitado el incidente del 03/07. **✅ PASADO EN LOCAL (03/07)** con `next dev` (authjs+lifecycle+mode=on): toda la cadena verde, `iss` presente (Google sí lo manda), 0 errores 500. **NO existe entorno preview** (`preview-aws.vence.es` = alias del mismo prod) → se verifica en local (`scratchpad/start-flip-dev.sh`; requiere `http://localhost:3000/api/auth/callback/google` en el OAuth client Vence `28025109215-...`, sección "Authorized redirect URIs"). **✅ COMPLETO (03/07): los 3 escenarios verdes** — usuario existente (cadena 200), usuario NUEVO (9/9 PASS: crea perfil fresco → session.user.id nuevo → RS256 → `/api/v2` 200 → sin Bearer 401), y bootstrap (sesión Supabase residual → dispara signIn). Flip listo; falta solo el deploy.


1. **Deploys estables.** Hoy (25/06) los deploys del frontend **revierten** bajo
   `db-ready` 503 (circuit-breaker). Meter cambios de auth en esa situación es
   temerario. Requisito: 2-3 deploys seguidos que lleguen a `services-stable`.
2. **Sin sesión paralela tocando `main`.** Fase B añade `jose` (toca
   `package-lock.json`) + ficheros de auth → coordinar para evitar conflictos.
3. **C1+C2+C3 ya en prod** (✅ hechas) — la autorización en app no debe depender
   del emisor para nada salvo el `sub`.
4. **Backup del proyecto Supabase** + acceso a SSM (`aws ssm ... --profile vence`).

---

## Readiness verificado (2026-06-26)

Pre-flight contra prod del riesgo nº1 (mismatch de `sub` → un usuario hereda datos de otro). **Lo crítico, VERDE:**
- ✅ **`user_profiles`: 0 emails duplicados** (case-insensitive) y **0 emails NULL/vacíos** → el lookup `email → user_profiles.id` para fijar `token.sub` es **inequívoco** para los 8782 perfiles.
- ✅ **`auth.users`: 0 emails duplicados** + **0 mismatches solo-de-casing** entre `auth.users.email` y `user_profiles.email` del mismo id → sin fallos de lookup por casing.
- ✅ **Piezas de soporte ya existen:** `create_organic_user` (función canónica, usuarios nuevos), `app/api/v2/auth/ensure-profile/route.ts`, y el check `userid_mismatch` en `lib/api/auth/verifyAuth.ts` (validación en shadow mode).
- 🔁 **Re-verificar el día del cutover** (los emails únicos pueden cambiar): `SELECT lower(email), count(*) FROM user_profiles WHERE email IS NOT NULL GROUP BY 1 HAVING count(*)>1` debe dar 0 filas.

**Precondiciones OPERATIVAS:**
- 🟡 **Deploys estables (precondición 1) — matizado 2026-06-26.** El health-check da 🔴 ROJO por **503 "Servicio saturado"**, pero investigado a fondo: **NO es inestabilidad de deploy ni saturación de pool** — son **queries de agregación lentas** (count-por-topic mean 2-4s/max 34s; user_article_stats mean 6.7s/max 29s) que superan `withDbTimeout(8000)`. Patrón disperso (~15/día sobre 17 deploys, NO cascada). Es un **baseline bajo de timeouts user-facing**, no deploys que revierten. Ver `pool-segregation.md` §"ACTUALIZACIÓN 2026-06-26". **Implicación para Fase B:** estos 503 NO son el bloqueador que creí; la precondición real ("2-3 deploys seguidos a `services-stable` sin revert por circuit-breaker `db-ready`") sigue **sin verificar directamente** — comprobar el estado de los últimos deploys ECS antes de la ventana. Aparte, conviene bajar ese baseline de timeouts (optimizar las queries lentas) por higiene user-facing, pero no es gate duro de Fase B.
  - ✅ **RESUELTO 2026-07-01 (commit `51c98f22`).** Ese día los deploys SÍ revertían en bucle (circuit-breaker `db-ready` → churn infinito), pero la causa era distinta a lo de arriba: **`/api/health/db-ready` probaba `getDb()`→Supavisor** (pooler regional COMPARTIDO), mientras el tráfico user-facing va por el **pooler propio HA**. Un blip del Supavisor (carga de OTROS clientes) daba 503 aunque la app sirviera bien → ECS mataba contenedores sanos. Medido: pooler propio `SELECT 1`=6-79ms sano, backend 44/90 conexiones 0 locks, Supavisor flapeando >2s. Fix: `db-ready` prueba el pool que REALMENTE sirve (`getPoolerDb()`, cae a `getDb` si el flag off). Self-healing + **elimina la fragilidad del deploy** (ya no depende de `startPeriod`/`grace`). Detalle en `self-hosted-pooler.md` §"Incidente 2026-07-01". **→ La precondición 1 (deploys estables) queda desbloqueada por este fix.**
- ⏳ **Sin sesión paralela en `main`** (precondición 2): hay actividad de otra sesión en el working tree → coordinar antes (Fase B toca `package-lock.json` con `jose` + ficheros de auth).

---

## Contrato del token (lo que el verificador debe aceptar tras el cutover)

```
header:  { "alg": "RS256", "kid": "<id-clave>", "typ": "JWT" }
payload: {
  "sub":   "<user_profiles.id>",   // ⚠️ NO el sub de Google — ver "Detalle del sub"
  "email": "user@example.com",
  "role":  "authenticated",
  "aud":   "authenticated",        // se mantiene para no tocar EXPECTED_AUDIENCE
  "iss":   "https://www.vence.es", // emisor propio
  "iat":   <epoch>, "exp": <epoch ~+1h>
}
```

**Detalle crítico del `sub`:** hoy `sub = auth.users.id = user_profiles.id`, y toda
la data del usuario cuelga de ese UUID. Google da un `sub` propio (distinto). En el
callback `jwt`/`signIn` de Auth.js hay que **buscar `user_profiles` por email y fijar
`token.sub = user_profiles.id`** (y crear la fila para usuarios nuevos, vía la misma
función canónica `create_organic_user` / `POST /api/v2/auth/ensure-profile` que ya
usa AuthContext en el 1er login). Si esto se hace mal, cada usuario existente "pierde"
sus tests/suscripciones. Se valida en **shadow mode** con el check `userid_mismatch`
que ya tiene `verifyAuth`.

---

## B0 — Generar el par RSA + guardarlo en SSM (infra, una vez)

```bash
# Par RSA 2048 (PKCS8 privada + SPKI pública)
openssl genpkey -algorithm RSA -pkeyopt rsa_keygen_bits:2048 -out /tmp/authjs_priv.pem
openssl rsa -in /tmp/authjs_priv.pem -pubout -out /tmp/authjs_pub.pem
KID="vence-$(date +%Y%m)"   # ej. vence-202607; rotación = kid nuevo

# Privada → SSM SecureString (AWS-native, igual que el resto de secretos)
aws ssm put-parameter --name /vence-frontend/AUTH_JWT_PRIVATE_KEY \
  --type SecureString --value "file:///tmp/authjs_priv.pem" \
  --profile vence --region eu-west-2
aws ssm put-parameter --name /vence-frontend/AUTH_JWT_KID \
  --type String --value "$KID" --profile vence --region eu-west-2
# Pública también en SSM (la sirve el endpoint JWKS; no es secreta pero centraliza)
aws ssm put-parameter --name /vence-frontend/AUTH_JWT_PUBLIC_KEY \
  --type String --value "file:///tmp/authjs_pub.pem" \
  --profile vence --region eu-west-2

rm /tmp/authjs_priv.pem /tmp/authjs_pub.pem   # no dejar copias en disco
```

Cablear las 3 en `frontend-deploy.yml` (patrón `ensure_secret(...)` que ya inyecta
los `ADS_*`) → llegan como env a las tasks de Fargate.

---

## B1 — Auth.js dormido + endpoints (un PR, NO cambia comportamiento aún)

1. `npm install jose next-auth@beta` (Auth.js v5). `jose` da `SignJWT` (firmar
   RS256) + `createRemoteJWKSet`/`jwtVerify` (verificar).
2. **`app/.well-known/jwks.json/route.ts`** (PÚBLICO, cacheable): construye el JWKS
   desde `AUTH_JWT_PUBLIC_KEY` + `AUTH_JWT_KID` (`jose.exportJWK`). Si las env no
   están → `{ keys: [] }` (dormido, no rompe nada).
3. **Auth.js v5** (`app/api/auth/[...nextauth]/route.ts` + `lib/auth/authjs.ts`):
   solo Google. Callback `jwt`: lookup `user_profiles` por email → `token.sub =
   user_profiles.id`. `jwt.encode` custom: **firma RS256 con la privada de SSM** +
   `kid` (`jose.SignJWT`), claims del contrato. NADIE lo usa todavía (el hub sigue
   en `supabaseAdapter`).
4. **`app/api/auth/token/route.ts`** (protegido por cookie de sesión Auth.js):
   devuelve el access token RS256 para que el adapter lo ponga como Bearer.

**Verificar B1:** `npm run build`; hit a `/.well-known/jwks.json` → JWKS válido;
login Google de prueba en una preview → `/api/auth/token` devuelve un RS256 que
`jose.jwtVerify(token, JWKS)` acepta y cuyo `sub` == `user_profiles.id`.

---

## B3 — Verificadores RS256/JWKS (dormido, SIN romper el HS256 vivo)

> El `lib/api/auth/verifyJwtLocal.ts` actual es **síncrono** (jsonwebtoken, whitelist
> `['HS256']`). RS256/JWKS es **async** (aunque la JWKS se cachee). **NO** convertir
> el síncrono en async de golpe (toca el hot-path de cada request). Patrón seguro:

1. **Nuevo helper async aislado** `lib/api/auth/verifyJwtRs256.ts`:
   `verifyJwtRs256(token): Promise<JwtVerifyResult>` usando
   `createRemoteJWKSet(new URL(JWKS_URL))` + `jwtVerify` con
   `algorithms:['RS256']`, `audience:'authenticated'`, `issuer` propio. Mismo
   `JwtVerifyResult` que el HS256 → intercambiable.
2. **`verifyAuth.ts` decide la rama por el header `alg`** (decode sin verificar
   solo para leer `alg`): `RS256` → `verifyJwtRs256`; `HS256` → `verifyJwtLocal`
   (intacto). Durante la ventana de cutover acepta **ambos** (doble-aceptación
   explícita). `verifyAuth` ya es async → no cambia su firma.
3. **Backend** `backend/src/auth/jwt-verifier.ts`: misma ampliación (jose +
   `createRemoteJWKSet`), misma doble-aceptación HS256 en la ventana.
4. **Tests** (clave de test generada en el propio test, NO la de prod):
   - un token RS256 firmado con la priv de test pasa `verifyJwtRs256`;
   - `verifyAuth` enruta bien por `alg` (RS256 vs HS256);
   - **anti algorithm-confusion**: un RS256 firmado con la pública como si fuera
     HS256 secret → RECHAZADO (whitelist por rama, nunca `alg:none`);
   - HS256 actual sigue pasando byte-idéntico (test de no-regresión).

**Garantía de no romper:** mientras no se emitan RS256 (B4 no flipado), la rama
RS256 nunca se ejerce en prod → el path HS256 vivo queda intacto.

---

## B2 — Adapter Auth.js (parte del flip, no antes)

`lib/auth/adapters/authjsAdapter.ts` implementa `AuthClientPort` (mismo contrato que
`supabaseAdapter`). `getAccessToken()` lee `/api/auth/token` preservando el
singleflight+cooldown de `lib/api/authHeaders.ts`. `completeOAuthCallback()` se
simplifica (Auth.js hace el round-trip server-side) → se **borra** la maquinaria
PKCE/tres-canales/localStorage del `supabaseAdapter`. `onAuthStateChange` se emula
desde `useSession()`. Punto de swap: `AUTH_PROVIDER` en `lib/auth/client.ts`.

---

## B4 — Secuencia de cutover (cada paso REVERSIBLE)

| # | Acción | Reversible con |
|---|--------|----------------|
| 1 | Desplegar B1+B3 **dormidos** (`lib/auth/client.ts` sigue en `supabaseAdapter`) | revert del PR |
| 2 | `JWT_LOCAL_VERIFY_MODE=shadow` 24-48h → **0 divergencias** (`userid_mismatch`, etc.) sobre tokens reales | env |
| 3 | Flip `AUTH_PROVIDER=authjs` (1 línea). Nuevos logins → RS256 con `sub=user_profiles.id` | `AUTH_PROVIDER=supabase` (instantáneo) |
| 4 | Tokens Supabase viejos siguen aceptados (rama HS256) hasta expirar (~1h); el refresh re-emite RS256. Google-only → re-login = 1 clic. **Sin logout forzado** | — |
| 5 | Tras 1 semana limpia: `JWT_LOCAL_VERIFY_MODE=on` (quita round-trip remoto) + **retirar la rama HS256** de los verificadores | revert (punto de no retorno tras esto) |
| 6 | Retirar `adminApiGuard` remoto → `verifyJwtLocal`+`isAdminEmail` | revert |
| 7 | Retirar `authAdmin.deleteUser/getUserById` → `DELETE FROM user_profiles` (CASCADE) + `deleteUserData` | revert |
| 8 | Retirar `supabaseAdapter` + PKCE + superficie auth de `lib/supabase.ts` | — |

**Monitor en cada paso:** `validation_error_logs` + `observable_events`
(`event_type` de auth) + `db-ready`/`services-stable` del deploy.
**Rollback de oro (pasos 3-6):** `AUTH_PROVIDER=supabase` + `JWT_LOCAL_VERIFY_MODE=shadow`
→ vuelve a Supabase Auth con el `supabaseAdapter` intacto, sin pérdida de sesión.

---

## Riesgos y mitigaciones

- **Mismatch del `sub`** (el grande): mitigado por el lookup por email + la
  assertion `userid_mismatch` en shadow (paso 2) ANTES de cualquier flip.
- **JWE vs JWT**: Auth.js v5 por defecto **cifra** la sesión (JWE). El access token
  para el Bearer debe ser **JWT firmado** (no JWE) → `jwt.encode` custom con
  `jose.SignJWT`. Test de `decode` obligatorio.
- **Algorithm confusion**: ramas separadas por `alg` con whitelist por rama; nunca
  un verificador que acepte `RS256|HS256` con el mismo material de clave.
- **Entrega del token al browser**: `/api/auth/token` no debe romper el 429/cooldown
  del singleflight de `authHeaders.ts`.

---

## Ficheros que toca Fase B

- **Nuevos:** `app/.well-known/jwks.json/route.ts`, `app/api/auth/[...nextauth]/route.ts`,
  `app/api/auth/token/route.ts`, `lib/auth/authjs.ts`, `lib/auth/adapters/authjsAdapter.ts`,
  `lib/api/auth/verifyJwtRs256.ts`, tests.
- **Ampliados:** `lib/api/auth/verifyAuth.ts` (rama por `alg`),
  `backend/src/auth/jwt-verifier.ts` (RS256/JWKS), `lib/auth/client.ts` (`AUTH_PROVIDER`),
  `frontend-deploy.yml` (inyectar `AUTH_JWT_*`).
- **Se retiran (pasos 6-8):** `lib/security/adminApiGuard.ts` (remoto),
  `lib/auth/server.ts` (`authAdmin.*`), `lib/auth/adapters/supabaseAdapter.ts`,
  superficie auth de `lib/supabase.ts`.

---

## Enlaces

- Roadmap padre (QUÉ + porqué): [`auth-agnostico-jwks-y-rls.md`](./auth-agnostico-jwks-y-rls.md) — Fase B.
- Migración AWS (Fase B desbloquea §3.1 DB→RDS): [`migracion-vercel-a-aws.md`](./migracion-vercel-a-aws.md).
- Por qué urge el agnosticismo de BD (SPOF del 503): [`incidente-answer-save-503-01-06.md`](./incidente-answer-save-503-01-06.md).
