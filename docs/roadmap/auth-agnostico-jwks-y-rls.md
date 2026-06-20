# Roadmap — Auth agnóstico (Auth.js + RS256/JWKS) + retirada de RLS

> **Estado:** 🟢 EN CURSO. **Fase A ✅ COMPLETA (A1+A2+A3)** (2026-06-20; A1+A2 commit `495886aa`, A3 sin commit aún). Fase B + Fase C pendientes.
> **Propietario:** equipo Vence.
> **Coste recurrente añadido:** 0 € (Auth.js self-hosted, claves en SSM, infra existente).
> **Última actualización:** 2026-06-20.

## Progreso

- **A1 ✅ (2026-06-20):** todos los `supabase.auth.*` de CLIENTE enrutados por el puerto `auth` (22 ficheros). 3 `.js`→`.tsx` tipados strict (GoogleOneTap, AvatarChanger, repaso-fallos-oficial/page). Puerto ampliado con `signInWithIdToken`. typecheck verde, 2382/2383 tests OK (el fallo restante es pre-existente: conteo fijo en `OposicionDetector.test.tsx`, ajeno a auth). Tests `client.test.ts`/`complete-test/client.test.ts`/`testSaveSessionExpired.test.ts` actualizados (sesiones mock ahora con `user`, el puerto descarta sesiones sin usuario). **Hallazgo:** `components/ChatInterface.js` era código muerto (0 importadores; el chat vivo es `AIChatWidget`) → **BORRADO 2026-06-20**. **Diferido (no es A1):** `signInWithOAuth` de login/landing/premium (= funnel C2), `app/auth/callback/page.tsx` (Fase B), server `verifyAuth`/`adminApiGuard` (Fase B).

- **A2 ✅ (2026-06-20):** las 5 RPCs de ciclo de vida → **3 endpoints Drizzle agnósticos** (`POST /api/v2/auth/ensure-profile`, `/api/v2/access/check`, `/api/v2/premium/activate`), invocan las mismas funciones plpgsql vía `getAdminDb().execute(sql\`SELECT fn(named => args)\`)` (notación nombrada = orden infalible). **user_id/email del TOKEN (verifyAuth), nunca del body.** `contexts/AuthContext.tsx` (ensureUserProfile/checkAccess/activatePremium) + `lib/campaignTracker.ts` (otro caller de `create_google_ads_user`) cableados con **ambos paths** detrás del flag compartido `LIFECYCLE_VIA_API` (`lib/auth/lifecycleFlag.ts`, `NEXT_PUBLIC_AUTH_LIFECYCLE_VIA_API`, default false → flip = redeploy). 11 tests nuevos (`authLifecycleEndpoints.test.ts`) + AuthContext 80/80. typecheck verde. **Rollout:** mantener flag false, validar endpoints en log-paralelo, luego flip. **Cabo pendiente (con C2):** `app/landing/premium-edu/page.js:58` también llama `create_google_ads_user` — es landing del funnel C2 (su `signInWithOAuth` ya está diferido ahí); migrar junto con C2 para no dejarla incoherente.

- **A3 ✅ (2026-06-20):** eliminadas las RPCs de admin `is_current_user_admin`/`is_user_admin` (auth.uid(), no portables). **Allowlist client-safe** `lib/auth/adminEmails.ts` (fuente única; `lib/api/shared/auth` la reexporta). Migrados: cliente `app/Header.tsx`, `components/UserAvatar.tsx`, `components/Admin/ProtectedRoute.tsx`, `app/admin/fraudes/page.tsx` + 5 `.js` `admin/notificaciones/*` → `setIsAdmin(isAdminEmail(user.email))`; server `lib/finance/auth.ts` → `isAdminEmail(auth.email)` (quita el cliente Supabase user-scoped). **Borrado** el `POST` muerto de `app/api/admin/email-events/route.ts` (0 callers, usaba `is_user_admin`). **Verificado en BD:** único admin por rol = `manueltrader@gmail.com` (en la allowlist) → cero lockout. El gate REAL sigue server-side (`requireAdmin`); el cliente es solo UI. typecheck verde, 354/354 tests, lint sin errores nuevos. **Cabos de calidad (NO agnosticismo):** (1) `components/ChatInterface.js` **BORRADO** (muerto, 0 importadores). (2) `admin/notificaciones/email/subscripciones/page.js` **→ `.tsx`** strict (era endpoint-based vía `adminFetch`, conversión limpia). (3) Los otros 4 (`overview/users/events/email`) **siguen `.js` a propósito**: usan `supabase.from()` intensivamente (cliente `any`) → convertirlos a strict ahora obligaría a tipar a mano datos `any` que se **re-tiparán al migrar esos `.from()`→endpoints en Fase C**. Se convierten **junto con su migración de Fase C** (evita retrabajo). El RPC admin ya está migrado, así que no bloquean Neon.

