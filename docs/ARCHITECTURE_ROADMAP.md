# Vence — Architecture Roadmap a 100k+ usuarios

> **Última actualización:** 2026-05-02
> **Estado:** Fase 0 en curso (1 de 5 puntos hechos)
> **Objetivo:** preparar Vence para escalar a 100k+ usuarios sin perder features ni romper nada
> **Coste extra estimado total (Fases 0-3):** $10-40/mes
> **Coste extra estimado total (Fases 0-5):** $50-150/mes

## Por qué este documento

Vence creció con una arquitectura "todo en BD" (8 triggers en `test_questions`, queries en línea para stats, sin caché). Funciona bien hasta ~5-10k usuarios pero **no escala** a 100k sin cambios.

Los **timeouts 504** que aparecen en producción (mayo 2026) son la señal: las queries lentas saturan el pool max:1 de Postgres y bloquean otros endpoints en cascada.

Este roadmap cambia la arquitectura **sin reescribir** el código, en 6 fases independientes y reversibles.

---

## Principios

1. **Equivalencia funcional**: cada cambio preserva el comportamiento visible al usuario, o documenta la diferencia (ej. caché de 30s) y la justifica.
2. **Reversibilidad**: cada fase se puede revertir en <5 min si algo falla.
3. **Una mejora a la vez**: si haces 5 cambios y se rompe algo, no sabes cuál.
4. **Mide antes y después**: sin métricas, no sabes si funcionó.
5. **Audit antes de tocar código**: lista de features afectadas, SPEC actual y nuevo, tests que protegen, monitor, rollback.
6. **No re-escrituras grandes**: cambios incrementales en código existente.
7. **Ahorra antes de gastar**: caché y queries antes que plan caro.

---

## Diagnóstico actual (mayo 2026)

| Métrica | Valor | Comentario |
|---|---|---|
| Postgres | Supabase Pro 17.4, max_connections=90, shared_buffers=512MB | Plan básico |
| `test_questions` | 773k filas, 8 triggers AFTER INSERT | Cuello de botella escritura |
| `questions` | 6.3M UPDATEs acumulados (por triggers) + 800k seq_scans con 17B filas leídas | Lock contention + índices faltantes |
| Pool Drizzle | max:1 (bajado de max:8 → 3 → 1 tras 261 events de pool exhaustion el 27 abr) | Trade-off Supavisor vs Fluid serialization |
| Caché edge | Solo en `/api/teoria/*` y `/api/ranking` | Falta en `/api/v2/user-stats`, `/api/v2/profile`, etc. |
| Caché Redis | ❌ no existe | Imprescindible para escala |
| Queue async | ❌ no existe (todo es triggers SQL síncronos) | Triggers son anti-pattern de escala |

---

## Las 6 fases

| Fase | Duración | Coste mensual | Beneficio | Riesgo |
|---|---|---|---|---|
| **0 — Estabilizar** | 1 sem | $0 | Resuelve timeouts actuales | Cero |
| **1 — Redis cache** | 1-2 sem | $10 | -80% load BD | Bajo |
| **2 — Outbox pattern** | 2-3 sem | $0 | Estabilidad escrituras | Medio |
| **3 — Pool split / replica** | 2-3 sem | $0-30 | Aislamiento OLTP/admin | Bajo |
| **4 — Async queues** | 1-2 sem | $0-20 | -50% writes BD principal | Medio |
| **5 — Data warehouse** | 3-6 sem | $30-100 | Analytics escalable | Bajo |

**Para 100k cómodo**: Fases 0-3 (3-6 semanas, ~$10-40/mes).
**Para 1M+**: Fases 0-5 (3-6 meses, ~$50-150/mes).

---

## Fase 0 — Estabilizar (URGENTE)

**Objetivo:** parar los timeouts 504 actuales sin tocar arquitectura.

