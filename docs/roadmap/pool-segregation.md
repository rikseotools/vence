# Roadmap — Pool Segregation + Diagnóstico de saturación 503 en horas pico

> **Estado**: 🟡 **FASE 1 SOLO PARCIAL (corregido 2026-06-26)** — ver corrección abajo. Self-hosted pooler PgBouncer **en HA** (2 VMs Lightsail, AZs distintas, NLB con failover testeado — Fase 6 self-hosted-pooler.md ✅ aplicada 01/jun) operativo y validado, PERO el path principal `getDb()`/`getReadDb()` **NO** se migró a él: sigue en Supabase Supavisor `max:1`. Por eso persiste la saturación.
> **Propietario**: equipo Vence
> **Coste esperado de la implementación**: 0€ (cambios de config sobre infra ya existente)
> **Última actualización**: 2026-06-26 — corrección del estado tras verificar prod (la saturación 503 NO está resuelta).

> ## ⚠️ CORRECCIÓN 2026-06-26 — "Fase 1 APLICADA" era inexacto
>
> Verificado contra **prod** (`vence-frontend:290` + SSM, perfil `vence`) y código:
> - `USE_SELF_HOSTED_POOLER=true` ✅, pero **`DATABASE_URL` → `aws-0-eu-west-2.pooler.supabase.com:6543` (Supavisor)** y `USE_READ_REPLICA` vacío.
> - `getDb()` → `createDbClient()` → `DATABASE_URL` = **Supavisor `max:1`**; `getReadDb()` → `return getDb()`. **NINGUNO usa el pooler.** El pooler solo lo usan `getPoolerDb()` (opt-in) y `getAdminDb()`.
> - Lo que realmente se construyó en "Fase 1" fue la función **paralela** `getPoolerDb()` (`max:8`, apunta a `pooler.vence.es`), con **adopción PARCIAL**. `getDb()` (path principal) **nunca se reconectó**.
> - **Consecuencia (verificada):** los 6 endpoints que saturan (109 saturación-503 en 7d) corren queries por `getDb`/`getReadDb` = Supavisor max:1, fuera del pooler → Hipótesis D sigue viva para ellos.
>
> **⚠️ ACTUALIZACIÓN 2026-06-26 (segunda vuelta) — la causa NO es el pool, son QUERIES LENTAS. Migración a getPoolerDb CANCELADA.**
>
> Al investigar a fondo antes de migrar (timestamps + pg_stat_statements):
> - **NO es Hipótesis D / deploy-starvation.** Los 109 saturación-503/7d están **dispersos en 92 minutos distintos sobre 17 deploys** (~15/día, todas horas), 1-2 por ventana — NO el patrón de cascada (37/min) de Hipótesis D. No correlacionan con deploys.
> - **NO es path-específico.** `topics/[numero]` (el que MÁS satura, 54/7d) **YA está en el pooler** (`getTopicDataDb()` → `getPoolerDb()` con el flag ON). 3 de los 5 helpers ya enrutan al pooler; el `getDb` era solo el fallback del ternario + el tipo. Mi conteo inicial de "9 llamadas" fue superficial.
> - **SÍ son queries lentas** (pg_stat_statements): `count(DISTINCT questions.id)` sobre topics → **mean 1.6-4.0s, max 23-34s**; `FROM user_article_stats` (oposiciones-compatibles/progress) → **mean 6.7s, max 29s**; `tq.id FROM test_questions` (difficulty/historial) → max 43s. Cuando superan `withDbTimeout(8000)` → 503. **El pooler NO acelera una query de 30s.**
>
> **EL FIX REAL = optimización de esas queries de agregación**, no routing de pool:
> - ✅ **HECHO (commit `45076c43`):** el `count(DISTINCT questions.id)` por topic (el MAYOR consumidor, ~18.000s) corría en vivo en `lib/api/random-test/queries.ts` (configurador + páginas SEO) en vez de leer las MV. Ahora `getThemeCountsFromMV` lee `topic_law_question_summary`/`topic_official_by_position` gated por `TOPIC_MV_ENABLED` (ya ON), fallback rollback-safe. Paridad verificada 0-diffs en 4 oposiciones + 5 tests. ~2s→~5ms. (`random-test-data/queries.ts` NO migrado: usa tagFilter que la MV no conoce — pendiente aparte.)
> - ✅ **HECHO (commit `b029d672`):** la query `user_article_stats` de 6.7s NO era de oposiciones-compatibles/progress (su query per-user corre en **184ms** con índice — era VÍCTIMA, no causa). Era el **canary `canary-theme-stats`** haciendo un full-scan + GROUP BY de toda user_article_stats (126MB) cada 10min para elegir "el usuario más pesado" (~6443s). Ahora cachea ese usuario 1h → full-scan de 144/día a ~24/día. (Queda el `expected` per-user del canary, 1.5s/run, menor.)
> - ✅ **HECHO (commit `d77e32fe`):** la 3ª query (`tq.id FROM test_questions`, **max 43s, ~13.359s impacto** — historial de respuestas en `topic-progress/user-answers.ts`) seleccionaba `tq.id AS answer_id`, **dato muerto** (nunca leído). Eso rompía la cobertura del índice `idx_tq_user_q_full_covering` → index scan no-covering con ~52k heap fetches → 33s para el usuario de 70k respuestas. Quitado `answerId` → **Index Only Scan, 33.291ms→827ms (40×)**. Cero esquema, dato muerto.
> - ✅ **HECHO (commit `96cfc131`):** la 4ª query (`daily-goal/status`, banner "X/Y preguntas hoy", **48.564 calls, max 25s, ~4.724s**) contaba con `JOIN tests t ON t.id=tq.test_id WHERE t.user_id` → picos de 25s en usuarios pesados. Cambiado a `tq.user_id` directo (patrón "JOIN tests eliminado") → índice `idx_tq_user_created_correct`, ~240ms. Paridad verificada (241 filas globales con tq.user_id≠t.user_id = bug de datos pre-existente, despreciable en métrica blanda).
> - **VERIFICACIÓN (2026-06-26 ~13:30):** frontend `:291` LIVE con el fix MV → el query MV theme-counts corre en prod a **13ms** (vs 1491ms el viejo); la vieja query (3915 calls) deja de crecer. Saturación-503: 0 desde el deploy (la tendencia completa necesita horas — es bursty). covering-index + daily-goal en el siguiente build; canary (backend) pendiente.
> - Plan B inmediato si urge: stale-while-error en estos endpoints (servir cache viejo en vez de 503) + subir `withDbTimeout` para las agregaciones conocidas-lentas.
>
> NOTA: la HA del pooler (2 VMs AZs + NLB failover testeado, Fase 6 ✅) está bien y NO hace falta pooler nuevo — pero es ortogonal a esta saturación.

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