### Inventario RPCs restantes (para no perderlas)
- **Fase C (otras RPCs PostgREST de cliente):** OnboardingModal (`get_popular_custom_oposiciones`, `create_or_select_custom_oposicion`), `get_effective_psychometric_difficulty` (`lib/adaptiveQuestionSelection.ts`, `lib/psychometricDifficulty.ts`), `get_personalized_message` (MotivationalMessage), `get_user_share_stats` (SharePrompt), `get_random_upgrade_message`/`track_upgrade_message_{shown,click,dismiss}` (UpgradeLimitModal), `get_user_problematic_articles_weekly` (useIntelligentNotifications), `track_conversion_event` (conversionTracker), `get_daily_question_status`/`increment_daily_questions` (useDailyQuestionLimit cliente). + RPCs server-side ya en `getSupabaseAdmin().rpc` (dailyLimit, deviceLimit, admin endpoints) — PostgREST, migrar a Drizzle en el barrido de Fase C.

## Relación con el resto de roadmaps

Cuelga del [`docs/ARCHITECTURE_ROADMAP.md`](../ARCHITECTURE_ROADMAP.md) → **Fase C (swap Auth)** + **Fase P (desacople PostgREST/RLS)**. Es el **plan de ejecución unificado** de:

- La **Fase 4 (Auth)** de [`agnosticismo-supabase.md`](agnosticismo-supabase.md) — la facade/puerto y el cutover del hub ya están avanzados; este doc define el **emisor** (Auth.js) y su **firma** (RS256/JWKS).
- La parte **RLS** de [`desacople-postgrest-rls.md`](desacople-postgrest-rls.md) — su Fase P2/P3.

⚠️ **Cambio de dirección respecto a `desacople-postgrest-rls.md` §0:** aquel asumía *"el IdP se queda en Supabase Auth"*. **Esta decisión lo supersede**: migramos el IdP a Auth.js para cerrar la portabilidad de verdad. Lo demás de ese doc (PostgREST → Drizzle) sigue vigente y es prerrequisito de la Fase C de aquí.

## Contexto (por qué)

Queremos que **una futura migración de BD (Supabase → Neon/RDS) sea solo cambiar `DATABASE_URL`**, sin que falle ni el login ni la seguridad. Hoy quedan dos acoplamientos a Supabase que lo impedirían:

1. **Auth (emisión de tokens):** el login/sesión/OAuth los emite Supabase Auth (GoTrue). La *verificación* del token ya es agnóstica (`verifyJwtLocal`), pero la *emisión* no.
2. **RLS:** ~32 tablas de usuario tienen políticas con `auth.uid()` (función propietaria de Supabase). En Postgres plano `auth.uid()` no existe → esas lecturas devuelven 0 filas o petan, y si se quita RLS con tablas aún accesibles desde el cliente, hay **fuga cross-user**.

Decisiones tomadas (listón: **robusto, fiable, profesional, pensando en grande**):
- **Emisor:** Auth.js (NextAuth v5) self-hosted, $0, agnóstico. Solo Google OAuth (la app no tiene email/contraseña → **sin migración de hashes**).
- **Firma:** **RS256/JWKS asimétrica** (no el HS256 heredado). El emisor firma con clave **privada**; frontend Next y backend NestJS verifican con la **pública** publicada en un JWKS. Nadie con acceso a un verificador puede falsificar tokens; rotación de claves vía `kid` sin compartir secretos. Estándar para arquitectura multi-servicio.
- **RLS:** se deja de usar. Autorización en capa de app (`verifyAuth` + `WHERE user_id`), respaldada por **guardrail en CI + tests sistemáticos de aislamiento cross-user** (no se reimplementa `auth.uid()`).
- **Despliegue:** cada acoplamiento se voltea por separado, detrás de flag, reversible en <5 min, con **modo shadow** y **ventana de doble-aceptación** de tokens (cero logout forzado).

## Estado del terreno (confirmado en código)

