# Roadmap — Sistema de canary + simulaciones E2E

> **Estado**: 🟢 Niveles 1+2+3 ✅ (Sprint 1 completo) + Niveles 4-7 pendientes.
> **Propietario**: equipo Vence.
> **Inspiración**: VicoHR ([análisis comparativo](#anexo-inspiración-vicohr)) — patrones validados en producción.
> **Coste recurrente añadido total**: ~$15-30/mes cuando se complete el stack.
> **Última actualización**: 2026-05-27 (Sprint 1 mergeado — workflow GHA + canary HTTP Fargate operativos).

---

## ¿Por qué este roadmap?

El 27/05/2026, Rocío Jodar y Mercedes Martínez pagaron €20 cada una y no recibieron Premium porque el webhook de Stripe estaba devolviendo 400 `signature verification failed` tras un redeploy con `STRIPE_WEBHOOK_SECRET` stale. **El bug llevaba activo horas** y solo lo detectamos cuando Rocío escribió al chat de soporte.

Si hubiéramos tenido **canary HTTP cada 5 min** que verificara `POST /api/stripe/webhook` con un evento sintético firmado correctamente, la alarma habría disparado en ≤5 min en lugar de horas. El mismo patrón aplica a cualquier regresión funcional silenciosa.

Este roadmap es la respuesta sistémica: niveles incrementales de simulación que detectan los bugs antes que el primer feedback de usuario.

---

## Estado actual (qué hay ya)

| Pieza | Ubicación | Madurez |
|---|---|---|
| Playwright config (2 entornos: preview AWS + prod Vercel) | `playwright.config.ts` | ✅ |
| Smoke público (10 tests páginas anónimas, SSG-dependent, SEO) | `e2e/smoke-public.spec.ts` | ✅ |
| Endpoint SLO con 7 indicadores CloudWatch | `app/api/admin/slos/route.ts` | ✅ |
| Endpoint smoke observability stack | `app/api/debug/observability-smoke/route.ts` | ✅ |
| Alert rules engine declarativo (16 reglas SQL sobre `observable_events`) | `backend/src/alerts/alert-rules.ts` | ✅ |
| `observable_events` sink AWS-ready (OTEL-compat) | `lib/observability/` | ✅ |
| CloudWatch Synthetics canary mencionado como roadmap | `docs/runbooks/observability.md` §11 | ⏳ |
| **Workflow GHA que ejecute Playwright** (PR + cron 6h) | `.github/workflows/e2e-smoke.yml` | ✅ |
| **`docs/SLO.md` formal** | `docs/SLO.md` | ✅ |
| **Canary HTTP autenticado cada 5 min** (Fargate cron) | `backend/src/canary-smoke-auth/` | ✅ código (idle hasta SSM smoke user) |
| **Smoke autenticado E2E** (login + flujo) | ❌ | ❌ |
| **Cobertura exhaustiva** (filtros, configurador, suscripción) | ❌ | ❌ |

---

## Niveles de madurez (1→7)

Inspirados en los niveles de VicoHR. Cada nivel es **ejecutable de forma independiente** — se puede parar entre cualquier dos sin dejar el sistema en estado inconsistente.

### 🟢 Nivel 1 — Smoke público (HECHO)

**Qué cubre**: páginas anónimas críticas (home, landing oposición, temario, tema concreto SSG-dependent).

**Cómo**: `e2e/smoke-public.spec.ts` con Playwright. Sin login, sin BD mutations. Cubre regresión SEO + SSG (DATABASE_URL faltante en build-arg).

**Esfuerzo**: ✅ ya hecho.

**Gap**: los tests existen pero **NO se ejecutan en CI**. Pasan al Nivel 2.

---

### 🟢 Nivel 2 — Workflow GHA ejecuta Playwright en cada PR + diario (HECHO 2026-05-27)

**Qué cubre**: cualquier PR que rompa una página pública queda bloqueado antes de merge.

**Implementación**: `.github/workflows/e2e-smoke.yml`:
- `on: pull_request` → ejecuta contra `preview-aws.vence.es` (`npm run test:e2e:preview`).
- `on: schedule: '0 */6 * * *'` (cada 6h) → ejecuta contra producción (`npm run test:e2e:prod`).
- `workflow_dispatch` con input `target=preview|prod|both` para runs manuales.
- 2 workers paralelos + 2× retries en CI (heredados de `playwright.config.ts`).
- HTML report como artifact 14d retention.
- Cancel concurrent runs del mismo ref para no saturar CI.
- Paths filter: solo corre si tocan `app/`, `components/`, `hooks/`, `lib/`, `e2e/`, etc.
- Notify failure schedule → POST `/api/observability/ingest` con `event_type=e2e_smoke_failed` (requiere secret GHA `CRON_SECRET`).

**Coste real**: gratis (GitHub Actions free tier, ~12 min/día = ~360 min/mes).

**Métrica éxito**: 100% PRs ejecutan e2e smoke. Cero merges con tests rotos.

---

### 🟢 Nivel 3 — Canary HTTP autenticado cada 5 min (HECHO 2026-05-27 — código listo, esperando smoke user)

**Qué cubre**: regresiones en `/api/profile` (endpoint protegido más caliente: cada page load logueado pasa por aquí). Cualquier rotura de validación JWT, RLS, Drizzle, timeouts, deploy roto, etc. → alarma critical en ≤5 min.

**Approach AGNÓSTICO (decidido 27/05/2026)**: en vez de hacer login real contra Supabase Auth REST (acoplaría el canary al proveedor cuando estamos en mitad del [agnosticismo Supabase](agnosticismo-supabase.md)), el canary **firma localmente** un JWT smoke con `SUPABASE_JWT_SECRET` (que el backend ya tiene y usa `JwtGuard` para verificar tokens entrantes). Mismo formato que el SDK Supabase (`HS256`, `aud='authenticated'`, `sub=userId`). Cuando migremos a otro proveedor de auth, solo cambia la lógica de firma; el canary sigue intacto.

**Qué NO cubre con este approach**: caída de Supabase Auth como proveedor. Esa cobertura la dará el smoke E2E del Nivel 4 (Playwright + login real). Hoy no la necesitamos: si Supabase Auth cae, lo notamos por su status page y mil sitios más, no es la línea de defensa que añadimos aquí.

**Implementación** — módulo NestJS Fargate `backend/src/canary-smoke-auth/`:

- `canary-smoke-auth.service.ts`: 4 pasos secuenciales con timeout 5s en el fetch.
  1. Firmar JWT smoke con `SUPABASE_JWT_SECRET` (TTL 1h, regenerado en cada `run()`).
  2. `GET /api/profile?userId=<SMOKE_USER_ID>` con Bearer.
  3. Validar `planType === 'premium'`.
  4. Validar latencia total < 10s.
- `canary-smoke-auth.cron.ts`: `@Cron('*/5 * * * *')` con 4 eventos a observability:
  - `canary_auth_ok` (info)
  - `canary_auth_failed` (critical, dispara `RULE_CANARY_AUTH_FAILED`)
  - `canary_auth_skipped` (warn, modo idle cuando falta `SMOKE_USER_ID` — NO spam de alarmas)
  - `cron_run` (siempre, liveness)
- `canary-smoke-auth.module.ts` registrado en `app.module.ts`.
- `RULE_CANARY_AUTH_FAILED` en `alert-rules.ts`: severity critical, cooldown 15min, dispara con ≥1 evento en 10 min.
- Tests Jest: 5 tests verde en `alert-rules.spec.ts`.

**Estado**: código mergeado. **Cron está en modo idle hasta que exista `SMOKE_USER_ID`** (devuelve `{skipped: true, reason: 'credentials_not_configured'}` con warn).

**Pendiente humano (5 min — 3 cosas, no 7 como decía la primera versión)**:
1. Crear `smoke@vence.es` en Supabase Auth (vía dashboard o admin API) + UPSERT `user_profiles` con `plan_type='premium'`, `target_oposicion='auxiliar_administrativo_estado'`. **Anotar el UUID** del user creado.
2. `aws ssm put-parameter --profile vence --region eu-west-2 --name /vence-backend/SMOKE_USER_ID --value '<uuid>' --type String` (NO SecureString — un UUID no es credencial, no hace falta encriptar).
3. Añadir `SMOKE_USER_ID` a `backend/infra/main.tf` como **environment** (no como secret porque no es SSM SecureString) + `terraform apply` + `aws ecs update-service --force-new-deployment`.

`SUPABASE_JWT_SECRET` **ya está** en el backend (lo usa `JwtGuard`) — no hay que añadirlo.

**Métrica éxito**: SLO ≥99.9% uptime/mes. Detección regresiones `/api/profile` en ≤5 min.

**Lo que hubiera cazado**: regresiones de `/api/profile` (cambio breaking en Drizzle queries, RLS roto, JwtGuard mal configurado, timeouts, etc.). El gap del bug Rocío/Mercedes específico (webhook signature failed) lo cierra el canary Stripe webhook hermano (siguiente sección).

---

### 🟢 Nivel 3 variante — Canary Stripe webhook sintético (HECHO 2026-05-27)

**Cierra el círculo del incidente Rocío/Mercedes (27/05/2026)**: cada 5 min envía un Event sintético firmado al `/api/stripe/webhook` real y verifica que devuelve 200 `{received:true}`. Si el handler / signature / route están rotos, alarma critical en ≤5 min en vez de tardar horas hasta el primer pago real fallido.

**Implementación** — módulo NestJS Fargate `backend/src/canary-stripe-webhook/`:

- `canary-stripe-webhook.service.ts`:
  1. Construye Event sintético `{ id: 'evt_canary_<ts>', type: 'canary.synthetic', livemode: false, ... }` — `type` desconocido para Stripe entra al `default:` del handler, se loguea como "Unhandled event type" y devuelve 200 sin side effects.
  2. Firma con `Stripe.webhooks.generateTestHeaderString({ payload, secret, timestamp })` usando `STRIPE_WEBHOOK_SECRET` — la MISMA key que el handler usa para `constructEvent()`.
  3. `POST https://www.vence.es/api/stripe/webhook` con header `Stripe-Signature`. Espera 200 `{received:true}`. Timeout 5s.
- `canary-stripe-webhook.cron.ts`: `@Cron('*/5 * * * *')` con 4 eventos (ok/failed/skipped/cron_run).
- `RULE_CANARY_WEBHOOK_FAILED` en `alert-rules.ts`: severity critical, cooldown 15min, dispara con ≥1 fallo en 10min. Notification step-aware (runbook distinto según `step=sign/http/validate_*`).
- 5 tests Jest verde en `alert-rules.spec.ts` (total: 62/62 pasan).

**Cross-namespace SSM**: el `STRIPE_WEBHOOK_SECRET` vive en `/vence-frontend/STRIPE_WEBHOOK_SECRET` (porque el handler real está en la app Next.js). El IAM policy del backend task execution role lee ese ARN cross-namespace para evitar duplicar el secret. Si Manuel rota la key en Stripe Dashboard + SSM frontend, automáticamente afecta al canary también — imposible desincronización accidental.

**Lo que detecta**:
- SSM no propagada al ECS task (signature 400).
- Handler `/api/stripe/webhook` 404 (route eliminada del bundle Next.js).
- `constructEvent()` throw inesperado (regresión código signature).
- App caída / 5xx / timeout.

**Lo que NO detecta** (cabo conocido, cubierto por regla existente):
- Secret rotado en Stripe Dashboard sin actualizar SSM → canary y handler siguen sincronizados entre sí pero los dos están "stale" vs Stripe → `RULE_STRIPE_WEBHOOK_SIGNATURE_FAILED` dispara con el primer evento real fallido (lag horas, pero detectado).

**Lo que SÍ hubiera cazado del incidente Rocío/Mercedes**: si tras un redeploy el ECS task no hubiera propagado `STRIPE_WEBHOOK_SECRET` (caso real del incidente), el canary detectaría signature 400 en ≤5 min en vez de tardar horas hasta el primer pago real.

---

### 🟢 Nivel 3 variante — Canary answer-save (HECHO 2026-05-27)

Cubre el endpoint **MÁS caliente** de la app: `POST /api/v2/answer-and-save`. Cada respuesta de cada user en cada test pasa por aquí. Si se rompe, la app queda inutilizable instantáneamente.

**Implementación** — módulo NestJS Fargate `backend/src/canary-answer-save/`:

- `canary-answer-save.service.ts`: mismo approach agnóstico (JWT firmado local con `SUPABASE_JWT_SECRET`). Construye payload completo con pregunta hardcoded (art 99 CE, easy, estable) + session smoke estable (`00000000-0000-4000-8000-000000000001` creada manualmente en `tests` con `test_type=practice`). POST + valida 200 + `success:true`.
- Manejo step-aware: `sign_token`/`http`/`validate_response`/`validate_latency` → critical. `questionInvalid` (pregunta retirada del catálogo) → warn, NO critical.
- Cooldown 15min. Latencia <15s.
- `RULE_CANARY_ANSWER_SAVE_FAILED` en `alert-rules.ts` con runbook step-aware (401/422/5xx/503).

**Decisión "contamina BD"**: el canary reutiliza siempre el mismo `(sessionId, questionId, questionIndex)`. Primer tick: INSERT `saved_new`. Siguientes 287 ticks/día: `23505 unique constraint` → `already_saved` → 200. Contamina UNA fila en `test_questions`, no 288/día.

**Lo que detecta** (todo lo crítico del endpoint hot):
- Drizzle transactional save roto / RLS / FK violations / unique constraints.
- Antifraud cache corrupto / register_device RPC roto.
- Daily-limit query rota.
- JwtGuard mal configurado.
- Schema validation cambiado.
- 503 load shedding (saturación BD).

---

## Observabilidad cableada

### Dashboard `/admin/canary` (HECHO 2026-05-27)

Vista única con cards por canary mostrando:
- Status (verde ≥99% / ámbar ≥95% / rojo <95%).
- Uptime 24h + 7d, latencia p50/p95.
- Último OK y último fallo con mensaje accionable.
- Auto-refresh 60s.

Endpoint `/api/admin/canary` agrega `observable_events` en una sola query (filtra por `endpoint IN ('canary-smoke-auth', 'canary-stripe-webhook', 'canary-answer-save')` últimos 7d).

### SLOs en `/api/admin/slos` cableados a observable_events (HECHO 2026-05-27)

Reemplaza el ex-SLO-01 CloudWatch Synthetics (devolvía `unknown` porque el canary CloudWatch nunca se desplegó). Ahora 3 SLOs derivados de los canarios Fargate, con mismas thresholds (≥99.9% verde, ≥99% ámbar) y subiendo a `cutoverReady`.

---

### 🟡 Nivel 4 — Smoke autenticado E2E (Playwright + login)

**Qué cubre**: flujo crítico end-to-end con browser real.

**Specs propuestos** (5-8 críticos):
1. `auth-login.spec.ts` — login con credenciales + redirect a dashboard.
2. `test-quick.spec.ts` — usuario hace test rápido de 5 preguntas y ve resultado.
3. `test-answer-saved.spec.ts` — responder pregunta y verificar que se guarda en `test_questions`.
4. `subscription-checkout.spec.ts` — pulsar "Hazte Premium" → Stripe checkout (test mode) → success_url → premium activo.
5. `subscription-cancel.spec.ts` — cancelar suscripción active → `cancel_at_period_end=true`.
6. `profile-update.spec.ts` — cambiar nombre + oposición target.

**Cómo**: extender `e2e/` con specs autenticados. Fixture común `loginAsUser()` reutilizable.

**Esfuerzo**: 3-5 días.

**Bloqueadores**:
- Smoke user dedicado en Supabase Auth + entorno test mode Stripe.
- Cleanup obligatorio en `try/finally`: tras cada spec, soft-delete de `test_questions`, cancel sub Stripe test, reset perfil.

**Métrica éxito**: cero regresiones del flujo crítico llegan a producción.

---

### 🔴 Nivel 5 — Cobertura exhaustiva (todo el catálogo)

**Qué cubre**: catálogo completo de funcionalidades de Vence. **El "test todos los filtros + hacer test" que mencionas.**

**Specs propuestos** (~35+ inspirado en VicoHR):

**Tests (10+ specs)**:
- Cada tipo: aleatorio, personalizado, examen, dinámico AI, leyes específicas, temas, fallos, repaso.
- Configurador: cantidad (5/10/25/50/100), dificultad (mix/easy/medium/hard), exclusión recientes, focus weak, adaptive.
- Modo examen completo (todas preguntas visibles, corrección final).
- Test interrumpido → reanudar.
- Test psicotécnico.

**Premium/free (5 specs)**:
- Free: 25 preguntas/día → bloqueo en 26ª.
- Premium: sin límite.
- Upgrade flow desde dailylimit modal.
- Downgrade gracioso al expirar suscripción.
- Compatibilidad con tiers (premium_monthly, premium_quarterly, premium_semester).

**Suscripción (8 specs)**:
- Checkout (3 planes).
- Activación inmediata `/premium/success` (sync).
- Polling 3DS pending → activación tras confirm.
- Cancel `cancel_at_period_end` (active sub).
- Cancel inmediato (past_due / unpaid).
- Reactivar antes de fin de periodo.
- Cambio de plan (downgrade/upgrade).
- Renovación automática.

**Contenido (5 specs)**:
- Temario por oposición.
- Audio TTS tema completo (con bucle final).
- Cambio oposición target.
- Buscador de leyes.
- Impugnación de pregunta.

**Admin (3 specs)**:
- Responder feedback de soporte.
- Resolver impugnación.
- Eliminar cuenta usuario (RGPD).

**Multi-dispositivo (4 specs)**:
- Mobile viewport (iPhone, Android).
- Desktop responsive.
- Modo oscuro.
- PWA install + offline graceful.

**Esfuerzo**: 2-3 semanas sprint dedicado.

**Bloqueadores**:
- Stripe test mode key activa (rotar `sk_test_*` expirada).
- Datos test parametrizados (faker para crear users, preguntas).
- Aislamiento por user de smoke dedicado por spec (paralelización).

**Coste**: GitHub Actions free tier puede saturarse con 35 specs × 2 workers. Pasar a self-hosted runner si supera 2000 min/mes.

**Métrica éxito**: ≥80% de features cubiertas por al menos 1 spec (objetivo VicoHR: 84%).

---

### 🔵 Nivel 6 — Multi-browser + visual regression

**Qué cubre**: regresiones específicas de Safari/Firefox + cambios visuales no intencionados.

**Cómo**:
- Matriz Playwright: chromium + firefox + webkit.
- `@playwright/test` snapshots comparados con baseline (Percy o nativo `toHaveScreenshot`).

**Esfuerzo**: 1 semana.

**Bloqueadores**: triplica el tiempo de CI. Ejecutar en cron diario, no en cada PR.

---

### 🔵 Nivel 7 — Synthetic monitoring AWS

**Qué cubre**: validación continua post-deploy desde infra AWS, independiente de la app.

**Cómo**:
- **AWS CloudWatch Synthetics canary** con script Puppeteer ($15/mes por canary). Login + flujo + logout cada 5 min.
- Alarmas CloudWatch ya configuradas en el endpoint `/api/admin/slos`.

**Esfuerzo**: 1-2 días.

**Coste**: $15/mes por canary (calculado para 1 canary cada 5min).

**Decisión**: solo cuando se complete cutover AWS y volumen > 1000 DAU. Hoy es overkill (alternativa: Nivel 3 con cron Fargate gratis).

---

## Orden de implementación recomendado

| Sprint | Niveles | Esfuerzo | Valor |
|---|---|---|---|
| ✅ **Sprint 1 (HECHO 2026-05-27)** | 2 + 3 | 3-4h | 🔴 Alto — workflow GHA + canary-smoke-auth Fargate. |
| ✅ **Sprint 2 (HECHO 2026-05-27)** | 3 variante webhook | 1-2h | 🔴 Alto — canary-stripe-webhook cierra incidente Rocío/Mercedes. |
| ✅ **Sprint 3 (HECHO 2026-05-27)** | 3 variante answer-save | 1-2h | 🔴 Alto — canary endpoint más caliente. |
| ✅ **Sprint 4 (HECHO 2026-05-27)** | Observabilidad | 1-2h | 🟡 Alto — dashboard `/admin/canary` + SLOs cableados. |
| **Sprint 5 (siguiente)** | Más canarios HOT | 2-3h | 🔴 Alto — ver §Próximos canarios sugeridos abajo. |
| **Sprint 6** | 4 — Playwright autenticado E2E | 3-5 días | 🟡 Alto — flow crítico cubierto end-to-end. |
| **Sprint 7** | 5 (subset 15 specs core) | 1 semana | 🟡 Alto — cobertura amplia donde más duele. |
| **Sprint 8** | 5 (resto) + 6 | 2-3 semanas | 🟢 Medio — completitud. |
| **Sprint 9 (post-cutover AWS)** | 7 | 1-2 días | 🟢 Bajo — sólo cuando justifique el coste. |

---

## Próximos canarios sugeridos (Sprint 5)

Estado tras Sprints 1-4: 3 canarios autenticados (auth, stripe-webhook, answer-save) + dashboard + SLOs. Gaps de cobertura priorizados:

### 🔴 ALTO valor (~1-2h cada uno)

| Canary | Endpoint | Por qué |
|---|---|---|
| **canary-checkout-sync** | `POST /api/stripe/checkout-sync` | Cierra el círculo de pagos: activación post-checkout. Si se rompe, users pagan y no obtienen premium hasta cron reconciliation. Complementa canary-stripe-webhook. |
| **canary-home-public** | `GET /` (sin auth, assertions HTML) | Único canary SIN JWT. Detecta categoría completamente distinta: SSG roto, build broken, hidratación rota, SEO meta tags. Cubre el endpoint de mayor tráfico. |
| **canary-user-stats** | `GET /api/v2/user-stats?userId=<smoke>` | Segundo endpoint más caliente tras answer-save (dashboard del user). Cubre cache Redis `user_stats:<id>` + agregaciones Drizzle. |

### 🟡 MEDIO valor (~1h cada uno)

| Canary | Detecta |
|---|---|
| **canary-database-pool** | Saturación PgBouncer / max_connections agotados (query trivial `SELECT 1`) |
| **canary-redis-upstash** | Cache compartido caído (Upstash SET/GET/DEL trivial) |
| **canary-medals** | `GET /api/medals` — Bloque 3 endpoint. Quejas reputación si se rompe |

### 🟢 MEJORAS del actual (~30min cada una)

| Mejora | Valor |
|---|---|
| Endpoint `POST /api/admin/canary/run-now` | Disparo on-demand (pre-deploy verify, post-incidente confirm) |
| Canary "negativo" | JWT inválido → esperar 401. Detecta JwtGuard demasiado permisivo |
| Multi-step canary | login + profile + user-stats + answer-save en 1 tick. Detecta regresiones de FLOW completo |

---

## Plantilla para añadir un nuevo canary (Fargate cron)

Patrón validado en Sprints 1-3. Cada canary nuevo siguiendo esta plantilla toma **~1h en vez de 3h**.

### Paso a paso

1. **Investigar endpoint** (15 min, read-only):
   - Localizar handler (`app/api/...` o `backend/src/.../*.controller.ts`).
   - Leer el Zod schema del request completo (`lib/api/.../schemas.ts`).
   - Identificar todos los status codes que devuelve y por qué (grep `status:` o `throw`).
   - Si requiere datos satélites (sessions, customers): mapearlos ANTES de codificar.

2. **Crear datos satélites estables** (10 min):
   - Si el endpoint requiere FK a otra tabla: crear UNA fila estable con UUID hardcoded.
   - Usar UUIDs reservados: `00000000-0000-4000-8000-0000000000XX` (versión 4, fácil de identificar).
   - Anotar en `admin_notes` o equivalente: "Canary smoke data — NO ELIMINAR".

3. **Crear módulo NestJS** (`backend/src/canary-<x>/`) (20 min):
   - `<x>.service.ts`: clase con método `run(): Promise<CanaryXResult>`. Discriminated union para el resultado: `ok | skipped | <variants> | failed`.
   - `<x>.cron.ts`: `@Cron('*/5 * * * *')` que llama `service.run()` y emite a `observability` con eventTypes `canary_x_ok` / `_failed` / `_skipped` (+ `cron_run` liveness siempre).
   - `<x>.module.ts`: registrar service + cron.

4. **Registrar en `app.module.ts`** (1 min):
   - Import + añadir a `imports`.

5. **Crear alert rule** (`backend/src/alerts/alert-rules.ts`) (10 min):
   - `RULE_CANARY_X_FAILED` severity `critical`, cooldown 15min, dispara con `≥1` evento en 10min.
   - Notification step-aware (runbook diferente según `step`).
   - Añadir a `ALERT_RULES`.

6. **Tests** (`alert-rules.spec.ts`) (5 min): 5 tests: shouldFire 1, no fire 0, severity, notification contiene runbook, cooldown 15.

7. **Si requiere envs/secrets nuevos** (20 min):
   - SSM put-parameter.
   - Editar `backend/infra/main.tf` (local + IAM Resources + container secrets).
   - `terraform apply -target=aws_ecs_task_definition.backend -target=aws_iam_role_policy.task_execution_secrets`.
   - `aws ecs update-service --task-definition vence-backend:<nueva> --force-new-deployment`.

8. **Añadir a dashboard** (`app/api/admin/canary/route.ts`):
   - Añadir endpoint al array `CANARY_ENDPOINTS`.
   - Añadir descripción en `CANARY_DESCRIPTION` de `app/admin/canary/page.tsx`.

9. **Si tiene SLO propio** (`app/api/admin/slos/route.ts`):
   - Añadir entrada al array `FARGATE_CANARIES`.

10. **Verificar primer tick OK**:
    - Esperar al próximo múltiplo de 5min UTC.
    - Query `observable_events` por `endpoint='canary-<x>'` últimos 10min.
    - Confirmar `event_type='canary_x_ok'` (no `_failed`).

---

## Lecciones aprendidas (mega-sesión 2026-05-27)

Hits y baches reales de implementar 3 canarios + dashboard + SLOs en una sesión. Leer ANTES de añadir el siguiente canary.

### 🪤 Trampas técnicas

1. **`*/` rompe JSDoc**: en un comment block, `cada */5min` cierra prematuramente el comentario. Usar "cada 5min" o "cada `*/5min`" (backticks).

2. **`/api/auth/login` NO existe**: Vence usa SDK Supabase directo desde cliente (`signInWithPassword`). Cualquier canary que intente login REST custom fallará con 404. **Solución agnóstica**: firmar JWT local con `SUPABASE_JWT_SECRET` + HS256 + `aud='authenticated'` + `sub=<user_id>`. Mismo formato que el SDK Supabase emite; cuando migremos a otro proveedor, solo cambia `jwt.sign()`.

3. **404 ambiguo en `/api/v2/answer-and-save`**: el handler mapea `save_failed && correctAnswer===0` a 404 (en lugar de 500), incluso cuando el bug real es FK violation (`sessionId` no existe). Bug latente expuesto por el canary.

4. **Datos satélites obligatorios**: endpoints con FK (answer-save necesita `tests.id`) fallan si generas UUIDs fresh cada tick. Crear UNA fila estable + reutilizar PK → primer tick INSERT, siguientes 287/día devuelven `23505 → already_saved → 200`. **Contamina UNA fila, no 288/día**.

5. **Cross-namespace SSM**: el backend Fargate puede leer secrets de `/vence-frontend/` añadiendo el ARN al IAM Resources. Evita duplicar secrets (`STRIPE_WEBHOOK_SECRET` lo compartimos: handler y canary leen el MISMO SSM → imposible desincronización).

6. **`force-new-deployment` NO cambia task definition**: el workflow GHA hace solo `update-service --force-new-deployment` (rebuild imagen `:latest` + reinicio). Si necesitas que ECS use NUEVA task def, hace falta `update-service --task-definition vence-backend:<rev> --force-new-deployment` explícito tras `terraform apply`.

7. **Drift de Terraform vs `frontend-deploy.yml`**: el workflow actualiza la imagen del frontend fuera de Terraform. `terraform plan` SIEMPRE muestra drift. Un full `terraform apply` revertiría el último deploy del frontend. **Solución**: `terraform apply -target=<recursos específicos>`.

8. **ALB health check grace period**: al añadir un secret nuevo al task def, el cold start del container es ~30s más largo. El primer task puede fallar el health check ALB en el límite → ECS reintenta y la 2ª task arranca OK. **No es bug a perseguir**, es comportamiento ECS esperado en el primer rollout post-cambio de envs.

9. **GHA `paths-ignore` se evalúa con la versión del PROPIO commit**: cuando pusheamos un workflow que añade `.github/workflows/**` a su propio paths-ignore, el fix toma efecto en ese mismo push. No hay "último build idle".

10. **`gh` CLI no está en sandbox de Claude**: usar `curl + jq` contra `https://api.github.com/repos/<owner>/<repo>/actions/runs?branch=main` (API pública para repos públicos, 60 req/hora sin token).

### 🎯 Decisiones arquitectónicas

1. **Approach agnóstico para auth**: JWT firmado local con `SUPABASE_JWT_SECRET` (que el `JwtGuard` ya verifica). Migración de proveedor en el futuro = 1 línea de cambio (`jwt.sign()`), no rewrite del canary.

2. **Modo idle preventivo**: cada canary chequea sus envs al inicio. Si faltan, emite `_skipped` warn (NO `_failed` critical). Permite que el código viva en main mucho antes de aplicar terraform sin spam de alarmas.

3. **Step-aware errors**: discriminated union `{ step: 'sign'|'http'|'validate_*'|... }` con notification que muestra runbook diferenciado. Acción operativa concreta en lugar de "algo falló".

4. **Smoke user marca semántica**: `user_metadata.is_smoke_user: true` + `user_profiles.admin_notes: "Smoke user del canary…"`. Cualquier admin futuro entiende NO eliminar.

5. **UUID reservados para datos satélites**: `00000000-0000-4000-8000-0000000000XX` patrón claro y reconocible.

6. **NO duplicar secrets entre namespaces**: usar cross-namespace IAM antes de duplicar SSM. Una rotación accidental sin sincronizar es bug silencioso peor que cualquier complejidad arquitectónica.

### 📋 Checklist obligatoria pre-merge de un nuevo canary

- [ ] Investigación read-only completa del endpoint (status codes, schema, FK).
- [ ] Datos satélites creados ANTES de la primera ejecución del canary.
- [ ] Discriminated union `CanaryResult` cubre TODOS los pasos (`sign`, `http`, `validate_*`).
- [ ] Service detecta envs faltantes → `_skipped` warn (no critical).
- [ ] Cron emite 4 eventos: `_ok` / `_failed` / `_skipped` / `cron_run` (liveness).
- [ ] RULE con cooldown 15min + notification step-aware + 5 tests Jest.
- [ ] Si añade envs: terraform `-target` + verificar plan SOLO toca lo mío.
- [ ] Tras deploy: verificar primer tick `_ok` en `observable_events` (no `_failed`).
- [ ] Dashboard `/admin/canary`: añadir a `CANARY_ENDPOINTS` + `CANARY_DESCRIPTION`.
- [ ] SLO: añadir a `FARGATE_CANARIES` en `/api/admin/slos`.
- [ ] Roadmap doc actualizado con sección del nuevo canary.

---

## Criterio de éxito global

Sistema **maduro** cuando:

1. ✅ Cada PR bloquea si rompe smoke público (Nivel 2).
2. ✅ Detección de regresión auth en ≤5 min (Nivel 3).
3. ✅ Cero feedbacks de soporte por bugs que el sistema podía haber capturado (Nivel 4+).
4. ✅ ≥80% de features cubiertas (Nivel 5).
5. ✅ SLOs documentados + alarmas activas (`docs/SLO.md` + `alert-rules.ts`).

Filosofía martillo (de `observability.md`):

> *"Si un usuario nos reporta un bug que la observabilidad/simulaciones podía haber capturado, hemos fallado."*

---

## Decisiones de diseño

### ¿Por qué Playwright en vez de Cypress?
- VicoHR ya validó Playwright en producción (>1 año).
- Playwright soporta multi-browser nativo (Cypress requiere plugins).
- Mejor integración con TypeScript strict.
- `playwright.config.ts` ya está creado en Vence.

### ¿Por qué cron Fargate en vez de AWS CloudWatch Synthetics?
- Coste: 0€ vs $15/mes/canary.
- Reutiliza infra existente (Fargate ya está con 12 crons).
- Decision postponed para post-cutover AWS (cuando volumen lo justifique).

### ¿Por qué smoke user dedicado en vez de mocks?
- Detecta bugs reales de auth + RLS que mocks ocultarían.
- Patrón estándar SaaS (Stripe usa `tok_visa`, GitHub usa `octocat`).
- Cleanup tras cada spec previene contaminación BD.

### ¿Por qué 5 min de cadencia para canary HTTP?
- 5 min = buen balance entre latencia detección y carga BD.
- 1 min sería overkill (carga × 5).
- 15 min cubriría incidentes en 15 min máximo (aceptable).
- VicoHR usa 5 min (validado).

---

## Anexo: inspiración VicoHR

Origen del roadmap: análisis del repo `~/Documentos/github/VicoHR/`, en concreto:

- `docs/E2E-TESTING.md` (14K) — guía Playwright + niveles de madurez.
- `docs/SLO.md` (5K) — 7 SLOs documentados con alarmas.
- `docs/OBSERVABILITY-RUNBOOK.md` (48K) — 16 playbooks de respuesta.
- `docs/roadmaps/E2E-COVERAGE-ROADMAP-simulaciones.md` (33K) — el roadmap original que inspira este.
- `docs/roadmaps/AWS-NATIVE-ARCHITECTURE.md` — infra observability.

**Lo que copiamos** (con adaptaciones):
- Niveles de madurez 1-7 incrementales.
- Canary HTTP cada 5 min con SNS email.
- SLOs formalizados.
- Cleanup obligatorio `try/finally` en specs E2E.
- Smoke user "JWT-only" para evitar contaminación BD.

**Lo que NO copiamos**:
- Multi-país (VicoHR opera en 8 países, Vence en ES).
- 16 playbooks específicos de VicoHR (Vence tiene los suyos en `docs/runbooks/`).
- Canary Playwright cada 6h con Lambda + S3 (overkill hoy; usar cron Fargate gratis).

---

## Relacionado

- [`docs/SLO.md`](../SLO.md) — Los 7 SLOs actuales (pendiente crear).
- [`docs/runbooks/observability.md`](../runbooks/observability.md) — Manual de observabilidad completa.
- [`docs/runbooks/health-check.md`](../runbooks/health-check.md) — Runbook diagnóstico rápido.
- [`backend/src/alerts/alert-rules.ts`](../../backend/src/alerts/alert-rules.ts) — Engine de alertas declarativas.
- [`app/api/admin/slos/route.ts`](../../app/api/admin/slos/route.ts) — Endpoint que materializa los SLOs.
- [`e2e/smoke-public.spec.ts`](../../e2e/smoke-public.spec.ts) — Smoke público actual (Nivel 1).
- [`docs/ARCHITECTURE_ROADMAP.md`](../ARCHITECTURE_ROADMAP.md) — Roadmap arquitectural global.