## Hipótesis abiertas (estado tras Fase 0)

> **Resumen Fase 0 (01/06/2026 06:09-06:13 UTC)**: captura de 5 min sobre burst real en vivo, 24 samples cada 15s. **130 errores 5xx capturados con `active_app=0` durante TODO el incidente** = postgres-js no tiene conexiones activas durante los timeouts. A/B/C automatizadas dan DESCARTADA/INCONCLUSO; el patrón observable confirma Hipótesis D (no contemplada al crear el roadmap).

### Hipótesis D — Starvation del pool durante rolling deploy Fargate ✅ CONFIRMADA

**Patrón observado en captura 01/06/2026**:
- Burst arranca **06:09:02 UTC = ~7 min tras push del commit `000d2c2f`** (06:01:51 UTC). Tiempo coherente con rolling deploy Fargate (build imagen + ECS rolling update + health checks).
- `active_app=0` en TODOS los 24 samples del burst — el frontend NO consigue establecer conexiones a la BD.
- Burst termina solo a los **~4 minutos** sin intervención (06:13:08 UTC), coincidiendo con el tiempo esperado para que el container nuevo caliente su pool y/o el viejo termine de drenar.
- Mismo fingerprint que el incidente 31/05 19-21 UTC (duración 8003 ms = `withDbTimeout`, mensaje "Servicio saturado momentáneamente").

**Cadena causal hipotetizada**:

1. Frontend ECS Fargate con `desired=2` recibe rolling update tras cada push a main.
2. Container A se apaga ordenadamente; container B nuevo arranca con pool `postgres-js` con `max:1` y conexiones=0 inicialmente.
3. La línea `db/client.ts:42` (`conn\`SELECT 1\`.catch(() => {})`) dispara 1 warmup en background, pero **no bloquea el arranque** ni garantiza que el pool esté caliente cuando llegan requests reales.
4. Llegan requests a `/api/profile`. El cliente intenta `pool.acquire()` → como `max:1` y la conexión está en proceso de establecerse, espera.
5. `connect_timeout: 5` (línea 37) es **demasiado bajo** para el handshake TLS contra Supavisor en cold start bajo presión (TCP + TLS + SCRAM negotiation contra pooler externo).
6. La conexión falla → `withDbTimeout(8000)` espera al timeout del wrapper → 503 después de exactos **8003 ms** observados.
7. Cascada durante ~4 minutos hasta que (a) el container B calienta el pool, (b) el ALB redirige tráfico al container A drenado, o (c) Supavisor libera presión.

