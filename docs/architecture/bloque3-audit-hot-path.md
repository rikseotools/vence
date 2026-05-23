# Bloque 3 — Audit hot path para Etapa 2 backend NestJS

**Fecha:** 2026-05-23
**Autor:** sesión Claude tras cierre Fase 2-bis.
**Objetivo:** datos reales (errores 7d, tráfico, cascade frequency) y catálogo técnico (deps, patrones, complejidad) para decidir **qué endpoint migrar primero** al backend dedicado NestJS/Fargate.

No es un plan de implementación — es el input cuantitativo del que partirá ese plan en la sesión que arranque Bloque 3.

---

## 1. Métricas reales (últimos 7 días)

Fuente: `validation_error_logs` + agregados en `tests` / `test_questions`.

### 1.1 Volumen de tráfico (proxy: inserts BD)

| Métrica | Promedio/h | Peak/h (18h Madrid) | Total 7d |
|---|---:|---:|---:|
| `test_questions` inserts (proxy `answer-and-save`) | **1.061** | **5.704** | 178.184 |
| `tests` creados (proxy `daily-limit` checks) | 57 | ~100 | 9.523 |

**Lectura:** answer-and-save ve **~5.700 inserts/h en peak**. Es donde rompen las cascadas.

### 1.2 Errores por endpoint (top hot path)

| Endpoint | Errors 7d | 503 | 504 | 500 | 4xx | p50 ms | p95 ms | max ms |
|---|---:|---:|---:|---:|---:|---:|---:|---:|
| `/api/v2/answer-and-save` | **222** | 32 | 0 | 0 | 190 (anti-fraud) | 74 | **15.056** | 15.301 |
| `/api/medals` | **34** | **34** | 0 | 0 | 0 | 3.057 | **15.038** | 15.078 |
| `/api/stats` | 3 | 0 | 0 | 3 | 0 | 111.040 | **153.427** | 158.137 |
| `/api/v2/test-config/articles` | 2 | — | — | — | — | — | 41.648 | — |
| `/api/v2/test-config/sections` | 1 | — | — | — | — | — | 44.602 | — |
| `/api/daily-limit` | **0** | 0 | 0 | 0 | 0 | — | — | — |
| `/api/v2/stats` | 0 | 0 | 0 | 0 | 0 | — | — | — |

**Lecturas clave:**
- `answer-and-save` lidera por volumen (222 errors, 32 son 503 quick-fail de timeout 15s).
- `medals` 100% son 503: cuando falla, falla por timeout, no por validación.
- `stats` con bajo volumen y **p95 = 153s** que **resultó ser deuda histórica del 29/04** — pre-refactor `getRecentTests` a `LEFT JOIN LATERAL`. Hoy las 10 queries paralelas suman <200ms con el user más heavy. Detalle en §4-bis. **Falsa alarma del audit.**
- `daily-limit` **0 errores 7d** — actualmente sano tras el Sprint 5 (cache stale-if-error). **No urge migrarlo.**
- `test-config` 3 errores 7d pero p95 ~44s = cuando falla, falla con Vercel Timeout.

### 1.3 Cascade frequency (ventanas de ≥3 errores 5xx mismo endpoint en 5min)

| Endpoint | Ventanas 7d | Total errors | Peor bucket |
|---|---:|---:|---:|
| `/api/questions/user-failed` | 5 | 37 | 20 |
| `/api/ranking` | 3 | 10 | 4 |
| **`/api/v2/answer-and-save`** | **3** | **23** | **11** |
| `/api/questions/filtered` | 2 | 9 | 5 |
| **`/api/medals`** | **2** | **6** | **3** |
| `/api/v2/difficulty-insights` | 1 | 8 | 8 |
| `/api/random-test/availability` | 1 | 4 | 4 |
| `/api/topics/[numero]` | 1 | 3 | 3 |
| `/api/exam/answer` | 1 | 3 | 3 |

### 1.4 Co-ocurrencia (endpoints que TAMBIÉN fallan cuando answer-and-save cascadea, 14d)

| Endpoint arrastrado | Errores en ventana de cascade |
|---|---:|
| `/api/medals` | 56 |
| `/api/questions/filtered` | 42 |
| `/api/profile` | 35 |
| `/api/topics/[numero]` | 25 |
| `/api/exam/answer` | 23 |
| `/api/ranking` | 11 |
| `/api/laws-configurator` | 11 |
| `/api/teoria/sections` | 10 |

**Conclusión cuantitativa:** cada cascade de `answer-and-save` arrastra **8 endpoints user-facing**. Migrarlo solo libera todo ese efecto dominó.

---

## 2. Catálogo técnico

### 2.1 `/api/v2/answer-and-save` — **KEYSTONE**

