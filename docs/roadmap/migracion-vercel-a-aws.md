# Roadmap — Migración completa de Vercel a AWS (agnóstico a cloud)

> **Propósito**: completar el cutover de Vercel a AWS y dejar la app **portable a cualquier proveedor de cloud** (AWS hoy, mañana Azure / GCP / Hetzner / autohospedado).
>
> **Detonante**: incidente del 28/05/2026 con el cap `maxDuration = 10s` que mata INSERTs lentos en `/api/v2/answer-and-save`. Ver causa raíz y evidencia en [`incidente-answer-save-503-28-05.md`](./incidente-answer-save-503-28-05.md).
>
> **Principios** (heredados de [`ARCHITECTURE_ROADMAP.md`](../ARCHITECTURE_ROADMAP.md) §"Principio transversal: agnóstico al proveedor"):
> 1. **Contenedores 12-factor** (Docker) — corren en cualquier cloud sin cambios.
> 2. **Postgres estándar** vía Drizzle/postgres-js — sin RPCs/funciones Supabase-only en el path crítico.
> 3. **Redis estándar** — Upstash hoy, mañana ElastiCache / Hetzner Redis si conviene.
> 4. **Cache HTTP estándar** (Cache-Control + SWR) — CDN-agnóstico (CloudFront / Cloudflare / Fastly).
> 5. **IaC con Terraform** — recursos descritos como código, portables entre clouds.
> 6. **Cero APIs proprietary** en el path crítico (sin `@vercel/functions`, sin `@vercel/kv`, sin `next/og` específico de Vercel runtime).
>
> **Última actualización**: 2026-07-04 — 🟢 **Fase B HECHA + login nativo REPARADO + drenaje del bridge EN CURSO** (prod `vence-frontend:329`, `AUTH_BRIDGE_ENABLED=false`).
> - **Bug oculto cazado y arreglado (04/07)**: el login **nativo** Auth.js NUNCA funcionó de verdad tras el flip — `app/auth/callback/page.tsx` era 100% Supabase (polling de sesión Supabase + PKCE, timeout 15s) y bajo Auth.js esperaba una sesión que nunca llegaba → "Timeout: no se recibió sesión en 15s". Solo las sesiones vivas tiraban del bridge; cualquier re-login fallaba (era también lo que rompía a usuarios como Alba al caducar su sesión). **Fix `cb69790e`**: el callback usa el puerto agnóstico `auth.completeOAuthCallback()` (bajo Auth.js relee la sesión ya establecida por el servidor; bajo Supabase hace el PKCE de siempre). **Verificado E2E en prod** (re-login real de Manuel → mints `via='authjs_session'` + redirect limpio a `/`, 0 errores, monitor `errRuntime=0`).
> - **Kill-switch del bridge (`b539b1d8`)**: env `AUTH_BRIDGE_ENABLED` (default `true`). A `false` el bridge HS256 se apaga → los usuarios legacy reciben 401 → re-login nativo. Reversible al instante por task-def env (script `scripts/bridge-flip.sh <on|off>`), sin rebuild.
> - **Drenaje disparado (04/07 ~00:00)**: `AUTH_BRIDGE_ENABLED=false` (`:329`). Mints por bridge → **0** en ~2 min; solo quedan mints nativos; 0 errores 5xx; usuarios re-entran con un clic. Soak ~15h limpio (91k mints, todos `authjs_session`, 0 bridge, 0 regresiones auth). **✅ C4 APLICADO A PROD (04/07): 205→75 políticas, 0 `auth.*`, prod verde (ver §3.1 punto 4).** **Pendiente: cerrar soak → retirar el bridge por código (paso sin retorno) → migración de datos (guion validado end-to-end en RDS piloto: `migracion-datos-supabase-a-rds.md`).**
> - Además (04/07): fix de regresiones del flip en avatar+nombre y tarjetas "Tu Progreso" (`AuthContext` sintetiza `user_metadata` + `created_at` desde `/api/profile`, `:324`); migración `app/login/page.js`→`.tsx` (`7d7e9b0a`).
>
> Entradas previas: 2026-07-03 (Fase B flip `:320`), 2026-06-25 (revisión en vivo AWS CLI + curl prod + grep repo). Detalle Fase B: [`fase-b-ejecucion-authjs-rs256.md`](./fase-b-ejecucion-authjs-rs256.md) §"Siguiente paso".

---