- **Consumo de token ya agnóstico:** `lib/api/auth/verifyJwtLocal.ts` (HS256, `aud:'authenticated'`, claims `sub→userId/email/role`, `clockTolerance:5`) y wrapper `lib/api/auth/verifyAuth.ts` (modos `off/shadow/on` vía `JWT_LOCAL_VERIFY_MODE`).
- **Backend NestJS comparte semántica y secreto:** `backend/src/auth/jwt-verifier.ts` + `jwt.guard.ts` + `auth.module.ts` usan `jsonwebtoken`, HS256, mismo `SUPABASE_JWT_SECRET`, `aud:'authenticated'`. (El doc-comment que dice `jose` está stale.)
- **Emisión ya detrás de un puerto:** `lib/auth/types.ts` (`AuthClientPort`), `lib/auth/client.ts` (singleton, único punto de swap), `lib/auth/adapters/supabaseAdapter.ts`. `getAccessToken()` → `lib/api/authHeaders.ts` (singleflight + cooldown 30s).
- **Admin server:** `lib/auth/server.ts` `authAdmin.getUserById/deleteUser` vía `supabase.auth.admin.*` (única dependencia auth-admin de servidor).
- **Exposición RLS real (cliente sobre PostgREST, mayor de lo estimado):** `lib/testFetchers.ts` (`test_questions`, `tests`), `components/QuestionEvolution.tsx`, `components/PsychometricQuestionEvolution.tsx`, `app/Header.tsx` (`user_streaks`, `feedback_conversations`), `app/perfil/page.tsx` (`user_feedback`, `user_profiles`), `contexts/OposicionContext.tsx`, `hooks/useOnboarding.ts`, `components/OnboardingModal.tsx` (+RPCs custom-oposicion), `app/pregunta/[id]/page.tsx`, `lib/adaptiveQuestionSelection.ts`, `lib/psychometricDifficulty.ts`, y páginas admin (`fraudes/feedback/conversiones/newsletters`).
- **Acoplamientos de schema que romperían Neon:** ~32 `pgPolicy(auth.uid())` en `db/schema.ts`; `backend/src/email/medal-email.service.ts` (`JOIN auth.users`); RPCs `is_current_user_admin`/`is_user_admin` (leen `auth.uid()`); `lib/security/adminApiGuard.ts` (remote `supabase.auth.getUser`); `lib/auth/server.ts` (`supabase.auth.admin.*`); cualquier `supabase.from()/rpc()` restante (PostgREST no existe en Neon).
- Comandos: `npm run test`, `npm run test:unit`, `npm run test:integration`, `npm run test:precommit`, `npm run typecheck`, `npm run lint`, `npm run build`; backend `cd backend && npm test`. `next-auth`/`jose` aún NO instalados.

## Diseño profesional del token (RS256/JWKS)

- **Emisor (Auth.js):** firma el access token con **clave privada RSA** (alg `RS256`), `kid` en la cabecera. Clave privada en **AWS SSM Parameter Store** (`/vence-frontend/AUTH_JWT_PRIVATE_KEY`, SecureString) — AWS-native, igual que el resto de secretos.
- **JWKS público:** endpoint `GET /.well-known/jwks.json` (Next route) sirviendo la(s) clave(s) pública(s) con su `kid`. Cacheable. Rotación: añadir clave nueva → firmar con `kid` nuevo → retirar la vieja tras propagación.
- **Contrato de token (documentado, no truco):** `sub` = `user_profiles.id` (UUID existente, ver detalle crítico abajo), `email`, `role:'authenticated'`, `aud:'authenticated'`, `iss` propio (p.ej. `https://www.vence.es`), `iat/exp` (~1h), `kid` en header.
- **Verificadores (Next `verifyJwtLocal` + backend `JwtVerifier`):** se **amplían** para (a) aceptar `RS256` verificando contra el JWKS por `kid` (con caché, p.ej. `jose`/`createRemoteJWKSet`), y (b) **durante la transición**, seguir aceptando los `HS256` viejos de Supabase con el secreto compartido. Tras expirar los viejos (~1h post-cutover) se retira la rama HS256.
- ⚠️ Con RS256 la doble-aceptación **no es automática** (con HS256 reutilizado sí lo sería): es **explícita** — los verificadores prueban RS256/JWKS y, si falla, HS256-secreto durante la ventana. Más trabajo, pero correcto y futuro-proof.

## Detalle crítico de correctitud: el `sub`

Hoy `sub` = `auth.users.id` = `user_profiles.id`, y TODA la data del usuario cuelga de ese UUID. Google entrega un `sub` propio (distinto). En el callback `signIn`/`jwt` de Auth.js hay que **buscar `user_profiles` por email y fijar el `sub` del JWT al `user_profiles.id` existente** (y crear la fila para usuarios nuevos). Si se hace mal, cada usuario existente "pierde" sus tests/suscripciones. Se valida en shadow mode con el check `userid_mismatch` ya existente en `verifyAuth`.

