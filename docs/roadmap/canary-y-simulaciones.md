# Roadmap — Sistema de canary + simulaciones E2E

> **Estado**: 🟡 Nivel 1 ✅ (smoke público) + Nivel 2-7 pendientes.
> **Propietario**: equipo Vence.
> **Inspiración**: VicoHR ([análisis comparativo](#anexo-inspiración-vicohr)) — patrones validados en producción.
> **Coste recurrente añadido total**: ~$15-30/mes cuando se complete el stack.
> **Última actualización**: 2026-05-27 ~15:30 CEST.

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
| Alert rules engine declarativo (15+ reglas SQL sobre `observable_events`) | `backend/src/alerts/alert-rules.ts` | ✅ |
| `observable_events` sink AWS-ready (OTEL-compat) | `lib/observability/` | ✅ |
| CloudWatch Synthetics canary mencionado como roadmap | `docs/runbooks/observability.md` §11 | ⏳ |
| **Workflow GHA que ejecute Playwright** | ❌ | ❌ |
| **`docs/SLO.md` formal** | ❌ | ❌ |
| **Canary HTTP autenticado cada N min** | ❌ | ❌ |
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

### 🟡 Nivel 2 — Workflow GHA ejecuta Playwright en cada PR + diario

**Qué cubre**: cualquier PR que rompa una página pública queda bloqueado antes de merge.

**Cómo**: `.github/workflows/e2e-smoke.yml`:
- `on: pull_request` → ejecuta contra `preview-aws.vence.es`.
- `on: schedule: '0 */6 * * *'` (cada 6h) → ejecuta contra producción.
- 2 workers paralelos, 2× retries en CI, HTML report como artifact 14d retention.

**Esfuerzo**: 30-60 min.

**Coste**: gratis (GitHub Actions free tier).

**Bloqueadores**: ninguno — playwright.config.ts ya está.

**Métrica éxito**: 100% PRs ejecutan e2e smoke. Cero merges con tests rotos.

---

### 🟡 Nivel 3 — Canary HTTP autenticado cada 5 min

**Qué cubre**: el flujo crítico de auth + endpoint protegido + sesión. Equivalente al canary HTTP de VicoHR.

**Cómo**: backend NestJS Fargate añade cron `@Cron('*/5 * * * *')`:

```ts
@Cron('*/5 * * * *', { name: 'canary-smoke-auth', timeZone: 'UTC' })
async handle() {
  // 1. POST /api/auth/login con smoke@vence.es + password
  // 2. GET /api/profile?userId=<smoke_uid> con Bearer
  // 3. Verificar plan_type esperado, response 200, latencia <2s
  // 4. Emit observable_events:
  //    - cron_run (info si todo OK)
  //    - canary_auth_failed (critical si cualquier step falla)
}
```

Regla `RULE_CANARY_AUTH_FAILED` en alert-rules: `severity=critical`, `cooldown=15min`, dispara con ≥1 evento en 5 min.

**Esfuerzo**: 2-3h.

**Coste**: 0€ (cron Fargate ya pagado).

**Bloqueadores**:
- Crear smoke user `smoke@vence.es` en Supabase Auth + perfil con `plan_type='premium'` y `target_oposicion='auxiliar_administrativo_estado'`.
- Almacenar password como SSM `/vence-backend/SMOKE_USER_PASSWORD`.

**Métrica éxito**: SLO ≥99.9% uptime/mes. Detección regresiones auth en ≤5 min.

**Lo que hubiera cazado**: el bug Rocío/Mercedes de hoy (webhook signature failed → checkout-sync devolvería 5xx si el flujo de login no funciona).

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
| **Sprint 1 (esta semana)** | 2 + 3 | 3-4h | 🔴 Alto — captura 80% de regresiones críticas. Hubiera cazado el bug de hoy. |
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
