# SLOs — Service Level Objectives de Vence

> Documento formal con los objetivos de servicio medidos en producción.
> **Fuente de datos**: endpoint `app/api/admin/slos/route.ts` (cálculo en vivo) + `observable_events` + CloudWatch.
> **Última actualización**: 2026-05-27 ~15:30 CEST.

---

## ¿Qué es un SLO?

Un **SLO (Service Level Objective)** es una promesa medible que hacemos sobre el comportamiento del sistema en producción: latencia, disponibilidad, tasa de errores. Cada SLO tiene:

1. **Métrica**: qué se mide y dónde se almacena.
2. **Umbral**: verde (target cumplido) / ámbar (alerta) / rojo (incidente).
3. **Alarma**: regla automática que dispara notificación si el SLO baja a rojo.
4. **Acción operativa**: qué hace el on-call cuando dispara.

Filosofía martillo: *"Si un usuario nos reporta un bug que un SLO podía haber capturado, hemos fallado."*

---

## Los 7 SLOs activos

### SLO-01 — Canary CloudWatch uptime (24h)

| Campo | Valor |
|---|---|
| **Métrica** | `CloudWatchSynthetics/SuccessPercent` con dimension `CanaryName=vence-preview` |
| **Ventana** | Rolling 24h, agregado por hora |
| **🟢 Verde** | ≥99.9% |
| **🟡 Ámbar** | ≥99% |
| **🔴 Rojo** | <99% |
| **Alarma** | `RULE_CANARY_AUTH_FAILED` (cuando se implemente Nivel 3 de [canary-y-simulaciones.md](roadmap/canary-y-simulaciones.md)) |
| **Acción** | Investigar últimos deploys + verificar `/api/health` + revisar logs Fargate del cron Nivel 3 |

**Estado actual**: canary CloudWatch Synthetics aún no desplegado — el cálculo usa el namespace `CloudWatchSynthetics/vence-preview` que **devolverá `unknown` hasta el cutover AWS completo**. Ver `docs/runbooks/observability.md` §11.

---

### SLO-02 — Latencia preview AWS (24h)

| Campo | Valor |
|---|---|
| **Métrica** | p50/p95/p99 sobre `observable_events.duration_ms` filtrado por `event_type='request_completed'` y `metadata.host='preview-aws.vence.es'` |
| **Ventana** | Rolling 24h, sampling 10% de requests exitosos |
| **🟢 Verde** | p95 < 800ms |
| **🟡 Ámbar** | p95 < 1500ms |
| **🔴 Rojo** | p95 ≥ 1500ms |
| **Alarma** | Pendiente crear regla en `alert-rules.ts` (`RULE_LATENCY_P95_SLOW`, severity warn) |
| **Acción** | Revisar PgBouncer pool stats (`/admin/infra-stats`) + queries lentas pg_stat_statements + cold start ECS |

**Métricas baseline (2026-05-27)**: p95 ~600ms en horas pico tras migración self-hosted-pooler. Bajo control.

---

### SLO-03 — Latencia prod Vercel (24h, baseline)

Mismo SLO que SLO-02 pero filtrado por `metadata.host='www.vence.es'`. Usado como **baseline de comparación** durante el cutover Vercel→AWS para decidir GO/NO-GO.

Umbrales idénticos: p95 < 800ms verde.

---

### SLO-04 — Errores 4xx (24h, todos los hosts)

| Campo | Valor |
|---|---|
| **Métrica** | `count(observable_events) / total` donde `http_status >= 400 AND http_status < 500` |
| **Ventana** | Rolling 24h |
| **🟢 Verde** | < 5% |
| **🟡 Ámbar** | < 10% |
| **🔴 Rojo** | ≥ 10% |
| **Alarma** | `RULE_STRIPE_WEBHOOK_4XX_BURST` (parcial, solo webhook). Pendiente extender a 4xx genérico |
| **Acción** | 1) Validar si es bot abuse → bloquear UA. 2) Si es legítimo → endpoint con validación rota |

**Nota**: 4xx siempre tiene un baseline normal (~2-3%) por bots scrapeando endpoints públicos + clientes mal configurados. El SLO captura solo spikes anómalos.

---

### SLO-05 — Errores 5xx user-facing reales (24h)

| Campo | Valor |
|---|---|
| **Métrica** | `count(observable_events)` donde `http_status >= 500` **excluyendo** `/api/cron/*`, `/api/debug/*`, `/api/admin/*` + `error_message` que contiene "reintenta"/"saturad"/"temporalmente" (load-shedding deliberado) |
| **Ventana** | Rolling 24h |
| **🟢 Verde** | < 0.1% |
| **🟡 Ámbar** | < 1% |
| **🔴 Rojo** | ≥ 1% |
| **Alarma** | `RULE_HTTP_5XX_SPIKE` (severity critical, >20 en 5 min, cooldown 30 min) |
| **Acción** | Ver runbook health-check.md §1 (CLI 30s veredicto) + investigar endpoint top en `/admin/salud-sistema` |