## 0. Estado actual (verificado en vivo, 25/06/2026)

> ⚠️ **La tabla del 28/05 estaba desactualizada.** Lo verificado el 25/06 contra AWS/prod/repo invalida varias filas: OpenNext **ya no existe** (el frontend migró a Docker `standalone` + ECS Fargate), Vercel está **erradicado** (sin deps, sin `vercel.json`, sin `VERCEL_*`), y el cap de 10 s **dejó de existir** porque las rutas Next ya no corren en Lambda. El detonante original del roadmap está, por tanto, resuelto estructuralmente.

| Pieza | Estado | Comentario (verificado 25/06) |
|---|---|---|
| **DNS `www.vence.es`** | ✅ AWS | servido por CloudFront (`via: 1.1 …cloudfront.net`, `x-amz-cf-pop: MAD53-P2`) |
| **CDN edge** | ✅ AWS CloudFront | distribución `E1EH4WF1H7ZGLA`; invalidación `/*` en cada deploy |
| **Next.js SSR + pages** | ✅ AWS ECS Fargate | **ya NO OpenNext**: Docker multi-stage `.next/standalone` (`Dockerfile`), service `vence-frontend` 2/2 running, task def rev **287**, rollout COMPLETED. `.open-next/` local = artefacto gitignored stale, no se usa |
| **API `/api/*` (Next.js routes)** | ✅ Contenedor Fargate | corren dentro del contenedor `vence-frontend` (server.js standalone), **sin cap de Lambda**. La etiqueta `source=vercel` en observable_events es legacy del código |
| **`/api/v2/answer-and-save`** | ✅ Contenedor Fargate (sin cap) | `route.ts` corre en el contenedor (NO hay rewrite a backend) → el cap 10 s que motivó el roadmap **ya no aplica**. El módulo `backend/src/answer-save/` queda como cutover opcional, no urgente |
| **`/api/medals`** | ✅ Backend Fargate (api.vence.es) | cutover desde 24/05 ([[project_bloque3_canary_medals_live]]) |
| **Crons Grupo A (12)** | ✅ Fargate eu-west-2 | cutover completado 24/05 ([[project_backend_dedicado_fargate]]) |
| **Crons Grupo B (4 triviales)** | ⚠️ GitHub Actions | `close-inactive-feedback.yml` + `renewal-reminders.yml` activos; `daily-registration-summary`, `detect-fraud` (rutas presentes). **NO en Vercel** — son workflows GHA que pegan al endpoint. Pendiente verificar historial de runs (requiere `gh auth`) y decidir si migrar a Fargate |
| **Canarys / heartbeat** | ✅ Fargate */5min | ([[project_sistema_canary_completo]]) 6 piezas + dashboard |
| **Self-hosted pooler** | ✅ AWS Lightsail London ($7/mes) | PgBouncer ([`self-hosted-pooler.md`](./self-hosted-pooler.md)); enrutado vía flag `USE_SELF_HOSTED_POOLER` en SSM (re-aplicado en cada task def) |
| **DB primaria** | ⚠️ Supabase (Postgres 17.4) | SQL estándar; portable a Neon/RDS. **Fase B ✅ hecha (03/07)**; ahora bloqueado solo por soak+retirar HS256/bridge + C4 (drop RLS) — ver §3.1 |
| **Emisor de tokens (auth)** | ✅ Auth.js RS256/JWKS (03/07) | Fase B hecha (`:320`). Doble-aceptación HS256 transitoria durante el soak; se retira en el paso 5 de B4. `auth.users` ya desacoplado (52 FKs → `user_profiles`) |
| **Redis** | ⚠️ Upstash | API estándar; portable a ElastiCache |
| **Frontend deploy pipeline** | ✅ GHA → ECR → ECS | `frontend-deploy.yml`: build Docker → push ECR `vence-frontend` → register task def (pin por digest) → `update-service` → `wait services-stable` → smoke HTTP + invalidación CloudFront. `backend-deploy.yml` análogo para el backend |
| **Backend deploy pipeline** | ✅ GHA → ECR → ECS | `backend-deploy.yml` → service `vence-backend` (1/1 running, task def rev 24) |
| **Dependencias Vercel** | ✅ Erradicadas | sin `@vercel/*` en `package.json`, sin imports `@vercel/functions`/`@vercel/kv`, sin `process.env.VERCEL_*`, sin `vercel.json`, sin OpenNext en deps |