---

## FASE A — Preparación agnóstica (sin cambio visible, sin tocar el emisor)

**Objetivo:** quitar todo acoplamiento Supabase que no sea el emisor, para que la Fase B sea un flip contenido.

- **A1. Enrutar TODO `supabase.auth.*` de cliente por el puerto** (`auth.*` de `@/lib/auth` o `getAuthHeaders()`): `lib/api/v2/{answer-and-save,complete-test,complete-onboarding}/client.ts`, `lib/testFetchers.ts`, `components/{PersistentRegistrationManager,OposicionDetector,ProgressiveRegistrationModal}.tsx`, `components/test/TemaTestPage.tsx`, `hooks/useDailyQuestionLimit.ts`, `app/premium/page.tsx`, varias `app/**/test/**/page.tsx`. Añadir `signInWithIdToken(idToken)` al `AuthClientPort` + adapter (GoogleOneTap). Refactor 1:1.
- **A2. Convertir 5 RPCs de ciclo de vida a endpoints Drizzle** (`create_google_ads_user`, `create_meta_ads_user`, `create_organic_user`, `check_user_access`, `activate_premium_user`, en `contexts/AuthContext.tsx`). Plpgsql param-driven (ya portables): mantener la función SQL pero llamarla desde nuevos endpoints `verifyAuth` (`POST /api/v2/auth/ensure-profile`, `/api/v2/access/check`, `/api/v2/premium/activate`) vía Drizzle. Detrás de flag `AUTH_LIFECYCLE_VIA_API`. Inventariar (Fase C) RPCs de `OnboardingModal` y psicotécnicas/adaptativas.
- **A3. Sustituir `is_current_user_admin`/`is_user_admin`** por el allowlist de email ya agnóstico: servidor → `requireAdmin()`/`isAdminEmail()` de `lib/api/shared/auth.ts`; gating de cliente → claim `email`/`role` del JWT. Mantener `manueltrader@gmail.com` en el allowlist.
- **A4. Confirmar estrategia de claves** (read-only; secreto compartido confirmado). Preparar clave privada RSA + JWKS para Fase B; marcar `medal-email.service.ts` (`JOIN auth.users`) para Fase C.

**Verificar:** `npm run typecheck && npm run lint && npm run test:unit`; smoke manual. **Rollback:** revert por fichero / flip `AUTH_LIFECYCLE_VIA_API`. **Riesgo:** bajo (A1) / medio (A2 = ruta de dinero → log-paralelo 24h antes de flip).

## FASE B — Cutover del emisor (Supabase Auth → Auth.js RS256/JWKS), riesgo más alto

- **B1.** Auth.js v5 + Google con `jwt` callback (claims del contrato) y `jwt.encode/decode` custom que firman **RS256 con la privada de SSM** + `kid`. Mapear `sub = user_profiles.id` (lookup por email). Endpoints `GET /.well-known/jwks.json` y `GET /api/auth/token` (protegido por cookie) que devuelve el access token RS256 para el Bearer.
- **B2.** Adapter `lib/auth/adapters/authjsAdapter.ts` (implementa `AuthClientPort`). `getAccessToken()` lee de `/api/auth/token` preservando singleflight de `authHeaders.ts`. `completeOAuthCallback()` se simplifica → **borrar** la maquinaria PKCE/tres-canales/localStorage de `supabaseAdapter`. `onAuthStateChange` emulado desde `useSession()`.
- **B3.** Ampliar `verifyJwtLocal.ts` y `backend/src/auth/jwt-verifier.ts` a RS256/JWKS por `kid` + doble-aceptación HS256 en la ventana. Tests: token Auth.js pasa ambos verificadores.
- **B4. Secuencia (cada paso reversible):** (1) desplegar Auth.js dormido; (2) `JWT_LOCAL_VERIFY_MODE=shadow` 24-48h, 0 divergencias; (3) flip `AUTH_PROVIDER=authjs` (una línea en `lib/auth/client.ts`); (4) tokens viejos válidos hasta expirar (~1h), refresh re-emite RS256, sin logout forzado; (5) tras 1 semana limpia: `mode=on` + retirar rama HS256; (6) retirar `adminApiGuard` remoto → local; (7) retirar `authAdmin.deleteUser/getUserById` → `DELETE FROM user_profiles` (CASCADE) + `deleteUserData`; (8) retirar `supabaseAdapter` + PKCE + superficie auth de `lib/supabase.ts`.

