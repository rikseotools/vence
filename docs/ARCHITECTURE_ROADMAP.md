# Vence — Architecture Roadmap a 100k+ usuarios

> **Última actualización:** 2026-05-03 (tarde)
> **Estado:** Fase 0 casi completa (0.1-0.6 hechas) + **Fase 1 Redis ✅ COMPLETA** + **Sprint 1 seguridad ✅ COMPLETO** (5 sub-sprints). Hoy: rotación password Supabase post-leak GitGuardian, custom domain auth.vence.es activado, One Tap nonce fix, sistema push completo retirado (12 fases, ~12k líneas eliminadas), 3 fugas de seguridad cerradas (assign_role, payout_transfers RLS, sentry-issues stack muerto). Pendiente: 0.5 verificar p95 producción, **Fase 0.7 (JWT local verify)** documentada como next big win, **Fase 11 push (DROP TABLES BD)** esperar 24-48h.
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

| Fase | Estado | Duración | Coste mensual | Beneficio | Riesgo |
|---|---|---|---|---|---|
| **0 — Estabilizar** | 🟡 6/7 hechas (falta 0.5 verificación p95). Fase 0.7 nueva (JWT local verify) pendiente | 1 sem | $0 | Resuelve timeouts actuales | Cero |
| **1 — Redis cache** | ✅ COMPLETA (2026-05-02) | 1-2 sem | $10 | -80% load BD | Bajo |
| **2 — Outbox pattern** | ⏳ Pendiente | 2-3 sem | $0 | Estabilidad escrituras | Medio |
| **3 — Pool split / replica** | 🟡 Pool split parcial (`getDb` max:1 + `getAdminDb` max:4 ya existen, varios crons migrados). Read replica pendiente | 2-3 sem | $0-30 | Aislamiento OLTP/admin | Bajo |
| **4 — Async queues** | ⏳ Pendiente | 1-2 sem | $0-20 | -50% writes BD principal | Medio |
| **5 — Data warehouse** | ⏳ Pendiente | 3-6 sem | $30-100 | Analytics escalable | Bajo |

## Sprint 1 seguridad/limpieza ✅ COMPLETO (2026-05-03)

Trabajo paralelo a las 6 fases, gatillado por incidente GitGuardian (PostgreSQL URI leaked) + Database Linter Supabase warnings.

| Sprint | Acción | Estado | Commit principal |
|---|---|---|---|
| **0** | Rotación password Supabase post-leak + custom domain `auth.vence.es` + One Tap nonce fix | ✅ Hecho | varios |
| **1.1** | REVOKE EXECUTE `assign_role` FROM authenticated (defense in depth) | ✅ Hecho | `257a578b` |
| **1.2** | DELETE stack admin sentry-issues (badge muerto, hook huérfano, endpoint sin callers) | ✅ Hecho | `2b1e2b9f` |
| **1.3** | Sistema push completo retirado (12 fases): UI cliente + admin + endpoints + libs + tests + workflow + dependency npm + service worker NO-OP. **~12k líneas eliminadas**. Pendiente: Fase 11 DROP TABLES BD (esperar 24-48h sin código, backup previo) | 🟡 11/12 hechas | varios |
| **1.4** | Audit `is_current_user_admin`: 10 callers legítimos (Header, UserAvatar, ProtectedRoute, finance/auth, 5 paneles admin). NO TOCAR. Función bien diseñada (boolean, sin side effects, callable por authenticated es by design) | ✅ Documentado | (sin cambio) |
| **1.5** | Cierre RLS `payout_transfers` (DROP 2 policies USING true + REVOKE all anon/authenticated). Cierra fuga financiera severa post-refactor commit 25d9a175 | ✅ Hecho | `e9493d4c` |

**Para 100k cómodo**: Fases 0-3 (3-6 semanas, ~$10-40/mes).
**Para 1M+**: Fases 0-5 (3-6 meses, ~$50-150/mes).

---

## Fase 0 — Estabilizar (URGENTE)

**Objetivo:** parar los timeouts 504 actuales sin tocar arquitectura.