| Aspecto | Valor |
|---|---|
| Archivo | `app/api/v2/answer-and-save/route.ts` (206 líneas) |
| Auth | `verifyAuth` con tres modos (off/shadow/on) — Fase 0.7 completada |
| Tablas | `questions`, `psychometric_questions` (SELECT), `test_questions` (INSERT/UPDATE), `tests` (UPDATE score), `user_profiles` (`isActiveStudent`) |
| Pool | `getDb()` (max:1) para writes + `getTraceDb()` (max:1 dedicado) en `after()` block para evitar HoL blocking |
| Cache Redis | Lee `question-validation-v1` (1h, hit ~95%). Invalida `user_stats:${userId}`, `exam_pending:${userId}:*`, `theme_stats:${userId}` en `after()` |
| Patrones | `withDbTimeout(10s)` anti-fraud + `withDbTimeout(15s)` validate&save, `after()` background, anti-fraud paralelo (`Promise.all`), singleflight, `isDbTimeoutError` → 503 retryable |
| Externas | DeviceID/HW fingerprint, `getDailyLimitStatus()`, `checkDeviceDailyUsage()`. Sin fetch externo |
| maxDuration | 30s |
| **Complejidad migración** | **MEDIA** — split de pool (`getDb` + `getTraceDb`) hay que replicar en NestJS con 2 instancias. Cascada de invalidación Redis coordinada |

### 2.2 `/api/medals`

| Aspecto | Valor |
|---|---|
| Archivo | `app/api/medals/route.ts` (180 líneas) |
| Auth | **None** (userId por query/body — endpoint público pero semánticamente privado) |
| Tablas | `user_medals` (SELECT + INSERT), `test_questions` (SELECT GROUP BY user_id para ranking, ~192k rows en período mensual) |
| Pool | GET: `getMedalsReadDb()` (pooler self-hosted o `getDb()`). POST: `getDb()` |
| Cache Redis | Lee `medals:${userId}` fresh 6h. Invalida tras POST. Ranking en `medals_ranking:{start}:{end}:v2` TTL 30d |
| Patrones | `withDbTimeout(3s)` GET + `(15s)` POST, **stale-if-error** (sirve stale en timeout), **circuit breaker** (5min abierto tras statement_timeout en ranking) |
| Externas | fire-and-forget POST a `/api/emails/send-medal-congratulation` |
| maxDuration | Heredado (default) |
| **Complejidad migración** | **BAJA** — stateless GET, POST simple. Circuit breaker + stale-if-error ya mitigan cascadas. Único punto: dependencia HTTP a email service (en NestJS puede ser DI interno) |

### 2.3 `/api/daily-limit`

| Aspecto | Valor |
|---|---|
| Archivo | `app/api/daily-limit/route.ts` (126 líneas) |
| Auth | `verifyAuthOptional()` (Fase 0.7) — 401 si no userId |
| Tablas | **RPC Supabase**: `increment_daily_questions`, `get_device_daily_usage`. Sin Drizzle directo |
| Pool | Supabase Admin client (sin pool Drizzle) |
| Cache Redis | `daily_limit:${userId}` fresh 30s + stale 24h. **In-memory cache 60s** para premium |
| Patrones | `withDbTimeout(5s)`, **stale-if-error** (hit >90%), fire-and-forget cache write |
| Externas | Premium status (Stripe vía RPC), device-id headers |
| maxDuration | Default |
| **Complejidad migración** | **BAJA** — pero las RPCs Supabase no son portables sin reescribir en SQL/Drizzle. Si se migra, hay que sustituir las 2 RPCs por queries propias |

### 2.4 `/api/stats` (path real GET con userId query param)

| Aspecto | Valor |
|---|---|
| Archivo | `app/api/stats/route.ts` (121 líneas) |
| Auth | Query param `userId` (sin Bearer extract) — público pero semánticamente privado |
| Tablas | **Materializadas v2** (`user_stats_summary`, `user_difficulty_stats`, `user_hourly_stats`, `user_article_stats`, `user_daily_stats`) + ad-hoc (`tests`, `test_questions`, `user_streaks`, `user_profiles`, `oposiciones`, `user_sessions`). **~10 queries paralelas** |
| Pool | `getDb()` o `getPoolerDb()` (canary completado) |
| Cache Redis | `stats:${userId}` fresh 5min + stale 24h |
| Patrones | `withDbTimeout(10s)`, `withErrorLogging`, **stale-if-error**, fire-and-forget cache write |
| Externas | Ninguna |
| maxDuration | **15s** (reducido de 300s tras cutover) |
| **Complejidad migración** | **MEDIA** — 10 queries paralelas pero la mayoría son lookups PK <10ms en tablas materializadas. DataLoader trivial en NestJS. Riesgo: el statement_timeout que dio p95 153s en logs apunta a índices subóptimos en alguna materializada — investigar antes de migrar |

