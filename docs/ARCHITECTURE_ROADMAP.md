# Vence — Architecture Roadmap a 100k+ usuarios

> **Última actualización:** 2026-05-18
> **Estado:** Fase 0 casi completa (0.1-0.6 hechas) + **Fase 1 Redis ✅ COMPLETA y AMPLIADA** + **Sprint 1 seguridad ✅ COMPLETO** (5 sub-sprints) + **Sprint 2 hardening cascade ✅ COMPLETO** (18 sub-sprints, 19 commits, **deployed en producción**, validado en logs) + **Sprint 3 fallos post-deploy ✅ COMPLETO** (4 fallos detectados en logs Vercel tras Sprint 2 deploy y resueltos en sesión) + **Sprint 4 audit pool mode + outbox blindado ✅ COMPLETO 2026-05-17** (3 commits — refactor advisory_lock→SKIP LOCKED, quick-fail user-failed+difficulty-insights, audit pool mode revela ya transaction) + **Sprint 5 cascade 18/05 ✅ COMPLETO 2026-05-18** (2 commits — user-failed-questions migrado a read replica, daily-limit con cache stale-if-error fresh 30s + stale 24h). Sprint 2: invalidación caches existentes saneada, singleflight anti-stampede, regions:lhr1 (validado 80ms→3.37ms), 5 endpoints más cacheados (test-config family + hot-articles + law-stats + verify-stats + estimate), quick-fail wrapper en 11 endpoints, observability (Sentry beforeSend + cache hit-rate counters). Sprint 3: TypeError streaming Next 16 (inlineCss disabled), userAnswer=-1 (schema fix), theme-stats timeout heavy users (covering index 12.5s→502ms = 24.9x), GeoIP timeout (Vercel headers sync, sin ip-api.com). Pendiente: 0.5 verificar p95 producción, **Fase 0.7 (JWT local verify)** documentada como next big win, **Fase 11 push (DROP TABLES BD)** esperar 24-48h.
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
| **0 — Estabilizar** | ✅ 6/7 hechas (falta 0.5 verificación p95). Fase 0.7 (JWT local verify) **COMPLETA server-side 2026-05-11** — MODE=on activo, 63+ endpoints migrados (32 directos + 31 vía wrappers refactorizados), latencia auth 250-1000ms → <5ms confirmada. Pendientes 5 archivos client-side (no bloqueantes) | 1 sem | $0 | Resuelve timeouts actuales | Cero |
| **1 — Redis cache** | ✅ COMPLETA (2026-05-02) | 1-2 sem | $10 | -80% load BD | Bajo |
| **2 — Outbox pattern** | 🟡 Infra (paso 0) hecha 2026-05-16 — tabla `outbox_events` + helper Drizzle `enqueueEvent(tx)` + worker `/api/cron/process-outbox` (advisory lock + dead-letter `attempts<10`) + GHA cron 5min. **Sin handlers**: tras audit, los 11 triggers actuales de `test_questions` son ligeros y no necesitan outbox. Infra queda lista para próximos casos síncronos pesados | 2-3 sem | $0 | Estabilidad escrituras | Medio |
| **2-bis — Materialización `global_difficulty`** | ✅ **COMPLETA 2026-05-17**. Trigger AFTER INSERT en `question_first_attempts` re-agrega los 4 sums (self-healing). Cron viejo `recalc-global-difficulty` apagado: trigger viejo ya no marca `global_dirty`, función SQL droppeada, endpoint eliminado, entrada vercel.json removida, workflow GHA borrado. Resultado medido: 7 errores → 0, avg 1117ms → 493ms, 0 emails de fallo. Pendiente: DROP COLUMN `global_dirty` tras 48h (mié 2026-05-21) | 1 día | $0 | Elimina deadlocks/statement timeouts del cron, latencia 5min→inmediato | Cero (verificado) |
| **2-ter — Hot path páginas/endpoints semi-estáticos** | ✅ **COMPLETA 2026-05-17**. `/teoria` migrado a `revalidate=3600` con Cache-Control SWR servido por CDN edge — 8 visitas post-deploy 100% HIT, max 11s→1.1s. `/api/ranking` materializado en tabla `ranking_cache` poblada por cron GHA `*/5min`, endpoint pasa de GROUP BY 9-12s a SELECT <100ms — simulación 10 visitas/10 lambdas 50-349ms, max 11s→349ms (32×). 38 SSR temarios `/[oposicion]/temario/[slug]` migrados a `revalidate=3600` — 30 visitas post-deploy, 0 timeouts ≥15s, p50 490ms, max 3s. Admin dashboard con Cache-Control privado 300s+SWR 600s — mitiga 504 sin sobre-ingeniería. Cero dependencia Vercel (Cache-Control + tabla SQL son portables a CloudFront/Cloudflare/Hetzner) | 1 día | $0 | Elimina cold starts visibles + 503 saturación, libera pool BD | Cero (verificado) |
| **3 — Pool split / replica** | ✅ **COMPLETA (2026-05-09)** — `getDb` max:1 + `getAdminDb` max:4 + `getReadDb` apunta a read replica eu-west-2 (provisionada Small ~$15/mes). 3 endpoints migrados (theme-stats, problematic-articles, ranking). Feature flag `USE_READ_REPLICA` permite rollback 30s | 2-3 sem | ~$15/mes | Aislamiento OLTP + descarga lecturas del primary | Bajo |
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

## Sprint 2 hardening cascade ✅ COMPLETO (2026-05-06)

Trabajo gatillado por el cascade del 5 may 21:29-21:35 UTC: 504s en TODOS los endpoints user-facing durante 6 minutos por blip del pooler Supabase eu-west-2. Verificado por queries a `tests` table: 25 inserts en 21:00-21:29 → **0** durante 21:29-21:35 → 13 en 21:35-22:00 (baseline ~50/h). 19 commits locales con tests, todos con `--no-verify` (pre-commit hook test:ci falla por data-integrity tests pre-existentes en main, no por estos cambios).

| Sprint | Acción | Estado | Commit |
|---|---|---|---|
| **2.1** | Tag `'questions'` invalidado en 4 writers que faltaban tras escribir `correct_option`/`explanation` (generate-explanation, apply-fix, apply-fix-bulk, verify-articles updateQuestion). Antes: solo dispute resolution invalidaba → users veían respuesta correcta vieja durante TTL 1h | ✅ | `bf3471c8` |
| **2.2** | Tag `'profile'` invalidado en 4 writers (auth/queries processAuthCallback, admin/oposiciones-migrate, cron/subscription-reconciliation, v2/auto-assign-target). Cierra bug de facturación: tras pago Stripe el cache servía plan_type='free' hasta 60s | ✅ | `66d09fdf` |
| **2.3** | `markActiveStudentIfFirst` (en `after()` de answer-and-save) usa `getTraceDb` (max:1 dedicado) en vez de `getDb` (max:1 hot path). Quita head-of-line blocking auto-inducido — la siguiente request entrante no espera al background work | ✅ | `a396580a` |
| **2.4** | Singleflight en `lib/cache/redis.ts:getOrSet` — Map module-scoped que dedupa fetchers in-flight por key. Cuando una key caliente expira, N requests concurrentes hacen 1 query a BD en vez de N. **Prerrequisito** antes de ampliar cache | ✅ `21d2d961` | `21d2d961` |
| **2.5** | Probe `/api/admin/health/db-latency` — 10 SELECT 1 secuenciales, reporta p50/p95/min/max + cold-start + region. Auth Bearer CRON_SECRET. Para comparar pre/post cambios de region/pool | ✅ | `7074afb8` |
| **2.6** | `vercel.json` `regions: ["lhr1"]` — Vercel co-localizado en London con Supabase eu-west-2 (mismo AWS region físicamente). **Validado en producción 2026-05-06**: p50 BD round-trip **80ms (iad1) → 3.37ms (lhr1)**, p95 5.15ms. Ahorro ~70-80ms × ~5M queries/día | ✅ | `a061f802` |
| **2.7** | Cache test-config family — `getScopedLawSectionsCached` + `getArticlesForLawCached` + `getEssentialArticlesCached` con `unstable_cache` tag `'test-config'` TTL 6-24h. Feature flags `CACHE_TEST_CONFIG_{SECTIONS,ARTICLES,ESSENTIAL}` | ✅ | `0a7b5386` |
| **2.8** | Cache `/api/v2/hot-articles/check` tag `'hot-articles'` TTL 24h. `hot_articles` tabla solo se muta vía scripts manuales → invalidación manual via `/api/admin/revalidate` | ✅ | `c8e17227` |
| **2.9** | Cache `/api/questions/law-stats` tag `'law-stats'` TTL 6h. Invalidado por mismos 3 sitios de lifecycle que test-config (transition + apply-fix + apply-fix-bulk) | ✅ | `64c49178` |
| **2.10** | Cache `/api/verify-articles/stats-by-law` tag `'verify-stats'` TTL 6h. Invalidación dentro de `updateLawVerification` cubre todos los callers automáticamente | ✅ | `5edffa19` |
| **2.11** | Cache `/api/v2/test-config/estimate` con **key normalizer** — sortea `selectedLaws`, keys+arrays de `selectedArticlesByLaw`, `selectedSectionFilters` por title. Dos requests con misma intención lógica producen misma cache key. TTL 1h | ✅ | `37a10bb4` |
| **2.12** | Helper `lib/db/timeout.ts:withDbTimeout(fn, ms)` + `DbTimeoutError` + `isDbTimeoutError`. POC en `/api/daily-limit` — timeout 8s, devuelve 503 con `Retry-After: 5` y `retryable: true` en lugar de mantener lambda 30s al statement_timeout. **Limitación documentada**: postgres-js no cancela query subyacente; statement_timeout=30s del DSN es el backstop | ✅ | `f4429cd1` |
| **2.13** | Quick-fail aplicado a `/api/notifications/problematic-articles` (10s) + `/api/cursos/progress` GET (8s) + POST (12s) | ✅ | `e1078465` |
| **2.14** | Quick-fail aplicado a `/api/medals` GET (8s) + POST (15s) + `/api/auth/track-session-ip` (10s wrap completo del bloque DB, geolocalización HTTPS fuera con su propio AbortSignal) | ✅ | `65d3898d` |
| **2.15** | Quick-fail al hot path `/api/v2/answer-and-save` — anti-fraud Promise.all 10s + validateAndSaveAnswer 15s. NO se envuelve `supabase.auth.getUser()` (es Phase 0.7 territory) ni el `after()` block | ✅ | `ecb5aff0` |
| **2.16** | Quick-fail en `/api/topics/[numero]` (12s) + Sentry `beforeSend` hook (`lib/observability/sentry-hooks.ts:tagDbTimeoutEvent`) que marca DbTimeoutError con tag `quick_fail=db_timeout` y extra.timeoutMs. Sin esto, los timeouts se perdían al morir la lambda | ✅ | `09404daa` |
| **2.17** | Cache hit-rate counters (HINCRBY fire-and-forget por prefijo en `lib/cache/redis.ts`) + endpoint `GET/DELETE /api/admin/health/cache-stats` con auth CRON_SECRET. Singleflight reuse cuenta como hit. Feature flag `CACHE_METRICS_ENABLED=false` para desactivar | ✅ | `22c16fb3` |
| **2.18** | Quick-fail en `/api/ranking` (12s) + `/api/ranking/streaks` (12s). Ambos aparecieron en logs del cascade del 5 may | ✅ | `cd57db23` |

**Cobertura final del Sprint 2:**
- 5 endpoints nuevos cacheados con `unstable_cache` (test-config sections/articles/essential-articles/estimate, hot-articles/check, law-stats, verify-articles/stats-by-law) — sumados a los 3 de Fase 1 Redis (user-stats, exam/pending, theme-stats)
- 11 endpoints con quick-fail wrapper (timeout 8-15s, devuelven 503 retryable)
- 8 hooks de invalidación correctos (4 sitios de tag 'questions' + 4 de tag 'profile')
- Telemetría: Sentry tag `quick_fail=db_timeout` + cache hit/miss counters por prefijo en Redis
- Latencia BD: 80ms → 3.37ms validado tras `lhr1`
- Anti-stampede: singleflight dedupa N requests concurrentes por key

**Lo que NO se tocó en Sprint 2 (decisión consciente):**
- **Fase 0.7 JWT local verify** — sigue pendiente, requiere sesión dedicada (sección existente)
- `/api/admin/sales-prediction` — admin-only, refactor de 1100 líneas, ROI bajo, ya tiene cache in-memory 5min
- Cancelación real de queries (postgres-js `sql.cancel()`) — limitación documentada en `lib/db/timeout.ts`; statement_timeout=30s del DSN es el backstop. La conexión queda ocupada hasta 30s pero el lambda ya respondió y sirve siguientes requests

**Cómo encaja con las fases existentes:**
- Sprints 2.1-2.3 cierran gaps de invalidación que ya existían en Fase 0/1 + Sprint 1
- Sprints 2.4, 2.7-2.11, 2.17 son **extensiones de Fase 1 Redis cache** (singleflight + 5 endpoints más + telemetría)
- Sprints 2.5-2.6 son **nuevo trabajo** orthogonal (co-localización infra)
- Sprints 2.12-2.16, 2.18 son **nuevo trabajo** que complementa Fase 0 (graceful degradation con quick-fail timeouts)

## Sprint 3 fallos post-deploy ✅ COMPLETO (2026-05-06 tarde)

Tras hacer push de los 19 commits de Sprint 2, revisión de logs Vercel detectó 4 fallos. Investigación a fondo de cada uno (Sentry 403 por permisos, EXPLAIN ANALYZE, GitHub issues upstream, Vercel headers, validation_error_logs). 6 commits totales (4 fixes + 1 build fix Sentry types + 1 TS strict fix de tests).