**Conclusión**: la migración del **path crítico está prácticamente completa**. El frontend ya corre en contenedores ECS Fargate (no Lambda/OpenNext), Vercel está erradicado y el incidente del cap 10 s quedó resuelto por construcción. **Con Fase B hecha (03/07), el emisor de tokens ya es agnóstico (Auth.js RS256).** Lo que queda: 4 crons triviales en GHA (§1.3) y las migraciones de largo plazo de DB (§3.1, ahora bloqueada solo por soak+C4) y Redis (§3.2).

---

## 1. Cabos pendientes inmediatos (esta semana)

### 1.1 Identificar qué exactamente quedó tras "desactivar Pro Vercel"

> ✅ **RESUELTO (25/06)**: el frontend migró de OpenNext/Lambda a **Docker `standalone` + ECS Fargate** (ver §0), por lo que el cap de 10 s desapareció con la propia arquitectura — no era un toggle de Vercel sino el runtime Lambda de OpenNext. Vercel quedó **erradicado** del repo (sin deps, sin `vercel.json`, sin `VERCEL_*`). El análisis original se conserva abajo por contexto histórico.

> 🟡 ~~Pendiente humano (Manuel)~~: aclarar qué se desactivó en Vercel exactamente:
> - ¿La suscripción completa? ¿Solo el plan Pro → Hobby?
> - ¿Qué features perdimos? (preview deployments, edge functions, image optimization)
> - ¿El timeout 10s viene del Hobby de Vercel o de la config de AWS Lambda en OpenNext?

Hipótesis a verificar (en orden de probabilidad):

1. **OpenNext Lambda `timeout = 10`**: si está hard-coded en `open-next.config.ts`, subirlo a 30 s mitiga al instante. Ver `open-next.config.*` y `infra/terraform/aws/*.tf`.
2. **CloudFront origin response timeout** = 10 s: misma fix pero en la distribución de CloudFront.
3. **Vercel sigue sirviendo algunos endpoints** detrás de CloudFront como origin: en ese caso `source=vercel` en observable_events sería real, no legacy.

**Acción**: comprobar `open-next.config.ts` + `infra/terraform/**/lambda*.tf` + Vercel Settings.

### 1.2 Cutover answer-save Vercel/OpenNext → backend Fargate

> ✅ **Ya no es urgente (25/06)**: `/api/v2/answer-and-save` corre ahora dentro del contenedor `vence-frontend` (Fargate, server.js standalone), **sin el cap de 10 s de Lambda** que motivaba este cutover. El módulo `backend/src/answer-save/` sigue listo y el cutover a un servicio Fargate dedicado queda como **opción** (aislar el path hot del resto del frontend), no como fix de incidente.

Módulo ya listo en `backend/src/answer-save/answer-save.controller.ts`. Patrón ya probado con `/api/medals`.

**Pasos:**

1. **Validar paridad**: dirigir 1% del tráfico a Fargate vía rewrite condicional (`x-experiment-fargate=1`) — comparar respuestas bit-a-bit en logs.
2. **Cutover progresivo**: 1% → 10% → 50% → 100% a lo largo de 24-48h con monitor.
3. **Rollback instantáneo** vía revert del rewrite en `next.config.mjs`.
4. **Cleanup**: tras 7 días en 100% Fargate, eliminar el route handler `app/api/v2/answer-and-save/route.ts` y dejar solo el rewrite (o gateway directo).

**Beneficio**: sale del cap 10s (Lambda OpenNext) → corre en Fargate con timeouts saneados.

### 1.3 Crons Grupo B → Fargate

4 crons triviales (`close-inactive-feedback`, `renewal-reminders`, `daily-registration-summary`, `detect-fraud`) siguen en Vercel. Coste de mantenerlos: dependencia de Vercel solo por ellos. Coste de migrar: ~2-3h por cron. Decisión: migrar para cerrar completamente el bloque crons.

---

## 2. Cabos pendientes a medio plazo (próximas 2-4 semanas)

### 2.1 Limpieza de dependencias Vercel

Inventario a realizar:
- `package.json`: buscar `@vercel/*`, `next/og` (que solo funciona bien en Vercel runtime), `@vercel/kv`.
- Código: buscar `process.env.VERCEL_*`, `@vercel/functions` imports.
- `vercel.json`: eliminar si no se usa.
- GitHub Actions: buscar `vercel deploy` calls.
- DNS/CNAME: comprobar si hay registros apuntando a `cname.vercel-dns.com`.

