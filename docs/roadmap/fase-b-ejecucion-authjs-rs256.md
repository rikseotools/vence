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
> **Estado:** 🔴 NO INICIADA. Plan listo para una **ventana limpia**.

---

## ⚠️ Precondiciones (NO empezar si falta una)

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

**Precondiciones OPERATIVAS que faltan validar (no de datos):**
- ⏳ **Deploys estables** (precondición 1): confirmar 2-3 deploys seguidos a `services-stable` sin revert por `db-ready` 503 antes de tocar auth.
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