**Por qué el script automatizado NO la detectó**:

El script captura `pg_stat_activity` (qué pasa **en la BD**). El problema aquí es **antes** de llegar a la BD: la conexión TCP/TLS desde Fargate hacia Supavisor nunca llega a registrarse. La BD ve `conn=32` estable (postgrest + Supavisor existentes + realtime) sin variación. Para detectar D habría que capturar:

- Logs CloudWatch del frontend Fargate (`connect ETIMEDOUT`, `Connection terminated unexpectedly`).
- Métrica del ALB: `TargetResponseTime` + `HTTPCode_Target_5XX_Count` durante el rolling.
- Estado de Supavisor: ¿está rechazando conexiones nuevas porque otro cliente las acapara?

**Evidencia adicional** (cross-tab con commits del día):

| Push | Timestamp UTC | Burst observado |
|---|---|---|
| `88808e6e` (Acción 1) | ~04:30 | (no capturado, pre-script) |
| `bef2f3e4` (Acción 3) | ~05:39 | Burst 47 errores en `/api/profile` capturado por script CLI a las 05:45-05:53 |
| `1c1ef870` (analyze script) | ~05:45 | (continuación del anterior, mismo deploy window) |
| `000d2c2f` (mejora runbook) | ~06:01 | **Burst 130 errores capturado en vivo 06:09-06:13** |

**Patrón evidente**: cada push dispara un burst de 5xx ~7 min después, dura ~4 min, afecta principalmente a `/api/profile` y endpoints colaterales (`/api/questions/filtered`, `/api/topics/[numero]`). La frecuencia de pushes hoy ha hecho que el bug sea continuo. En días normales con 1-2 pushes/día sólo hay 1-2 ventanas de 4 min de incidente — fácil de no notar hasta que se acumula tráfico real en horas pico.

### Mitigaciones priorizadas para Hipótesis D

| # | Acción | Coste | Impacto | Robustez |
|---|---|---|---|---|
| 1 | Subir `connect_timeout: 5 → 15` en `db/client.ts` | 5 min, riesgo 0 | Da margen al TLS handshake en cold start | Band-aid puro, no soluciona starvation |
| 2 | Pre-warming agresivo del pool al boot (3-5 SELECT en serie con `await` bloqueante antes de arrancar el servidor HTTP) | 30 min | Conexión caliente garantizada antes de aceptar tráfico | Mejora real pero costosa en boot time |
| 3 | Healthcheck Fargate (`readinessProbe`) que falle si la BD no responde durante warm-up — ALB no envía tráfico hasta listo | 1 h | Elimina la ventana de starvation por construcción | **Solución correcta para containers** |
| 4 | Migrar `getDb()` al self-hosted pooler (PgBouncer en `pooler.vence.es`, ya operativo para `getAdminDb()` con `max:12`) | 2 h | Pool TCP persistente upstream, multiplexa transacciones | **Solución de fondo arquitectónica** — elimina el problema en origen |

**Recomendación**: 4 (self-hosted pooler) es la solución correcta. Beneficios acumulativos:
- Elimina la dependencia del Supavisor regional compartido (motivo original del roadmap `self-hosted-pooler.md`).
- El PgBouncer mantiene conexiones upstream a Postgres independientemente del ciclo de vida de los containers Fargate → no hay cold start de pool.
- Soporta `max:8` por instancia sin saturar Postgres (multiplexing transactional).
- Reduce variabilidad de `connect_timeout` (RTT a Lightsail London <3 ms vs RTT a Supavisor regional 10-30 ms).

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

> **Resultado Fase 0**: A/B/C descartadas o inconclusas. La causa real es Hipótesis D (starvation post-deploy). Ver §"Hipótesis D" arriba.

---

## Plan de ejecución

### Fase 0 — Captura en directo del próximo pico ✅ COMPLETADA (2026-06-01)

**Acción ejecutada**: captura ad-hoc 5 min (`scripts/diagnostic/capture-pool-pressure.cjs --duration 300 --interval 15`) sobre burst en vivo descubierto a las 06:09 UTC tras push del commit `000d2c2f`. Aprovechamos un burst real en madrugada española (sin tráfico real) en vez de esperar al pico de 9 UTC programado — la captura ad-hoc resultó suficiente para confirmar Hipótesis D.

