# Roadmap — Pool Segregation + Diagnóstico de saturación 503 en horas pico

> **Estado**: 🟡 **DIAGNÓSTICO ABIERTO** — causa raíz de los 503 burst NO confirmada. **No actuar sobre código de prod sin completar Fase 0 (captura en directo).**
> **Propietario**: equipo Vence
> **Coste esperado de la implementación**: 0€ (cambios de config sobre infra ya existente)
> **Última actualización**: 2026-06-01 ~00:00 UTC — roadmap creado tras incidente 31/05 19-21 UTC (609 errores 5xx /api/profile + endpoints colaterales).

---

## 🚀 PUNTO DE RETOMA — leer antes de tocar nada

**Contexto en 60 segundos:**

El 31/05/2026 entre 19:18-21:13 UTC se registraron **609 errores 5xx** en `/api/profile` (y colaterales `/api/questions/filtered`, `/api/random-test/availability`, `/api/topics/[numero]`), todos con mensaje `"Servicio saturado momentáneamente"` y duración **exactamente 8 003 ms** = el `withDbTimeout(8 000)` se disparó en cascada.

Patrón observado: 37 errores concentrados en 1 minuto (20:27 UTC), 21 al siguiente, 14 al anterior. Eso es **un bloqueo de ~30 s del slot único** que hizo timeoutear a todas las requests entrantes en esa ventana. Apagado solo cuando bajó el tráfico nocturno.

**El histograma de 7 días muestra el mismo patrón cada día a las 9-13 UTC** (hasta 21k errores 5xx por hora en el pico de las 9 UTC). NO es regresión del deploy del día — es deuda estructural latente.

**Diagnóstico previo que descartamos** (errores honestos en la primera ronda):

1. ❌ "Mover `refresh_ranking_cache` al backend Fargate" — **ya está allí** (`backend/src/refresh-rankings/refresh-rankings.cron.ts` desde sprint cutover anterior).
2. ❌ "El cron es la causa" — cross-tab por minuto **descarta correlación**:
   - 20:45 UTC cron tardó 3 905 ms → 0 errores
   - 21:10 UTC cron tardó 4 211 ms → 0 errores
   - 20:27 UTC sin cron corriendo → 37 errores
3. ❌ "Bot/scraping" — 8+ User-Agents distintos (Chrome Win/Linux/Android, Safari iPhone/Mac), distribución típica de usuarios reales.
4. ❌ "Banner deployed hoy lo rompió" — el banner toca `oposiciones` (SELECT cacheado ISR), no aparece en top de `pg_stat_statements`.
5. ❌ "MV `topic_question_summary` no aplicada" — sí está aplicada (con nombres `topic_law_question_summary` + `topic_official_by_position`), canary topic-data devuelve d=23-90 ms.

**Lo que SÍ sabemos a ciencia cierta:**

- Frontend usa pool `postgres-js` con `max: 1` por instancia serverless (`db/client.ts:35`).
- Frontend Fargate corre con `desired=2` (cutover 30/05) → **2 conexiones físicas para TODO el sitio**.
- `getDb()` (path principal) NO va por el self-hosted pooler — va por Supavisor regional compartido de Supabase.
- `getPoolerDb()` (self-hosted pooler) también declara `max: 1` (sospechoso: el pooler multiplexa, ¿por qué limitar a 1 cliente?).
- `getAdminDb()` SÍ usa `max: 12` vía self-hosted pooler — funciona bien en `/admin/*`.
- `withDbTimeout(8 000)` aborta tras 8 s SIN fail-fast en acquire → si el pool tiene 0 slots libres, la request espera los 8 s completos antes de fallar.
- Otros endpoints también timeoutean en la misma ventana: `track_session_ip_db_timeout warn n=194` en 4 h del pico.

**Lo que NO sabemos** (= Fase 0 obligatoria antes de implementar):