### 2.5 `/api/v2/test-config/*` (familia 4 endpoints)

| Endpoint | Líneas | Auth | Cache TTL | Complejidad |
|---|---:|---|---|---|
| `articles/` | 44 | None | unstable_cache 6h | MEDIA |
| `sections/` | 49 | None | unstable_cache 6h | MEDIA |
| `essential-articles/` | 42 | None | unstable_cache 24h | MEDIA |
| `estimate/` | 67 | None | unstable_cache 1h | **ALTA** (full traverse `topicScope` + condicionales) |

| Aspecto común | Valor |
|---|---|
| Pool | `getTestConfigDb()` = pooler o primary |
| Tablas | `laws`, `articles`, `law_sections`, `topics`, `topicScope`, `questions` |
| Patrones | `unstable_cache` (Next.js) con tag `'test-config'` invalidado por lifecycle_transition + apply-fix |
| Externas | Ninguna |
| **Complejidad migración** | **MEDIA→ALTA** — `unstable_cache` no es nativo en NestJS, hay que replicar con Redis tags. `estimate` tiene 3+ queries secuenciales con tree traversal — candidato a materializar |

---

## 3. Matriz comparativa final

| Endpoint | Tráfico/h | Errors 7d | Cascade ventanas | p95 ms | Patrones aplicados | Complejidad | **Palanca migración** |
|---|---:|---:|---:|---:|---|---|---|
| `answer-and-save` | 1.061 (peak 5.704) | 222 (32 ✕503) | **3 (peak 11)** | 15.056 | quick-fail, after(), singleflight | MEDIA | **MÁXIMA** — arrastra 8 endpoints en cascade |
| `medals` | — | 34 (todo 503) | 2 (peak 3) | 15.038 | stale-if-error, circuit-breaker | **BAJA** | ALTA — segundo en frecuencia de cascade |
| `stats` | — | 3 (3 ✕500) | 0 | **<200 ms real** (153 ms era deuda 29/04 pre-refactor) | quick-fail 10s, stale-if-error | BAJA | **BAJA** — endpoint sano (ver §4-bis) |
| `test-config/*` (4) | — | 3 (artic+sec) | 0 | ~44.000 | unstable_cache + flags | MEDIA-ALTA | BAJA-MEDIA — cache ya mitiga |
| `daily-limit` | 57 | **0** | 0 | — | quick-fail 5s, stale-if-error | BAJA (pero RPC) | **BAJA** — sano, no urge |

---

## 4. Recomendación de orden de migración

Criterio: **palanca real (cascade arrastre) × inverso de complejidad × resiliencia ya construida**.

### Orden propuesto

1. **`/api/medals` — canary/template (BAJA complejidad, ALTA palanca)**
    Patrones de resiliencia más sofisticados del repo (stale-if-error + circuit breaker). Stateless. Sin auth. Si rompe en migración, el blast radius es el badge del header, no el flujo crítico. Sirve como **playbook validado** para los siguientes — replica la mecánica feature-flag + adapter en frontend antes de tocar nada crítico.

2. **`/api/v2/answer-and-save` — KEYSTONE real**
    Una vez templado el camino con medals, migrar el endpoint que arrastra 8 endpoints en cada cascade. ROI máximo del proyecto entero. Reto técnico: replicar el split de pool (`getDb` + `getTraceDb`) en NestJS. Resultado esperado: las 3 ventanas/semana de cascade desaparecen.

3. ~~**`/api/stats` — eliminar el p95 de 153s**~~ **DESCARTADO — endpoint sano**
    EXPLAIN ANALYZE 2026-05-23 noche con el user más heavy (2730 tests, 29.558 test_questions): las 10 queries paralelas suman <200ms peor caso cold-cache, <50ms cache caliente. Los 153s del audit son **deuda histórica del 29/04** (pre-refactor `getRecentTests` a `LEFT JOIN LATERAL` Memoize). Los 3 errores 500 de los últimos 7d son blips puntuales del pooler Supabase que arrastraron este endpoint junto con otros — no es problema endémico. Plan completo en sección 4-bis abajo. **Baja a prioridad MEDIA-BAJA** (mismo nivel que daily-limit).

4. **`/api/v2/test-config/*` — bundle de 4**
    Migrar la familia entera, replicar `unstable_cache` con Redis tags propios. Empezar por `estimate/` que es el más complejo y el que más se beneficia (full traverse `topicScope`).