**Output guardado en**: `/tmp/pool-pressure-2026-06-01.jsonl` (24 samples, 130 errores 5xx capturados).

**Resultado del análisis automatizado** (`analyze-pool-capture.cjs`):
- Hipótesis A: DESCARTADA (0 samples con Supavisor hung).
- Hipótesis B: DESCARTADA (0 samples con postgres-js idle-in-tx >5s).
- Hipótesis C: INCONCLUSO (1 burst correlacionado con deploy, 9 bursts sin deploy reciente — pero todos en mismo deploy_version).
- Recomendación automática: "más muestreo necesario" — INCORRECTA para este caso porque el script no contemplaba Hipótesis D.

**Conclusión humana** (post-análisis): el patrón `active_app=0` sostenido durante 4 min de burst es la firma inequívoca de Hipótesis D (starvation pre-BD, no contienda en BD). El script se actualizará en una iteración futura para añadir esta hipótesis.

**Acción ejecutada (legacy, mantenida para referencia)**: el script estaba previsto para ventana 8:50-10:30 UTC del próximo día. La oportunidad llegó antes — se capturó tras push de las 06:01 UTC.

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

### Fase 1 — Migrar `getDb()` (path principal) al self-hosted pooler ✅ **APLICADA 2026-06-01 ~09:00 UTC**

**Trigger**: ✅ confirmado por Hipótesis D (no A) tras Fase 0. El razonamiento original para Fase 1 (mitigar blips Supavisor) sigue válido, pero ahora **además** soluciona la starvation post-deploy porque el PgBouncer mantiene conexiones upstream estables independientes del ciclo de vida de los containers Fargate.

**Resultado de la aplicación**:
- ✅ Endpoint `/api/health/db-ready` LIVE devolviendo `pool=self_hosted` con latencia **3-18 ms** (vs 1606-2000 ms+ con Supavisor antes).
- ✅ Task definition `vence-frontend:76` con `USE_SELF_HOSTED_POOLER=true` + secret `DATABASE_URL_SELF_POOLER` + `healthCheck` container apuntando a `/api/health/db-ready`.
- ✅ Target group `vence-frontend-tg`: `HealthCheckPath: /` → `/api/health/db-ready`, `slow_start.duration_seconds: 0 → 30`.
- ✅ Scalable target `MinCapacity: 1 → 2` (auto-scaling no puede bajar de 2 tasks aunque CPU sea bajo) — descubrimiento bonus durante la aplicación: el monitoreo detectó que ECS bajó automáticamente desired 2→1 por el auto-scaling con `MinCapacity: 1`. Fix profesional: subir MinCapacity.
- ✅ Rolling deploy `:75 → :76` completo en 3 min sin downtime, 0 failed tasks, 0 rollback del deploymentCircuitBreaker.
- ✅ **0 errores 5xx en los 15 min siguientes a la estabilización** (vs ~130 errores en bursts post-deploy previos).
- ✅ 8 conexiones `postgres.js` calientes en BD (warmup robusto 3 SELECT al boot × 2 tasks = baseline persistente).

**Commits asociados**: `5ed827fd` (código: endpoint db-ready + max:8 + warmup robusto). Cambios de infra AWS aplicados directamente vía `aws cli` con profile `vence` (sin commit en git porque task definition + target group + scalable target son infra, no código).

**Acciones (ejecutadas)**:

1. ✅ Cambio en `db/client.ts:35` — **NO ejecutado**. Mantuvimos `createDbClient()` con Supavisor sin cambios. El cambio operativo fue activar `USE_SELF_HOSTED_POOLER=true` que hace que los 30 wrappers `getXxxDb()` redirijan a `getPoolerDb()`. El path principal sigue intacto como fallback de rollback.
2. ✅ Subido `max: 1 → 8` en `createPoolerDbClient()` — PgBouncer multiplexa transacciones, soporta sin saturar Postgres.
3. ✅ Feature flag `USE_SELF_HOSTED_POOLER` mantenido para rollback instantáneo (SSM `/vence-frontend/USE_SELF_HOSTED_POOLER`).
4. ✅ Soak 24 h: pendiente — observar próximos 24h con cron `pg-stat-snapshot` capturando deltas.