- ❓ ¿Qué proceso/query bloquea el slot durante esos 30 s del pico?
- ❓ ¿Es un Supavisor blip externo o algo dentro de nuestra app?
- ❓ ¿`USE_SELF_HOSTED_POOLER` está activo en `getProfileDb` en prod o devuelve `getDb()` por defecto?
- ❓ ¿`reconcileUserPremium` en `after()` está reteniendo el slot porque Stripe API responde lento?
- ❓ ¿Hay algún `revalidateTag('profile', 'max')` corriendo en sincronía bajo updates concurrentes?

---

## Hipótesis abiertas (a falsar con Fase 0)

### Hipótesis A — Supavisor blip externo

El pooler regional compartido (`aws-0-eu-west-2.pooler.supabase.com:6543`) tiene blips esporádicos documentados en [`self-hosted-pooler.md`](self-hosted-pooler.md). Si un blip dura 20-30 s, **todas las requests del frontend que coincidan con esa ventana esperan al slot y timeoutean**.

**Falsable con**: `pg_stat_activity` durante el pico + logs Supavisor + diff con tráfico que va por self-hosted pooler (debería ser inmune si el flag está activo).

**Si es cierta**: la solución es completar la migración al self-hosted pooler para el path principal (`getDb()` → `getPoolerDb()` con `max:8` en el pool de cliente). Roadmap Fase 1.

### Hipótesis B — `reconcileUserPremium` en `after()` retiene slot

`/api/profile` dispara en `after()` (post-response, mismo runtime) una llamada a Stripe API (`reconcileUserPremium`). Si Stripe responde a 5-10 s en ciertas ventanas (rate-limit, blip de red), el handler retiene el slot pool durante esa llamada **aunque el GET ya respondió al cliente**.

**Falsable con**: muestrear `pg_stat_activity` durante el pico — si hay conexiones en `state=idle in transaction` con `application_name='postgres-js'` retenidas >5 s, hipótesis viva. Cruzar también `event_type='reconcile_attempt'` o similar en `observable_events`.

**Si es cierta**: la solución es mover `reconcileUserPremium` a una cola async (Redis queue + worker en backend Fargate) o usar un cliente DB dedicado con su propio pool para `after()` (`getTraceDb()` ya existe — patrón replicable).

### Hipótesis C — Cache miss masivo + concurrencia natural

`getProfileForSelfCached` tiene TTL 60 s con `unstable_cache`. Tras cada deploy del frontend, **el Next.js cache se invalida globalmente** → cache miss del 100% durante el siguiente minuto. Si en ese minuto entran ~20 requests/s de users distintos (cada uno con su cache key) → 20 cache misses paralelos → cada uno espera por el slot único → cascada de timeouts.

**Falsable con**: cross-tab de deploys (`80239faa`, `26e191b4`...) con timestamps de cada burst de errores. Si cada burst arranca a los 0-60 s post-deploy → hipótesis viva.

**Si es cierta**: la solución es (a) usar Redis como cache de profile en vez de `unstable_cache` (sobrevive a deploys), o (b) warmup automático del cache tras deploy.

> **Una de las 3 puede ser correcta, o pueden ser 2 simultáneas amplificándose.** Por eso Fase 0 captura todo y decide después.

---

## Plan de ejecución

### Fase 0 — Captura en directo del próximo pico (obligatoria antes de Fase 1)

**Acción**: ejecutar `scripts/diagnostic/capture-pool-pressure.cjs` durante una ventana 8:50-10:30 UTC (cubre el pico observado 9-10 UTC).

**Qué captura cada 30 s**:

- `pg_stat_activity` filtrado a `application_name='postgres-js'` y `Supavisor` — estado, `wait_event`, query (primeros 200 chars), `query_start`, edad de la conexión.
- `pg_stat_activity` con `idle in transaction` >5 s — bandera roja para Hipótesis B.
- `observable_events` últimos 30 s — errores 5xx, latencias `/api/profile`, runs de crones pesados, eventos Stripe.
- Top 5 queries por `mean_exec_time` desde `pg_stat_statements` (delta entre sample y sample).
- Deploy actual + edad del deploy (para Hipótesis C).