**Cada dependencia Vercel-only encontrada → roadmap de migración con alternativa estándar.**

### 2.2 Pipeline de deploy del frontend

Verificar y documentar:
- **¿Cómo se genera la build OpenNext hoy?** (GHA workflow, `npm run build && open-next build`)
- **¿Cómo se despliega a AWS?** (S3 + Lambda + CloudFront invalidate via Terraform / SST)
- **Estado del IaC**: ¿hay Terraform completo para frontend o todavía hay clicks manuales?

Documentar en `infra/README.md` con `terraform plan` ejemplo.

### 2.3 Outbox pattern para `test_questions`

Solución estructural al problema de los 27 triggers en cascada. Plan completo en [`incidente-answer-save-503-28-05.md`](./incidente-answer-save-503-28-05.md) §"Solución profesional: Outbox Pattern + Worker async".

Aporta a esta migración: **independencia total del proveedor**, porque el worker es un container Docker NestJS estándar que corre en Fargate hoy, mañana en Kubernetes, GCE, Hetzner.

---

## 3. Cabos pendientes a largo plazo (próximos meses)

### 3.1 Migrar DB de Supabase a Postgres gestionado portable

> 🔗 **Prerrequisito = el roadmap auth-agnóstico** [`auth-agnostico-jwks-y-rls.md`](./auth-agnostico-jwks-y-rls.md). Los dos puntos de abajo (RLS `auth.uid()` + `auth.users`) son sus **Fase C4** (drop RLS — draft en [`c4-drop-rls.draft.sql`](./c4-drop-rls.draft.sql)) y **Fase B** (emisor → Auth.js — [`fase-b-ejecucion-authjs-rs256.md`](./fase-b-ejecucion-authjs-rs256.md)). **Estado al 03/07: C1+C2+C3 ✅ · Fase B ✅ HECHA (`:320`, `auth.users` ya desacoplado, 52 FKs → `user_profiles`) · falta: soak ~1 sem + retirar HS256/bridge (pasos 5-8) · C4 ⏳ reposo.** **El único bloqueador VIVO de §3.1 es ya C4 (drop RLS) + cerrar el soak de Fase B.** Cerrados esos, la BD es un `DATABASE_URL` cambiable. Es además el fix estructural del SPOF del 503 ([`incidente-answer-save-503-01-06.md`](./incidente-answer-save-503-01-06.md)).

Hoy el SQL es **ya estándar** (usamos Drizzle + postgres-js, no `@supabase/supabase-js` en el path crítico tras [[project_stats_v2_cutover_done]]). Pero quedan:
- RLS policies con `auth.uid()` (Supabase-only). Migrar a JWT validado en backend. → **Fase C4** (draft listo).
- ~~`auth.users` table → migrar a tabla propia + servicio de auth~~ → **✅ Fase B HECHA (03/07)**: emisor = Auth.js RS256; `auth.users` desacoplado (52 FKs re-apuntados a `user_profiles`). La identidad ya no depende de GoTrue.
  - **✅ Login nativo REPARADO (04/07)**: `app/auth/callback/page.tsx` era Supabase-only (timeout 15s bajo Auth.js) → ahora usa `auth.completeOAuthCallback()` (puerto agnóstico). Verificado E2E en prod (`cb69790e`). Sin esto, ningún re-login nativo funcionaba (bug oculto: solo el bridge mantenía sesiones vivas).
  - **🔄 Drenaje del bridge EN CURSO (04/07)**: `AUTH_BRIDGE_ENABLED=false` (`:329`) → mints por bridge = 0, solo nativos. Falta: soak ~1 día → **retirar la doble-aceptación HS256 + el bridge por código** (paso sin retorno; borra la rama HS256 de `verifyAuth` + el bloque bridge de `/api/auth/token`). Reversible mientras tanto con `scripts/bridge-flip.sh on`.
- Funciones SQL `SECURITY DEFINER` (transition_question_state, etc.) — ya están en PL/pgSQL estándar, sirven igual en RDS.
- Realtime subscriptions (si se usan) — sustituir por SSE/WebSocket propio.

**Candidatos de destino**: RDS Postgres (AWS), Neon (multi-cloud), Crunchy Data, autohospedado. Coste estimado AWS RDS db.t4g.medium Multi-AZ: ~$120/mes (vs Supabase Pro ~$25/mes hoy).

