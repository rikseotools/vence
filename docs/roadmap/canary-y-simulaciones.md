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

**Qué cubre**: el flujo crítico de auth + endpoint protegido + sesión. Equivalente al canary HTTP de VicoHR.

**Implementación** — módulo NestJS Fargate `backend/src/canary-smoke-auth/`:

- `canary-smoke-auth.service.ts`: 4 pasos secuenciales con timeouts de 5s cada uno.
  1. `POST /api/auth/login` con `smoke@vence.es` + `SMOKE_USER_PASSWORD` (SSM).
  2. `GET /api/profile?userId=<SMOKE_USER_ID>` con Bearer del paso 1.
  3. Validar `planType === 'premium'`.
  4. Validar latencia total < 10s.
- `canary-smoke-auth.cron.ts`: `@Cron('*/5 * * * *')` con 4 eventos a observability:
  - `canary_auth_ok` (info)
  - `canary_auth_failed` (critical, dispara `RULE_CANARY_AUTH_FAILED`)
  - `canary_auth_skipped` (warn, modo idle cuando faltan credenciales SSM — NO spam de alarmas)
  - `cron_run` (siempre, liveness)
- `canary-smoke-auth.module.ts` registrado en `app.module.ts`.
- `RULE_CANARY_AUTH_FAILED` en `alert-rules.ts`: severity critical, cooldown 15min, dispara con ≥1 evento en 10 min.
- Tests Jest: 5 tests verde en `alert-rules.spec.ts` (shouldFire ≥1, NO con 0, severity critical, notification con runbook 5 acciones, cooldown 15).

**Estado**: código mergeado. **Cron está en modo idle hasta que se configure el smoke user** (devuelve `{skipped: true, reason: 'credentials_not_configured'}` con warn, sin spam).

**Pendiente humano (15 min) para activarlo**:
1. Crear smoke user en Supabase Auth: `smoke@vence.es` / password seguro generado.
2. UPSERT `user_profiles` con `plan_type='premium'`, `target_oposicion='auxiliar_administrativo_estado'`.
3. `aws ssm put-parameter --profile vence --region eu-west-2 --name /vence-backend/SMOKE_USER_PASSWORD --value '<password>' --type SecureString`
4. `aws ssm put-parameter --profile vence --region eu-west-2 --name /vence-backend/SMOKE_USER_ID --value '<uuid>' --type SecureString`
5. Añadir ambos a `backend/infra/main.tf` (locals + IAM policy + secrets en task def) — mismo patrón que `STRIPE_SECRET_KEY` (commit `2e67ffd6`).
6. `terraform apply -target=aws_ecs_task_definition.backend -target=aws_iam_role_policy.task_execution_secrets`
7. `aws ecs update-service --profile vence --cluster vence-backend --service vence-backend --force-new-deployment`

**Métrica éxito**: SLO ≥99.9% uptime/mes. Detección regresiones auth en ≤5 min.

**Lo que hubiera cazado**: el bug Rocío/Mercedes de hoy (auth + profile funcionaban, pero si hubiéramos extendido el canary a `/api/stripe/webhook` con evento sintético firmado, la regresión de signature se habría detectado en 5min). Nivel 4 lo extenderá al webhook.

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
| ✅ **Sprint 1 (HECHO 2026-05-27)** | 2 + 3 | 3-4h | 🔴 Alto — captura 80% de regresiones críticas. Cron Fargate en idle hasta SSM smoke user (15min humano). |
| **Sprint 2 (próxima semana)** | 4 | 3-5 días | 🟡 Alto — flow crítico cubierto end-to-end. |
| **Sprint 3 (próximo mes)** | 5 (subset 15 specs core) | 1 semana | 🟡 Alto — cobertura amplia donde más duele. |
| **Sprint 4 (futuro)** | 5 (resto) + 6 | 2-3 semanas | 🟢 Medio — completitud. |
| **Sprint 5 (post-cutover AWS)** | 7 | 1-2 días | 🟢 Bajo — sólo cuando justifique el coste. |

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