| # | Tarea | Estado | Detalle |
|---|---|---|---|
| 0.1 | Trigger `update_article_stats_trigger` (#7) → NO-OP | ✅ Hecho 2 may 2026 | `supabase/migrations/20260502_disable_trigger_update_article_stats.sql` |
| 0.2 | Trigger #2 → debounced + cron 5min | ✅ Hecho 2 may 2026 (commit 0f58feaf) | Trigger #2 (`update_question_difficulty_immediate`) ahora solo SET stats_dirty=true (UPDATE atómico). Cron `/api/cron/recalc-question-difficulty` (GH Actions cada 5min) procesa hasta 500 dirty/ejecución con algoritmo byte-exact al original (validado 50/50 matches). Triggers #3/#4 quedan para Fase 2 outbox por bug preexistente de algoritmos paralelos. |
| 0.3 | Investigar 17B seq_scans en `questions` (índices faltantes) | ⏳ Pendiente | Read-only investigación con `pg_stat_statements`. CREATE INDEX CONCURRENTLY. |
| 0.4 | Cache headers user-stats + exam/pending + in-memory cache availability | ✅ Hecho 2 may 2026 | Commit f5a1f4e8. /api/profile no se toca (no-store deliberado). Tras Fase 1 (Redis) se promueve a L2 compartido. |
| 0.5 | Verificar p95 `/api/exam/answer` baja de >10s a <2s | ⏳ Pendiente | Vercel Analytics + alerta |
| 0.6 | Trigger #9 `update_user_analytics_on_test_completion` (en `tests`) → simplificado a solo `is_active_student` | ✅ Hecho 2 may 2026 (commit 5363b8f4) | Migración `20260502_simplify_trigger_user_analytics.sql`. Hacía 6 aggregate scans de test_questions (2.2 GB) por completar test. Tabla `user_learning_analytics` (58k filas) verificada por 8 vías como dead-write. Parity test BD real: 2153ms → 38ms (-98%). Resuelve warnings 4-9.6s en `/api/v2/complete-test`. |

**Resultado esperado:** 80% de los timeouts desaparecen. $0 extra.

---

## Fase 0.7 — JWT local verify (CRÍTICO seguridad) ⏳ PENDIENTE

**Origen:** Hard Gap #1 de la auditoría 10k DAU. Investigación a fondo del 3 may 2026 confirma que es **el principal cuello del hot path**.

**Diagnóstico (3 may 2026, 18:30 UTC):**
- 24 warnings/h de `⚠️ [answer-and-save] Respuesta lenta: 2-4s` en producción (consistente)
- Trace del endpoint:
  | Paso | Coste | Estado |
  |---|---|---|
  | `supabase.auth.getUser()` | **250-1000ms** | ❌ Sin atacar |
  | `Promise.all([device, daily, deviceUsage])` | 50-200ms | OK paralelo |
  | `getQuestionValidationCached` | <5ms | OK (cache hit) |
  | INSERT `test_questions` (6 triggers I/O) | 100-500ms | 🟡 Parcial (Fases 0.1/0.2/0.6) |
  | UPDATE `tests` SET score | 10-30ms | OK |
- Total: 400-1700ms p50, **2-4s p99**
- **El round-trip a Supabase Auth es el contribuyente único más grande**

**Beneficio esperado:**
- Round-trip Vercel → Supabase Auth: 250-1000ms → **<5ms** (verificación firma local)
- p50 endpoint: 1.5s → **0.5s**
- p99 endpoint: 4s → **1.5s**
- ~5M req/día × ~250ms ahorrados = **350h latencia agregada eliminada**

**Riesgos analizados (NO eliminables 100% incluso con mitigaciones):**
1. **Algorithm confusion attack** (`alg: none`) — bypass total si verifier no enforce whitelist explícito
2. **Usuarios baneados** continúan accediendo hasta 1h (TTL access token) porque local verify no consulta BD. Mitigación: añadir check `user.banned_at IS NULL` post-extracción userId
3. **Token revocation tras logout** — access token sigue válido hasta `exp` (no es nuevo, comportamiento actual)
4. **Rotación key Supabase** — wave de 401 falsos en window de cache stale. Mitigación: TTL corto + refetch on signature failure
5. **Custom claims futuros** que Supabase añada — divergencia silenciosa post-shadow window

**Investigación previa OBLIGATORIA (10-30 min, antes de tocar código):**
1. **¿Vence usa JWKS asimétrico (RS256/ES256) o secreto simétrico (HS256)?** — `curl https://<project>.supabase.co/auth/v1/.well-known/jwks.json`. Modelo de riesgo distinto en cada caso.
2. **Auditar TODOS los callers de `supabase.auth.getUser()`** — qué uso hacen: solo `user.id`? `app_metadata`? `email`? Algunos pueden necesitar el round-trip por roles.
3. **Verificar OAuth Google flow** genera tokens compatibles con verifier local.

**Plan de implementación (cuando se reanude):**
1. Helper aislado `verifyAuthLocal(token): { userId, error }` con whitelist de algoritmos hardcoded
2. Tests de paridad: 100 tokens reales × `verifyAuthLocal` debe matchear `getUser` 100/100
3. Aplicar a `/api/v2/answer-and-save` con feature flag `JWT_LOCAL_VERIFY_ENABLED=false`
4. Shadow log: ejecutar AMBAS verificaciones en paralelo durante 1-2h, log si discrepa
5. Activar flag en producción, observar 2-4h sin parar
6. Migrar resto endpoints hot path uno por uno

**Esfuerzo:** 6-9h trabajo + observación

**Cuándo abordarlo:**
- Cabeza fresca, sesión dedicada
- NO viernes (BD admin disponible si algo va mal)
- Bloque de 4-6h sin otros cambios críticos en flight
- Memo detallado: `~/.claude/projects/-home-manuel/memory/vence_jwt_local_verify_phase07.md`

---

## Fase 1 — Redis cache (Upstash) ✅ COMPLETA (2026-05-02)

**Objetivo:** que el 80%+ de las requests no lleguen a BD.

**Setup:**
- Upstash Redis serverless (gratis hasta 10k commands/día, ~$10/mes para 100k usuarios)
- `lib/cache/redis.ts` con `getOrSet(key, ttl, fetcher)` (cache-aside) + `getCached/setCached` (patrón stale-fallback)
- Fallback a BD si Redis está down (timeout 100ms)

| # | Endpoint | Estado | Detalle |
|---|---|---|---|
| 1 | `/api/v2/user-stats` | ✅ Hecho (commit 9262954c) | TTL 30s, key `user_stats:{userId}`, invalidación tras INSERT en `test_questions` |
| 2 | `/api/v2/profile` | ⏭️ Skip | `Cache-Control: no-store` deliberado (cambios deben ser inmediatos) |
| 3 | `/api/daily-limit` | ⏭️ Skip | Ya tiene cache premium-only in-memory (anti-fraude). Mover a Redis añadiría riesgo de bypass freemium sin beneficio claro |
| 4 | `/api/exam/pending` | ✅ Hecho (commit 9262954c) | TTL 30s, key segmentada por testType+limit, invalidación tras INSERT/UPDATE en `tests` |
| 5 | Catálogos oposiciones/leyes/themes | ⏭️ Skip | Ya cubiertos por Next.js `unstable_cache` con tags (`temario`, `teoria`, `laws`, `landing`). Manual: `docs/maintenance/cache-revalidation.md` |
| 6 | `/api/v2/topic-progress/theme-stats` | ✅ Hecho (commit a0ef3078) | Promovido de Map in-memory → Redis. Patrón "fresh 5min + stale fallback 24h" para query pesada (16s en heavy users). Invalidación tras INSERT en `answer-and-save`. |

**Salvaguardas implementadas:**
- Feature flag `REDIS_CACHE_ENABLED=false` para desactivar instantáneo
- Timeout 100ms en cada GET/SET — si Redis lento, cae a BD sin penalizar
- Fire-and-forget en SET — no bloquea la respuesta del usuario
- Stale fallback en theme-stats — datos viejos > pantalla vacía si BD timeout

---

## Fase 2 — Outbox pattern (sustituir triggers pesados) ⏳ PENDIENTE

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

## Fase 3 — Pool split / read replica 🟡 PARCIAL

**Objetivo:** aislar lecturas pesadas de escrituras críticas.

**Pool split (sin replica, $0):**
```typescript
getWriteDb()  → max:1, timeout 5s   // ⏳ PENDIENTE — hoy `getDb()` cubre lectura+escritura
getReadDb()   → max:1, timeout 3s   // ⏳ PENDIENTE
getAdminDb()  → max:4, timeout 60s  // ✅ HECHO — usado por crons (3 migrados commit 76dc3ffb + avatar 2026-05-03)
```

Una stats lenta no bloquea un INSERT de respuesta.

**Read replica (decisión de negocio, ~$30/mes extra):** ⏳ PENDIENTE
- Supabase Pro permite 1 read replica
- `getReadDb()` apunta a la replica → admin/stats no compiten con OLTP
- Latencia: ~100ms behind primary (acceptable)

---

## Fase 4 — Async queues para escrituras no críticas ⏳ PENDIENTE

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

## Fase 5 — Data warehouse para analytics ⏳ PENDIENTE

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
- **Slow query log de Supabase** activado y revisado weekly (Dashboard → Database → Query Performance) — ⏳ Pendiente
- **Alertas en Sentry** (no solo logging — que avise por email cuando algo se sale de baseline) — ⏳ Pendiente
- **Cron de revisión semanal**: query a `validation_error_logs` agrupando por endpoint/severity, email con top 10 si hay critical > N — ⏳ Pendiente
- **Endpoint `/api/admin/health`** simple que devuelve estado de Postgres, Redis (Fase 1+), outbox lag (Fase 2+) — para uptime monitor externo (UptimeRobot $0) — ✅ HECHO (commit a270f267, ampliado con DB stats / queues / crons / incidents). Pendiente conectar UptimeRobot.
- **Tabla `cron_runs` + helper `runCronWithLogging`** para observabilidad de crons — ✅ HECHO (commit a270f267)

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
- `/api/random-test/availability` (14 critical en 24h) → ⏳ pendiente
- `/api/v2/user-stats` (4 critical en 24h) → ✅ Mitigado vía Fase 1 Redis cache (TTL 30s + invalidación)
- `/api/v2/answer-and-save` (78 warnings, "respuesta lenta") → 🟡 Bajado por triggers optimizados (Fase 0.1/0.2/0.6) pero sigue con outliers 7-10s ocasionales — Fase 2 outbox lo arreglará del todo

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

## Deuda técnica detectada (auditoría 2026-05-02 noche)

Hallazgos durante la investigación a fondo del trigger #9 (`user_learning_analytics`). Priorizado por impacto e inversión.

### 🔴 Dead code activo (impacto en producción)

| Item | Detalle | Acción | Esfuerzo |
|---|---|---|---|
| Funciones SQL nunca llamadas | `predict_exam_readiness(user, opos)`, `get_complete_test_analytics(test_id)`, `detect_learning_style(user)`, `get_user_recommendations()` (esta última documentada como "PLACEHOLDER" desde hace meses). 0 callers en TS/JS/SQL. | DROP FUNCTION en migración tras 2-4 sem de monitorización post-Fase 0.6 | 30min |
| Columnas dead-write en `user_learning_analytics` | `article_performance_history jsonb` (0 filas con datos, jamás se llenó). `current_weak_areas`, `peak_performance_hours`, `worst_performance_hours`, `best_day_of_week` (58k pobladas pero 0 lectores). | Tras 2 sem sin reclamaciones tras 0.6, DROP COLUMN o DROP TABLE entera | 30min |
| Índices GIN sobre `tests.detailed_analytics` y `tests.performance_metrics` (jsonb) | `idx_tests_analytics`, `idx_tests_performance`. Sospechoso a auditar: ¿alguien consulta esos JSONB? Si no, son coste puro de escritura/storage en una tabla caliente. | Auditar lectores → si 0, DROP INDEX | 1h |

### 🟡 Anti-patrones arquitectónicos

| Item | Detalle | Acción | Esfuerzo |
|---|---|---|---|
| Doble taxonomía de "mastery_level" sin fuente de verdad | `user_learning_analytics.mastery_level`: `beginner\|intermediate\|advanced\|expert` vs `useTopicUnlock.ts` + `temario/schemas.ts`: `beginner\|good\|expert`. Dos sistemas que no se hablan. | Decidir taxonomía única tras eliminar la tabla muerta. Documentar en CLAUDE.md | 2h (decisión + refactor) |
| `motivationalAnalyzer.getUserAnalyticsData` hace `fetch('/api/user/question-history')` desde el servidor | Llama a su propio API por HTTP en lugar de invocar `getUserAnalytics` de `lib/api/questions/queries.ts`. Overhead innecesario + frágil en SSR (URLs relativas). | Refactor: importar y llamar la fn directamente | 1-2h |
| Patrón "trigger pesado en tabla caliente" repetido 9 veces | El equipo escogió Postgres triggers como motor de analytics. A escala chica funcionaba; a 100k DAU es la causa raíz que estamos apagando. **Lección:** los nuevos analytics deben ir vía outbox/cron desde el principio (Fase 2). | Documentar en CLAUDE.md como regla: **NUNCA añadir trigger pesado en tablas calientes**. Toda nueva agregación va a outbox o vista materializada con cron. | 15min (doc) |
| `verify_triggers_working()` SQL fn no integrada en `/api/admin/health` | La función existe para diagnóstico pero la construimos en Fase 0.3 sin enchufarla. | Añadir sección `triggers` al endpoint health | 30min |

### 🟢 Higiene del repo

| Item | Detalle | Acción | Esfuerzo |
|---|---|---|---|
| ~500 archivos `_tmp_*.cjs` y `_tmp_*.json` en raíz | Scripts de migración históricos sueltos. Ensucian `git status`, lentifican IDEs, riesgo de `git add .` accidental. | Mover a `scripts/archive/` y añadir `_tmp_*` y `*_galicia_*` a `.gitignore` | 30min |
| Archivos sin extensión en raíz (`Artículo`, `El`, `La`, `De`, `Esta`) | Outputs de scripts de scraping. | Borrar | 5min |
| `docs/database/tablas.md` desactualizado | Sigue marcando triggers #2/#3/#4/#5/#7/#9 como "PRINCIPAL" cuando ya están neutralizados/migrados a debounced. Confunde a nuevos colaboradores. | Sección "Estado de triggers (2026-05-02)" con tabla actual. Tachar "PRINCIPAL" donde ya no aplique. | 1h |

### Consolidado de inversión

- **Quick wins (totales):** ~3-4h trabajo, $0 coste, deuda técnica reducida significativamente
- **Recomendado:** atacar tras la verificación 0.5 (p95 baja en producción) para no mezclar ruido. La auditoría de los índices GIN en `tests.*` puede revelar más ahorro de escritura.

---

## Hard gaps para escalar a 10k DAU (auditoría 2026-05-03)

Estimación honesta de qué REVENTARÍA a 10k DAU si no hacemos nada. Distinto de "deuda técnica" — esto es trabajo necesario, no oportunidades estéticas.

### Math básico que justifica todo lo demás

| Métrica | Hoy (~1k DAU) | A 10k DAU | Multiplicador |
|---|---|---|---|
| test_questions/día | ~5-10k | ~1M (100/user) | 100-200x |
| test_questions cumulado / 30 días | +200k | +30M | 150x |
| Bytes/día en test_questions | ~30 MB | ~3 GB | 100x |
| Auth round-trips (`supabase.auth.getUser`) | ~50k/día | ~5M/día | 100x |
| Concurrent lambdas pico | ~10-30 | ~200-500 | 15-20x |
| BD requests/segundo pico | ~10-30 | ~200-500 | 15-20x |

### 🔴 Top 5 que NO escalan (orden de impacto)

| # | Gap | Cuándo revienta | Esfuerzo | ROI |
|---|---|---|---|---|
| 1 | **JWT verify con round-trip a Supabase Auth** en cada request autenticada (~250ms × 5M/día = 350h latencia agregada). El propio shadow log de `/api/profile` ya hace decode local sin verificar firma — extender a verificación con JWKS cacheado | 3-5k DAU | 4-6h | **Brutal** — baja TODOS los endpoints autenticados |
| 2 | **Pool max:1 en endpoints/crons que deberían usar `getAdminDb` (max:4)** — 3 crons migrados (commit 76dc3ffb) + 1 hoy (avatar). Faltan auditar el resto. Cada cron lento con `getDb` monopoliza el pool de usuarios → cascada 504 | 3-5k DAU | 2-3h auditoría + N migraciones triviales | Alto |
| 3 | **Cron batch LIMIT 100 vs tasa de inserción** — hoy 28k procesados/día sobra; a 10k DAU son 1M inserciones → 1M `stats_dirty` marks → backlog crece +972k/día. Subir LIMIT a 1000 o cron 1min, validar que no causa lock contention (incidente 2 may 17:14 fue por esto con LIMIT 500) | 5-7k DAU | 1h ajuste + monitorización | Medio |
| 4 | **Tablas grandes sin partitioning ni TTL** — test_questions 2.2 GB → 30 GB/mes a 10k DAU. validation_error_logs / notification_events / email_events crecen sin parar. Quick wins: TTL >90 días en eventos. Estructural: partitioning declarativo de test_questions por mes (ya en Fase 3 roadmap) | 5-7k DAU para TTL, 7-10k para partitioning | TTL = 1h, partitioning = 4-8h | Alto a medio plazo |
| 5 | **NO hay read replica** — todo va al primario. Reads de stats/catálogos compiten con INSERTs/UPDATEs por IO. Endpoints SOLO lectura (user-stats, exam/pending, ranking, theme-stats, catálogos) deberían usar réplica. Ya mencionado en Fase 3 del roadmap | 5-7k DAU (saturación primario) | 1-2 días | Crítico para últimos 3-5k DAU |

### 🟡 Top 5 segunda capa (necesarios pero no urgentes)

| # | Gap | Notas |
|---|---|---|
| 6 | **Cache invalidation rompe Redis para usuarios activos** — invalidamos `user_stats:{user}` tras cada answer → activos = cache miss permanente. Considerar **NO invalidar y solo TTL 30s** (datos hasta 30s viejos, aceptable para stats) | A 10k DAU activos hace que la inversión Redis sea inútil para ellos |
| 7 | **Auditoría freemium** (`increment_daily_questions` vulnerable a bypass desde cliente — ya en MEMORY como pendiente) | A 10k DAU el impacto monetario crece linealmente |
| 8 | **Triggers que aún escanean `tests`/`questions`** — `update_user_question_history` hace JOINs. A 1M INSERTs/día = 1M JOINs adicionales | Reducir, materializar agregados, o mover a outbox (Fase 2 roadmap) |
| 9 | **`tests.detailed_analytics` + `performance_metrics` JSONB con índices GIN** — ya flagged en deuda técnica. Si nadie los lee, DROP INDEX | Cada UPDATE en tests recompone el GIN — coste puro |
| 10 | **Daily-limit hace 2 queries secuenciales** (`getDynamicLimit` + RPC `get_daily_question_status`). Podría ser 1 RPC unificada | A 10k DAU = 10M queries/día evitables |

### 🟢 Hard gaps menos críticos

| # | Gap | Notas |
|---|---|---|
| 11 | **Rate limiting per user** — cualquier abuser puede hammer y degradar a otros | Upstash ratelimit, 5 líneas de código |
| 12 | **Doble request a `/api/profile` por usuario** (200-300ms apart, sin Bearer) — completar migración shadow auth (paso 5/7) y deduplicar en cliente | Hoy son 2x peticiones inútiles por user |
| 13 | **Webhook idempotency Stripe** — si una webhook se reentrega, ¿dobles el premium? Audit | Riesgo monetario raro pero existe |
| 14 | **`force-dynamic` pages sin stale-while-revalidate ágil** — al invalidar el cache, herd de visitantes hits BD a la vez | A 10k DAU una invalidación de catálogo en hora pico = pico de carga |
| 15 | **Búsqueda con LIKE en vez de FTS** (si existe buscador, no he auditado) | A 10k DAU + corpus grande, LIKE va a doler |

### Orden de ataque recomendado

Si solo pudieras hacer 3 cosas para escalar a 10k, en este orden:

1. **JWT local verify** (#1) — ROI brutal, 4-6h, baja todos los endpoints autenticados ~250ms
2. **Auditoría completa de getDb→getAdminDb** (#2) — 2-3h, elimina causa raíz de cascadas 504
3. **TTL de tablas de eventos + plan de partitioning de test_questions** (#4) — 1h TTL inmediato, partitioning planificado para 1-2 meses vista

Con esos 3 sobrevivimos hasta ~5-7k DAU. Para los últimos 3-5k DAU hace falta el **read replica** (#5).

### Cómo encaja con las 6 fases del roadmap

| Hard gap | Fase del roadmap donde encaja |
|---|---|
| #1 JWT local verify | Nueva: **Fase 0.7** (Estabilizar) — quick win, no encaja en otras fases |
| #2 getDb→getAdminDb audit | Fase 0 (Estabilizar) — ya en proceso, falta cerrar auditoría |
| #3 Cron batch size | Fase 2 (Outbox) — coincide con replanteamiento de async |
| #4 TTL eventos + partitioning | TTL = Fase 0.7 quick win, partitioning = **Fase 3** o **Fase 5** |
| #5 Read replica | **Fase 3** (Pool split / read replica) — ya mencionada |
| #6 Cache invalidation refactor | Fase 1 (cierre, TODO añadido) |
| #7 Auditoría freemium | Independiente, ya en MEMORY como pendiente |
| #8 Triggers que escanean | Fase 2 (Outbox) |
| #9 GIN sospechosos | Fase 0.7 quick win |
| #10 Daily-limit 2 queries | Fase 0.7 quick win |

---

## Histórico de decisiones

| Fecha | Decisión | Razón |
|---|---|---|
| 2026-05-02 | Adoptar este roadmap | 504 timeouts en producción + objetivo 100k usuarios |
| 2026-05-02 | Trigger #7 NO-OP en lugar de DROP | Reversibilidad inmediata si algún sistema externo lo necesita |
| 2026-05-02 | Pool split antes que subir max:1 | El problema antiguo (261 events Supavisor exhaustion 27 abr) volvería al subir max |
| 2026-05-02 | Outbox híbrido (no full async) | Preservar UX en tiempo real (stats, streak); solo lo pesado va async |
| 2026-05-02 | Cache in-memory para availability en Fase 0.4 (no Redis) | Quick win sin dependencia externa; tras Fase 1 se promueve a Redis L2 |
| 2026-05-02 | NO cachear /api/profile en Fase 0.4 | Tiene Cache-Control: no-store deliberado; cambios deben ser inmediatos |
| 2026-05-02 | Pool fix data-integrity/validate (getDb→getAdminDb) | Identificado en Fase 0.3 con pg_stat_statements; 1 línea, riesgo cero |
| 2026-05-02 | Fase 0.2 SOLO trigger #2 (no #3 #4 todavía) | Triggers #3/#4 escriben en `questions.global_difficulty` con 2 algoritmos paralelos diferentes (#B `calculate_question_global_difficulty` desde question_first_attempts vs #C `calculate_global_law_question_difficulty` desde law_question_first_attempts). Bug preexistente. Resolverlo requiere decisión de negocio: ¿qué algoritmo es el correcto? Por ahora solo se ataca el trigger #2 que es autónomo. |
| 2026-05-02 | Aplicar Fase 0.2 inmediato pese a riesgo medio | Ráfaga de 504 timeouts en producción (10:51-11:21 UTC) con CONNECT_TIMEOUT a Supavisor confirmado. Trigger #2 era ~283ms/INSERT, contribuía al pool exhaustion. Algoritmo verificado byte-exact, rollback en 5s, riesgo justificado. |
| 2026-05-02 | Trigger #9 simplificado en lugar de DROP trigger entero | Mantener `is_active_student=true` (parte ligera del trigger) por preservar feature de marca de "usuario activo" en `user_profiles`. La tabla `user_learning_analytics` queda CONGELADA con sus 58k filas históricas en lugar de truncarla, por reversibilidad. |
| 2026-05-02 | Aplicar Fase 0.6 sin esperar verificación 0.5 | Warnings 4-9.6s en `/api/v2/complete-test` tenían causa raíz idéntica a #7 (trigger con aggregate scans de tabla caliente, dead-write verificado). Riesgo idéntico, parity confirmado. |
| 2026-05-03 | Migrar crons recalc-*-difficulty a Vercel Cron, mantener GH Actions como backup | GH Actions cron es best-effort: corrió 12 veces en 24h en lugar de ~288 (`*/5 * * * *`). Avg interval 70min (debería 5min). Vercel Cron es puntual al segundo. Doble disparo seguro por `pg_try_advisory_xact_lock`. Coste 576 invocations/día (negligible Pro). Backlog 2877 stats_dirty creciendo era el síntoma. |
| 2026-05-03 | Migrar `calculateBulkUserProfiles` (cron avatar) a `getAdminDb` + `maxDuration` 300s | Weekly Avatar Rotation falló 04:00 UTC con timeout 1m3s. Función procesa cientos de usuarios con 2 aggregate scans pesadas (extract hour + 8 SUMs por user) y usaba pool max:1, monopolizando conexiones. Mismo patrón que commit 76dc3ffb. |
| 2026-05-03 | Reset `pg_stat_statements` post-deploy de optimizaciones | Stats acumulaban desde 2026-03-01 (2 meses). Medias mostraban 8.4s en queries que post-optimización corren en 50-160ms. Sin reset es imposible distinguir mejoras reales de fantasmas históricos. Manual `revisar-errores-fallos.md` actualizado con esta lección como "Trampa #1". |
| 2026-05-03 | Auditoría 10k DAU añadida al roadmap como sección dedicada | Identificados 15 hard gaps en 3 niveles (5 críticos / 5 segunda capa / 5 menos críticos). Top 3: JWT local verify, audit getDb→getAdminDb, TTL eventos. Permite priorizar trabajo de Fase 0.7 (nueva) y completar Fases 1-3 con foco. |
| 2026-05-03 | Rotación de password Supabase post-leak GitGuardian | Hardcoded DATABASE_URL en `__tests__/api/user-stats/userStatsSummary.test.ts` salió por git history → GitGuardian alert. Fix: REQUIRE env var (no fallback). Lambdas warm en Vercel mantuvieron pool con password viejo ~1h hasta reciclado → SASL_SIGNATURE_MISMATCH transitorio. Lección documentada: tras rotar password siempre force-redeploy en Vercel. |
| 2026-05-03 | Activar Supabase Custom Domain `auth.vence.es` ($10/mes) | Quitar el project ID del consent screen de Google OAuth. Mejora confianza de signup. Configurado vía CNAME, propaga PostgREST/Auth/Storage transparente. **Solo en producción** (Vercel env vars) — NO en `.env.local` para evitar problemas de scope cookies/CORS en dev. |
| 2026-05-03 | Fix One Tap nonce: generar nonce + SHA-256, pasar hash a `Google.accounts.id.initialize` y raw a `signInWithIdToken` | FedCM exige nonce verificable en el id_token. Sin esto, signInWithIdToken rechaza el token con "nonce mismatch". `components/GoogleOneTap.js` actualizado con `crypto.subtle.digest('SHA-256', ...)`. |
| 2026-05-03 | Retirada COMPLETA del sistema push notifications (12 fases, ~12k líneas) | "Push es invasivo, los users prefieren email" (decisión de producto). Fases: workflow GH Actions desactivado → broadcast schema solo email → admin pages eliminadas → endpoints push DELETE → libs/services + tests + npm dep `web-push` + service worker NO-OP self-unregister. Pendiente solo Fase 11: DROP TABLES (`user_notification_settings`, `notification_events/logs/metrics/templates`, `user_notification_metrics` + 2 views) — esperar 24-48h sin código nuevo, backup previo. |
| 2026-05-03 | REVOKE EXECUTE `assign_role(uuid,text)` FROM authenticated | Defense in depth post-Linter Supabase. La función ya tenía guard interno (`is_current_user_admin()`), pero quitar el grant a authenticated reduce blast radius. service_role mantiene acceso por bypass RLS. |
| 2026-05-03 | DELETE stack admin sentry-issues (badge + hook + endpoint) | Audit reveló 0 callers reales. Badge en Header, hook `useSentryIssues`, endpoint `/api/admin/sentry-issues` huérfanos. -230 líneas. Sentry sigue activo via `@sentry/nextjs`, solo eliminada la integración admin custom. |
| 2026-05-03 | Cierre RLS `payout_transfers` (DROP 2 policies USING(true) + REVOKE all anon/authenticated) | Cierre del refactor 25d9a175 (2 may): `/armando` y `/admin/cobros` ahora son server-side con service_role. Auditado: 0 callers de Supabase JS browser sobre la tabla, 0 queries en `pg_stat_statements` desde reset. Migración `20260503_payout_transfers_close_rls.sql` aplicada. Cierra **fuga financiera severa** (datos de payouts eran legibles por anon). |
| 2026-05-03 | Audit `is_current_user_admin()` → NO TOCAR | 10 callers legítimos (Header badges, UserAvatar, ProtectedRoute, finance/auth, 5 paneles admin). Función bien diseñada: returns boolean, sin side effects, `EXECUTE TO authenticated` es by design (los users normales reciben `false`). Documentado en Sprint 1.4 para no re-auditar. |
| 2026-05-03 | BOE cron `check-boe-changes` — time budget guard 50s | 504 timeout a las 11:21 UTC: cuando BOE va lento, fetches caen al timeout 10s × 42 chunks > 60s `maxDuration`. Fix: break del loop si `Date.now() - startTime > 50s`, log `⚠️ parcial (time budget)`. Las leyes pendientes las recoge el siguiente run (filtro `last_checked < hoy` ya existe). Riesgo 0, graceful degradation. |
| 2026-05-03 | Investigación a fondo de Fase 0.7 (JWT verify) — pausada para sesión dedicada | 24 warnings/h `answer-and-save` 2-4s persistentes pese a Fases 0.1/0.2/0.6. Trace confirma cuello principal en `supabase.auth.getUser()` (250-1000ms) — NO triggers. Fase 0.7 daría p50 1.5s→0.5s, p99 4s→1.5s. Riesgos analizados (algorithm confusion, banned users, key rotation, custom claims) — no eliminables 100%. **Decisión: NO empezar tarde/cansado/viernes en código crítico de seguridad**. Sección "Fase 0.7" del roadmap ampliada con plan completo. Memo `vence_jwt_local_verify_phase07.md`. |