#### 🧪 DRY-RUN de la migración (2026-07-03, prod INTACTO)

`pg_dump --schema-only` de Supabase → restore a un **Postgres 17 vanilla** local (podman) para medir portabilidad real. Resultado: **el esquema es ~87% portable tal cual — 167/191 tablas restauran solo con crear roles + extensiones. Sin ningún blocker profundo sorpresa.** Errores 665→193 tras crear roles+extensiones; los 193 restantes son 130× `schema "auth"` (RLS+funciones, los resuelve C4) + cascada. **Checklist EXACTO de la migración (verificado):**

1. ✅ **FKs → auth.users**: 0 (re-apuntados a `user_profiles` el 03/07).
2. **Roles**: `CREATE ROLE anon, authenticated, service_role` en el target (trivial; 51 GRANTs los referencian).
3. **Extensiones**: crear schema `extensions` + instalar `uuid-ossp, pgcrypto, pg_trgm, unaccent, pgvector` — **todas soportadas en RDS/Neon** (trivial).
4. **C4 (drop RLS policies que usan `auth.*`) + retirar `is_current_user_admin`** → elimina las refs a `schema auth`. **✅ DRAFT COMPLETO Y VERIFICADO EN PILOTO RDS REAL (04/07):** regenerado desde `pg_policies` = **130 políticas** (57 tablas). **Cabo suelto cazado por el PILOTO RDS y cerrado:** tras extender el generador a `auth.role()` (draft 125→129), al restaurar el esquema post-C4 en el RDS piloto y probar a tirar los stubs `auth.*`, sobrevivía **1 política `auth.jwt()`** (`user_avatar_settings` "Service role full access", `(auth.jwt()->>'role')='service_role'`) — el generador seguía enumerando funciones a mano. **Fix de raíz:** el WHERE ya NO lista funciones, matchea **cualquier llamada `auth.<fn>(` por regex** (uid/role/jwt/email/futuras) sin matchear literales tipo `'service_role'` → draft 129→**130**, cierra la clase entera. **Verificación cruzada contra prod: 0 políticas public que usen `auth.*` quedan fuera del draft.** Precondiciones #1 (C1/C2/C3 >1 sem) y #2 (los `.from` cliente de `useIntelligentNotifications`/`AuthContext` ya migrados) **CUMPLIDAS**. Dependencias `auth.*` NO-RLS analizadas: column defaults (4) y FKs a auth.users (0 desde `public`) son todas del **schema `auth`** interno (GoTrue, NO migrado) → benignas. (De las 3 fns `auth.*` originales, `assign_role`+`get_current_user_roles` = RBAC muerto **dropeadas 03/07**; queda `is_current_user_admin`, atada a RLS de `user_roles`, se va con el drop.) **✅✅ C4 APLICADO A PROD (04/07):** migración `supabase/migrations/20260704_c4_drop_rls.sql`. **205 → 75 políticas** (130 `auth.*` dropeadas, 0 restantes; las 75 son public-read/lockdown). Monitor + observabilidad: 0 errores runtime, 0 usuarios fallando, tráfico intacto (mints/requests fluyendo) tras el drop. Lecturas user-scoped por el path servidor (Drizzle=owner) siguen viendo filas (bypassa RLS). **GOTCHA (cazado aplicando):** la 1ª pasada en UNA transacción (BEGIN…COMMIT los 130 DROP) **deadlockeó** contra el tráfico vivo (DROP POLICY = ACCESS EXCLUSIVE por tabla) y **rollbackeó entera** (atómica, sin estado parcial). Re-aplicado en **autocommit con `SET lock_timeout='4s'`** (cada DROP = un lock exclusivo sub-segundo, sin transacción envolvente → imposible deadlock; parcial es seguro: DROP IF EXISTS idempotente y dropar hace PostgREST *más* restrictivo, con 0 `.from` cliente) → **130/130 a la 1ª pasada, 0 deadlocks**. Regla para DDL en prod con tráfico: NO envolver muchos DROP/ALTER en una transacción larga; autocommit + lock_timeout + reintento. Fichero de migración creado, **SIN commitear** (aplicado directo a prod). Rollback: bloque DOWN del draft + `policies_backup_pre_c4.json`.
5. ✅ **HECHO (03/07) — extensiones no-portables desacopladas.** La única función DB con `pg_net` era `public.notify_temario_change` (`net.http_post` al webhook de ISR), pero ya era **código muerto** (sus triggers se eliminaron el 16/04 por coste de ISR writes; la revalidación es app-side vía `revalidateTag` + `/api/admin/revalidate-temario`). **Dropeada de prod** (`20260703_drop_notify_temario_change.sql`). Verificado contra prod: **0 funciones/vistas de la app usan `http`, `pg_net` ni `supabase_vault`, y 0 objetos dependen de ellas** → en RDS/Neon simplemente NO se instalan esas 3 extensiones. Blocker cerrado.
6. ✅ **HECHO (03/07, `:321`) — Desacoplar login.** Las 5 páginas de login (`login`, `premium`, 3 landings) migradas de `supabase.auth.signInWithOAuth` al port `auth.signInWithGoogle` (→ `nextSignIn('google')` bajo el flip). **Verificado end-to-end en prod con sesión Google real** (Playwright vía CDP sobre el Chrome Flatpak del dev): la página de login dispara Auth.js (redirect_uri `=/api/auth/callback/google`, client Vence, PKCE, `prompt=select_account`) y el round-trip completa (Google → callback → sesión `user.id=user_profiles.id` → `/api/auth/token` 200 RS256 **nativo, sin bridge**). Gate de superficies 11/11, 0 errores, usuarios reales activos. **La entrada del login ya NO depende de Supabase GoTrue.** (Queda que los usuarios con sesión Supabase viva migren solos al re-loguear / caducar; el bridge los cubre entretanto.)