**Output**: JSON-line en `/tmp/pool-pressure-YYYYMMDD.jsonl`, 1 línea por sample.

**Coste**: 0 — read-only, conexión local del laptop al pooler de Supabase, no toca prod.

**Decisión post-Fase 0**:

| Hallazgo en captura | Diagnóstico | Siguiente Fase |
|---|---|---|
| Conexiones Supavisor con `wait_event=ClientRead` >10 s | Supavisor blip | Fase 1 (migrar `getDb()` → self-hosted) |
| Conexiones `idle in transaction` >5 s con app `postgres-js` | `after()` retiene slot | Fase 2 (separar pool background o mover a cola) |
| Burst de errores 30-90 s post-deploy timestamp | Cache miss masivo | Fase 3 (Redis profile cache) |
| Ninguna anomalía visible en captura | Re-instrumentar — añadir trace_id en `withDbTimeout` para correlación exacta | Fase 4 (tracing) |

### Fase 1 — Migrar `getDb()` (path principal) al self-hosted pooler

**Trigger**: confirmado Hipótesis A en Fase 0.

**Acción**:

1. Cambiar `db/client.ts:35` para que `createDbClient()` use `DATABASE_URL_SELF_POOLER` cuando esté disponible (feature flag `USE_SELF_HOSTED_POOLER_DEFAULT=true`).
2. Subir `max: 1` → `max: 8` en el pool de cliente (el self-hosted PgBouncer multiplexa transacciones, soporta `max_client_conn=1000` y `default_pool_size=30` upstream → no agota Supabase Postgres).
3. Mantener el flag para rollback instantáneo sin redeploy.
4. Soak 24 h con métrica explícita: errores 5xx /api/profile y latencia p95.

**Riesgo**: medio — cambio en path principal. Mitigado por:
- Feature flag.
- El self-hosted pooler ya está LIVE para `/admin` (`getAdminDb()` con `max:12`) — el patrón está validado.
- Canary de bajo riesgo: aplicar primero a `getProfileDb()` solo, y migrar el resto incremental.

**Métrica de éxito**: 503 burst en horas pico desaparece o se reduce >90%.

### Fase 2 — Pool dedicado para background tasks (`after()`)

**Trigger**: confirmado Hipótesis B en Fase 0, o si Fase 1 no resuelve completamente.

**Acción**:

1. Crear `getBackgroundDb()` en `db/client.ts` con su propio pool (`max:2`, distinto del principal).
2. Refactor `reconcileUserPremium` para que use `getBackgroundDb()` en vez del cliente compartido.
3. Plazo más relajado: `idle_timeout: 60s`, `statement_timeout: 30s` (sin el quick-fail de 8 s del path user-facing).

**Alternativa más robusta** (recomendada si Fase 2 no basta): mover `reconcileUserPremium` a una cola async (Redis queue → worker en backend Fargate). Elimina por completo la atadura entre `/api/profile` y Stripe API.

### Fase 3 — Redis cache para `getProfileForSelf` (sobrevive a deploys)

**Trigger**: confirmado Hipótesis C en Fase 0.

**Acción**:

1. Wrapper Redis (Upstash, ya en stack) con TTL 60 s alrededor de `getProfileForSelf`, antes de `unstable_cache`.
2. `unstable_cache` se mantiene como L2 (cache local Next.js) — Redis es L1 compartido entre instancias y persistente a deploys.
3. Invalidar Redis key en `updateProfile()` igual que hoy se invalida tag.

**Riesgo**: bajo. Patrón ya usado en el sprint outbox (`registerAndCheckDevice` Redis cache).

### Fase 4 — Defensa-en-profundidad permanente