**Riesgo realizado**: bajo. El rolling fue limpio (`minimumHealthyPercent: 100` + `deploymentCircuitBreaker.enable + rollback: true` ya estaban activos), el container nuevo pasó healthCheck antes de recibir tráfico. Sin band-aid `connect_timeout 5→15`: no fue necesario.

**Métrica de éxito**: ✅ alcanzada. 503 burst en horas pico eliminado en el primer test post-deploy.

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

- **2026-04-27** — Pool `max: 8 → 3 → 1` aplicado tras pool exhaustion con 261 eventos en Supavisor (documentado en `db/client.ts:12`). Decisión correcta para el contexto de entonces; ahora obsoleta tras self-hosted pooler operativo (2026-05-10).
- **2026-06-01 ~00:00 UTC** — Roadmap creado. Estado: 🟡 diagnóstico abierto. Script `capture-pool-pressure.cjs` preparado para Fase 0.
- **2026-06-01 ~06:30 UTC** — Fase 0 ejecutada gracias a burst en vivo capturado a las 06:09-06:13 UTC (130 errores 5xx). Hipótesis A/B/C descartadas. **Hipótesis D (starvation pool en rolling deploy) confirmada** por patrón `active_app=0` sostenido durante 4 min. Plan reordenado: Fase 1 (self-hosted pooler) sigue siendo la solución correcta pero con motivación nueva (pool TCP persistente que sobrevive a rolling deploys, no solo blips Supavisor). Mitigación band-aid (subir `connect_timeout: 5 → 15`) disponible si se necesita alivio inmediato; pre-warming agresivo y readinessProbe Fargate como alternativas intermedias.
- **2026-06-01 ~09:00 UTC** — **FASE 1 APLICADA**. Commit `5ed827fd` (endpoint `/api/health/db-ready` + pool max:8 + warmup robusto). SSM `USE_SELF_HOSTED_POOLER=true` creado. Task definition `vence-frontend:76` registrada con env + secret + healthCheck container. Target group: `HealthCheckPath: / → /api/health/db-ready`, `slow_start: 30s`. Service `desiredCount: 1 → 2`, `force-new-deployment`. **Descubrimiento bonus durante aplicación**: scalable target con `MinCapacity: 1` permitió a auto-scaling bajar a 1 task en madrugada — fix profesional `MinCapacity: 1 → 2`. Rolling completo 3 min, 0 failed tasks, 0 rollback. Verificación: endpoint devuelve `pool=self_hosted` latencia 3-18 ms; 0 errores 5xx en 15 min post-estabilización. Band-aid `connect_timeout 5→15` NO fue necesario — la solución de fondo es suficiente.
- **2026-06-01 ~09:42 UTC** — **FASE 6 HA APLICADA** (sub-roadmap `self-hosted-pooler.md`). 2ª VM Lightsail `vence-pooler-prod-2` en eu-west-2b creada desde snapshot. AWS NLB internet-facing en 3 AZs con cross-zone enabled, target group TCP:6543, healthcheck cada 10s. VPC peering Lightsail↔default. DNS `pooler.vence.es` → ALIAS NLB con `EvaluateTargetHealth: true`. Test failover REAL: stop VM-1 → VM-2 toma tráfico en ~37s sin downtime. **Bug latente cerrado en ambas VMs**: PgBouncer fallaba al boot por `/run/pgbouncer` (tmpfs) — fix `tmpfiles.d` aplicado. Sin HA, este bug habría tirado VM-1 en cualquier reboot futuro. SPOF del pooler eliminado. Fix sistémico complementario: GHA workflow `frontend-deploy.yml` jq filter ahora idempotente, garantiza por construcción que `USE_SELF_HOSTED_POOLER` + `DATABASE_URL_SELF_POOLER` + `healthCheck` siempre presentes en cada task def registrada (caso real `:77` 2026-06-01 que tiró momentáneamente la HA por registrar sin esos campos).

## Mejora pendiente del script analyze-pool-capture

El análisis automatizado no detectó Hipótesis D porque solo busca `pg_stat_activity` (estado de la BD). Cuando se vuelva a usar para Fase 1 verificación post-migración, añadir un cuarto bloque de análisis:

- **Hipótesis D** — patrón `active_app=0` sostenido (≥3 samples consecutivos) durante burst de errores 5xx. Si se cumple, el problema es **pre-BD** (TCP/TLS no establecido), no en la BD. Recomendación: revisar logs Fargate CloudWatch durante ventana del burst para confirmar `connect ETIMEDOUT` / `ECONNRESET`.

Esto requeriría enriquecer la captura con datos del ALB o logs Fargate — fuera del scope actual del script.