**Verificar:** typecheck/build/test + backend test + E2E (signup nuevo id correcto; usuario existente ve histórico = prueba del `sub`; Bearer a `/api/v2/*` y `api.vence.es`; premium; admin); monitor `validation_error_logs`. **Rollback:** pasos 3-6 = flip `AUTH_PROVIDER=supabase` + `mode=shadow` (instantáneo). Pasos 7-8 = punto de no retorno (solo tras semana verde). **Riesgos:** mismatch `sub` (lookup email + assertion shadow); JWE vs JWT (test de decode); entrega del token al browser (no romper el 429).

## FASE C — Retirada de RLS (autorización en app + guardrails)

- **C1.** Migrar los `.from()` de cliente sobre tablas de usuario a endpoints `verifyAuth` con `WHERE user_id=<userId verificado>`. Páginas admin que leen datos de otros usuarios → endpoints `/api/admin/*` con `requireAdmin`. Tras esto, el browser no tiene cliente de datos anon-key.
- **C2. Guardrail en CI** (`test:precommit`): falla si una query a tabla user-scoped no filtra por `user_id` derivado de `verifyAuth` (allowlist de las ~32 como fixture).
- **C3. Tests de aislamiento cross-user** (`__tests__/integration`/`security`): usuarios A y B; cada endpoint user-scoped → A no lee/escribe filas de B. Prueba conductual que reemplaza RLS.
- **C4. Drop de políticas `auth.uid()` (migración reversible):** `DROP POLICY` de las ~32 + opcional `DISABLE ROW LEVEL SECURITY` (down-migration recrea verbatim desde `db/schema.ts`). Revisar 8 public-read (inocuas) y 13 lockdown (sin cambio). Arreglar `medal-email.service.ts` (`JOIN auth.users` → `user_profiles.email`) y eliminar funciones `is_*_admin`.

**Verificar:** `test:integration` + guardrail + build + backend test; migración contra copia de staging antes. **Rollback:** down-migration recrea políticas. **Riesgo:** medio → desplegar C1+C2+C3 y reposar 1 semana en prod ANTES de C4 (el drop es entonces no-op).

## Qué seguiría rompiendo el swap a Neon/RDS si se deja sin hacer

1. ~32 `pgPolicy(auth.uid())` en `db/schema.ts` → C4 (y C1 antes para no exponer).
2. `backend/src/email/medal-email.service.ts` `JOIN auth.users` → C4.
3. `is_current_user_admin`/`is_user_admin` → A3 + drop en C4.
4. `lib/security/adminApiGuard.ts` remote `supabase.auth.getUser` → B4 paso 6.
5. `lib/auth/server.ts` `authAdmin.*` → B4 paso 7.
6. Cualquier `supabase.from()/rpc()` restante → A2/A3 + C1 + barrido de crons/admin.
7. Renombrar envs `SUPABASE_*` → `DATABASE_URL`/`JWT_SECRET` (cosmético, último).

## Secuencia de PRs
Fase A: 3 PRs (A1 refactor; A2 endpoints tras flag; A3 admin-check). Fase B: 1 PR (Auth.js dormido + adapter RS256/JWKS + verificadores) + flips por env. Fase C: PR C1 (endpoints), PR C2/C3 (tests), PR C4 (migración). Cada PR desplegable y revertible.

## Ficheros críticos
- `lib/api/auth/verifyJwtLocal.ts` + `lib/api/auth/verifyAuth.ts` (RS256/JWKS + doble-aceptación + flip de modo)
- `backend/src/auth/jwt-verifier.ts` (ampliar a RS256/JWKS)
- `lib/auth/client.ts` (swap `AUTH_PROVIDER`), `lib/auth/types.ts`, `lib/auth/adapters/supabaseAdapter.ts` (plantilla → `authjsAdapter.ts`)
- `contexts/AuthContext.tsx` (5 RPCs → endpoints; mapeo `sub`)
- `lib/auth/server.ts` (retirar `authAdmin.*`), `lib/security/adminApiGuard.ts`
- `db/schema.ts` (~32 políticas a dropear en C4), `backend/src/email/medal-email.service.ts`
- Nuevos: `app/api/auth/[...nextauth]`, `app/.well-known/jwks.json/route.ts`, `app/api/auth/token/route.ts`, `lib/auth/adapters/authjsAdapter.ts`, endpoints A2/C1.