Independiente de qué hipótesis sea correcta, estos cambios mejoran la robustez sistémica:

1. **Fail-fast en `withDbTimeout`**: añadir `pool.acquire({ timeoutMs: 200 })` antes de ejecutar la query. Si en 200 ms no hay slot libre → 503 inmediato con `Retry-After`. Hoy un slot ocupado deja 50 requests esperando 8 s — eso amplifica el incidente.

2. **Métrica "% pool saturado" en `/admin/salud-sistema`**: cron cada 1 min que sample `pg_stat_activity WHERE application_name='postgres-js' AND state='active'`, calcula utilización vs `max`, emite a `observable_events`. Alerta predictiva (alarma en 70 %) en vez de reactiva (alarma en 503 ya consumado).

3. **Test de carga en CI** (k6 o similar) que falle si `/api/profile`, `/api/v2/answer-and-save` o `/api/topics/[numero]` superan p95 > 500 ms con 20 VUs concurrentes durante 60 s. Hoy esto no existe → cada deploy es una rifa.

4. **Documentar invariante "1 cron pesado nunca debe estar en el mismo proceso que /api"** en `CLAUDE.md` y enforcear con ESLint custom rule (`no-cron-in-app-api` que rechace `@/lib/cron` en `app/api/**`).

---

## Antipatrones a evitar (lecciones del diagnóstico inicial fallido)

Documentar errores honestos para no repetirlos:

1. **Diagnosticar por intuición sin cross-tab temporal**: la primera hipótesis ("el cron drena el slot") parecía obvia pero la cross-tab por minuto la falsó. Patrón: **antes de proponer fix, exigir prueba causal — correlación temporal mínima**.
2. **Asumir que código que existe está activo en prod**: el `getPoolerDb()` existe pero `USE_SELF_HOSTED_POOLER` puede estar a `false`. Patrón: **verificar env vars de prod con captura directa, no asumir del código**.
3. **Confundir "endpoint top en errores" con "causa raíz"**: `/api/profile` es la primera VÍCTIMA (timeout más corto, 8 s), no la causa. Patrón: **mirar también qué OTROS endpoints fallan en la misma ventana — la causa es lo que comparten**.
4. **No considerar que `after()` retiene runtime**: las funciones `after()` de Next.js corren tras la response PERO en el mismo runtime — pueden retener pool, memoria, CPU. Patrón: **toda operación en `after()` debe usar pool aparte o cola async**.

---

## Dependencias y enlaces

- **Roadmap padre**: [`docs/ARCHITECTURE_ROADMAP.md`](../ARCHITECTURE_ROADMAP.md) § Bloque 4 (Materializar pendientes + resiliencia) y § Bloque 5 Fase E (Frontend Vercel → ECS Fargate).
- **Self-hosted pooler**: [`docs/roadmap/self-hosted-pooler.md`](self-hosted-pooler.md) — infra ya operativa, Fase 5 completa 2026-05-10.
- **Observability manual**: [`docs/runbooks/observability.md`](../runbooks/observability.md) — patrón de emisión de métricas a `observable_events`.
- **Health check runbook**: [`docs/runbooks/health-check.md`](../runbooks/health-check.md) — protocolo de diagnóstico inmediato.
- **Sprint outbox** (precedente de Redis cache cross-lambda): [`docs/roadmap/sprint-outbox-test-questions.md`](sprint-outbox-test-questions.md).

---

## Histórico de decisiones

- **2026-06-01 ~00:00 UTC** — Roadmap creado. Estado: 🟡 diagnóstico abierto. Script `capture-pool-pressure.cjs` preparado para Fase 0.
- **2026-04-27** — Pool `max: 8 → 3 → 1` aplicado tras pool exhaustion con 261 eventos en Supavisor (documentado en `db/client.ts:12`). Decisión correcta para el contexto de entonces; ahora obsoleta tras self-hosted pooler operativo (2026-05-10).