**Volumen**: BD **26 GB** (~20GB app; `audit_log_entries` 1.5GB + `refresh_tokens` 769MB son de GoTrue, NO se migran). Mayores: `user_interactions` 7.8GB/8.7M, `test_questions` 4.9GB. Dump/restore en frío = **multi-hora** → para downtime casi-cero usar **replicación lógica (CDC)**, no dump/restore. Dump de esquema de referencia guardado en scratchpad de la sesión.

**🧪🧪 DRY-RUN 2 — RESTORE COMPLETO POST-PREP+C4 PROBADO (2026-07-03 noche):** re-dump del esquema (tras los drops de hoy) → simulé C4 (quité las 132 `CREATE POLICY` con `auth.uid()`/`is_current_user_admin`) → restauré a **`pgvector/pgvector:pg17`** (= Neon/RDS con pgvector) con roles + extensiones. **Errores 665 → 193 → 62 → 4**, y los 4 son triviales/entendidos:
- `schema "public" already exists` → inofensivo.
- `extensions.pg_stat_statements does not exist` → faltaba instalar esa extensión (una vista la usa) → cascada a `v_insert_test_questions_latency`.
- `public.gin_trgm_ops does not exist` → `pg_trgm` debe ir en **`public`** (no en `extensions`) para que el operator class del índice GIN resuelva.

**Receta exacta de setup del target (0 errores reales):**
1. Roles: `anon`, `authenticated`, `service_role`.
2. Extensiones: `uuid-ossp`+`pgcrypto` en schema `extensions`; **`pg_trgm` en `public`**; `unaccent`; `vector`+`pg_stat_statements` en `extensions`.
3. **`ALTER DATABASE <db> SET search_path = "$user", public, extensions;`** — OBLIGATORIO. Supabase mete `extensions` en el search_path por defecto; RDS no. Sin esto, el **operador `<->` de pgvector no resuelve** (`operator does not exist: extensions.vector <-> extensions.vector`) → las búsquedas vectoriales de la app rompen. **Cazado y verificado en el piloto RDS (04/07):** con el ALTER, la query de similitud sobre `articles` (23.998 embeddings) funciona.
4. Aplicar el esquema post-C4 (con las policies `auth.*` ya dropeadas por C4).

**🧪🧪🧪 DRY-RUN 3 — RESTORE + C4 EN EL TARGET REAL (AWS RDS, 2026-07-04):** ya no un contenedor local sino **RDS Postgres 17.6** provisionado en la cuenta (`vence-pilot`, eu-west-2, db.t4g.medium, mismo VPC que ECS). Aplicada la **receta de setup** (roles + extensiones) → **todas las extensiones instalan out-of-the-box, incl. `pgvector 0.8.0`** (`venceadmin` tiene `rds_superuser`; contraste con koigrid, donde pgvector daba `permission denied`). Restaurado el dump `--schema=public` completo (con stubs `auth.*` para que entre tal cual) → **1 solo error** (`schema "public" already exists`, inofensivo); 171 tablas, 223 funciones, 688 índices, 205 políticas. Aplicado el **draft C4 real** (130 DROP POLICY, 0 errores) → **0 políticas `auth.*` restantes**; los stubs `auth.*` se **tiran sin dependencias** y el schema `auth` desaparece → **el esquema post-C4 NO depende del schema auth de Supabase, probado en el target de producción.** (Este dry-run cazó el cabo suelto `auth.jwt()` del punto 4.)