| # | Tarea | Estado | Detalle |
|---|---|---|---|
| 0.1 | Trigger `update_article_stats_trigger` (#7) → NO-OP | ✅ Hecho 2 may 2026 | `supabase/migrations/20260502_disable_trigger_update_article_stats.sql` |
| 0.2 | Triggers #2/#3/#4 → debounced + cron 5min | ⏳ Pendiente | Mover updates de `questions.difficulty` a cron batch. Requiere audit previo. |
| 0.3 | Investigar 17B seq_scans en `questions` (índices faltantes) | ⏳ Pendiente | Read-only investigación con `pg_stat_statements`. CREATE INDEX CONCURRENTLY. |
| 0.4 | Cache edge en /api/v2/user-stats, /api/exam/pending, /api/v2/profile | ⏳ Pendiente | `Cache-Control: s-maxage=30, stale-while-revalidate=120` |
| 0.5 | Verificar p95 `/api/exam/answer` baja de >10s a <2s | ⏳ Pendiente | Vercel Analytics + alerta |

**Resultado esperado:** 80% de los timeouts desaparecen. $0 extra.

---

## Fase 1 — Redis cache (Upstash)

**Objetivo:** que el 80%+ de las requests no lleguen a BD.

**Setup:**
- Upstash Redis serverless (gratis hasta 10k commands/día, ~$10/mes para 100k usuarios)
- `lib/cache/redis.ts` con `getOrSet(key, ttl, fetcher)` (cache-aside)
- Fallback a BD si Redis está down

**Endpoints a cachear (orden de impacto):**
1. `/api/v2/user-stats` (TTL 30s, key `user_stats:{userId}`)
2. `/api/v2/profile` (TTL 60s, key `profile:{userId}`)
3. `/api/v2/daily-limit/check` (TTL 30s, key `daily_limit:{userId}`) — **NO el counter, solo el read**
4. `/api/exam/pending` (TTL 30s)
5. Catálogo oposiciones/leyes/themes (TTL 1h)

**Invalidación:** UPDATE perfil → `DEL profile:{userId}`. Respuesta → `DEL user_stats:{userId}`.

**Salvaguardas:**
- Daily limit: cache solo el VALOR leído, NO el decremento. El INSERT sigue siempre en BD.
- Tests de paridad (cache vs BD coinciden).
- Feature flag `REDIS_CACHE_ENABLED=false` para desactivar instantáneo.

---

## Fase 2 — Outbox pattern (sustituir triggers pesados)

**Objetivo:** eliminar lock contention de triggers manteniendo features intactas.

**Patrón híbrido (preserva UX):**
- **Lo que el usuario ve en tiempo real → trigger ligero**: `user_stats_summary` (+1 atómico), `user_streak` (con guard 1x/día), `user_question_history` simple counter.
- **Lo que es analítico/pesado → outbox + worker**: recálculo de `questions.difficulty/global_difficulty`, agregaciones complejas, eventos analytics.

**Setup:**
1. Tabla `outbox_events` con índices en (processed, created_at)
2. Endpoint `/api/v2/answer-and-save` inserta en outbox + test_questions (atómico, mismo transaction)
3. Worker `/api/cron/process-outbox` (GH Actions cron 1min) consume eventos
4. Migración gradual trigger por trigger: worker procesa → verifica 1 semana → trigger a NO-OP

**Salvaguardas:**
- Idempotencia (UPSERT, no INSERT) en lo que procesa el worker
- Lock distribuido (advisory lock) en el cron para evitar dobles procesamientos
- Si worker falla, eventos se acumulan, se procesan al recuperar (sin pérdida)

---

## Fase 3 — Pool split / read replica

**Objetivo:** aislar lecturas pesadas de escrituras críticas.

**Pool split (sin replica, $0):**
```typescript
getWriteDb()  → max:1, timeout 5s   // INSERT/UPDATE críticos (answer, save)
getReadDb()   → max:1, timeout 3s   // SELECTs cacheables (stats, profile)
getAdminDb()  → max:4, timeout 60s  // ya existe, admin/dashboards
```

Una stats lenta no bloquea un INSERT de respuesta.

**Read replica (decisión de negocio, ~$30/mes extra):**
- Supabase Pro permite 1 read replica
- `getReadDb()` apunta a la replica → admin/stats no compiten con OLTP
- Latencia: ~100ms behind primary (acceptable)

---

## Fase 4 — Async queues para escrituras no críticas

**Tablas candidatas:**
- `user_interactions` (7.6M filas, 4.9M inserts) — verificar consumidores antes
- Eventos de tracking del cliente
- Notification events

**Patrón:**
- Frontend POST → endpoint API → push a Inngest queue (gratis hasta 50k steps/mes)
- Worker Inngest persiste en BD (o data warehouse, si nadie lo consume tiempo real)
- Si nadie las consume real-time → eliminar la tabla del todo

**Audit CRÍTICO previo:** identificar todos los consumidores de cada tabla antes de hacer async.

---

## Fase 5 — Data warehouse para analytics

**Setup:**
- ClickHouse (Aiven, ~$30-100/mes) o BigQuery (pay-per-query)
- CDC desde Postgres con Inngest functions (más simple que Debezium)
- Tablas: `test_questions`, `user_question_history`, eventos

**Migración gradual:**
- Cada dashboard admin: comparar warehouse vs Postgres 1 semana
- Si los números coinciden → migrar al warehouse
- Postgres OLTP descargado, admin instantáneo

---

## Framework: Feature Audit (proceso por cada cambio)

Antes de tocar código en cualquier fase:

```markdown
## Audit de cambio: [nombre]

### Features que toca
- [ ] Feature A: descripción + dónde está el código
- [ ] Feature B: descripción + dónde está el código

### Comportamiento ACTUAL (lo que el usuario espera)
Detalle exacto de qué ve, cuándo, con qué latencia.

### Comportamiento NUEVO
Detalle exacto de qué verá tras el cambio.
Diferencias (si las hay) y por qué son aceptables.

### Tests que protegen
- Tests existentes que cubren esto: [lista]
- Tests nuevos a añadir: [lista]

### Monitor
- Métrica que detecta regresión: [cuál]
- Threshold de alerta: [valor]

### Rollback
Cómo revertir en <5 min si algo falla.
```

Si el audit revela que un endpoint nuevo depende de comportamiento que vamos a cambiar → **se replantea el diseño**, no se hace el cambio.

---

## Reglas de seguridad de oro

1. **Cada fase: rama git separada, deploy a staging primero** (cuando haya staging)
2. **Métricas antes y después** (Vercel Analytics + endpoint propio que mide p95)
3. **Feature flags** para rollback instantáneo de cambios grandes
4. **Tests de paridad y E2E** que verifican comportamiento conserva
5. **NUNCA borrar código que pueda servir** (NO-OP primero, DROP en migración separada después)
6. **Audit antes de cualquier cambio en triggers/flujos críticos**

---

## Exit criteria por fase (cuándo se considera "hecha")

Sin métricas medibles, una fase nunca está terminada de verdad. Antes de marcar una fase como completa, todas estas condiciones deben cumplirse durante **al menos 48h** en producción.

| Fase | Métrica | Threshold para "hecho" |
|---|---|---|
| **0** | p95 `/api/exam/answer` | < 2.000 ms |
| **0** | Error rate (5xx) global | < 0.5% en 48h |
| **0** | Sin timeouts 504 en endpoints hot durante 48h | 0 incidencias |
| **1** | Cache hit ratio Redis | > 70% |
| **1** | Carga BD reads (queries/seg en lectura) | -50% vs baseline pre-Fase-1 |
| **1** | p95 `/api/v2/user-stats` y `/api/v2/profile` | < 100 ms |
| **2** | Outbox lag (eventos pendientes oldest) | < 5 min sostenido |
| **2** | p99 `/api/v2/answer-and-save` | < 500 ms |
| **2** | DLQ (eventos que fallan reiteradamente) | < 10 al día |
| **3** | Pool wait time hot path | p95 < 50 ms |
| **3** | Admin queries no bloquean hot path | 0 timeouts cruzados |
| **4** | Volumen de escrituras en BD principal | -50% vs baseline pre-Fase-4 |
| **4** | Lag de queue (jobs pendientes) | < 30 s sostenido |
| **5** | Paridad warehouse vs Postgres en métricas admin | 100% match en 1 semana de comparación |
| **5** | Latencia dashboards admin | < 2s p95 |

Si una fase no cumple sus exit criteria, **no se pasa a la siguiente** (puede quedar en producción si funciona, pero la siguiente fase queda bloqueada).

---

## Observabilidad mínima

Para 100k DAU, no hace falta APM de pago. Vence ya tiene buena base; solo faltan piezas concretas.

### Lo que YA existe (mantener y aprovechar)
- ✅ **Sentry** (`@sentry/nextjs`) — captura errores client + server
- ✅ **`validation_error_logs` table** — log estructurado de errores con severity (info/warning/critical), endpoint, user_id, payload sanitizado. Ya 11k+ registros, activo.
- ✅ **`withErrorLogging` wrapper** en route handlers — log automático de 5xx con `errorRef` UUID que se devuelve al cliente
- ✅ **`/admin/errores-validacion` UI** + `/api/v2/admin/validation-errors` API — panel para revisar errores en tiempo real
- ✅ **Vercel Function Logs** + Vercel Analytics
- ✅ **pg_stat_statements** activo en Supabase

### Lo que FALTA añadir (1-2h setup)
- **Slow query log de Supabase** activado y revisado weekly (Dashboard → Database → Query Performance)
- **Alertas en Sentry** (no solo logging — que avise por email cuando algo se sale de baseline)
- **Cron de revisión semanal**: query a `validation_error_logs` agrupando por endpoint/severity, email con top 10 si hay critical > N
- **Endpoint `/api/admin/health`** simple que devuelve estado de Postgres, Redis (Fase 1+), outbox lag (Fase 2+) — para uptime monitor externo (UptimeRobot $0)

### Alertas mínimas (vía Sentry rules)
- p95 de cualquier endpoint > 3s durante 5 min → alerta email
- Error rate global > 1% durante 5 min → alerta email
- Cualquier 504 timeout → alerta inmediata (rara, debe ser excepción)
- `validation_error_logs` critical count > 50/hora → alerta email (umbral a calibrar tras observar baseline)
- Outbox lag > 10 min (cuando exista, Fase 2) → alerta email
- Cache hit ratio Redis < 50% durante 30 min (cuando exista, Fase 1) → alerta email

### Dashboards (pueden ser manuales)
- ✅ `/admin/errores-validacion` — Vence ya lo tiene
- Supabase Dashboard: connections, slow queries, cache hit (Postgres)
- Vercel Analytics: requests, p95, error rate por endpoint
- Sentry: error volume, performance
- Upstash dashboard (Fase 1+): Redis ops, hit ratio
- Inngest dashboard (Fase 2+ y 4+): jobs, fails, throughput

### Aprovechar `validation_error_logs` para esta migración
La tabla ya está identificando puntos calientes en producción. Para Fase 0:
- `/api/random-test/availability` (14 critical en 24h) → investigar
- `/api/v2/user-stats` (4 critical en 24h) → investigar (relacionado con timeouts ya documentados)
- `/api/v2/answer-and-save` (78 warnings, "respuesta lenta") → fase 2 outbox lo arregla

### Lo que NO necesitas (sobre-engineering)
- Datadog / New Relic / Honeycomb (>$100/mes, no merece la pena hasta multi-millones)
- Distributed tracing custom (Sentry Performance basta)
- Logs aggregation externo (Vercel logs + `validation_error_logs` table sirven hasta 100k DAU)

---

## Resilience mínima

Patrones imprescindibles para que un fallo en una pieza no tumbe toda la app.

### Circuit breaker en dependencias externas (Fase 1+)
- **Redis**: si 3 fallos consecutivos en 10s, abrir el circuito, ir directo a BD durante 30s, luego reintentar.
- **Stripe**: si 5xx repetido, no martillar. Endpoints que dependen de Stripe (admin/cobros, stripe-fees-summary) ya tienen timeout — añadir circuit breaker simple en `lib/stripe-client.ts` cuando se cree.
- **BSC RPC** (USDT verification en /armando): ya tiene try/catch, suficiente.
- **Frankfurter** (EUR/USD): ya sin fallback inventado tras refactor 2 may. OK.

### Rate limiting per user authenticated
- Existe `lib/api/rateLimit.ts` con `RATE_LIMIT_ANON_ANSWER` (anon).
- **Falta** rate limit por `user_id` en endpoints autenticados:
  - `/api/exam/answer` y `/api/v2/answer-and-save`: max 60 req/min/user (suficiente para responder rápido sin permitir abuse)
  - `/api/v2/user-stats`: max 20 req/min/user (raro que un user real las pida más)
  - `/api/v2/profile`: max 10 req/min/user
- Implementación: in-memory Map + cleanup, o Upstash Ratelimit (cuando llegue Redis Fase 1).

### Graceful degradation
- Si Redis cae → BD directo (no error al usuario)
- Si stats endpoint cae → mostrar "—" en UI (no bloquear toda la página)
- Si BD lenta → response con `success:false, retry:true` para que cliente reintente
- Si Sentry/observabilidad cae → no afectar producción (fire-and-forget)

### Timeouts estrictos en cada llamada externa
- Postgres: ya `statement_timeout=30000` (en `db/client.ts`)
- HTTP fetches: añadir `AbortController` con `setTimeout` en cada uno (varios ya lo tienen, hacer audit)
- Redis (Fase 1+): timeout 100ms con fallback a BD

---

## Backups y disaster recovery (mínimo viable)

Para 100k DAU, no hace falta multi-región ni multi-AZ. Pero sí lo siguiente:

### Verificar que está activo (HOY)
- **Supabase PITR (Point-In-Time Recovery)**: en plan Pro está incluido. Verificar en Dashboard → Settings → Database → Backups que dice "PITR enabled". Permite restaurar a cualquier momento de los últimos **7 días**.
- **Daily backup**: Supabase Pro hace backup diario automático. 30 días de retención.
- **Backup de schema**: el repo tiene `db/schema.ts` (Drizzle source of truth). Eso protege contra pérdida de definiciones.

### Probar restore (1 vez antes de Fase 1)
- Crear proyecto Supabase **temporal** ($0 plan free)
- Restaurar backup de hoy ahí
- Verificar que las tablas críticas (`user_profiles`, `tests`, `test_questions`, `payout_transfers`) tienen datos consistentes
- Documentar el procedimiento exacto en este doc (siguiente sección "Procedimiento de restore")

### RTO / RPO declarados
- **RTO** (Recovery Time Objective): **2 horas** para restaurar servicio tras incidente catastrófico. Plan: PITR de Supabase + redeploy de Vercel.
- **RPO** (Recovery Point Objective): **5 minutos** máximo de datos perdidos. PITR cubre esto.

### Procedimiento de restore (a documentar tras la prueba)
- TODO: completar tras primera prueba real

### Lo que NO necesitas para 100k DAU
- Multi-región / multi-AZ (Supabase Pro single AZ basta)
- Replicación cross-region en tiempo real
- Hot standby propio (PITR cubre el caso)
- Run-book complejo (un párrafo con steps basta)

---

## Memos detallados por fase

Cada fase tiene su memo con detalles técnicos en `~/.claude/projects/-home-manuel/memory/`:
- `vence_test_questions_triggers_phase1.md` — Fase 0.2 (triggers debounced)
- `vence_test_questions_triggers_phase2.md` — Fase 2 outbox
- `vence_test_questions_triggers_phase3.md` — Fase 6 long-term
- (futuros memos por cada fase del roadmap conforme se aborden)

---

## Histórico de decisiones

| Fecha | Decisión | Razón |
|---|---|---|
| 2026-05-02 | Adoptar este roadmap | 504 timeouts en producción + objetivo 100k usuarios |
| 2026-05-02 | Trigger #7 NO-OP en lugar de DROP | Reversibilidad inmediata si algún sistema externo lo necesita |
| 2026-05-02 | Pool split antes que subir max:1 | El problema antiguo (261 events Supavisor exhaustion 27 abr) volvería al subir max |
| 2026-05-02 | Outbox híbrido (no full async) | Preservar UX en tiempo real (stats, streak); solo lo pesado va async |