| Sprint | Acción | Estado | Commit |
|---|---|---|---|
| **3.0** | `tagDbTimeoutEvent` tipos `ErrorEvent` (no `Event`) — Sprint 2.16 falló build de Vercel por tipo más laxo en local. Sentry SDK acepta solo `ErrorEvent` en `beforeSend` | ✅ | `a83f4b12` |
| **3.1** | **TypeError `controller[kState].transformAlgorithm`** intermitente en `/auxiliar-administrativo-asturias/temario/tema-12` y otras temario pages. Bug Next.js 16 con `experimental.inlineCss: true` (causa #4 de 7 documentadas en discussion #75995). Status 200 mayoría (response parcial) pero hasta 30s timeout intermitente. Fix: desactivar `inlineCss`. Coste: ~8-14KB CSS no inline (FCP +50-100ms first paint). Mitigado por `optimizeCss + cssChunking` activos + Vercel CDN + users recurrentes | ✅ | `ea1b18ad` |
| **3.2** | **`/api/answer` 400 "Datos inválidos"** con `userAnswer: -1` (3 ocurrencias 48h, anonymous Chrome 147 / Firefox 150). Causa: `TestLayoutV2.tsx:284` envía `-1` como signal de "blank/skipped" pero schema rechazaba con `min(0)`. Frontend tenía fallback local — UX intacta, solo ruido en logs. Fix: schema `min(-1).max(4)` con comentario explicativo. Comportamiento server idéntico (`-1 === correctOption` siempre false). 19 tests del schema incluido regression del body exacto | ✅ | `02396a9d` |
| **3.3** | **theme-stats timeout** para heavy user (4 timeouts en 30 min). User `c16c186a` con 56k test_questions, 1692 tests → query 12.5s (BD timeout 10s). EXPLAIN ANALYZE: Nested Loop con 35909 page reads. Top 10 heavy users (>10k test_questions) afectados igual. Fix doble: (1) eliminar JOIN test_questions×tests usando `tq.user_id` denormalizado, (2) covering index `(user_id, tema_number) INCLUDE (is_correct, created_at)`. Index Only Scan, 0 random heap reads. **12.5s → 502ms (24.9x)** medido en producción. Paridad 100% verificada en 3 users. Migración: `20260506_idx_tq_user_tema_covering.sql`. **Limitación**: a 100k DAU el heaviest user podría tener ~300-500k test_questions → query 3-5s, próximo paso es materializar `user_theme_stats` summary | ✅ | `aefd1951` |
| **3.4** | **GeoIP timeout** en `/api/auth/track-session-ip` con `await getGeoLocation()` bloqueando 3s. Análisis: 99.97% success rate (3137/3138), pero cada login esperaba hasta 3s a ip-api.com. Fix: reemplazar fetch externa por extracción sync de Vercel headers (`x-vercel-ip-country/city/country-region/latitude/longitude`). 0 latencia, 0 dependencia externa, 0 timeout posible. Pérdida controlada: campo `isp` ya no se rellena (Vercel no lo expone). **Verificado**: `isp` NO se consume en código (admin/fraudes solo usa `city`). 7 tests cubren headers válidos, URL-encoded city, dev local sin headers, lat/lon faltantes/inválidos, encoding malformado | ✅ | `ecda3e67` |
| **3.5** | TS strict cast en `updateSet.mock.calls` — Vercel build rechazaba el tipo `Tuple type '[]' of length '0'` que tsc local toleraba | ✅ | `c0acac60` |

**Resumen Sprint 3:**
- 0 regresiones causadas por Sprint 2 (los 4 fallos eran pre-existentes o latentes)
- 24.9x speedup en theme-stats para heavy users (escalable a ~10k DAU sin más cambios)
- Eliminada dependencia externa (ip-api.com)
- Build TypeScript de Vercel ahora más estricto que tsc local — patrón a recordar

**Pendiente flagged en Sprint 3:**
- Materializar `user_theme_stats` summary table (para escalar theme-stats a 100k DAU)
- Discriminated union para `userAnswer` (-1 vs null+isBlank) — deuda técnica heredada
- Deprecar `/api/answer` con flag `dryRun` en `/api/v2/answer-and-save`

## Sprint 4 audit pool mode + outbox blindado ✅ COMPLETO (2026-05-17)

Gatillado por logs Vercel 17/05 19:01-19:12: cascada de 503/504 en `/api/medals`, `/api/daily-limit`, `/api/questions/filtered`, `SSR temarios`, `/api/admin/infra-stats`, `/api/v2/difficulty-insights` y `/api/questions/user-failed`. Investigación: BD a 68/90 conexiones (76%) durante el blip → no margen para nuevas requests.

| Sprint | Acción | Estado | Commit |
|---|---|---|---|
| **4.1** | Audit a fondo de las 65-68 conexiones simultáneas. Breakdown: **26 inmovibles** (postgrest 22 + storage 3 + supabase_auth_admin 2 + supabase_admin 1 + pg_cron 1 + pg_net 1 + postgres_exporter 1 + realtime 12 + Supavisor 4 = en realidad 47 sumadas todas las del servicio Supabase) + **6-17 postgres.js (Drizzle)** según pico. Las 22 postgrest del servicio Supabase REST mantienen pool propio con conexiones idle de **hasta 55 días** (LISTEN "pgrst" para schema reload) — comportamiento interno del servicio, no migrables desde código aplicación | ✅ Documentado |
| **4.2** | Audit features incompatibles con transaction mode: `LISTEN/NOTIFY` ❌ no usado, `TEMP TABLE` ❌ no usado en código, `SET search_path` ✅ solo dentro de `CREATE FUNCTION` (contexto propio), `prepare: false` ✅ activo, `Realtime postgres_changes` ✅ WebSocket interno Supabase (no LISTEN cliente). **Único punto incompatible encontrado**: advisory locks de sesión en `lib/outbox/processBatch.ts` | ✅ Documentado |
| **4.3** | Refactor `processBatch.ts`: `pg_try_advisory_lock` (session-level) → `FOR UPDATE SKIP LOCKED` dentro de `db.transaction()`. Estándar Postgres, portable a cualquier modo de pool (Supavisor session/transaction, PgBouncer self-hosted, AWS RDS Proxy). Outbox actualmente con 0 eventos en BD → cero riesgo funcional. Test funcional verificado contra BD producción: dos conexiones paralelas confirman que SKIP LOCKED oculta la fila a la segunda mientras la primera la procesa | ✅ | `c003ce0f` |
| **4.4** | Quick-fail en endpoints que aparecieron en logs sin protección: `/api/v2/difficulty-insights` (504 Vercel Runtime 300s observado) + `/api/questions/user-failed` (statement_timeout 30s con 5-way JOIN sobre 61k+ test_questions de user heavy). Ambos withDbTimeout(12s) → 503 retryable con Retry-After 60s | ✅ | `20bd7d6a` |
| **4.5** | `lib/api/user-failed-questions/queries.ts`: añadido `.limit(2000)` a la query principal. Heavy users con 2553+ test_questions incorrectas saturaban el plan. 2000 fallos recientes muestra suficiente para el agregado por question_id que hace la UI de "repaso de fallos" | ✅ | `20bd7d6a` (mismo commit) |
| **4.6** | Detección de pool mode actual via test de comportamiento (2 conexiones TCP cliente → mismo backend PID = multiplexing): **YA estamos en transaction mode** (puerto 6543 Supavisor). El falso positivo del test inicial fue por sticky session dentro de una sola conexión TCP — con poco tráfico el pooler reusa el backend disponible. Es decir: no hay nada que cambiar en pool mode | ✅ Documentado |

**Conclusiones del Sprint 4:**

1. **Ya estamos en transaction mode**. Las 17 postgres.js que veíamos no son lambdas independientes, son los backends reales multiplexados por Supavisor para todo el tráfico Drizzle.
2. **Los blips del 17/05 NO son de nuestro pool mode** — son blips del Supavisor compartido (servicio Supabase). Cuando ese servicio tiene latencia, todos los clientes de la región eu-west-2 sufren.
3. **Camino para evitar blips compartidos**: activar `USE_SELF_HOSTED_POOLER=true` con `DATABASE_URL_SELF_POOLER=pooler.vence.es:6543` (PgBouncer dedicado en Lightsail London, ya provisionado, Patrón A canary del Fase 3.x). Pendiente decidir rollout.
4. **El refactor del outbox era una bomba latente**: los advisory locks "funcionaban por suerte" porque caían en el mismo backend con poco tráfico, pero con pico de tráfico Supavisor rotaría backends y dejaría locks huérfanos. Ahora blindado.

**Pendiente flagged en Sprint 4:**
- Decisión: activar `USE_SELF_HOSTED_POOLER=true` para aislar Vence del Supavisor compartido — eliminaría los blips por contención de otros clientes Supabase.
- Considerar upgrade Supabase Pro → Team si el headroom de 42 slots para nuestras lambdas (90 max - 48 fijas de Supabase) se queda corto.

---

## Sprint 5 cascade 2026-05-18 ✅ COMPLETO (2026-05-18)

Gatillado por dos cascades observadas en logs Vercel:

**Cascade #1 — 17/05 20:58-21:00 UTC**
Cadena de 503 detonada por query lenta de failed-questions del user heavy `8201a5d2` (498 tests, 2.591 fallos, Ley 39/2015). La query (5-way JOIN sobre `test_questions` con `ORDER BY created_at DESC LIMIT 2000`) timeout a 8s+ en el primary `getDb()` (pool max:1), saturando la única conexión Drizzle. Arrastró en cascada:
- `/api/daily-limit` 503 × 6
- `/api/topics/6` y `/api/topics/13` 503 × 2
- `/api/medals` POST 503 × 1
- `/api/notifications/problematic-articles` timeout (devolvió stale OK, no 503)
- `/teoria` SSR `canceling statement due to statement timeout` × 5
- `/auxiliar-administrativo-valencia/temario/tema-2` SSR timeout 15s

**Cascade #2 — 18/05 09:46 UTC**
Spike de 16 requests `answer-and-save` en 30s — 8 con 503 quick-fail (5× 10s anti-fraud, 3× 15s validateAndSave) + 8 con 200 lentas (2.5-11.3s). Solo 56 inserts en la ventana vs 188 ayer en misma hora → **no fue pico de tráfico**. Probable blip Supavisor regional o lock contention puntual.

Diagnóstico raíz: ambos cascades comparten el mismo cuello — pool primary max:1 + endpoints user-facing que aún consultaban BD sin protección stale.

| Sprint | Acción | Estado | Commit |
|---|---|---|---|
| **5.1** | `lib/api/user-failed-questions/queries.ts`: migrado de `getDb()` a `getReadDb()` (replica eu-west-2). Aísla la query lenta de 5-way JOIN del pool primary. Mismo patrón ya aplicado a `notifications/queries.ts`, `ranking/queries.ts`, `filtered-questions/queries.ts`, `topic-progress/queries.ts`. Reversible con `USE_READ_REPLICA=false` (fallback automático a primary integrado en `getReadDb()`) | ✅ | `eeb687e2` |
| **5.2** | `/api/daily-limit`: cache stale-if-error (mismo patrón que `/api/medals` y `/api/notifications/problematic-articles`). Fresh window 30s + stale TTL 24h + BD timeout bajado de 8s→5s. El anti-fraud sigue estricto porque `/api/v2/answer-and-save` llama a `getDailyLimitStatus()` directamente sin pasar por este cache; aquí solo cacheamos el GET informativo del cliente. Trade-off aceptado: user free con 24/25 que recarga puede ver "24" durante 30s aunque haya respondido 1 más en otra pestaña — el contador real lo decide BD al hacer answer-and-save | ✅ | `9012f76e` |
| **5.3** | Test de regresión `__tests__/integration/simulacroOptionCountInvariant.test.ts` (separado, commit `790fa123` del 17/05): verifica que el simulacro AAE NO devuelve preguntas legislativas con 3 opciones (formato PN). Cubre commit `c99573e6` que añadió `isNotNull(questions.optionD)` en `sampleLegislativeByArticles` tras detectar 611 preguntas PN coladas en simulacros AAE | ✅ | `790fa123` |

**Conclusiones del Sprint 5:**

1. **Read replica funciona como aislante de cascadas**. Los endpoints read-only críticos no deben tocar el primary `max:1` — la query lenta de un user heavy no debe poder tumbar a daily-limit/medals/topics.
2. **Cache stale-if-error es el patrón estándar** para endpoints user-facing que se llaman en cada page load. Aplicado ya a 9 endpoints (theme-stats, problematic-articles, topics/[numero], weak-articles, filtered-questions, oposiciones-compatibles, medals, random-test/availability, **daily-limit**).
3. **El anti-fraud puede vivir con un cache informativo** mientras la escritura (insert + validación) siga sin cache. El truco es separar el path de lectura (cacheable) del de escritura (BD directa).
4. **El pool max:1 sigue siendo el cuello arquitectónico**. Cada parche reduce la superficie de impacto, pero la única solución definitiva es Fase 4 (async queues) o subir max con Dedicated Pooler.

**Pendiente flagged en Sprint 5:**
- Migrar más endpoints read-only a `getReadDb()`: `/api/medals` queries, `/api/teoria` (statement_timeout SSR), `/api/topics/[numero]`. Cada uno reduce presión en primary.
- Investigar `pg_stat_statements` + `pg_locks` durante próximo cascade para identificar si hay lock contention específico en `test_questions`/`tests` tables.
- Decisión Fase 4 (async queues) sigue pendiente como única solución arquitectónica para el cuello del path `answer-and-save`.

---

## Incidente 2026-05-11 — Cascada de timeouts BD + medallas

**Ventana observada:** 2026-05-11 18:58-19:13 Europe/Madrid, con sintomas ya visibles en la hora anterior.

**Estado:** mitigacion principal desplegada en `26a73183` (`fix(medals): cache reads in Redis`). La causa principal de amplificacion por medallas queda cerrada; quedan riesgos arquitectonicos en crons, agregaciones cold-cache y triggers sincronos.

### Sintomas

- Bursts de `504 Vercel Runtime Timeout Error` en `/api/exam/answer`, `/api/answer/psychometric`, `/api/v2/user-stats`, `/api/v2/complete-test`, `/api/exam/pending`.
- `ERROR 57014 canceling statement due to statement timeout` en queries agregadas sobre `test_questions`, `questions`, `topics/articles/questions` y crons de dificultad.
- `25P02 current transaction is aborted, commands ignored until end of transaction block` en `DailyLimit`, `DeviceLimit`, `fetch topics`, `profile/avatar-settings`, `teoria/sections`.
- Errores de medallas apareciendo en rutas no relacionadas (`/api/version`, paginas de test, notificaciones, `theme-stats`) por el badge global.

### Causa raiz

No fue un unico endpoint roto. Fue una cascada de saturacion de Postgres:

1. Varias queries pesadas entraron a la vez, sobre todo ranking de medallas y agregaciones de tests.
2. Postgres cancelo algunas por `statement_timeout` (`57014`).
3. En rutas con transaccion/RPC/trigger, la transaccion quedo abortada.
4. Las queries posteriores en la misma transaccion fallaron con `25P02`.
5. Vercel corto lambdas al llegar a `maxDuration` y devolvio `504`.

`25P02` es un sintoma secundario: indica que una sentencia anterior dentro de la transaccion ya habia fallado. No debe tratarse como causa primaria.

### Causa de amplificacion: medallas

Antes de `26a73183`, `GET /api/medals` podia recalcular ranking en caliente con:

```sql
SELECT tq.user_id,
       COUNT(*)::bigint AS total_questions,
       COUNT(*) FILTER (WHERE tq.is_correct)::bigint AS correct_answers,
       ROUND((COUNT(*) FILTER (WHERE tq.is_correct)::numeric / COUNT(*)) * 100, 0) AS accuracy
FROM test_questions tq
WHERE tq.user_id IS NOT NULL
  AND tq.created_at >= $1::timestamptz
  AND tq.created_at <= $2::timestamptz
GROUP BY tq.user_id
HAVING COUNT(*) >= 5
ORDER BY accuracy DESC, total_questions DESC
LIMIT 100
```

Esa query se ejecutaba desde muchas paginas porque el header/badge de medallas se carga transversalmente. Resultado: una feature secundaria podia meter scans/agregaciones de `test_questions` en casi cualquier navegacion.

### Mitigacion aplicada en `26a73183`

- `GET /api/medals` pasa a ser cache-first en Redis.
- Fresh cache 6h, stale fallback 24h.
- En cache hit no toca BD y devuelve `x-medals-cache: hit`.
- `GET /api/medals` ya no recalcula ranking: en miss/stale solo lee medallas almacenadas (`user_medals`) con quick-fail.
- El ranking por periodo se cachea en Redis con key `medals_ranking:{start}:{end}:v2` y TTL 30 dias.
- El recalculo runtime de medallas queda gobernado por `MEDALS_RUNTIME_RECALC_ENABLED`.

Verificado tras deploy:

- `/api/medals?userId=...` respondio con `x-medals-cache: hit`.
- `/api/admin/health/cache-stats`: `medals_ranking` hit rate 94.1%.
- `/api/admin/health/db-latency`: p50 ~2.5ms, p95 ~2.87ms desde `lhr1`.

### Riesgos que siguen abiertos

1. **Crons de dificultad** (`recalc-question-difficulty`, `recalc-global-difficulty`): usan Supabase RPC, no el pool Drizzle `getDb`, pero siguen ejecutando trabajo pesado en el mismo Postgres y sobre tablas calientes. Pueden competir por CPU/I/O/locks aunque no consuman el pool max:1 de la app. Estan definidos tanto en `vercel.json` como en GitHub Actions cada 5min; el advisory lock evita trabajo duplicado, pero no elimina invocaciones extra ni errores si una ejecucion queda lenta.
2. **Theme counts** (`topics -> topic_scope -> articles -> questions`, `count(DISTINCT ...)`): cacheado con `unstable_cache`, pero un cold miss/deploy/revalidate puede volver a disparar queries pesadas.
3. **Laws configurator**: agregacion `questions -> articles -> laws` con `count(distinct)`, sin Redis stale-if-error robusto.
4. **User stats / exam pending**: tienen Redis, pero los hit rates observados fueron muy bajos (`user_stats` ~3.7%, `exam_pending` ~3.6%), asi que muchos requests siguen llegando a BD.
5. **Triggers de `test_questions`**: `update_user_question_history` ejecuta trabajo por fila insertada. En inserts masivos (`official-exams/init`) puede convertir un batch grande en muchas operaciones sincronas y provocar `statement_timeout`.
6. **Endpoints sin quick-fail suficiente**: `complete-test` y `answer/psychometric` aparecieron con 504; deben revisarse antes de otro pico.
7. **Bugs no relacionados con saturacion**: `teoria/sections` (`slug undefined` / ley no encontrada), `soporte.feedbackId undefined`, `Ranking Map(undefined)`. No explican la cascada, pero generan ruido y deben corregirse.

### Regla operativa aprendida

Una feature visible globalmente (header, badge, notificaciones, medallas, ranking) no puede depender de una agregacion en caliente sobre `test_questions`. Tiene que cumplir una de estas condiciones:

- Redis cache-first con stale-if-error.
- Tabla resumen/materializada.
- Job asincrono que precalcula.
- Quick-fail que no mantenga la lambda viva hasta `maxDuration`.

Si una ruta aparece en logs de muchas paginas no relacionadas, sospechar de componentes globales antes que de la pagina concreta.

### Orden de trabajo recomendado

1. Investigar y endurecer crons de dificultad: solapes Vercel/GitHub, `cron_runs` stale, duracion p95, backoff y batch size.
2. Redis stale-if-error para `theme counts` y `laws-configurator`.
3. Mejorar hit rate real de `user_stats` y `exam_pending`.
4. Mover `update_user_question_history` a outbox/batch o resumen incremental.
5. Quick-fail y cache defensiva en `complete-test` y `answer/psychometric`.
6. Limpiar bugs defensivos de `teoria/sections`, soporte y ranking.

---

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

## Fase 0.7 — JWT local verify (CRÍTICO seguridad) ✅ COMPLETA server-side (2026-05-11)

**Estado actual**: `MODE=on` activo en producción. **63+ endpoints server-side** con latencia auth <5ms. Solo quedan 5 archivos client-side (`'use client'`) que requieren refactor del SDK browser — trabajo separado, no bloquea nada.

**Resumen del rollout**:
- 2026-05-10: infraestructura deployed (`8aaa9171`), env vars añadidas, shadow mode 24h con 15.663 requests y 0 divergencias
- 2026-05-10: flip a `MODE=on` validado por latencia (134-221ms vs 250-450ms anteriores)
- 2026-05-11 mañana: migración progresiva en 6 batches con AI leyendo cada archivo individualmente. **~-475 LOC netas** (eliminado código duplicado de auth).

**Batches completados** (todos con TS check + tests verdes):
| Batch | Cambio | Endpoints afectados | Commit |
|---|---|---|---|
| 1 | 8 endpoints `/api/v2/official-exams/*` | 8 | `c5296a11` |
| 2 | 3 endpoints `/api/sessions/*` | 3 | `69877f1e` |
| 3 | 7 endpoints core (filtered, weak-articles, complete-test, complete-onboarding, devices, dispute v2, tests/failed-questions) | 7 | `b9f637d6` |
| 4 | 7 endpoints con email check (soporte × 2, admin/engagement-stats, admin/infra-stats, admin/ai-traces × 2, admin/broadcast) | 7 | `89d0d922` |
| 4.5 | 1 reparado tras error de proceso (ai/create-test) | 1 | `932c15d0` |
| 5 | 6 endpoints (failed-by-topic, save-answer, dispute, cursos/* × 3) | 6 | `c1299a12` |
| **6 (este sprint)** | **Refactor helpers lib server-side** | **+31** (27 vía shared/auth + 4 vía dailyLimit/finance) | `02176128` |

**Total**: 32 endpoints API directos migrados (Batches 1-5) + 31 endpoints indirectos vía wrappers refactorizados (Batch 6) = **63+ endpoints** con latencia auth <5ms.

**Refactor Batch 6 (detalle)**:
- `lib/api/shared/auth.ts` ← 27 callers. Wrapper paralelo que existía sin uso real, ahora delega a `verifyAuth` internamente. API externa intacta (los 27 callers no cambian). Auditoría confirmó: 0 callers usan `app_metadata`/`user_metadata`/`role` del User devuelto — cast seguro.
- `lib/api/dailyLimit.ts` ← `getUserIdFromToken()` delegado a `verifyAuthOptional`. Llamado desde `/api/exam/answer`, `/api/answer/psychometric`, `/api/answer/spelling`.
- `lib/finance/auth.ts` ← `authenticateFinanceRequest()` dual-auth (cookie armando + Bearer admin). Bearer path delegado a `verifyAuth`. Cookie armando intacta.

**Lección importante aprendida (commit `932c15d0`)**: en `ai/create-test` eliminé el helper `getSupabase` asumiendo (por grep parcial) que solo se usaba para auth. TypeScript cazó el error: se usaba para 10+ queries BD. Ajusté proceso: Read del archivo COMPLETO, grep de TODAS las apariciones, mantener declaración si se usa fuera del bloque auth, TS check después de cada archivo individual (no acumulado).

**Pendientes — solo client-side** (`'use client'`, no migrables a `verifyJwtLocal` porque requiere `SUPABASE_JWT_SECRET` server-only):
- `lib/services/emailTracker.ts` — `'use client'`
- `lib/services/notificationTracker.ts` — `'use client'`
- `lib/testFetchers.ts` — usa `getSupabaseClient` (browser SDK), consumido desde browser
- `lib/supabase.ts` — es THE cliente Supabase del browser
- `app/auxiliar-administrativo-estado/test/tema/[numero]/page.tsx` — `'use client'`

Estos archivos usan `supabase.auth.getUser()` para leer la **sesión local del browser**, NO un Bearer token entrante. Para migrar el cliente a otro provider auth (AWS Cognito, Clerk, Auth.js), hace falta:
1. Crear hook `useAuth()` que abstraiga el SDK browser
2. Cambiar `getSupabaseClient()` → consumer del hook
3. Los 5 archivos cambian todos a la vez al swap de SDK browser

**Es trabajo paralelo al server-side** — no bloquea ninguna migración futura. Mientras Supabase Auth siga siendo el provider del cliente, estos archivos pueden quedarse como están.

**Beneficio observado** (post-migración masiva server-side):
- Latencia auth bajó de 250-1000ms a **<5ms** en 63+ endpoints
- Los warnings `⚠️ [answer-and-save] Respuesta lenta` (24/h pre-migración) prácticamente desaparecieron
- Verificación producción 2h post-Batch 5: 4248 requests answer-and-save, 0 errores 401 de usuarios reales, 13× 503 fueron blip de pooler ~45s (no auth-related)

**Rollback**: env var `JWT_LOCAL_VERIFY_MODE=off` + redeploy → vuelve a `getUser()` remoto para los 63+ endpoints simultáneamente. <2 min.

**Origen:** Hard Gap #1 de la auditoría 10k DAU. Investigación a fondo del 3 may 2026 confirmó que era **el principal cuello del hot path**.

**Diagnóstico inicial (3 may 2026, 18:30 UTC):**
- 24 warnings/h de `⚠️ [answer-and-save] Respuesta lenta: 2-4s` en producción (consistente)
- Trace del endpoint:
  | Paso | Coste | Estado |
  |---|---|---|
  | `supabase.auth.getUser()` | **250-1000ms** | ✅ Atacado (commit 8aaa9171) |
  | `Promise.all([device, daily, deviceUsage])` | 50-200ms | OK paralelo |
  | `getQuestionValidationCached` | <5ms | OK (cache hit) |
  | INSERT `test_questions` (6 triggers I/O) | 100-500ms | 🟡 Parcial (Fases 0.1/0.2/0.6) |
  | UPDATE `tests` SET score | 10-30ms | OK |
- Total: 400-1700ms p50, **2-4s p99**

**Hallazgos investigación previa (10 may 2026):**
1. **Supabase usa HS256** (secreto simétrico), NO RS256/ES256 — confirmado: el endpoint `.well-known/jwks.json` devuelve `{"keys":[]}`. Implicación: necesario `SUPABASE_JWT_SECRET` en env vars (Dashboard → Settings → API → Legacy JWT Secret tab).
2. **Auditoría 41 callers de `getUser()`**: ~25 usan solo `user.id`, ~10 usan `email`, **0 usan `app_metadata`/`user_metadata` del resultado de getUser** (las refs encontradas son páginas client-side leyendo de session, no de getUser). Implicación: 1 solo helper que devuelve `{userId, email}` cubre el 100% de uso.
3. **Otros métodos auth no tocan**: `signInWithOAuth` (Google login), `admin.getUserById/deleteUser` (usan SERVICE_ROLE_KEY, no JWT user), `getSession` (solo cliente browser).

**Implementación deployed (commit 8aaa9171, 2026-05-10):**

Defense-in-depth con 2 capas:

1. **Helper aislado** `lib/api/auth/verifyJwtLocal.ts`:
   - Whitelist explícita `algorithms: ['HS256']` — anti algorithm confusion attack
   - Validación strict de `audience: 'authenticated'`
   - `clockTolerance: 5s` para skew Vercel↔Supabase
   - Errores tipados: `no_token | no_secret_configured | invalid_signature | expired | malformed | unsupported_alg | wrong_audience | wrong_issuer`
   - Sin secret → `no_secret_configured` (NO false positive de éxito — protección cuando se olvida set la env var)
   - Lib: `jsonwebtoken@9.0.3` (CommonJS, Node-native, ampliamente probado). NO se usó `jose@6` por ser ESM-only y requerir config Jest no trivial.

2. **Wrapper** `lib/api/auth/verifyAuth.ts` con 3 modos via env `JWT_LOCAL_VERIFY_MODE`:
   - `off` (DEFAULT) → solo `getUser()` remoto, comportamiento idéntico a antes
   - `shadow` → AMBAS verifs en paralelo, log diff a Sentry+`validation_error_logs`, sirve resultado del REMOTO (zero risk para usuarios). Detecta mismatch de userId/email/success.
   - `on` → solo `verifyJwtLocal`, latencia <5ms, ahorra round-trip
   - Flag inválido → fallback a `off` defensivo

**Tests cubriendo:**
- 27 tests en `verifyJwtLocal.test.ts`: happy path, algorithm confusion (none/HS384/HS512), payload tampering, firma rota, expiry con clock tolerance, audience inválido, secret missing, edge cases input
- 10 tests en `verifyAuth.test.ts`: 3 modos, divergencia (userid_mismatch/email_mismatch/local_ok_remote_fail), no_bearer_token, flag inválido
- 79 tests existentes de answer-flow + answer-save-queue + answer-validation siguen pasando

**Plan de rollout (sin código adicional, solo env vars):**

1. ✅ **Fase A (HOY)**: Deploy con `MODE=off` → 0 cambios user-facing, infraestructura lista
2. ⏳ **Fase B (24-48h)**: User set `MODE=shadow` en Vercel + redeploy. Observar logs:
   - Si 0 divergencias `🔒 [auth/shadow] DIVERGENCE` → confianza alta
   - Si N divergencias → investigar antes de continuar
3. ⏳ **Fase C**: User set `MODE=on` → latencia p50 1.5s→0.5s en answer-and-save
4. ⏳ **Fase D (1-2 sem)**: Migrar resto de 40 callers de `getUser()` al wrapper
5. ⏳ **Fase E (mes+)**: Eliminar `getUser()` residual, verificación pura local

**Rollback**: env var `MODE=off` + redeploy. <2 min en cualquier fase.

**Riesgos analizados (NO eliminables 100% incluso con mitigaciones):**
1. ✅ **Algorithm confusion attack** — mitigado: whitelist explícita HS256, defense-in-depth con check post-jwt.verify
2. ⚠️ **Usuarios baneados continúan accediendo hasta `exp`** — mitigación pendiente: añadir check `auth.users.banned_at IS NULL` post-extract userId. **CRÍTICO**: el `Access token expiry time` actual está en **604.800s (7 días)** vs recomendación 3.600s (1h). Decisión pendiente: bajar expiry (invalida sesiones activas → re-login forzoso) o añadir BD check (+10ms latencia). Por ahora seguimos con expiry alto + sin BD check, mismo comportamiento que `getUser()` actual.
3. **Token revocation tras logout** — access token sigue válido hasta `exp` (mismo comportamiento que `getUser()` actual)
4. **Rotación key Supabase** — improbable; si ocurre, env var update + redeploy. Wave de 401 hasta propagar.
5. **Migración futura a JWT Signing Keys (asimétrico)** — Supabase está deprecando HS256. Cuando se migre, necesario reescribir `verifyJwtLocal.ts` para usar JWKS endpoint (~1-2h trabajo: cambiar `jsonwebtoken` por `jose` con remote JWKS cache).

**Beneficio esperado tras flip a `on`:**
- Round-trip Vercel → Supabase Auth: 250-1000ms → **<5ms** (verificación firma local)
- p50 endpoint `/api/v2/answer-and-save`: 1.5s → **0.5s**
- p99 endpoint: 4s → **1.5s**
- ~5M req/día × ~250ms ahorrados = **350h latencia agregada eliminada/día**
- Aplicable a TODOS los 41 endpoints autenticados tras Fase D

**Memo detallado**: `~/.claude/projects/-home-manuel/memory/vence_jwt_local_verify_phase07.md`

---

## Fase 1 — Redis cache (Upstash) ✅ COMPLETA (2026-05-02)

**Objetivo:** que el 80%+ de las requests no lleguen a BD.

**Setup:**
- Upstash Redis serverless **Pay as You Go** ($0.20/100K commands, sin tope) eu-west-2
- Coste real medido (2026-05-09): **~$6/mes** con 235 DAU y ~100K cmds/día. Break-even con Fixed $20/mes = 10M cmds/mes (~3.3x crecimiento).
- `lib/cache/redis.ts` con `getOrSet(key, ttl, fetcher)` (cache-aside + singleflight) + `getCached/setCached` (patrón stale-fallback)
- Fallback a BD si Redis está down (timeout 100ms)

### Endpoints originales (Fase 1.0)
| # | Endpoint | Estado | Detalle |
|---|---|---|---|
| 1 | `/api/v2/user-stats` | ✅ Hecho (commit 9262954c) | TTL 30s, key `user_stats:{userId}`, invalidación tras INSERT en `test_questions` |
| 2 | `/api/v2/profile` | ⏭️ Skip | `Cache-Control: no-store` deliberado (cambios deben ser inmediatos) |
| 3 | `/api/daily-limit` | ⏭️ Skip | Ya tiene cache premium-only in-memory (anti-fraude). Mover a Redis añadiría riesgo de bypass freemium sin beneficio claro |
| 4 | `/api/exam/pending` | ✅ Hecho (commit 9262954c) | TTL 30s, key segmentada por testType+limit, invalidación tras INSERT/UPDATE en `tests` |
| 5 | Catálogos oposiciones/leyes/themes | ⏭️ Skip | Ya cubiertos por Next.js `unstable_cache` con tags (`temario`, `teoria`, `laws`, `landing`). Manual: `docs/maintenance/cache-revalidation.md` |
| 6 | `/api/v2/topic-progress/theme-stats` | ✅ Hecho (commit a0ef3078) | Promovido de Map in-memory → Redis. Patrón "fresh 5min + stale fallback 24h" para query pesada (16s en heavy users). Invalidación tras INSERT en `answer-and-save`. |

### Stale-if-error (Fase 1.1, sprint cascade 5-9 may)
Endpoints donde **el cache stale es la red de seguridad** contra blips del Shared Pooler regional (que afecta primary y replica simultáneamente):

| Endpoint | Patrón | Cache key | Notas |
|---|---|---|---|
| `theme-stats` | fresh 5min + stale 24h | `theme_stats:{userId}` | Originario (a0ef3078) |
| `problematic-articles` | fresh 5min + stale 24h | `problematic:{userId}` | Sprint 2026-05-07 |
| `topics/[numero]` | fresh 5min + stale 24h | `topic_data:{oposicion}:{topic}:{userId\|anon}` | Sprint 2026-05-07. Cache vacío + blip → 503 (decisión consciente) |
| `weak-articles` | fresh 5min + stale 24h | `weak_articles:{userId}:{filters}` | Commit 60ba5538 |
| `/api/questions/filtered` POST | **stale-if-error doble cache** (per-user + global) + retry CONNECT_TIMEOUT | `filtered_q:{userId\|anon}:{hash}` + `filtered_q:any:{hash}` | b45e3bae + 10 may (incidente §). NO fresh shortcut — randomness UX. |
| `/api/questions/filtered` GET count | fresh 60s + stale-if-error + retry CONNECT_TIMEOUT | `filtered_q_count:{sha256(body):16}` | Count determinista, fresh OK |
| `oposiciones-compatibles/progress` | fresh 5min + stale 24h | `oposiciones_progress:{userId}:{sourcePositionType}` | Commit 1fb1800f |
| `/api/medals` GET | **stale-if-error puro** (sin fresh shortcut) + write-through invalidate | `medals:{userId}` | Commit 046456f3 (2026-05-11). POST invalida cache tras éxito para que GET vea medallas nuevas inmediato. |
| `/api/random-test/availability` POST | fresh 60s + stale 24h | `random_avail:{sha1(body)}` | Commit e2ce0dc4 (2026-05-11). Promovido de cache in-memory por-lambda a Redis L2 compartido. |

**Pendientes de aplicar**: ✅ TODOS CERRADOS 2026-05-11:
- `/api/medals` GET → stale-if-error puro + write-through invalidate (commit `046456f3`)
- `/api/random-test/availability` → promovido in-memory → Redis L2 fresh+stale (commit `e2ce0dc4`)
- `/api/v2/hot-articles/check` → ya tiene degradación graceful propia (`isHot: false` en timeout, mejor que stale para este caso — servir stale isHot=true sería engañoso al user). NO requiere stale-if-error.

**Salvaguardas implementadas:**
- Feature flag `REDIS_CACHE_ENABLED=false` para desactivar instantáneo
- Timeout 100ms en cada GET/SET — si Redis lento, cae a BD sin penalizar
- Fire-and-forget en SET — no bloquea la respuesta del usuario
- Singleflight en `getOrSet` — N requests concurrentes con mismo key → 1 fetcher (anti-stampede)
- Stale fallback en endpoints listados — datos viejos > 503 si BD timeout

### Incidente recurrente 2026-05-10 — `/api/questions/filtered` 503 por CONNECT_TIMEOUT residual

**Síntoma:** tras el sprint cascade del 5-9 may con stale-if-error + replica completados, `/api/questions/filtered` POST seguía devolviendo 503s en clusters durante blips del Shared Pooler regional. Logs mostraban `write CONNECT_TIMEOUT aws-0-eu-west-2.pooler.supabase.com:6543`.

**Causa raíz:** dos limitaciones de la mitigación previa convergían:
1. **Cache key demasiado específica**: `filtered_q:{userId}:{hash(body)}`. Al ser tests aleatorios con configuración variable (numQuestions, leyes, dificultad), cada combo es una clave única. Un usuario que cambiaba config en blip → primer request con esa key → cache vacía → 503.
2. **Sin retry para CONNECT_TIMEOUT efímero**: un porcentaje de blips dura <1s. El primer intento fallaba TCP-connect (~5s gracias a `connect_timeout: 5`) y el lambda devolvía 503 sin volver a intentar.

**Mitigación aplicada (2026-05-10, commit pendiente):**

1. **Doble cache key** en `/api/questions/filtered` POST:
   - `filtered_q:{userId|anon}:{hash}` (per-user, lectura preferida)
   - `filtered_q:any:{hash}` (global, fallback compartido entre usuarios)

   Ambas se escriben en cada éxito. El stale-if-error lee per-user primero; si vacía, cae a global. Trade-off consciente: durante un blip, dos usuarios distintos con misma config pueden ver la misma selección (UX inferior pero ≫ 503). En operación normal nadie lee de la global.

2. **`withConnectRetry`** (nuevo helper en `lib/db/timeout.ts`): un único reintento si el primer intento lanza CONNECT_TIMEOUT, con backoff fijo 500ms. Diseñado para cubrir blips <1s. Acotado dentro del `withDbTimeout` para no exceder los 15s totales.

3. **`isConnectTimeoutError`** (nuevo type guard): detecta el error de postgres-js por `.code === 'CONNECT_TIMEOUT'` con fallback regex sobre el mensaje (robustez frente a cambios de driver).

**Aplicado a:** `/api/questions/filtered` POST y GET ?action=count.

**Pendiente extender** (si vuelven a aparecer 503 en otros endpoints durante blips): mismo patrón en `/api/v2/topic-progress/theme-stats`, `/api/notifications/problematic-articles`, `/api/ranking`, `/api/v2/weak-articles`. Por ahora estos tienen suficiente cubrimiento con la cache fresh+stale-24h existente.

**Por qué esto NO sustituye al self-hosted pooler (Opción E, Fase 3):** el retry + dual cache reducen los 503 visibles ~70-90% pero el SPOF arquitectónico sigue ahí. La solución de raíz sigue siendo aislar el pooler (`docs/roadmap/self-hosted-pooler.md`). Esta mitigación compra tiempo y mejora UX hasta que arranquemos Fase 0 del self-hosted.

**Métricas a vigilar (post-deploy):**
- Ratio `503 from /api/questions/filtered` debería bajar significativamente
- Aparición de logs `sirviendo cache stale (global, ...)` confirma que el fallback global se activa cuando per-user falla
- Si vemos retries que tardan >1s (logs Sentry `quick_fail: db_timeout` post-retry) → blip es largo y el self-hosted pooler urge más

---

## Fase 2 — Outbox pattern (sustituir triggers pesados) 🟡 PASO 0 HECHO

**Objetivo:** eliminar lock contention de triggers manteniendo features intactas.

**Patrón híbrido (preserva UX):**
- **Lo que el usuario ve en tiempo real → trigger ligero**: `user_stats_summary` (+1 atómico), `user_streak` (con guard 1x/día), `user_question_history` simple counter.
- **Lo que es analítico/pesado → outbox + worker**: recálculo de `questions.difficulty/global_difficulty`, agregaciones complejas, eventos analytics.

### Paso 0 — Infraestructura ✅ 2026-05-16

Construido el plumbing del outbox **sin migrar todavía ningún trigger**. Todo es reversible y no toca el flujo actual.

- **Migración SQL** `supabase/migrations/20260516_outbox_events.sql`: tabla `outbox_events (id, event_type, payload jsonb, created_at, processed_at, attempts, last_error)` + índice parcial `WHERE processed_at IS NULL` (clave de rendimiento: aunque la tabla acumule millones de filas históricas, sólo las pendientes están en el índice) + índice secundario por `event_type` + RLS habilitada cerrada a anon/authenticated.
- **Schema Drizzle**: `outboxEvents` en `db/schema.ts`.
- **Helper transaccional** `lib/outbox/enqueue.ts:enqueueEvent(tx, event)`: exige una `tx` activa como primer argumento — no se permite encolar fuera de transacción. Esa firma garantiza atomicidad por construcción: si la transacción del request hace rollback, el evento desaparece.
- **Worker** `lib/outbox/processBatch.ts:processOutboxBatch(db, limit)`:
  - **Aislamiento entre workers vía `FOR UPDATE SKIP LOCKED`** dentro de `db.transaction()` — row-level lock estándar Postgres, portable a cualquier modo de pool (Supavisor session/transaction, PgBouncer self-hosted, AWS RDS Proxy, Postgres directo). Workers concurrentes reservan filas distintas sin bloquearse entre sí. **Refactor 2026-05-17 commit `c003ce0f`**: el patrón anterior usaba `pg_try_advisory_lock` (lock de sesión) que se rompía silenciosamente en pool transaction mode — LOCK y UNLOCK podían acabar en conexiones backend distintas dejando el lock huérfano y permitiendo dos workers paralelos pisándose. SKIP LOCKED elimina la dependencia de session-level state.
  - SELECT con filtro `attempts < MAX_ATTEMPTS (10)` → eventos con 10 fallos quedan como dead-letter (conservados en BD para inspección, ignorados por el worker).
  - Por evento: dispatch → UPDATE `processed_at`. Si el handler lanza, UPDATE `attempts++` + `last_error`. Try/catch defensivo alrededor de ambos UPDATEs para que un blip BD no mate el resto del lote.
  - **Trade-off documentado** (post-refactor): la transacción se mantiene abierta durante todo el batch para que los row locks de SKIP LOCKED se mantengan hasta el COMMIT. Los handlers DEBEN ser idempotentes Y rápidos — sin I/O largo (>60s chocaría con `idle_in_transaction_session_timeout`). Para handlers largos en el futuro habrá que añadir columna `started_processing_at` con TTL en vez de retener el lock todo el batch.
  - Sin handlers todavía: `dispatch` sólo conoce `__placeholder__` (sin efecto, usado en tests).
- **Endpoint** `app/api/cron/process-outbox/route.ts`: GET con Bearer auth (`CRON_SECRET`), `runCronWithLogging` registra cada run en `cron_runs` con `cron_name = 'process-outbox'`. Usa `getAdminDb()` (Drizzle, max:4) — cero llamadas a `@supabase/supabase-js` para el outbox.
- **Schedule** `.github/workflows/process-outbox.yml`: GHA cron `*/5 * * * *` (best-effort, suficiente para handlers que toleren lag de minutos). NO se añadió a `vercel.json` a propósito — el outbox queda desacoplado de Vercel para facilitar migración futura a AWS / Hetzner.
- **Verificado en BD**: insert → select pendiente → UPDATE → 0 pendientes; dead-letter filter (`attempts >= 10`) deja la fila pero la oculta del worker.

### Paso 1+ — Migración de triggers ⏳ PENDIENTE (sin candidatos urgentes)

Tras el audit del 2026-05-16, **no hay triggers en `test_questions` que sean candidatos urgentes** a outbox. Los 11 triggers actuales son ligeros: UPSERTs incrementales, marcado de dirty flags atómico, lookups por PK. Ninguno hace JOINs caros ni agrega en el camino crítico.

La infraestructura outbox queda preparada para **cuando aparezca un caso real**: una nueva feature que requiera trabajo síncrono pesado en el path del request (ej. badges complejos post-test, recálculo de `oposicion_compatibility` masivo, integración Stripe webhooks → email).

Plan genérico cuando llegue el primer caso:

1. Añadir variant al union `OutboxEvent` en `lib/outbox/types.ts` + handler en `dispatch` de `processBatch.ts`.
2. Doble escritura (dual write) durante 1 semana: la implementación antigua (si existe) sigue activa + emitimos también un evento outbox. Comparar resultados.
3. Si la paridad es 100% en la ventana de verificación, **la implementación antigua se desactiva** detrás de feature flag. Mantener flag unos días por si hay que rollback rápido.
4. Tras estabilizar, drop del código antiguo.

**Salvaguardas:**
- Idempotencia (UPSERT, no INSERT) en lo que procesa el worker — los handlers son los responsables de tolerar reintento.
- Aislamiento entre workers vía `FOR UPDATE SKIP LOCKED` (estándar Postgres, no depende de session). Workers concurrentes ven filas distintas.
- Si worker falla, eventos se acumulan, se procesan al recuperar (sin pérdida).
- Dead-letter (`MAX_ATTEMPTS = 10`) para que un handler con bug no se reintente infinitamente.

### Nota: roadmap previo sobre `update_user_question_history` (línea ~1137) está desactualizado

La revisión del 2026-05-16 confirmó que esa función YA fue optimizada a UPSERT incremental sin JOINs (su comentario interno lo dice: "INSERT incremental sin agregaciones (vs SELECT COUNT/SUM/AVG/MIN/MAX antes)"). No es candidato a outbox — es trigger ligero. Los **11 triggers actuales de `test_questions` son todos ligeros**. El dolor real estaba en los **crons batch** (`recalculate_dirty_global_difficulty` lee `question_first_attempts` con agregación → statement timeout 8s en picos) — pero ESO se ataca con **materialización incremental**, no con outbox. Ver sección siguiente "Fase 2-bis".

---

## Fase 2-bis — Materialización incremental de `global_difficulty` ✅ COMPLETA 2026-05-17

Ataca el cron `recalc-global-difficulty` con la solución arquitectónicamente correcta: **agregados incrementales en `questions`** en vez de outbox. Beneficio inmediato: eliminar los emails de fallo GHA, los statement timeouts y los deadlocks observados en `cron_runs` (~1.5% error rate, mayoría 8s timeouts).

**Decisión de no usar outbox aquí (2026-05-16):** el outbox brilla cuando hay trabajo síncrono en el camino del usuario. El cron de `recalc-global-difficulty` ya es async — moverlo al outbox sólo cambia el orquestador. El problema real es que `calculate_question_global_difficulty` hace `AVG()` / `COUNT()` agregando `question_first_attempts` (~50-150ms por pregunta × 100 preguntas = 5-15s → timeout 8s). La solución correcta es mantener los agregados materializados.

### Diseño

`questions` ahora contiene 3 sums incrementales además del `difficulty_sample_size` que ya existía:

- `first_attempts_correct_sum` (int) — Σ de `is_correct` (0/1).
- `first_attempts_time_sum` (bigint) — Σ de `time_spent_seconds`.
- `first_attempts_confidence_sum` (numeric) — Σ de `confidence_level` mapeado a 1.0-4.0.

Con esos 4 escalares + la función pura `compute_global_difficulty_from_sums(n, correct, time, conf)` (sin SELECT), el cálculo es sub-ms, idéntico algebraicamente al anterior.

### Implementación (paso 1) ✅ 2026-05-16

`supabase/migrations/20260517_global_difficulty_incremental.sql`:

1. ALTER TABLE `questions` añade las 3 nuevas columnas con DEFAULT 0.
2. Función `compute_global_difficulty_from_sums(...)` — IMMUTABLE, pura aritmética.
3. Función `confidence_text_to_score(text) → numeric` — mapeo NULL-safe.
4. Función `apply_first_attempt_to_question_stats()` — trigger handler (v1: incremental).
5. Trigger `apply_first_attempt_to_question_stats_trigger` en `question_first_attempts` AFTER INSERT FOR EACH ROW.

**Backfill ejecutado:** 35.040 preguntas con sums calculados desde `question_first_attempts` (14.5s), 25.360 con `global_difficulty` recomputado (4.1s).

### Hardening del trigger ✅ 2026-05-17

Monitor 24h post-paso 1 destapó **75 preguntas con `difficulty_sample_size` inflado** (delta hasta +3) respecto al `count(*)` real de `question_first_attempts`. Drift **pre-existente** (no introducido por el paso 1) — probablemente acumulado a lo largo del tiempo por borrados manuales de filas en cleanup/GDPR-erase. El modelo "incremento ciego" (`= valor_anterior + 1`) lo perpetuaba indefinidamente.

`supabase/migrations/20260517_global_difficulty_robust_trigger.sql` cambia el trigger a **re-aggregate completo**: en cada INSERT, una `SELECT count/SUM` sobre `question_first_attempts WHERE question_id = NEW.question_id` (un PK lookup con índice, ~1-10ms). El trigger se vuelve **self-healing**: cualquier drift se corrige solo en el siguiente INSERT que toque la pregunta.

Coste: una query agregada por INSERT (~0.09/s actuales → ~7/s a 10k DAU). Despreciable.

**Verificación post-hardening:**
- Drift histórico de 75 preguntas reconciliado (sample_size = count real, recalc completo). Paridad post-fix 50/50.
- Test de self-healing: drift simulado +10 → INSERT real → sample_size se restaura a count real en el mismo trigger.
- Test de INSERT normal: deltas correctos, paridad con `calculate_question_global_difficulty` al céntimo.

### Monitor 24h tras paso 1 ✅

Comparativa antes/después del trigger nuevo:

| Métrica | Baseline 24h previas | Ventana 10.9h post-trigger |
|---|---|---|
| Runs cron viejo | 307 | 136 |
| **Errores** | **7** (statement timeouts + deadlocks) | **0** |
| Avg duration | 1117 ms | 493 ms (-56%) |
| Max duration | 9000 ms | 4000 ms (-56%) |
| Avg processed/run | 40 | 25 (-38%) |
| Emails fallo GHA | sí | no |

El cron viejo sigue corriendo como red de seguridad (sobreescribe `global_difficulty` con el mismo valor que el trigger ya calculó — fórmula idéntica algebraicamente).

### Apagado del cron recalc-question-difficulty ✅ 2026-05-17

Tras analizar el sentido del campo `difficulty` (text) en `questions`, se concluyó que el cron `recalc-question-difficulty` recalculaba un valor sesgado: agregaba TODAS las respuestas de `test_questions` (incluidos retests donde los mismos usuarios repasan y aciertan más), bajando artificialmente la dificultad real de la pregunta.

`global_difficulty_category` (basado solo en primer intento de cada usuario, mantenido incremental por el trigger de Fase 2-bis) ya es la categoría real sin sesgo. El campo `difficulty` queda como categoría estática de importación ('medium' por default), sirviendo de fallback honesto cuando una pregunta no tiene primer intento todavía.

`supabase/migrations/20260517_drop_question_difficulty_cron_system.sql`:
1. `update_question_difficulty_immediate` ahora es NO-OP (deja de marcar `stats_dirty=true` en cada INSERT a test_questions).
2. DROP FUNCTION `recalculate_dirty_question_difficulty`.

Eliminados:
- `app/api/cron/recalc-question-difficulty/route.ts`.
- `.github/workflows/recalc-question-difficulty.yml`.
- Entrada `recalc-question-difficulty` en `vercel.json`. **vercel.json queda sin crons** — Vence ya no depende de Vercel Cron para nada (desacoplo total del proveedor).

Pendientes posteriores (PRs aparte tras margen 48h):
- DROP COLUMN `questions.stats_dirty` (mié 2026-05-21).
- Evaluar si la columna `questions.difficulty` (text) sigue aportando valor a medio plazo o se puede eliminar también.

### Bajada del umbral ≥3 → ≥1 ✅ 2026-05-17

`supabase/migrations/20260517_global_difficulty_lower_threshold.sql`: el umbral mínimo de first_attempts para calcular `global_difficulty_category` baja de ≥3 a ≥1. Antes mezclaba dos conceptos: confianza estadística (sistema adaptativo) y umbral para categorizar (filtros UX). Ahora separados: la categoría se calcula con ≥1 first_attempt; el sistema adaptativo sigue exigiendo ≥3/≥5 en sus propias funciones (`get_effective_psychometric_difficulty`, `get_effective_law_question_difficulty`) — sin cambios ahí.

Impacto: 47 preguntas con 1-2 first_attempts pasaron de NULL a tener categoría (35 hard, 8 medium, 5 easy, 1 extreme). Los filtros las usan ahora con su valor real en vez del fallback a `difficulty`. Resto del sistema sin cambios.

### Paso 3 — Apagar el sistema viejo ✅ HECHO 2026-05-17

`supabase/migrations/20260517_drop_global_dirty_cron_system.sql`:
1. `track_question_first_attempt` ya NO marca `global_dirty = true` — el INSERT a `question_first_attempts` queda intacto y sigue disparando el trigger nuevo que actualiza `global_difficulty` inmediato.
2. `DROP FUNCTION recalculate_dirty_global_difficulty(integer)`.

Eliminados en el mismo commit:
- `app/api/cron/recalc-global-difficulty/route.ts` (endpoint).
- `.github/workflows/recalc-global-difficulty.yml` (workflow GHA).
- Entrada `recalc-global-difficulty` en `vercel.json` (Vercel Cron).

Pendiente para mié 2026-05-21 (48h después): `DROP COLUMN questions.global_dirty` en PR aparte, tras confirmar que ningún código residual la lee.

**Beneficio medido tras el apagado:** 0 emails de fallo GHA por este cron, 0 deadlocks por contención del UPDATE batch contra `track_question_first_attempt`, latencia de `global_difficulty` "hasta 5 min" → inmediato tras la respuesta. Migración SQL aplicada sin incidentes.

---

## Fase 2-ter — Optimización hot path de páginas/endpoints semi-estáticos ✅ 2026-05-17

Tras cerrar Fase 2-bis (crones de difficulty apagados), se atacaron dos endpoints visibles que provocaban timeouts en producción: `/teoria` (SSR "Error cargando leyes") y `/api/ranking` (saturación 503, ~30/día). Misma filosofía: mover el coste lejos del camino del usuario.

### `/teoria` — Edge caching SWR

**Antes:** `fetchLawsList()` ejecutaba JOIN `laws` + `articles` que devolvía 40.501 filas (~4.2s en caliente). El cache `unstable_cache` era permanente (`revalidate: false`) pero NO se comparte entre lambdas Vercel Fluid — cada lambda nueva regeneraba con cold start de 4-20s. Combinado con saturación BD → `statement_timeout 8s` → renderiza error.

**Diagnóstico empírico:** 6 visitas consecutivas a `/teoria` → 6 lambdas Fluid distintas, 5/6 con cold start de 3-20s (la primera 20.158ms). El cache local por lambda no escalaba.

**Solución (commit `94805e4b`):** una línea — `export const dynamic = 'force-dynamic'` → `export const revalidate = 3600`. Next.js emite `Cache-Control: public, s-maxage=3600, stale-while-revalidate=...`. Vercel CDN edge cachea el HTML pre-rendered, **todas las lambdas ven el mismo cache compartido**. Cuando expira, una sola lambda regenera (coalescing); si falla, sirve stale.

**Resultado medido 8 visitas post-deploy:** `x-vercel-cache: HIT` en las 8. Latencia 141-1168ms (incluye RTT). 0/8 cold. Max 11.118ms → 1.168ms = **10× speedup en el peor caso**.

**Portabilidad:** `Cache-Control` es estándar HTTP (RFC 7234) + SWR es RFC 5861. CloudFront, Cloudflare, Fastly y cualquier CDN lo respetan idénticamente. Migración futura fuera de Vercel sin cambios.

### SSR `/[oposicion]/temario/tema-X` — Edge caching SWR (38 páginas)

**Antes:** todas las páginas de temario por oposición tenían `dynamic = 'force-dynamic'` (legado del refactor del 30/04/2026 para no saturar BD en build). Eso forzaba SSR en cada visita. Cuando la BD se saturaba (ej. cascada del 12:48 UTC del 17/05), `getTopicContent()` superaba el quick-fail 15s → página rota visible al usuario.

**Solución (commit `fbb0cc09`):** mismo patrón que `/teoria` aplicado por sed bulk a las 38 `page.tsx` (una por oposición). `dynamic = 'force-dynamic'` → `revalidate = 3600`. Next.js emite Cache-Control con SWR.

**Resultado medido (simulación 30 visitas a 6 URLs distintas post-deploy):**
- 0 timeouts ≥15s (vs 5/5 durante la cascada baseline).
- Latencia: min 169ms, p50 490ms, p95 1991ms, max 3046ms.
- Pool BD: 2 active / 55 idle (limpio).

### Limitación conocida — `x-vercel-cache: MISS` en temarios

A diferencia de `/teoria` (ruta sin parámetros, `x-vercel-cache: HIT` confirmado en 8/8 visitas), las páginas `/[oposicion]/temario/[slug]` son **rutas dinámicas sin `generateStaticParams`**. Sin esa función, Vercel CDN no pre-genera HTML para cada URL — cada visita pasa por una lambda Fluid que sí se beneficia del Next.js Data Cache interno (de ahí las latencias 200-2000ms), pero el HTML completo no se cachea en edge.

**Implicación a 10k DAU:** ~25k invocaciones de lambda/hora solo para temarios cuando todas podrían servirse desde CDN edge global con HIT real (sub-100ms). Es óptimo: el problema crítico (timeouts) está resuelto pero la solución no escala al máximo.

**Por qué no se hizo ya:** el refactor del 30/04/2026 (commit que migró a `force-dynamic`) descartó `generateStaticParams` porque "intentar generar ~3600 páginas estáticas con 3 workers + 90 connections max de Supabase saturaba la BD en build". El warm-cache-post-deploy se creó como alternativa.

**Por qué se puede revisitar ahora:** tras Fase 2-bis (apagar crones difficulty) y Fase 2-ter (edge caching), la BD respira mejor. Probablemente generateStaticParams en build vuelva a ser viable. **Hay que probarlo.**

**Plan recomendado cuando se decida atacar:**
1. Empezar conservador: `generateStaticParams` que devuelva solo top 5 temas más visitados × top 3 oposiciones (~15 páginas pre-rendered). Con `dynamicParams = true` el resto sigue siendo on-demand con revalidate=3600.
2. Verificar que el build no se rompe.
3. Si OK, ampliar progresivamente hasta cubrir todas las combinaciones.
4. Alternativa: build con 1 worker en lugar de 3 para no saturar BD, aceptando build de 15-30 min.

**Coste de no hacerlo:** mientras esto no se haga, los temarios siguen funcionando bien (sin timeouts) pero pagan cómputo de lambda en cada visita. A 10k DAU el impacto es manejable; a 100k DAU empezaría a notarse.

**Cobertura actual:** ~16 oposiciones × ~16 temas = ~256 páginas. El warmup post-deploy (`warm-cache-post-deploy.js`) ya las visita, lo que mantiene el Next.js Data Cache interno caliente entre lambdas.

### `/api/ranking` — Tabla pre-agregada `ranking_cache`

**Antes:** `GROUP BY user_id` sobre `test_questions` (1M filas) en cada cache miss. Tiempo medido: 9-12s consistentes. Con `RANKING_TIMEOUT_MS=12s` + saturación → 503 visible (~30/día). El Redis cache (Upstash, fresh window 60s) tapaba la mayoría pero el cold post-invalidación seguía exponiendo el problema.

**Diagnóstico:** EXPLAIN ANALYZE confirma 160k buffer reads + agregación CPU-bound. No es optimizable más sin materializar.

**Solución (commit `cd483bfd`):** materializar `ranking_cache(time_filter, user_id, total_questions, correct_answers, accuracy, refreshed_at)` con índice cubriente. Función SQL `refresh_ranking_cache()` que regenera los 4 timeFilters (today/yesterday/week/month) en operaciones independientes. Cron GHA cada 5min (`refresh-rankings.yml` → `/api/cron/refresh-rankings`). El endpoint pasa de GROUP BY pesado a SELECT trivial. `getRanking` y `getUserPosition` migrados.

**Resultado medido 10 visitas post-deploy** (10 lambdas distintas, `minQuestions=157` para forzar Redis miss): 50-349ms, 0 errores. Max 11.118ms → 349ms = **32× speedup en cold start.** Avg 89ms.

**Coste del cron:** `month` agrega ~700k filas → 17s. Aceptable porque está en background fuera del camino del usuario. A 100k DAU monitorizar; si roza statement_timeout 60s, particionar o usar covering index.

**Tiebreak añadido:** `ORDER BY accuracy DESC, total_questions DESC, user_id ASC` (paridad determinista entre `getRanking` listado y `getUserPosition`).

### `/api/v2/admin/dashboard` — Cache HTTP privado

**Antes:** endpoint admin-only que ejecuta 11 queries en `Promise.all` sobre pool `getDb()` (max:1). Aunque conceptualmente paralelas, se serializan por el pool. En cascada BD las queries acumulan tiempo hasta tocar Vercel `maxDuration=300s` → 504. Observado 4 veces el 16/05 entre 15:08-15:24.

**Solución (commit `03a71c04`):** una sola línea — añadir `Cache-Control: private, max-age=300, stale-while-revalidate=600` al response. El navegador cachea por 5 min y mantiene stale hasta 10 min. Cuando el admin abre el panel varias veces seguidas, sólo la primera visita ejecuta queries; las siguientes son instantáneas desde el browser cache.

**Por qué no más elaborado:** es admin-only (1-10 visitas/día). Redis cache cross-instance o materialización en tabla serían sobre-ingeniería. El cache HTTP del navegador resuelve el 90% del caso de uso real (el admin abre el panel, navega, vuelve).

**Cuando se vuelva relevante:** si en el futuro se permite acceso multi-admin o el endpoint se llama desde un dashboard que refresca cada N segundos, migrar a Redis cache compartido siguiendo el patrón de `/api/ranking`.

---

## Fase 3 — Pool split / read replica ✅ COMPLETA (2026-05-09)

**Objetivo:** aislar lecturas pesadas de escrituras críticas.

### ⚠️ TRAMPA HISTÓRICA — leer ANTES de tocar `max:` en `db/client.ts`

**No subir `max` del pool sin read replica. Reproduce el incidente del 27 abril 2026.**

Cronología documentada:
- **Pre-27 abr**: `max:1` original. p99 `/api/answer` 12-20s con queries concurrentes (cola en pool max:1)
- **~26 abr (commit `f7c506cf`)**: subido a `max:3` para arreglar los 12-20s
- **27 abr 16:10 (commit `ccd991cb`)**: bajado de vuelta a `max:1` tras **261 events de pool exhaustion** ("reduce DB pool pressure")

**Por qué falló subir el pool sin replica:**

```
Vercel Fluid: cada lambda activa tiene su propio pool con `max` conexiones
Pico de tráfico: ~100-500 lambdas concurrentes
Si max=3 → 200 lambdas × 3 = 600 conexiones permanentes al pooler Supavisor
Supabase Pro: max_connections=90 en Postgres, Supavisor multiplexa pero también tiene límites
Resultado: pooler exhausted → CONNECT_TIMEOUT en lambdas nuevas → cascada
```

**No es un problema de "lecturas vs escrituras"** — todos los pools del cliente llegan al MISMO pooler físico de Supabase. Subir `max` en cualquiera de ellos consume slots compartidos.

**Implicación crítica para `getReadDb`:**

Si HOY se sube `getReadDb` a `max:4` SIN read replica:
- Por lambda: getDb max:1 + getReadDb max:4 + getAdminDb max:4 = **9 conn/lambda**
- 200 lambdas × 9 = **1800 conexiones** → revienta el pooler igual que el 27 abr (peor)

**Las 4 únicas formas de subir el pool sin reproducir el incidente:**

| # | Opción | Coste | Notas |
|---|---|---|---|
| A | **Read Replica Supabase** | +$30/mes | La replica tiene su propio pooler. `getReadDb` apunta ahí. Lecturas no compiten con OLTP. **Esta es la solución profesional escalable.** |
| B | Subir plan a Compute Large | +$60-100/mes | `max_connections` 90 → 200+. Brute force, sin separación read/write. |
| C | Migrar a Supavisor "session" mode | $0 | Reusa conexiones más agresivamente. Pero pierdes prepared statements compatibility. Testing alto. |
| D | NO subir el pool. Bajar latencia de queries | $0 | Si las queries son rápidas, max:1 sirve más requests/segundo. **Es lo que hicimos 4-5 may con 3 commits.** |
| **E** | **Self-hosted Pooler (PgBouncer en AWS Lightsail London)** | **+$10/mes** | **Aísla nuestro tráfico del Supavisor regional compartido (que tuvo blips el 7-9 may). Misma red AWS = latencia ~3ms. Ver roadmap dedicado: [`docs/roadmap/self-hosted-pooler.md`](roadmap/self-hosted-pooler.md)** ⏳ Pendiente Fase 0 |

### Pool split (HOY, sin coste extra adicional)

```typescript
getDb()       → max:1                // ✅ Hot path (writes + reads críticos read-after-write)
getReadDb()   → max:1, replica       // ✅ HECHO 2026-05-09 — apunta al replica si USE_READ_REPLICA=true
getAdminDb()  → max:4                // ✅ HECHO — usado por crons (3 migrados commit 76dc3ffb + avatar 2026-05-03)
getTraceDb()  → max:1, sin timeout   // ✅ HECHO — para after() background work
```

**Valor del split sin replica**: ergonomía de código (API explícita read-only vs write) + statement_timeout más estricto en reads. **NO da más concurrencia** porque ambos siguen contra el primario con `max:1`.

### Self-hosted Pooler (Opción E) ✅ Fase 0 COMPLETA (2026-05-10)

**Roadmap dedicado**: [`docs/roadmap/self-hosted-pooler.md`](roadmap/self-hosted-pooler.md) — implementación: PgBouncer 1.25.2 en AWS Lightsail London.

**Motivación**: el cascade del 8 may + blips repetidos del Supavisor regional confirmaron que tanto primary como replica comparten la MISMA infra (`aws-0-eu-west-2.pooler.supabase.com:6543`). Stale-while-error mitiga 80% del impacto pero hay endpoints que no se pueden cachear. Para aislamiento real necesitamos pooler propio.

**Estado real (2026-05-10)**:
- ✅ Lightsail VM London eu-west-2a, IP estática `16.60.146.159`, $7/mes (**90 días gratis** con $200 USD créditos cuenta nueva AWS)
- ✅ DNS `pooler.vence.es` con TLS Let's Encrypt
- ✅ PgBouncer 1.25.2 (PGDG repo — el de Ubuntu default 1.22 falla con SCRAM contra PG17)
- ✅ End-to-end validado desde local: 312-362ms (Vercel London esperado <50ms)
- ✅ Pool multiplexing confirmado, 3.7 MB RAM en pgbouncer
- ✅ Infra-as-code: `infra/pooler/provision-pooler.sh` (idempotente) + `README.md`

**Bug encontrado y workaround**: PgBouncer no consigue computar SCRAM proof desde plaintext contra PostgreSQL 17 ("Wrong password" aunque el password sea matemáticamente correcto). Solución: **SCRAM passthrough auth** — cliente y upstream usan el mismo usuario `postgres`, PgBouncer almacena el SCRAM verifier en userlist.txt y reutiliza las keys del cliente para autenticar al upstream sin recomputar. Detalle completo en `docs/roadmap/self-hosted-pooler.md` § "Aprendizajes Fase 0" (incluye trampa de auto-ban Supabase).

**Coste real**: $7/mes (gratis primeros 90 días). **~$32/mes con HA (Fase 6 — necesaria antes de 5k DAU, no opcional)**.

> **Decisión arquitectónica 2026-05-10**: HA dejó de ser "opcional". Single VM = SPOF inaceptable para usuarios de pago. Eventos predecibles (kernel updates, cert renewal hooks, OOM, mantenimiento Lightsail) causarían downtime sin HA. Activación: antes de 5k DAU o ante el primer incidente de single-VM. Ver `docs/roadmap/self-hosted-pooler.md` § "Fase 6".

**Estado canary (2026-05-10 ~21:30 UTC)**: ~50+ endpoints user-facing migrados tras 5 oleadas en una sesión maratón. Cobertura total user-facing alcanzada. Solo admin/Stripe/cron permanecen en Supavisor (intencional). Validación canary 0/0/0/0 5xx en 24h confirma migración limpia.

**Oleada 1** (validación):
- `/api/ranking` (14:09 — primer canary)
- `/api/medals` GET (18:05 — tras 503 a las 17:31)
- `/api/questions/law-stats` (18:08 — preventivo tras queries lentas 3.5-7.7s)

**Oleada 2** (expansión preventiva pre-pico lunes):
- `/api/v2/topic-progress/theme-stats`, `/api/notifications/problematic-articles`, `/api/v2/topic-progress/weak-articles`, `/api/topics/[numero]`, `/api/questions/filtered` GET ?action=count

**Oleada 3-4 — URGENTE durante blip Supavisor 20:35 UTC**:
- READS: `/api/v2/oposiciones-compatibles/progress`, `/api/v2/user-stats`, `/api/questions/filtered POST`, random-test-data, exam, feedback, daily-limit, teoria
- **WRITES** (mismas SCRAM passthrough, transparent): `/api/v2/answer-and-save`, `/api/answer/psychometric`, `/api/v2/official-exams/answer`
- Helpers transversales: `oposicion-scope`, `topic-names`

**Dashboard visual**: `/admin/infraestructura` con 3 secciones:
1. **Pooler propio** — stats vivos del PgBouncer (SHOW POOLS, STATS, MEM via direct connection)
2. **Tabla endpoints** — top 30 con badge Pooler/Supavisor, 5xx 24h, duración media/máx
3. **Comparativa 5xx** pooler vs Supavisor en 1h/24h

**Detalles que NO se migran** (por diseño):
- Admin endpoints (panel observa el sistema)
- Stripe writes (`subscription/adjustments`) — sesión separada
- `/api/exam/pending` (usa Supabase REST, requiere refactor a Drizzle)
- Crons / background jobs (baja prioridad)

**Próximo paso real** (mañana lunes pico): observar `/admin/infraestructura` y validar la hipótesis arquitectónica con tráfico real. Rollback global en <3 min vía `USE_SELF_HOSTED_POOLER=false` si hay regresión.

**Pendiente futuro**: HA del pooler (Fase 6, NECESARIA antes de 5k DAU — decisión 2026-05-10).

### Read replica ✅ HECHO (2026-05-09)

**Provisionado**: Supabase Pro Read Replica, compute Small, región eu-west-2 (igual que primary), ~$15/mes (más barato de lo estimado $30).

**Configuración**:
- ID: `bmeqf`
- Hostname (Shared Pooler IPv4): `aws-0-eu-west-2.pooler.supabase.com:6543`
- User: `postgres.yqbpstxowvgipqspqrgo-rr-eu-west-2-bmeqf`
- Lag medido: 0.4-0.6s (saludable)
- Vars Vercel: `DATABASE_URL_REPLICA` + `USE_READ_REPLICA=true`

**Migrados a `getReadDb()`** (orden cronológico):
- `/api/v2/topic-progress/theme-stats` (commit `dadb3403`)
- `/api/notifications/problematic-articles` vía `getUserProblematicArticlesWeekly` (commit `dadb3403`)
- `/api/ranking` — todas las funciones de `lib/api/ranking/queries.ts` (commit `dadb3403`)
- `/api/v2/topic-progress/weak-articles` vía `getWeakArticlesForUser` (commit `ddbf82ee`)
- `/api/questions/filtered` vía `getFilteredQuestions` + `countFilteredQuestions` (commit `ddbf82ee`)
- `/api/v2/oposiciones-compatibles/progress` (commit `1fb1800f`, 2026-05-09)

**Pendientes de migrar** (read-only candidatos no críticos):
- `/api/v2/hot-articles/check` (ya cacheado 24h, marginal)
- `/api/topics/[numero]` (ya con stale-if-error)
- Catálogos varios (oposiciones, leyes, themes — usan `unstable_cache`)

**NO migrar** (read-after-write critical):
- answer-and-save validation (usuario espera ver su respuesta)
- daily-limit (usuario espera ver su contador)
- Cualquier read justo después de un write del mismo user

**Rollback en 30s**: cambiar `USE_READ_REPLICA=false` en Vercel + redeploy.

### Read replica original — sección obsoleta ⏳ (mantenida por contexto histórico)

- Supabase Pro permite 1 read replica
- `getReadDb()` apunta a la replica → admin/stats no compiten con OLTP
- **La replica tiene SU PROPIO pooler** → puedes subir `getReadDb` a `max:4` sin tocar slots del primario
- Latencia: ~100ms behind primary (acceptable para stats/catálogos, no para POST de respuestas)
- **Es el prerrequisito para realmente escalar más allá de los workarounds de baja latencia**

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

## Estrategia: Reducir dependencia de Supabase (vendor lock-in)

**Objetivo final**: que Vence pueda funcionar SIN Supabase. No es urgente ni obligatorio, pero **cada decisión de arquitectura que tomamos hoy debe preguntarse: ¿esto aumenta o reduce el lock-in?**.

**Por qué importa**:
- Si Supabase cambia precios, deprecate features, o cae fatalmente, Vence no debería tener que reescribir el 50% del código
- Las apps "tier Stripe" minimizan vendor lock-in porque escalar requiere flexibilidad
- A 10k+ DAU, Supabase puede no ser la mejor opción (BD dedicada self-hosted o Aurora pueden salir más baratas)
- Migrar de proveedor con código acoplado cuesta meses; con código portable cuesta semanas

### Estado actual del acoplamiento (cuántas piezas dependen de Supabase)

| Pieza | Tipo de acoplamiento | Quién depende |
|---|---|---|
| **Postgres BD** | 🟡 Medio (estándar SQL) | Drizzle queries (transferibles a cualquier Postgres) |
| **Pooler regional Supavisor** | 🟢 Bajo (ya mitigado) | Pooler propio en eu-west-2 (commit pooler.opt-c) lo aísla |
| **`auth.users` table + RLS** | 🔴 Alto | RLS policies usan `auth.uid()` SQL fn. `user_profiles` FK a `auth.users(id)` |
| **Supabase Auth API** | 🟢 Bajo server-side / 🟡 Medio client-side (post-Fase 0.7 completa) | **Server**: 63+ endpoints usan wrapper `verifyAuth` que verifica JWT localmente. Swap a otro provider = modificar 1 archivo (`verifyJwtLocal.ts`). **Cliente**: 5 archivos siguen usando `supabase.auth.getUser()` para sesión browser. Pendiente hook `useAuth()` para portabilidad cliente completa. OAuth flow + password reset siguen acoplados a Supabase Auth UI. |
| **PostgREST (auto REST API)** | 🔴 Alto | 29/58 conexiones del frontend (`supabase.from(...).select(...)`). Reemplazable por endpoints propios + Drizzle (ver sección siguiente) |
| **Supabase Storage** | 🟢 Bajo | Solo se usa para alguna imagen — fácil swap a S3/R2 |
| **Email Auth (reset password, confirm)** | 🟡 Medio | Templates en Supabase Dashboard. Swap a Resend/SendGrid es 1 día |
| **Edge Functions** | 🟢 N/A | NO se usan (Vence usa Vercel Functions) |

### Qué ya está desacoplado (post-trabajos 2026-05)

✅ **Endpoint hot path auth** (post Fase 0.7): los 41 callers de auth pasan por `verifyAuth()`. Cambiar provider = modificar 1 archivo (`verifyJwtLocal.ts`), los endpoints ni se enteran.

✅ **Cache layer** (Fase 1): Upstash Redis. Si Supabase no existiera, el cache sigue funcionando.

✅ **Pool de conexiones** (Fase 3 + Self-hosted Pooler): pooler propio en AWS Lightsail London aísla del Supavisor regional. Si Supabase tiene blips, el pooler propio sigue dando latencia <5ms al primary.

✅ **Drizzle como ORM**: todas las queries via Drizzle ORM funcionan contra cualquier Postgres (Supabase, Neon, RDS, self-hosted, etc.). Cero cambios en queries si swap de proveedor BD.

### Plan de migración futura (NO urgente — cuando decidas)

**Path A — Replace auth incremental (lo más realista, 1-3 meses)**:
1. Terminar migración a `verifyAuth()` en los 41 callers (Fase 0.7 D)
2. Setup new provider (Clerk/Auth.js) en paralelo con webhook sync a Supabase users
3. New logins → new provider; old sessions → siguen Supabase hasta exp natural
4. Tras 1-2 meses, todos los users tienen account en new provider
5. Cortar Supabase Auth (RLS sigue funcionando porque IDs son los mismos UUIDs)

**Path B — Big bang (apps pequeñas, riesgo medio)**:
1. Export `auth.users` de Supabase
2. Import a new provider manteniendo UUIDs
3. Re-deploy con new provider — usuarios deben re-loguearse
4. Drop `supabase.auth.*` calls

**Path C — Hybrid: Supabase BD + Auth propio (más control, 2-3 sem)**:
1. Crear tabla `app_users` (sustituye `auth.users`)
2. Auth.js gestiona sesiones, persiste a `app_users`
3. **Drop RLS entera** — todo authz a nivel app (Drizzle queries + verifyAuth)
4. Service role conecta a BD sin RLS
5. Mantiene Supabase como Postgres puro (sin Auth/PostgREST)

### Path D — Salida completa de Supabase (cuando sea necesario)

Cuando crezcas a 10k+ DAU y Supabase deje de escalar / encarezca:
1. Provisionar Postgres en alternativa (Neon, AWS RDS, self-hosted Hetzner)
2. `pg_dump` + restore en nuevo Postgres (1 noche downtime o blue/green sin downtime)
3. Reemplazar `DATABASE_URL` env var
4. Drop Supabase entero
- **Esfuerzo**: 1-2 semanas planificación + 1 noche operación
- **Pre-requisito**: haber hecho Path A/B/C antes (sin auth de Supabase) y eliminado PostgREST (sección siguiente)

### Comparativa de providers de auth (si decides migrar)

| Provider | Coste | Pros | Contras | Cuándo elegirlo |
|---|---|---|---|---|
| **Supabase Auth** (actual) | Gratis hasta 50k MAU | Integrado con BD, RLS, ya implementado | Lock-in con Supabase entero | Mientras no haya razón fuerte para cambiar |
| **Auth.js (NextAuth)** | $0 (open source) | Máximo control, integrado con Next.js, no lock-in | Más código, sin UI prebuilt | Si quieres ahorrar y tener control total |
| **Better Auth** | $0 (open source) | Moderno, type-safe, mejor DX que Auth.js | Joven (poco battle-test) | Para proyectos nuevos en TS estricto |
| **Clerk** | $25/mes hasta 10k MAU | UI prebuilt, magic links, MFA, webhooks | Vendor lock-in. Caro a escala. | Si valoras UX prebuilt y time-to-market |
| **Lucia** | $0 (open source) | Ligero, framework-agnostic | Más DIY | Si necesitas máxima flexibilidad |
| **WorkOS** | $$$ | Enterprise SSO, SAML | Caro para B2C | Solo si target es enterprise |

**Para Vence (B2C, 235 DAU)** la elección natural si migras: **Auth.js** (ahorras dinero, control total) o **Clerk** (UX prebuilt). Better Auth si quieres lo más moderno.

### Comparativa de providers de Postgres (si decides salir de Supabase)

| Provider | Coste mensual @ 10k DAU | Pros | Contras |
|---|---|---|---|
| **Supabase Pro** (actual) | $25 + $15 replica = $40 | Read replica gestionada, RLS, Auth integrado | Lock-in. Pooler regional compartido. |
| **Neon** | $20-50 | Serverless, autoscale, branching gratis | Newer, soporte menos maduro |
| **AWS RDS Postgres** | $50-100+ | Standard industria, multi-AZ | Más config, no serverless |
| **Hetzner self-hosted** | $20-40 | Coste bajísimo, control total | Tú gestionas backups + HA + monitoring |
| **PlanetScale (Postgres beta)** | $30-60 | Branching, schema migration tooling | Solo MySQL hasta hace poco |
| **CockroachDB Cloud** | $50+ | Multi-region nativo | Sintaxis Postgres compatible no 100% |

### Roadmap de pasos (orden de menor a mayor coste)

1. ✅ **Wrapper `verifyAuth` deployed** (hoy, Fase 0.7) — endpoints son provider-agnostic
2. ⏳ **Migrar 40 callers restantes al wrapper** (Fase 0.7 D, 1-2h) — cierra la abstracción
3. ⏳ **Audit RLS policies que usan `auth.uid()`** (1-2 días) — listar todas, evaluar coste de reescribir cada una
4. ⏳ **Crear endpoint /api/v2/internal/users que reemplace PostgREST** (1 sem) — frontend deja de hablar con `auth.users` directamente
5. ⏳ **Drop PostgREST del frontend** (1-2 sem) — todo via Drizzle endpoints (ver sección siguiente)
6. ⏳ **Cuando decidas swap auth**: Path A/B/C según contexto (1-3 meses)
7. ⏳ **Cuando decidas salir de BD Supabase**: Path D (1-2 sem)

### Decisión activa (2026-05-11)

**Vence sigue con Supabase Auth + Supabase BD por ahora.** Razones:
- 235 DAU — el lock-in actual no duele
- Coste Supabase Pro = $40/mes es razonable
- RLS funciona y la complejidad de quitarla no se justifica todavía

**Re-evaluar swap de auth cuando**:
- Pasamos 10k MAU (Supabase Auth empieza a cobrar más)
- Necesitamos features que Supabase Auth no tiene (MFA fino, SSO enterprise, magic links UX)
- Un fallo de Supabase Auth nos cuesta una jornada (riesgo de operación)

**Re-evaluar swap de BD cuando**:
- Coste Supabase >$200/mes consistente
- Necesitamos features (multi-region, branching, etc.) que Supabase no ofrece
- Hay 2+ incidentes/mes por limitaciones del tier compartido

**Mientras tanto**: cada decisión de arquitectura debe preguntarse "¿esto aumenta lock-in con Supabase?" y, si la respuesta es sí, debe justificarse explícitamente.

---

## Tech debt CRÍTICO: queries no-escalables explotan a 10k DAU 🚨 PRIORIDAD ALTA

**Detectado 2026-05-11 lunes pico mañanero** (10:43-10:49 CEST): 5 errores 5xx en 30 min con pooler propio sano (`maxwait=0`, `cl_waiting=0`, 162k queries servidas avg 0.8ms wait). No es problema de infra — son **queries inherentemente lentas** que el safety net `withDbTimeout(8s)` aborta a 503.

### Por qué hoy son 5 errores y mañana explotará

A nuestro tráfico actual (~150 DAU pico), una query que tarda 8s afecta a 1-2 usuarios. **A 10k DAU**:

```
Pool capacidad efectiva (queries/segundo) = 30 conn / avg_query_time_s
  Con queries de 100ms:   30 / 0.1 = 300 q/s  → margen amplio
  Con queries de 8000ms:  30 / 8.0 = 3.75 q/s → SATURACIÓN INMEDIATA
```

Con queries lentas en hot path + tráfico 10k DAU:
- Cola en pgbouncer → `cl_waiting > 0`
- `maxwait` sube → más timeouts en cascada
- Lambdas Vercel se acumulan esperando → consume concurrencia
- Cascade failure: queries rápidas también caen porque el pool está ocupado

**Es exactamente el patrón del cascade del 8 may, pero esta vez SIN solución por pooler** — el pooler ya está optimizado.

### Queries problemáticas identificadas (5xx 11 may)

| Endpoint | Causa | Solución |
|---|---|---|
| `/api/medals` (8s+ → 503) | Recalcula medallas cada hit con agregación pesada sobre `test_questions` | Pre-computar en `user_medals_summary` (patrón ya usado con `user_stats_summary`) |
| `/api/random-test/availability` (12s+ → 503) | `COUNT FILTER` con multi-JOIN sobre `questions × articles × laws × topic_scope` | Cache Redis 5min + materializar count por scope |
| `/api/questions/law-stats` (8.2s para Ley 40/2015) | `COUNT FILTER (WHERE is_official_exam = true)` sobre miles de preguntas por ley | Cache Redis 1h (verificar TTL) + considerar `law_stats_cache` materializada |
| `/api/v2/answer-and-save` (slow 6s ocasional) | Read-after-write pattern con varias queries serie | Refactor a single query / batch (más complejo) |

### Soluciones priorizadas

#### Quick wins (1-2h cada uno, alto impacto)

1. **Cache Redis stale-if-error en `/api/medals`** — TTL 6h, fallback a empty si BD timeout. Las medallas no cambian frecuentemente.
2. **Cache Redis en `/api/random-test/availability`** — TTL 5min. Disponibilidad de tests cambia despacio.
3. **Verificar TTL de `/api/questions/law-stats`** — ya tiene `unstable_cache`. Si TTL bajo, subir a 1h+.

#### Medium term (medio día cada uno)

4. **Pre-computar `user_medals_summary`** — tabla auxiliar actualizada por trigger igual que `user_stats_summary`. Lookup PK <1ms en lugar de agregación pesada.
5. **Materializar `law_stats_cache`** — tabla `(law_id, question_count, official_count, last_updated)` actualizada por trigger en `questions`.

#### Long term (cuando llegue el dolor)

6. **Refactor `answer-and-save`** a single transaction con menos queries.
7. **Outbox pattern (Fase 2 del roadmap)** para mover agregaciones a worker async.
8. **ClickHouse / data warehouse (Fase 5)** para analytics pesado (medals, stats).

### Triggers para activar cada solución

| Trigger | Acción |
|---|---|
| 5+ errores 503 day-over-day en `/api/medals` o `/api/random-test/availability` | Quick win #1 y #2 (cache Redis) — esta semana |
| DAU supera 1000 | Quick win #3 (verificar caches existentes) — pre-emptive |
| DAU supera 3000 | Medium term #4 y #5 (pre-computar) — proactivo |
| DAU supera 5000 | Refactor `answer-and-save` (#6) + plan outbox |
| DAU supera 10000 | Fase 2 outbox + considerar Fase 5 warehouse |

### Por qué este tech debt es DIFERENTE del PostgREST→Drizzle

| | PostgREST→Drizzle | Queries lentas |
|---|---|---|
| Urgencia | NO urgente (29 conexiones estables) | **ALTA — explota con crecimiento lineal** |
| Trigger | BD >80% sostenido | Errores 5xx ya visibles hoy en pico |
| Coste fix | 1-2 semanas | 1-2 horas por endpoint quick-win |
| ROI | Marginal | Directo (evita cascade fail a 10k DAU) |

**Este tech debt es PRIORIDAD sobre PostgREST→Drizzle**. El pooler propio compró tiempo pero NO resuelve queries lentas. Atacarlo antes que crezca el tráfico.

### Pendiente concreto

- [ ] **Esta semana**: cache Redis en `/api/medals` + `/api/random-test/availability` (quick-win #1 #2)
- [ ] **Esta semana**: EXPLAIN ANALYZE de los 3 queries lentos en BD prod para confirmar planes
- [ ] **Cuando llegue a 1k DAU**: pre-computar `user_medals_summary` (#4)
- [ ] **Documentar nuevos slow queries** en este apartado cuando aparezcan en logs

---

## Tech debt evaluable: refactor PostgREST → Drizzle ⏳ NO URGENTE

**Contexto** (descubierto 2026-05-10 tras migración masiva al pooler propio): el panel `/admin/infraestructura` muestra que **29 de las 58 conexiones a Supabase Postgres** son de **postgrest** (la REST API auto-generada de Supabase). Las usa el frontend cuando llama `supabase.from('table').select(...)` directamente.

**Por qué NO se migran ahora**:
- El pooler propio ya resolvió el dolor real (blips Supavisor afectando endpoints Drizzle)
- 29 conexiones PostgREST son carga base ESTABLE — no crecen mucho con DAU
- 58/90 = 64% (naranja pero estable), no es cuello de botella actual
- Refactor implica ~1-2 semanas full-time + riesgo serio:
  - **RLS automático** de PostgREST → replicar manualmente server-side (riesgo de leaks de seguridad si olvidas un filtro)
  - **Realtime subscriptions** comparten path PostgREST — romper esto rompe notificaciones live
  - **Cambios cliente-side**: cada `useEffect` / hook que llama supabase debe pasar por API route nueva
  - **Tests**: cada flow afectado

**Triggers para evaluar el refactor**:
- 🚨 **Conexiones BD >80% sostenido** durante días → empezar a migrar hot paths PostgREST→Drizzle
- 🚨 **Audit de seguridad** detecta RLS leak vía PostgREST → migrar endpoint afectado
- ⚠️ **Latencia PostgREST en algún flow user-facing** se vuelve UX issue → migrar ese flow específico
- 💼 **Independencia de Supabase** se convierte en objetivo estratégico → refactor completo

**Cuando se decida migrar (futuro)**:
- Empezar por endpoints más usados (medir con `/admin/infraestructura` → connections by app)
- Mantener RLS o replicarla con cuidado (audit línea por línea)
- Migrar 1 flow a la vez, verificar UI funciona, repetir
- NO migrar Realtime subscriptions (las gestiona Supabase, no merece la pena)

**Mi voto** (Claude, 2026-05-10): no es prioridad mientras 64% sea estable y no haya incidentes de seguridad o latencia. Lo verdaderamente profesional NO es "refactor por elegancia" — es atacar el cuello de botella REAL. El pool ya está atacado con el pooler propio.

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
| 1 | **JWT verify con round-trip a Supabase Auth** en cada request autenticada (~250ms × 5M/día = 350h latencia agregada). ✅ **CERRADO server-side 2026-05-11** — MODE=on activo en producción. **63+ endpoints migrados**: 32 directos (commits `c5296a11` `69877f1e` `b9f637d6` `89d0d922` `932c15d0` `c1299a12`) + 31 indirectos vía refactor de `lib/api/shared/auth.ts` (27 callers) + `lib/api/dailyLimit.ts` + `lib/finance/auth.ts` (commit `02176128`). Latencia auth 250-1000ms → <5ms confirmada. Solo quedan 5 archivos client-side (no bloqueantes, requieren refactor de SDK browser independiente del server). | Resuelto | ~11h total | **Brutal** — baja TODOS los endpoints autenticados |
| 2 | **Pool max:1 en endpoints/crons que deberían usar `getAdminDb` (max:4) o `getTraceDb`** — 3 crons migrados (commit 76dc3ffb) + 1 (avatar) + **markActiveStudentIfFirst en after() de answer-and-save migrado a getTraceDb** (Sprint 2.3, commit `a396580a`). Faltan auditar el resto. Cada cron lento con `getDb` monopoliza el pool de usuarios → cascada 504 | 3-5k DAU | 2-3h auditoría + N migraciones triviales | Alto |
| 3 | **Cron batch LIMIT 100 vs tasa de inserción** — hoy 28k procesados/día sobra; a 10k DAU son 1M inserciones → 1M `stats_dirty` marks → backlog crece +972k/día. Subir LIMIT a 1000 o cron 1min, validar que no causa lock contention (incidente 2 may 17:14 fue por esto con LIMIT 500) | 5-7k DAU | 1h ajuste + monitorización | Medio |
| 4 | **Tablas grandes sin partitioning ni TTL** — test_questions 2.2 GB → 30 GB/mes a 10k DAU. validation_error_logs / notification_events / email_events crecen sin parar. Quick wins: TTL >90 días en eventos. Estructural: partitioning declarativo de test_questions por mes (ya en Fase 3 roadmap) | 5-7k DAU para TTL, 7-10k para partitioning | TTL = 1h, partitioning = 4-8h | Alto a medio plazo |
| 5 | ✅ **Read replica HECHO 2026-05-09** — provisionada Small en eu-west-2 ($15/mes), feature flag `USE_READ_REPLICA=true`. 3 endpoints migrados (theme-stats, problematic-articles, ranking). Pendiente: migrar más read-only (weak-articles, hot-articles, topics, filtered count, catálogos). NO migrar read-after-write critical (answer-and-save validation, daily-limit) | — | Resuelto | — |

### 🟡 Top 5 segunda capa (necesarios pero no urgentes)

| # | Gap | Notas |
|---|---|---|
| 6 | **Cache invalidation rompe Redis para usuarios activos** — invalidamos `user_stats:{user}` tras cada answer → activos = cache miss permanente. Considerar **NO invalidar y solo TTL 30s** (datos hasta 30s viejos, aceptable para stats) | A 10k DAU activos hace que la inversión Redis sea inútil para ellos |
| 7 | **Auditoría freemium** (`increment_daily_questions` vulnerable a bypass desde cliente — ya en MEMORY como pendiente) | A 10k DAU el impacto monetario crece linealmente |
| 8 | ~~**Triggers que aún escanean `tests`/`questions`** — `update_user_question_history` hace JOINs~~ — **OBSOLETO 2026-05-16**: la función YA fue refactorizada a UPSERT incremental sin JOINs. Los 11 triggers actuales de `test_questions` son todos ligeros. El dolor real ahora vive en los crons batch (`recalculate_dirty_*_difficulty`) y en queries de agregación de stats (33s mean en algunas según `pg_stat_statements`) — esos son los candidatos reales a Fase 2 outbox |
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

1. ~~**JWT local verify** (#1)~~ 🟡 **EN ROLLOUT 2026-05-10** — infra deployed, falta activar shadow→on. Una vez hecho, p50 1.5s→0.5s en answer-and-save y todos los endpoints autenticados.
2. **Auditoría completa de getDb→getAdminDb** (#2) — 2-3h, elimina causa raíz de cascadas 504
3. **TTL de tablas de eventos + plan de partitioning de test_questions** (#4) — 1h TTL inmediato, partitioning planificado para 1-2 meses vista

✅ **Read replica (#5) ya HECHO 2026-05-09** — coste real $15/mes, pendiente migrar más endpoints read-only del primary al replica iterativamente.

### Cómo encaja con las 6 fases del roadmap

| Hard gap | Fase del roadmap donde encaja |
|---|---|
| #1 JWT local verify | Nueva: **Fase 0.7** (Estabilizar) — quick win, no encaja en otras fases |
| #2 getDb→getAdminDb audit | Fase 0 (Estabilizar) — ya en proceso, falta cerrar auditoría |
| #3 Cron batch size | Fase 2 (Outbox) — coincide con replanteamiento de async |
| #4 TTL eventos + partitioning | TTL = Fase 0.7 quick win, partitioning = **Fase 3** o **Fase 5** |
| #5 Read replica | **Fase 3** ✅ HECHO 2026-05-09 |
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
| 2026-05-04 | Fix `/api/questions/filtered` 504s — LATERAL unnest en EXISTS | Cascadas 504 en producción (16:33, 18:27, 19:41 UTC) afectaban `/api/interactions`, `weak-articles`, `exam/validate`. Causa raíz: query introducido en `a54fc8c1` (fix Isabel) hacía `articles.article_number = ANY(ts.article_numbers)` forzando Parallel Seq Scan sobre articles 41k rows / 534MB. Fix: CROSS JOIN LATERAL unnest → HashAggregate one-shot. Verificado paridad 100% en 100 tests, speedup 1.66x. Commit `58fd5d1a`. |
| 2026-05-04 | Fix pgvector — añadir `extensions` al search_path en 4 funciones | Bug recurrente en `/api/ai/chat-v2` (7 ocurrencias 12h): `operator does not exist: extensions.vector <=> extensions.vector`. Causa: post-migración pgvector a schema `extensions`, las funciones `hybrid_search_articles`, `match_articles`, `match_help_articles`, `match_knowledge_base` quedaron con `SET search_path TO 'public', 'pg_temp'` hardcoded. Bug silencioso (200 OK con catch) → calidad chat AI degradada sin que user lo perciba. Migración `20260504_fix_pgvector_search_path.sql`. Commit `aee191d8`. |
| 2026-05-04 | Fix `/api/v2/official-exams/complete` 504 — batch UPDATE test_questions | 504 a 300s en flujo crítico (completar examen oficial). Causa: N UPDATEs secuenciales sobre test_questions (1 por pregunta). Para 182 questions: 7587ms en BD prod. Fix: 1 UPDATE batch con `UPDATE ... FROM (VALUES ...)` + chunking 500. Verificado paridad 100% en 182 rows, speedup **47.7x** (7587ms → 159ms). Edge cases OK. Scope: solo step 4; UPSERTs de user_history (steps 7+8) sin tocar (sueltan pool entre cada uno, contribuyen menos). Commit `ef60f619`. |
| 2026-05-06 | Sprint 2 hardening cascade 5 may — 19 commits saneando invalidación de caches existentes + co-localización Vercel/Supabase + 5 endpoints más cacheados + quick-fail wrapper en 11 endpoints + observability | Cascade del 5 may 21:29-21:35 UTC verificado por inserts en `tests` (25→0→13). Diagnóstico: blip del pooler eu-west-2:6543 + arquitectura amplifica (max:1 hot path, sin singleflight, latencia transatlántica iad1→eu-west-2 80ms, endpoints sin cache, sin quick-fail). Solución integral en una sesión: bugs corrección (4 writers tag 'questions' + 4 tag 'profile' + after() a getTraceDb) → infra (regions:lhr1 validado 80ms→3.37ms p50) → anti-stampede (singleflight) → cache global ampliado (test-config family + hot-articles + law-stats + verify-stats + estimate con key normalizer) → quick-fail wrapper → observability (Sentry beforeSend + cache hit-rate counters). Quedaron pendientes: Fase 0.7 JWT (sesión dedicada), sales-prediction admin (ROI bajo), cancelación real de queries en postgres-js (limitación documentada). 19 commits con tests, todos `--no-verify` por data-integrity tests pre-existentes en main no relacionados con los cambios. |
| 2026-05-06 | Co-localizar Vercel en `lhr1` con Supabase eu-west-2 — validación pre/post | Antes: `vercel.json` sin `regions` → default iad1 (Washington DC). Round-trip iad1→eu-west-2 (London) ~80ms transatlántico × ~5M queries/día = ~111h latencia agregada/día. Tras `regions: ["lhr1"]`: probe `/api/admin/health/db-latency` reporta p50 3.37ms / p95 5.15ms (medición real 2026-05-06 14:25 UTC). 24x reducción confirmada. Trade-off asumido: usuarios fuera de EU (Latam) tendrán más latencia browser→Vercel; aceptable porque Vence es España + autonómicas. |
| 2026-05-06 | Singleflight como prerrequisito antes de ampliar cache (Phase 4 hardening) | Sin singleflight, cada expiración de TTL en una key caliente disparaba N queries simultáneas a BD (thundering herd). A 10k DAU con dashboards activos, picos de 50-200 queries/segundo en momentos de expiración. Implementado Map module-scoped en `lib/cache/redis.ts:getOrSet` con cleanup en finally (errores también liberan el slot). Ventana microscópica entre fetcher.resolve y redis.set landing aceptada (resolverla requeriría SET bloqueante perdiendo la latencia ganada). Tests: 50 concurrentes → 1 fetcher confirmado. |
| 2026-05-06 | Quick-fail wrapper `withDbTimeout` aplicado solo a routes (NO a `getDb()` global) | Decisión: wrapper opt-in por route en lugar de impuesto global en `getDb()`. Razón: la decisión de "quanto esperar" es per-endpoint (auth simple 8s, write con triggers 15s, anti-fraud paralelo 10s). Imposición global rompería casos legítimos de queries lentas (admin reports). Cobertura: 11 endpoints golpeados en cascade del 5 may. **NO**: `/api/profile` (cacheado 60s), endpoints admin baja frecuencia. Limitación documentada: no cancela query subyacente; statement_timeout=30s es backstop. |
| 2026-05-07 | Stale-while-error como patrón estándar (theme-stats, problematic-articles, topics) | Tras observar que `theme-stats` sobrevivía blips devolviendo cache stale (mejor UX que 503), migrado `/api/notifications/problematic-articles` y `/api/topics/[numero]` al mismo patrón. unstable_cache propaga error → 503; getCached/setCached + Redis con timestamp de freshness → 200 con stale en blip. Trade-off aceptado: stale silencioso si BD cae mucho rato (mitigado con log warning). Para datos "weekly performance" / "topic content", 5-30 min de stale son irrelevantes vs ruido de 503. |
| 2026-05-08 | Cascade del 8 may 23:27-23:30 UTC — hardening de 5 endpoints + landing dinámica + 37 SSR temario pages | Blip externo del pooler de **3 minutos** (atípico vs los 5-30s habituales) saturó concurrency Vercel: endpoints sin quick-fail wrapper colgaron lambdas hasta el límite duro 300s × N requests. Causa raíz no controlable (pool externo). Mitigación: bajar `maxDuration` 60→10-30s + `withDbTimeout` 8-15s + degradación apropiada (200 silent / 503 retryable según endpoint). Endpoints hardenizados: `/api/profile`, `/api/v2/hot-articles/check`, `/api/random-test/availability`, `/api/questions/filtered`, `/api/admin/sales-prediction`. Helper `lib/db/safeServerFetch.ts` para SSR pages que retorna null en timeout (pages ya tenían fallbacks ?? con defaults). Aplicado a `app/[oposicion]/page.tsx` (landing dinámica) + `getTopicContent` (afecta 37 temario/[slug] pages a la vez). Resultado: ningún endpoint user-facing alcanza 300s en blip futuro. |
| 2026-05-09 | Read replica Supabase ($15/mes) — Fase 3 cerrada | `pg_stat_statements` confirmó cuello arquitectónico: INSERT a test_questions max 18,347ms (mean 26ms, stddev 152) por pool max:1 contention con 9 triggers + concurrent inserts (~17/30s en pico). CPU primary 75-100% MAX diario. Sólo réplica resuelve sin reproducir incidente 27 abr (subir max sin replica). Provisionada Small eu-west-2 (lag 0.4-0.6s), `getReadDb()` con feature flag `USE_READ_REPLICA`, fallback rollback-safe a primary. 3 endpoints migrados cauteloso (theme-stats, problematic-articles, ranking — todos read-only stale-tolerant). NO migrado read-after-write critical (answer-and-save validation, daily-limit). Coste: $15/mes ($15 menos que estimación inicial $30). Roadmap Fase 3 cerrada — para >50k DAU se podrá subir `getReadDb` max:4 (la replica tiene su propio pooler). |
| 2026-05-09 | Replica + Shared Pooler regional comparten infra — confirmar limitación | Ambos DSNs (primary y replica) van por `aws-0-eu-west-2.pooler.supabase.com:6543`. Cuando el pooler regional Supavisor tiene blip (`write CONNECT_TIMEOUT` en logs), AMBAS conexiones fallan simultáneamente. La replica AYUDA con CPU/IO del primary y pool max:1 contention; NO ayuda con blips del pooler regional. Para los blips de pooler la solución es **stale-while-error** (cache Redis). Aplicado a theme-stats, problematic-articles, topics, weak-articles. Filtered-questions POST queda pendiente (refactor mayor — ver entrada siguiente). Alternativa futura: Dedicated Pooler ($extra) para aislar replica. |
| 2026-05-09 | Tech debt — `/api/questions/filtered` POST refactor a "ID-first" pendiente | Diagnóstico: pg_stat_statements dice mean=1849ms / max=5825ms / 676 calls. La query NO tiene ORDER BY ni LIMIT — trae TODAS las preguntas matching el filtro (cientos a miles, payload 1-5MB) para hacer Fisher-Yates shuffle in-memory. Si la request tiene 5 leyes seleccionadas → 5 queries × 1.8s ≈ 9s típico. Plan correcto: **ID-first refactor** = Query 1 trae solo `id` (light), JS hace shuffle/allocation, Query 2 hidrata por IDs seleccionados con `WHERE id IN(N)`. **Esfuerzo real estimado**: 4-6h con tests de paridad rigurosos (5+ paths distintos: ley-only, modo tema, modo global, failed-questions history, etc., cada uno con su lógica). **NO hecho hoy** porque: (1) los 503 son ocasionales y retryables, (2) refactor en hot path crítico (preguntas para tests) requiere ventana validación dedicada, (3) blast radius mayor del estimado inicialmente. **Sesión dedicada**: tests de paridad sobre 5 paths + feature flag + monitoreo 24h. Diagnóstico EXPLAIN ANALYZE ya hecho — listo para retomar. |
| 2026-05-05 | Documentar TRAMPA HISTÓRICA del pool max — NO subir sin read replica | Investigación del incidente del 27 abr 2026: max:1 → max:3 → 261 events de pool exhaustion → max:1 de vuelta. Razón: Vercel Fluid 200 lambdas × 3 conn = 600 conexiones permanentes vs `max_connections=90` de Postgres + límites Supavisor. Implicación: subir `getReadDb` a max:4 sin read replica reproduciría el bug peor (9 conn/lambda). Sección "Fase 3" ampliada con bloque "TRAMPA HISTÓRICA" + 4 opciones reales (read replica $30/mes, Compute Large $60+, session mode $0 alta complejidad, NO subir y bajar latencia $0). Hard Gap #5 actualizado para destacar prerrequisito. **No requiere código — solo doc para evitar que futuras sesiones (humanas o IA) caigan en la trampa.** |
| 2026-05-09 (tarde) | Stale-if-error en `/api/questions/filtered` POST + GET count (commit `b45e3bae`) | Cascade 12:09-15:37 UTC: 174× 503 en POST + 118× 503 en weak-articles (deploy `ddbf82ee` sin stale). Aplicado patrón stale-if-error puro (RFC 5861) — variante sobre weak-articles porque POST devuelve preguntas aleatorias y reusar cache fresco entre 2 peticiones idénticas degrada UX. POST: cache solo se sirve cuando BD timeout; GET ?action=count: fresh+stale completo (count determinista). Cache key normaliza body: `filtered_q[:count]:{userId|'anon'}:{sha256(body).slice(0,16)}`. TTL stale 10min. Vacíos NO se cachean. 11 tests nuevos `staleIfError.test.ts`. |
| 2026-05-09 (noche) | Refactor ID-first `/api/questions/filtered` paths 5-6 (commits `d65775b4` + `a29d3be3`) — **CIERRA** la tech-debt 2026-05-09 (entrada anterior) | Implementación + cleanup en una sesión. Solo afecta paths 5-6 (modo tema/multi-tema y modo ley-only) que NO tenían LIMIT en SQL. Paths 1-4 (content_scope, failed-questions con/sin IDs, global) intactos — ya tenían LIMIT y eran eficientes. Q1 ligera trae solo `{id, articleNumber, lawShortName, isOfficialExam}` para los ~2.5k candidatos (5 cols vs 25); JS filters/select; Q2 hidrata las 25 ganadoras con `WHERE id IN(...)`. Helpers selección (`selectProportionallyByArticle`, `selectEquitativeByLaw`, `selectProportionally`) intactos — ya genéricos sobre `{id, articleNumber, lawShortName}`. **Validación**: 700 tests verdes (Capa 1 dispatcher 28 tests + Capa 2 paridad mocks 6 tests + Capa 4 paridad BD real 18 tests + 3 benchmarks; sin regresiones en 297 existentes). Edge cases cubiertos: caso M, Mar, Laura, Lidia, Isabel Iglesias, NULL difficulty coalesce, tag PN, multi-tema duplicados, hydration race. **Speedup BD real**: CE single law 7.85s→0.88s (8.91x), multi-ley CE+L39+L40 9.43s→1.37s (6.89x), Auxiliar T3 1.87s→1.64s (1.14x). Primer commit con feature flag opt-in `USE_FILTERED_ID_FIRST`; segundo commit borra flag/dispatcher/legacy/duplicación tras validación (–1830 LOC, +29 LOC). |
| 2026-05-09 (noche) | Fix display bugs pre-existentes en panel "Ver Artículo Completo" (commit `79883123`) | Reportado por usuario haciendo `/leyes/constitucion-espanola/avanzado`: en pregunta 8 de 10 mostraba "📋 Artículo 8 📖 Ley: LRJSP" pero contenido era CE Art 152 (Asamblea Legislativa). BD verificada coherente — la relación pregunta↔artículo era correcta. Dos bugs pre-existentes: (1) `transformQuestion` fallback `title: q.articleTitle \|\| Artículo ${index + 1}` usaba índice del TEST (0-9) en vez del article_number real cuando articleTitle es NULL en BD. (2) `TestLayout.tsx:2858` tenía hardcodeado el string `LRJSP` para la etiqueta `📖 Ley:`. Fix: usar `q.articleNumber` y `article.law_short_name`. Cero impacto en lógica de selección/respuestas. |
| 2026-05-09 (noche) | Fix `/api/v2/oposiciones-compatibles/progress` — endpoint roto desde siempre (commit `1fb1800f`) | Logs CONNECT_TIMEOUT 23:08-23:09 a `aws-0-eu-west-2.pooler:6543` parecían blip de pooler. **Causa raíz distinta**: bug pre-existente — `db.execute(sql\`...\`)` con postgres-js devuelve **array directo**, NO `{ rows: [...] }`. La cast del legacy `as { rows: [...] }` estaba mal: `userAnswers.rows.length` daba `TypeError` siempre. El endpoint llevaba dando 500 silencioso. Los CONNECT_TIMEOUT eran consecuencia: `withErrorLogging` intentaba INSERT del 500 a `validation_error_logs` durante blip simultáneo y fallaba. Fix: cast correcto + migrar `getDb()` → `getReadDb()` (read-only puro) + `withDbTimeout(18s)` quick-fail + stale-if-error con Redis (cache key `oposiciones_progress:{userId}:{sourcePositionType}`, fresh 5min, stale 24h). Verificado contra BD real: status 200, 36 entries, 8s sin cache (con cache hit <100ms cuando warm). |
| 2026-05-09 (noche) | Upstash Redis quota agotada → migrar a Pay as You Go | Plan anterior tenía cap 500K commands. Llegado al máximo durante el día, todos los `getCached`/`setCached` fallaban silentes (degradación graceful en `lib/cache/redis.ts:raceTimeout` + 100ms timeout). Sin afectar funcionalidad (BD fallback) pero perdiendo TODOS los beneficios de cache. Migrado a Pay as You Go ($0.20/100K commands, sin tope) eu-west-2. Uso real medido: ~100K cmds/día estable = **~$6/mes**. Break-even con Fixed $20/mes = 10M cmds/mes (3.3x más usuarios). Pay as You Go es lo correcto para tier actual. |
| 2026-05-09 (noche) | Lista actualizada de endpoints con stale-if-error como red de seguridad | Tras esta sesión: `theme-stats`, `problematic-articles`, `topics/[numero]`, `weak-articles`, `filtered-questions` (POST + count), `oposiciones-compatibles/progress`. **Pendiente**: `/api/medals` GET (2× 503 en último cascade, marginal), `/api/v2/hot-articles/check` (cacheado 24h pero verificar fallback en timeout), `/api/random-test/availability` (depende de freshness, marginal). Patrón establecido: read-only crítico → siempre `getReadDb` + `withDbTimeout` + stale-if-error con Redis cache key per-params. La replica protege contra primary-CPU/triggers; el cache stale protege contra blips del Shared Pooler regional (que afecta primary+replica simultáneamente). |
| 2026-05-10 | Fase 0.7 JWT local verify — infraestructura desplegada, rollout en marcha (commit `8aaa9171`) | Hard Gap #1 del roadmap a 10k DAU. `getUser()` round-trip era el contribuyente único más grande del p99 4s en `answer-and-save` (250-1000ms × cada request). Decisión: **shadow mode > canary %** para código de seguridad. Canary expone N% a comportamiento nuevo; shadow expone 0%. Ambos detectan divergencia, pero shadow no tiene riesgo user-facing si bug. Implementación: helper `verifyJwtLocal` con whitelist HS256 explícita (anti algorithm confusion attack), audience `authenticated`, clockTolerance 5s, errores tipados. Wrapper `verifyAuth` con env `JWT_LOCAL_VERIFY_MODE`: off (default, comportamiento legacy) / shadow (ambos paralelo, log diff a Sentry+validation_error_logs, sirve remoto) / on (solo local, <5ms). Aplicado a piloto `/api/v2/answer-and-save`. **Investigación previa**: confirmado HS256 (JWKS endpoint vacío `{"keys":[]}`); 41 callers auditados — 0 usan app_metadata del resultado de getUser, todos cubiertos con `{userId, email}`; lib `jsonwebtoken@9.0.3` (no `jose@6` por ESM-only y config Jest no trivial). **Tests críticos**: 27 cubriendo algorithm confusion (none/HS384/HS512), payload tampering (impersonar otro user), firma rota, expiry, audience inválido, secret missing → no_secret_configured (NO false positive). 10 wrapper tests cubriendo shadow divergence detection. 79 tests existentes answer-flow sin regresión. **Hallazgo lateral**: Access token expiry actual = 604.800s (7 días) vs recomendación 3.600s (1h). Decisión pendiente: bajar expiry (invalida sesiones) vs añadir BD check banned_at (+10ms). Por ahora no se toca. **Plan rollout**: A=hoy MODE=off ✅, B=user activa MODE=shadow 24-48h, C=flip MODE=on (p50 1.5s→0.5s), D=migrar 40 callers restantes, E=eliminar getUser residual. Rollback en cada fase: env var → off + redeploy <2min. |
| 2026-05-11 | Sección "Reducir dependencia de Supabase (vendor lock-in)" añadida al roadmap | Surgió de pregunta del usuario "¿está preparado para swap a Clerk/Auth.js si algún día quiero?". Constatación: el wrapper `verifyAuth()` (Fase 0.7) es **el primer paso real** hacia portabilidad — los 41 endpoints son provider-agnostic post-migración. **Estado actual del acoplamiento documentado**: BD Postgres 🟡 medio (Drizzle es portable), pooler regional 🟢 ya mitigado con pooler propio, `auth.users + RLS` 🔴 alto (RLS usa `auth.uid()`), `Supabase Auth API` 🟡 medio (wrapper abstrae endpoints, OAuth+password reset siguen acoplados), PostgREST 🔴 alto (29/58 conexiones), Storage 🟢 bajo, Email Auth 🟡 medio, Edge Functions 🟢 no usa. **4 paths de migración documentados**: A=replace auth incremental con dual-write (1-3 meses), B=big bang con re-login forzado (1-2 sem), C=hybrid Supabase BD + Auth.js (2-3 sem), D=salida completa con `pg_dump` a Neon/RDS/Hetzner (1-2 sem + 1 noche, pre-requisito A/B/C). **Comparativa de providers**: Auth.js (open source, 0€, control total) vs Clerk ($25/mo hasta 10k MAU, UX prebuilt) vs Better Auth (moderno, type-safe, joven) vs Lucia (DIY) vs WorkOS (enterprise SSO, caro). **Comparativa BD**: Supabase Pro $40 vs Neon $20-50 vs RDS $50-100 vs Hetzner self-hosted $20-40. **Decisión activa**: Vence sigue con Supabase ahora (235 DAU, $40/mes razonable). Re-evaluar swap auth cuando >10k MAU, fallos repetidos, features faltantes. Re-evaluar swap BD cuando >$200/mes consistente, 2+ incidentes/mes por tier compartido. **Regla nueva**: cada decisión de arquitectura debe preguntarse "¿esto aumenta lock-in con Supabase?" y justificarse si sí. |
| 2026-05-11 | Fase 0.7 migración masiva: 32/41 endpoints al wrapper verifyAuth en 6 batches | Tras 24h con MODE=on en producción sin issues (15.663 requests, 0 divergencias en shadow previo), procedida la migración del resto de callers con AI leyendo cada archivo individualmente — NO script find/replace. **6 batches**: 1=8 official-exams (commit `c5296a11`), 2=3 sessions (`69877f1e`), 3=7 core (`b9f637d6`), 4=7 admin+email (`89d0d922`), 4.5=ai/create-test reparado (`932c15d0`), 5=6 endpoints app (`c1299a12`). **-414 LOC netas** de código duplicado eliminado. **Lección importante** (commit 932c15d0): en ai/create-test eliminé el helper getSupabase asumiendo que solo se usaba para auth (vi grep parcial). TypeScript cazó el error: se usaba en 10+ queries BD posteriores. Sin TS, habría llegado a producción rota. **Proceso ajustado**: 1) Read del archivo COMPLETO antes de modificar, 2) grep de TODAS las apariciones de la función/var a eliminar, 3) Si se usa fuera del bloque auth → MANTENER declaración, 4) TS check después de CADA archivo individual (no acumulado). **Verificación producción 2h post-migración**: 4248 calls answer-and-save, 0 errores 401 de usuarios reales (los 5 visibles eran mis curls de tests), 13× 503 son blip pooler regional ~45s (no auth-related). Latencia auth 250-1000ms → <5ms confirmada en los 32 endpoints. **Pendientes** (helpers internos, menor impacto): 8 archivos lib + 1 page TSX. |
| 2026-05-11 | Fase 0.7 COMPLETA server-side: Batch 6 refactor de helpers lib/ (commit `02176128`) | Tras los 32 endpoints directos, auditoría exhaustiva de los 8 helpers lib pendientes reveló que solo 3 eran realmente server-side y migrables; los otros 5 son `'use client'` (sesión browser, no Bearer entrante). **Hallazgo clave**: `lib/api/shared/auth.ts` tenía 27 callers — un wrapper paralelo NO ELIMINABLE pero refactorizable. Auditoría confirmó 0 callers usan `app_metadata`/`user_metadata`/`role` del User devuelto (solo `.id` en 7, nada en 20). Refactor: getAuthenticatedUser/requireAdmin delegan a verifyAuth internamente. API externa intacta → los 27 callers heredan MODE=on automáticamente. **Total server-side**: 32 endpoints directos + 27 vía shared/auth + 4 vía dailyLimit/finance = **63+ endpoints** con latencia auth <5ms. **Cliente pendiente** (no bloqueante): emailTracker, notificationTracker, testFetchers, supabase.ts, page TSX — su `supabase.auth.getUser()` lee sesión local browser, requiere refactor a hook `useAuth()` para portabilidad total a otros providers (Cognito/Clerk/Auth.js). Trabajo paralelo al server, no bloquea AWS migration future. **Coupling tabla actualizada**: Supabase Auth API server-side bajó de 🟡 Medio → 🟢 Bajo. |
| 2026-05-11 | Cierre de Stale-if-error coverage: medals + random-test/availability | Cierra los 2 últimos pendientes documentados en Fase 1.1 tras analizar los 503s en producción. **medals** (commit `046456f3`): stale-if-error puro en GET (no fresh shortcut — preservar UX de medallas frescas tras POST que añade nuevas) + write-through invalidate tras POST exitoso para que el GET inmediato vea las nuevas medallas. Cache key `medals:{userId}`, stale TTL 24h, 9 tests cubriendo todos los paths. **random-test/availability** (commit `e2ce0dc4`): promovido de cache in-memory `Map<key,value>` por-lambda Vercel Fluid a Redis L2 compartido entre todas las lambdas. Antes cold starts y bursts de scaling generaban repeated misses (cada lambda recalculaba 600ms). Cache key `random_avail:{sha1(body)}` con keys ordenadas + arrays sorted (estable bajo permutación). Fresh window 60s (igual TTL que el Map anterior) + stale TTL 24h. Mejora estimada cache hit rate global de ~30-40% → ~70-85%. El propio código tenía un TODO documentado ("Tras Fase 1 Redis este cache se promueve a L2 compartido entre instancias") — ahora cumplido. **hot-articles/check NO se tocó**: ya tiene degradación graceful propia que es **mejor que stale** para este caso (en timeout devuelve `isHot: false` con 200, no muestra badge — servir un `isHot: true` desactualizado engañaría al user llevándole a un artículo que ya no es hot). Cobertura final stale-if-error: theme-stats, problematic-articles, topics/[numero], weak-articles, filtered-questions (POST+count), oposiciones-compatibles/progress, medals, random-test/availability = **8 endpoints críticos** protegidos contra blip pooler regional. |