**Conclusión: el esquema de Vence es PORTABLE a Postgres gestionado, PROBADO end-to-end EN AWS RDS.** Ya no hay incógnita de esquema ni de infra target. Lo que resta es operativo: C4 en prod (tras soak) + migración de DATOS con CDC (para downtime casi-cero, 26GB) + cutover + verificar. Orden: (soak) → C4 → (el target ya está probado; provisionar el definitivo Multi-AZ) → CDC → cutover. **Piloto `vence-pilot` sigue vivo** (~$60-70/mes single-AZ) — se puede parar (`aws rds stop-db-instance`) hasta la migración de datos, o reutilizar como staging.

### 3.2 Migrar Redis de Upstash a ElastiCache (o autohospedado)

Hoy ya usamos API Redis estándar (no `@vercel/kv` ni `@upstash/redis` semantic-specific en path crítico). Migración = cambiar DSN + adaptar TLS. Coste ElastiCache t4g.micro: ~$13/mes.

### 3.3 Multi-cloud / DR

Una vez todo agnóstico, el ejercicio final:
- Levantar app en GCP / Hetzner / Azure en paralelo con la misma imagen Docker.
- DNS round-robin o failover.
- Coste: principalmente operativo (más superficie a vigilar). Solo justificable cuando MRR ≥ $50k y un outage de AWS implica pérdidas inaceptables.

---

## 4. Reglas de oro (para no añadir más lock-in)

- ❌ **Prohibido `@vercel/*` o `@aws-sdk/*` directamente en el dominio app**. Siempre detrás de una interface (`SinkInterface`, `CacheInterface`, etc.) que tenga implementación stub para tests y permita swap del proveedor.
- ❌ **Prohibido funciones edge proprietary** (`runtime: 'edge'` Vercel) sin tener implementación Lambda + Cloudflare equivalente lista.
- ❌ **Prohibido nuevos triggers SQL pesados** en tablas hot. Para nueva materialización → outbox pattern.
- ✅ **Cada feature nueva** que toque infra → roadmap en este documento + descripción de la abstracción agnóstica.
- ✅ **Cada commit** que introduzca dependencia de proveedor → comentario `// LOCK-IN: razón + plan de salida si aplica`.

---

## 5. Enlaces

- 🔥 [`incidente-answer-save-503-28-05.md`](./incidente-answer-save-503-28-05.md) — incidente que motivó este roadmap.
- 📐 [`../ARCHITECTURE_ROADMAP.md`](../ARCHITECTURE_ROADMAP.md) — roadmap general (Bloques 1-5).
- 🛠 [`self-hosted-pooler.md`](./self-hosted-pooler.md) — PgBouncer en AWS Lightsail (ya operativo).
- 📓 [`materialized-stats-aggregates.md`](./materialized-stats-aggregates.md) — patrón de materialización que precede al outbox.
- 📓 [`answer-and-save-article-id-fix.md`](./answer-and-save-article-id-fix.md) — fix de `article_id` aplicado el 27/05.
- 📓 [`../runbooks/cron-cutover-fargate.md`](../runbooks/cron-cutover-fargate.md) — runbook del cutover de los 12 crons Grupo A.
- 📓 [`../runbooks/health-check.md`](../runbooks/health-check.md) — runbook que detectó este incidente.

Memorias relacionadas:
- [[reference_aws_accounts]] — IDs AWS Vence (349744179687, eu-west-2) y profile [vence] CLI.
- [[project_backend_dedicado_fargate]] — backend NestJS Etapa 1 (12 crons en shadow → cutover).
- [[project_bloque3_canary_medals_live]] — medals migrado, patrón replicable.
- [[project_sistema_canary_completo]] — canary 6 piezas */5min Fargate.
- [[feedback_prioridades_escala_y_agnostico]] — escala y agnóstico no chocan, se refuerzan.
- [[feedback_no_premature_scope_expansion]] — no ampliar scope antes de tiempo.