5. **`/api/daily-limit` — opcional, baja prioridad**
    0 errores 7d, ya sano. Solo migrar para consistencia y para sustituir las 2 RPCs Supabase por queries propias (paso necesario para Bloque 5 de salida de Supabase, pero no urgente).

### Lo que NO recomendar migrar a NestJS

- **`/api/questions/user-failed`** (5 ventanas cascade, peor que answer-and-save por frecuencia). Ya se migró a read replica (Sprint 5). El cuello no es pool sino plan de query con users heavy. Resolver con materialización (Bloque 4) o pagination, no con backend dedicado.
- **`/api/ranking`** (3 ventanas cascade). Ya materializado en `ranking_cache` (Fase 2-ter). Las cascadas residuales vienen de invalidación, no de query.
- **`/api/questions/filtered`**, **`/api/profile`**, **`/api/topics/[numero]`**, **`/api/exam/answer`**, **`/api/laws-configurator`**, **`/api/teoria/sections`** — todas aparecen como arrastrados, no como root cause. Si migramos answer-and-save, su ratio de errores debería caer en proporción.

---

## 4-bis. EXPLAIN ANALYZE `/api/stats` (resuelto 2026-05-23 noche)

Ejecutado con el user más heavy del sistema (`3260627f-2018-4a5e-8234-e6f07015abb9`, 2.730 tests completados, 29.558 test_questions):

| Función | Tabla principal | Execution time | Plan dominante |
|---|---|---:|---|
| `getMainStats` (summary) | user_stats_summary | 0.045 ms | Index Scan PK |
| `getMainStats` (bestScore) | tests | 4.48 ms hot / ~134 ms cold | Bitmap Heap Scan `idx_tests_user_completed` |
| `getDifficultyBreakdown` | user_difficulty_stats | 1.97 ms | Index Scan PK |
| `getTimePatterns` (hourly) | user_hourly_stats | 1.59 ms | Index Scan PK |
| `getTimePatterns` (avg session) | tests | 30.23 ms | Bitmap Heap Scan `idx_tests_user_completed` |
| `getArticleStats` | user_article_stats | 18.93 ms | Index Scan + Limit 1000 |
| `getWeeklyProgress` | user_daily_stats | 3.15 ms | Index Scan Backward `user_day_desc` |
| `getRecentTests` | tests + LATERAL topics + LATERAL test_questions | 14.95 ms | Limit + LATERAL Memoize |
| `getThemePerformance` | user_theme_performance_cache | 1.92 ms | Nested Loop Left Join |
| `getStreakData` | user_streaks | 0.034 ms | Index Scan PK |

**Conclusión**: suma paralela esperada **<200 ms peor caso cold-cache** (la única "alta" es bestScore 134 ms cold → 4.48 ms cache caliente). Con el cache Redis 5 min fresh + 24 h stale-if-error vigente, hit ratio ≈95% → endpoint sano en producción.

**Optimización marginal disponible (no aplicada)**: `idx_tests_user_completed_covering` `(user_id, is_completed) INCLUDE (score, total_questions, total_time_seconds) WHERE is_completed=true` permitiría Index Only Scan para `bestScore` y `avgSession` — ahorro 134 ms cold → ~15-25 ms cold. **No urge** (cache absorbe el caso cold) y se aplica cuando vuelva a aparecer en logs de cascade. Reversal: `DROP INDEX` (0.1 s, no hay code references).

---

## 5. Lo que falta antes de arrancar Bloque 3

Para no entrar en código sin contexto, completar estas dos tareas (cada una <1h):

1. **Decisión BACKEND_URL**: cómo apunta el frontend al backend. Env var simple + feature flag por endpoint, o gateway intermedio. Definir patrón antes del primer endpoint para no inventar dos.
2. **Adapter Redis**: el backend NestJS necesita un cliente Redis que respete los mismos tags que `lib/cache/redis.ts` actual (para que invalidaciones cross-runtime funcionen). Definir interface antes del primer endpoint.

~~Reproducir p95 153s `/api/stats`~~ — **HECHO 23/05 noche**: el endpoint está sano (ver §4-bis arriba). El p95 era deuda histórica del refactor pre-LATERAL Memoize.

---

## 6. Referencias

- Sección «Bloque 3» del [`ARCHITECTURE_ROADMAP.md`](../ARCHITECTURE_ROADMAP.md#bloque-3--etapa-2-del-backend-4-6-sem--keystone)
- Sprint 2 hardening cascade (`docs/ARCHITECTURE_ROADMAP.md`)
- Sprint 5 cascade 2026-05-18 (lo que ya mitigó user-failed y daily-limit)
- Backend dedicado Etapa 1 (`docs/runbooks/cron-cutover-fargate.md`)
