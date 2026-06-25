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
> **Última actualización**: 2026-05-28 ~20:30 UTC.

---

## 0. Estado actual (a ciencia cierta, 28/05/2026)

| Pieza | Estado | Comentario |
|---|---|---|
| **DNS `www.vence.es`** | ✅ AWS | apunta a `d25xcm3wrnxoty.cloudfront.net` |
| **CDN edge** | ✅ AWS CloudFront | `x-amz-cf-pop: MAD53-P2`, `via: 1.1 cloudfront.net` |
| **Next.js SSR + pages** | ✅ AWS OpenNext | carpeta `.open-next/` con `image-optimization-function`, `dynamodb-provider` |
| **API `/api/*` (Next.js routes)** | ⚠️ MIXTO | la mayoría en AWS Lambda (OpenNext); `source=vercel` en observable_events es **etiqueta legacy** del código |
| **`/api/v2/answer-and-save`** | ⚠️ AWS Lambda con cap 10 s | sufre el incidente actual: cualquier INSERT >10 s lo mata el cap |
| **`/api/medals`** | ✅ Backend Fargate (api.vence.es) | ya en cutover desde 24/05 ([[project_bloque3_canary_medals_live]]) |
| **Crons Grupo A (12)** | ✅ Fargate eu-west-2 | cutover completado 24/05 ([[project_backend_dedicado_fargate]]) |
| **Crons Grupo B (4 triviales)** | ⚠️ Vercel (intencional) | `close-inactive-feedback`, `renewal-reminders`, `daily-registration-summary`, `detect-fraud` |
| **Canarys / heartbeat** | ✅ Fargate */5min | ([[project_sistema_canary_completo]]) 6 piezas + dashboard |
| **Self-hosted pooler** | ✅ AWS Lightsail London ($7/mes) | PgBouncer, 50+ endpoints usándolo ([`self-hosted-pooler.md`](./self-hosted-pooler.md)) |
| **DB primaria** | ⚠️ Supabase (Postgres 17.4) | el SQL es estándar; portable a Neon/RDS sin reescribir |
| **Redis** | ⚠️ Upstash | API es estándar; portable a ElastiCache |
| **Frontend deploy pipeline** | ❓ verificar | ¿GHA build + sync a S3 + invalidate CloudFront? o aún Vercel build? |
| **Suscripción Vercel** | ❓ "desactivada Pro" (28/05) | desconocido qué quedó tras downgrade — ver §1 |
| **`vercel.json`** | ⚠️ existe con `regions:["lhr1"]` | candidato a eliminar |

**Conclusión**: la migración está **~75% hecha**. Faltan piezas concretas + limpieza de dependencias Vercel.

---

## 1. Cabos pendientes inmediatos (esta semana)

### 1.1 Identificar qué exactamente quedó tras "desactivar Pro Vercel"

> 🟡 **Pendiente humano (Manuel)**: aclarar qué se desactivó en Vercel exactamente:
> - ¿La suscripción completa? ¿Solo el plan Pro → Hobby?
> - ¿Qué features perdimos? (preview deployments, edge functions, image optimization)
> - ¿El timeout 10s viene del Hobby de Vercel o de la config de AWS Lambda en OpenNext?

Hipótesis a verificar (en orden de probabilidad):

1. **OpenNext Lambda `timeout = 10`**: si está hard-coded en `open-next.config.ts`, subirlo a 30 s mitiga al instante. Ver `open-next.config.*` y `infra/terraform/aws/*.tf`.
2. **CloudFront origin response timeout** = 10 s: misma fix pero en la distribución de CloudFront.
3. **Vercel sigue sirviendo algunos endpoints** detrás de CloudFront como origin: en ese caso `source=vercel` en observable_events sería real, no legacy.

**Acción**: comprobar `open-next.config.ts` + `infra/terraform/**/lambda*.tf` + Vercel Settings.

### 1.2 Cutover answer-save Vercel/OpenNext → backend Fargate

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

> 🔗 **Prerrequisito = el roadmap auth-agnóstico** [`auth-agnostico-jwks-y-rls.md`](./auth-agnostico-jwks-y-rls.md). Los dos puntos de abajo (RLS `auth.uid()` + `auth.users`) son exactamente sus **Fase C4** (drop RLS — draft en [`c4-drop-rls.draft.sql`](./c4-drop-rls.draft.sql), pendiente reposo) y **Fase B** (migrar el emisor a Auth.js — plan en [`fase-b-ejecucion-authjs-rs256.md`](./fase-b-ejecucion-authjs-rs256.md)). Estado al 25/06: C1+C2+C3 ✅ en prod; C4 ⏳ reposo; Fase B 🔴 no iniciada. **Hasta cerrar B+C4 no se puede mover la BD** → este §3.1 está bloqueado por ellas. Es además el fix estructural del SPOF del 503 ([`incidente-answer-save-503-01-06.md`](./incidente-answer-save-503-01-06.md)).

Hoy el SQL es **ya estándar** (usamos Drizzle + postgres-js, no `@supabase/supabase-js` en el path crítico tras [[project_stats_v2_cutover_done]]). Pero quedan:
- RLS policies con `auth.uid()` (Supabase-only). Migrar a JWT validado en backend. → **Fase C4** (draft listo).
- `auth.users` table → migrar a tabla propia + servicio de auth (NextAuth, Cognito, o backend custom). → **Fase B** (Auth.js, plan listo).
- Funciones SQL `SECURITY DEFINER` (transition_question_state, etc.) — ya están en PL/pgSQL estándar, sirven igual en RDS.
- Realtime subscriptions (si se usan) — sustituir por SSE/WebSocket propio.

**Candidatos de destino**: RDS Postgres (AWS), Neon (multi-cloud), Crunchy Data, autohospedado. Coste estimado AWS RDS db.t4g.medium Multi-AZ: ~$120/mes (vs Supabase Pro ~$25/mes hoy).

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