**Decisión de diseño (26/05/2026 audit)**: separamos user-facing vs internal porque smoke tests `/api/debug/*` con `throw` deliberado contaminaban SLO como falsos positivos. Cutover real solo depende de lo que ve el usuario.

---

### SLO-06 — React hydration mismatch (24h)

| Campo | Valor |
|---|---|
| **Métrica** | `count(observable_events)` donde `event_type='react_hydration_mismatch'` |
| **Ventana** | Rolling 24h |
| **🟢 Verde** | 0 eventos |
| **🟡 Ámbar** | < 50/día |
| **🔴 Rojo** | ≥ 50/día |
| **Alarma** | `RULE_HYDRATION_MISMATCH_SPIKE` (severity error, ≥5 mismatches en 15 min por (endpoint, deploy_version), cooldown 60 min) |
| **Acción** | grep `new Date()`, `Math.random()`, `localStorage` en componentes client del path afectado |

**Origen**: incidente repetido por `new Date()` en server vs client. Test arquitectural `__tests__/architecture/no-date-in-temario-client.test.ts` cubre `/temario/[slug]`; esta regla detecta el resto del repo.

---

### SLO-07 — Volumen total de eventos (24h)

| Campo | Valor |
|---|---|
| **Métrica** | `count(observable_events)` total |
| **Ventana** | Rolling 24h |
| **🟢 Verde** | > 100 eventos/día |
| **🟡 Ámbar** | > 10 eventos/día |
| **🔴 Rojo** | ≤ 10 eventos/día |
| **Alarma** | Implícita (si SLO baja a rojo, **toda la observabilidad está rota** → todos los demás SLOs son falsos verdes) |
| **Acción** | Verificar sink de observabilidad: ¿está activo `getSink()`? ¿la BD recibe writes? ¿hay tráfico real? |

**Métrica de validación**: el día 27/05 tras incidente AWS hubo período de cero eventos durante 15 min porque el sink dual-write tenía race condition (commit `9dc7acfd`). Sin SLO-07, habríamos asumido todo OK porque los demás SLOs estaban verdes (sin datos = sin alarmas).

---

## Cutover readiness gauge

El endpoint `/api/admin/slos` devuelve `cutoverReady: boolean` que es **`true` solo si TODOS los 7 SLOs están en verde** (0 reds + 0 ambers).

Es la decisión final automatizable para el GO/NO-GO del cutover Vercel→AWS (Bloque 5 Fase E).

---

## Cómo añadir un nuevo SLO

1. **Definir métrica**: ¿qué evento en `observable_events` la mide? ¿qué namespace CloudWatch?
2. **Decidir umbrales**: ¿qué valor es aceptable / preocupante / inaceptable?
3. **Implementar en endpoint**: añadir bloque en `app/api/admin/slos/route.ts` que calcula valor + status + detail.
4. **Crear alarma**: añadir regla en `backend/src/alerts/alert-rules.ts` con `shouldFire` que dispara cuando el SLO baja a rojo.
5. **Documentar en este file**: añadir sección como las de arriba con métrica/umbrales/alarma/acción.
6. **Añadir runbook**: si la acción operativa es no-trivial, link a `docs/runbooks/<slo-name>.md`.

---

## SLOs futuros candidatos (no implementados todavía)

| Candidato | Métrica | Por qué |
|---|---|---|
| SLO-08 — `stripe_webhook_signature_failed` rate | Count en `validation_error_logs` últimas 5 min | Hubiera cazado incidente Rocío/Mercedes en 5 min |
| SLO-09 — `subscription_drift_missing_in_db` | Pass-2 reconciliation cada hora | Webhook roto silencioso |
| SLO-10 — `tts_natural_end_rate` | % sesiones TTS terminadas naturalmente | UX crítico para premium |
| SLO-11 — `daily_active_users` | Tasa diaria comparada vs baseline semanal | Detectar caídas de tráfico no-incidente |
| SLO-12 — `checkout_conversion_rate` | % users que entran a /premium y completan pago | Funnel crítico negocio |

---

## Relacionado

- [Endpoint vivo](../app/api/admin/slos/route.ts) — cálculo en tiempo real.
- [Roadmap canary + simulaciones](roadmap/canary-y-simulaciones.md) — sistema E2E completo que alimenta nuevos SLOs.
- [Runbook health-check](runbooks/health-check.md) — diagnóstico rápido cuando algún SLO baja.
- [Runbook observabilidad](runbooks/observability.md) — manual completo de los sinks de eventos.
- [Alert rules engine](../backend/src/alerts/alert-rules.ts) — 15+ reglas que materializan las alarmas.
- [Panel admin /admin/salud-sistema](../app/admin/salud-sistema/) — UI con semáforos verde/ámbar/rojo en vivo.
