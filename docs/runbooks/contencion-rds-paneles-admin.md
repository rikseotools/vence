# Runbook — Contención RDS por paneles admin (bulkhead + cache + read replica)

> **Estado:** cache + bulkhead **APLICADOS (12/07/2026)**. Read replica = decisión de coste (pendiente, gatillada).
> **Cuándo consultarlo:** cuando el usuario diga *"la app va lenta a ratos"*, *"503 intermitentes"*, *"el canary de BD falló"*, *"el panel admin tarda"*, *"CONNECT_TIMEOUT en el build"*, o cuando la observabilidad muestre `canary_db_pool_failed` / picos de `http_5xx` sin causa de código. Seguir este runbook ANTES de improvisar.
> **Relacionado:** `docs/ARCHITECTURE_ROADMAP.md` (fases de pool contention), `roadmap/pool-segregation.md`, `roadmap/self-hosted-pooler.md`, `observability.md`.

## El síntoma

Fallos **transitorios** que se auto-recuperan y parecen inconexos, pero comparten una sola raíz:
- Ráfagas de `http_5xx` (503) del dashboard / endpoints admin ("servicio saturado").
- CRITICAL `canary_db_pool_failed` — *"Query timeout >1000ms"* en el canary de pool de BD.
- Carga de perfil lenta para usuarios (Alfonso, 12/07).
- `CONNECT_TIMEOUT` a RDS durante el build (prerender SSG que pega a BD).
- "Premium no reconocido" momentáneo (lectura de plan que timeoutea).

Todos son la **misma contención del primario RDS** manifestándose en distintos sitios.

## La causa raíz (diagnóstico a ciencia cierta, 12/07/2026)

Vía `pg_stat_statements` (ordenado por `total_exec_time`):

- La query **#1 en carga del primario** es la agregación de los **paneles admin** `system-health` + `infra-stats`: `SELECT endpoint, error_type, deploy_version, count(*), avg(duration)… GROUP BY` sobre **`observable_events` (9,8M filas / 5,4 GB)** + `validation_error_logs`. Coste acumulado **~60.000 s de tiempo BD, max 112 s**, 45.855 llamadas.
- Las queries **están bien escritas** (acotadas por `ts`/`created_at` + índice `btree(ts DESC)`). El problema **no es la query**, es **cuántas veces se ejecuta**: los paneles **auto-refrescan cada 60 s por admin** y corrían **SIN cache** → cada refresh de cada admin dispara un escaneo fresco de 5,4 GB.
- RDS tiene **400 max_connections y solo ~33 en uso** → **las conexiones NUNCA son el cuello**. El cuello es **CPU/IO/buffer del primario**, que TODOS los pools comparten (misma instancia física).

## El modelo mental correcto: dos aislamientos distintos (*bulkheading*)

Separar el trabajo admin del de usuarios es lo profesional, pero hay que distinguir:

1. **Aislar CONEXIONES (slots de pool).** Pools separados por workload: `getDb()` max:5 (usuarios), `getAdminDb()` max:12 (admin), `getTraceDb()` max:1. Evita que una query admin robe *slots* al hot-path. **Barato, app-level.** → Un "pooler propio para el admin" resuelve ESTO.
2. **Aislar CÓMPUTO (CPU/IO del servidor).** Un pool separado **sigue pegando a la misma instancia RDS**: un escaneo de 112 s quema CPU/buffer compartidos y ralentiza a los usuarios **aunque tengan su propio pool**. Por eso el panel tumbaba el tráfico *a pesar* de los pools separados. **Esto solo lo resuelve un READ REPLICA** (instancia física aparte para lecturas analíticas).

> **Regla:** si RDS tiene conexiones de sobra (33/400) pero la app va lenta bajo carga admin, el problema es **cómputo**, no conexiones. Un pooler nuevo no lo arregla; un read replica sí. Y **antes que la réplica**, mira si puedes **no ejecutar** la query (cache).

## Las capas de la solución (de más barata a más cara — aplicar en este orden)

### 1. No computar → cache del panel (✅ APLICADO 12/07)
Un panel de monitoreo que auto-refresca cada 60 s **no gana nada** ejecutando un escaneo fresco por cada admin. Memo in-memory **post-auth** del payload, por Fargate-task. **Los 5 paneles de monitoreo que agregan sobre `observable_events` están cubiertos:**
- **`system-health`** (TTL 30 s, keyed por `window`) e **`infra-stats`** (TTL 20 s): memo **inline** (fueron los primeros, `getHealthCache`/`getInfraCache`).
- **`observability`** (keyed por `window`), **`slos`** y **`canary`** (singleton): usan el **helper compartido `lib/cache/adminPanelMemo.ts`** (`createAdminPanelMemo(ttlMs)`, TTL 30 s) para no duplicar el memo. **Escalable:** un panel nuevo = 3 líneas (import + `createAdminPanelMemo` + get/set post-auth).
- *(Cabo menor: migrar los 2 inline al helper compartido para uniformidad — opcional, ambos funcionan.)*
- **Seguridad:** la auth (`verifyAuth` + `isAdmin`) corre SIEMPRE antes de leer el cache → nunca se sirve dato sin autorizar. El payload lleva `cached:true` cuando viene del memo (observabilidad del hit-rate).
- **Por qué NO es "cache que enmascara la causa"** (el `ARCHITECTURE_ROADMAP` avisa de eso): aquí no tapamos un SPOF con reintentos; **eliminamos un escaneo repetido inútil** de un panel. La causa (escaneo caro) desaparece, no se esconde.
- **Efecto:** query #1 pasa de N_admins × refresh a **~1 ejecución/30 s por task**.

### 2. Aislar conexiones → bulkhead de pool (✅ APLICADO 12/07)
`infra-stats` corría sobre **`getDb()` (el pool de USUARIOS)**. Movido a **`getAdminDb()`** (max:12) → sus lecturas ya no roban slots al hot-path. `system-health` ya usaba `getAdminDb()`.

### 3. Aislar cómputo → read replica (🟢 PROVISIONADA + CAPA 1 LIVE 15/07 — gatillo cumplido)
La fontanería **ya existía**: `getReadDb()` + flag `USE_READ_REPLICA` + `DATABASE_URL_REPLICA` en `db/client.ts`. El gatillo se cumplió el 15/07 (la contención RECURRIÓ bajo carga de mañana pese a cache+bulkhead → `pg_stat_statements` confirmó cuello de CÓMPUTO repartido: admin analytics ~117k s + escrituras telemetría ~96k s + user analytics ~60-80k s + cron outbox ~50k s).

**PROVISIONADA (15/07):**
- **Instancia:** `vence-prod-replica` (db.t4g.medium, single-AZ, misma SG `sg-04628bd6a17efdd20`). Endpoint `vence-prod-replica.c1mkcg6astb0.eu-west-2.rds.amazonaws.com`. Coste ≈ otra t4g.medium (~$40-60/mes).
- **⚠️ GOTCHA CAZADO al simular (imprescindible):** una lectura analítica en la réplica se **cancelaba** con `ERROR: canceling statement due to conflict with recovery` (la réplica aplica WAL que borra filas que la query lee). Fix: **parameter group propio `vence-postgres17-replica` con `hot_standby_feedback=on`** (+ `max_standby_streaming_delay=30000`). ⚠️ El param group requiere **reboot de la réplica** para activarse; NO rebootar hasta que la asociación esté en `pending-reboot` (si rebooteas mientras está `applying`, no aplica → verificar con `SHOW hot_standby_feedback` = `on`). Trade-off aceptado: `hot_standby_feedback=on` puede causar algo de bloat en el primario (retiene vacuum de filas que la réplica lee); con lag sub-segundo + queries cortas es asumible.
- **Flip (runtime-config, sin rebuild):** SSM `/vence-frontend/DATABASE_URL_REPLICA` → host de la réplica (era el primario) + `USE_READ_REPLICA=true` en el `environment` del task def (revisión `:468`). `getReadDb()` lee ambos en runtime; **rollback = flip a `false` o task def anterior**. **Persistencia:** el deploy script clona el TD VIVO → hereda `USE_READ_REPLICA=true` solo (no hay que tocar el script).
- **Qué MOVIÓ el flip (Capa 1):** SOLO los ~20 callers de `getReadDb()` (theme-stats ~28k s = el mayor de usuario, catálogo oposiciones, analytics de usuario, disputes…). **Verificado:** `pg_stat_activity`/`pg_stat_statements` de la réplica acumulan esas queries = fuera del primario; lag 0,08-0,13s; 0 regresiones.
- **CAPA 2 (15/07):** `system-health` + `observability` (agregación `observable_events` = ofensor #1 ~117k s) movidos de `getAdminDb`→`getReadDb`. **Reproductor de Manuel:** el pico NO era horario sino **abrir el panel `/admin`** (auto-refresca y dispara las agregaciones) → medido a demanda que ANTES ponía queries de 20-42s en el PRIMARIO y DESPUÉS el primario queda a 0 lentas (corre en la réplica). `infra-stats` se QUEDA en primario (lee `pg_stat_activity` del pool → debe ver la instancia primaria).
- **CAPA 3 — crons BACKEND NestJS (15/07):** el backend tenía **UNA sola conexión** (`DatabaseModule` token `DRIZZLE` → primario, max:25); todos los crons pegaban al primario (query `WITH src` 9s de `alert-rules`/`canary-stats-pipeline`, ~50k s). **Fix (mismo patrón agnóstico que el frontend):** nuevo token **`DRIZZLE_READ`** en `backend/src/db/database.module.ts` (réplica si `USE_READ_REPLICA=true`+`DATABASE_URL_REPLICA`, si no **fallback al MISMO cliente primario** = rollback-safe, sin conexiones extra). Los crons **ANALÍTICOS read-only** inyectan `DRIZZLE_READ`; **escrituras** (outbox, refresh MV, canarios que prueban el guardado) y **canarios que monitorizan el primario** (`db-pool`/`pool-capacity` que leen `pg_stat_activity`) **se quedan en `DRIZZLE`** (primario). ⚠️ **CLASIFICAR cada cron a mano** (enrutar mal una escritura → error en réplica read-only; enrutar mal un canario de monitorización → lee la instancia equivocada). Task def backend: secret `/vence-backend/DATABASE_URL_REPLICA` + env `USE_READ_REPLICA=true` (inyectados idempotentes en `deploy-backend.sh`). Deploy: `deploy-backend.sh` + smoke `api.vence.es/health`. **⚠️ GOTCHA IAM (cazado 15/07):** el rol `vence-backend-task-execution` tiene una allowlist EXPLÍCITA de ARNs SSM (`ssm:GetParameters` en la política inline `vence-backend-read-secrets`). Al añadir un secret nuevo al task def HAY QUE añadir su ARN a esa política, o el task NO arranca (`AccessDeniedException` → `ResourceInitializationError` → circuit breaker AUTO-REVIERTE a la revisión anterior; el anti-clobber del deploy lo caza). Fix: `aws iam put-role-policy` añadiendo `arn:…:parameter/vence-backend/DATABASE_URL_REPLICA`. **Verificado LIVE:** log de arranque `[DatabaseModule] DRIZZLE_READ → RÉPLICA de lectura`; `pg_stat_statements` de la réplica acumula las agregaciones `observable_events` del alert-engine; las 6 reglas de pool = 0 en la réplica (siguen en primario).
- **Validación:** el mecanismo está simulado/medido (Capa 1+2 confirmadas con el reproductor del panel: primario 20-42s→0). Vigilar `canary_db_pool_failed` + `http_5xx` 503 de `answer-and-save`/`questions/filtered`; si tras Capa 3 el primario sigue caliente → medir y valorar `t4g.large`.

### 4. Reducir el DATO (retención + partición) — más barato que el sink, ataca las 3 categorías

La contención tiene 3 categorías de carga: lecturas admin, lecturas analytics-usuario (ambas → réplica, Capas 1-3) y **ESCRITURAS** (~96k s: la observabilidad mete 7,5M+ inserts/mes en el primario). La réplica NO ayuda a las escrituras. Antes de construir un sink (caro), **reducir el dato** es el primer paso, más barato y con mejor ratio (encoge la tabla → agregaciones más rápidas + menos VACUUM + menos peso de escritura, todo a la vez).

**Estado actual (15/07):** la retención YA EXISTE y funciona (no es chapuza):
- `backend/src/observability/cleanup.cron.ts` (@Cron diario 4am UTC): `DELETE FROM observable_events WHERE ts < NOW() - RETENTION_DAYS` (30 días).
- `backend/src/telemetry-retention/telemetry-retention.service.ts`: borra POR LOTES (drena en varias noches, sin DELETE gigante ni locks largos) + `VACUUM (ANALYZE)`.
- Verificado: observable_events retiene ~30d (solo ~20k filas >30d = cola drenándose). Tamaños: **user_interactions 8,5GB/9,6M (la MAYOR)**, observable_events 5,7GB/10,2M (últimos 7d = 42%), test_questions 5,3GB/1,7M (historial, no purgable).

**Escalera de mejora (barato → caro), la gran mayoría PENDIENTE:**
1. **Bajar `RETENTION_DAYS`** de observable_events 30→7-14d (los paneles casi siempre miran 24h-7d). Encoge la tabla ~50-60%, es cambiar UN número. Si se necesita histórico >14d → **rollup diario** (tabla resumen chica). Casi gratis.
2. **Revisar el archivado de `user_interactions`** (8,5GB, la mayor; cron `archive-interactions` mueve filas INSERT+DELETE) — confirmar que va al día y no se queda atrás.
3. **Particionar por tiempo** (`pg_partman`, ya en el roadmap) las tablas de append (observable_events, user_interactions) → retención = **`DROP PARTITION`** (instantáneo, sin DELETE ni VACUUM). El fix ESTRUCTURAL de tablas de append masivo.
4. **Sink separado** (Kinesis/Firehose→S3+Athena o ClickHouse) → SOLO cuando 1-3 no basten (>30k DAU, Bloque 4 Fase 2 KinesisSink). Quita las escrituras del primario del todo, pero exige reescribir las queries de los paneles + latencia de ingesta.

### 5. (Latencia del cron, baja prioridad) Paralelizar las ~44 reglas de `alerts-engine`
Hoy corren en SERIE (bucle `for`) cada 5 min; si una tarda, retrasa las demás. Paralelizarlas (con **límite de concurrencia**, p.ej. p-limit 5-8 — NUNCA `Promise.all` a pelo, saturaría el pool) haría el tick ~lo que la regla más lenta. NO daña a usuarios (backend aislado + Capa 3 ya las saca del primario) → solo si el tick empieza a pasarse de 5 min (`cron_overdue`).

## Capas de seguridad de este fix (conforme memoria)
- **Guardarraíl:** `__tests__/api/admin/adminPanelsCache.test.ts` (8 tests) — verifica por fuente que el memo sigue puesto **y que el hit de cache ocurre DESPUÉS de la comprobación de admin** (anti-regresión de seguridad + de rendimiento).
- **Typecheck** de ambos routes: limpio.
- **Observabilidad:** `cached:true` en el payload; medir hit-rate. Vigilar `canary_db_pool_failed` y `http_5xx` post-deploy (ya cubierto por `RULE_HTTP_5XX_SPIKE`).
- **Reversible:** quitar el bloque `if (cachedX) return …` restaura el comportamiento anterior (sin tocar la lógica de cómputo).

## Verificación post-deploy
1. Abrir `/admin/salud-sistema` y `/admin/infraestructura` → responden y muestran datos (2ª carga en <30 s trae `cached:true`).
2. `pg_stat_statements`: la agregación #1 baja drásticamente en `calls` por unidad de tiempo.
3. Sin ráfagas de `canary_db_pool_failed` ni `http_5xx` 503 en 1 h.

## Cómo diagnosticar de nuevo (si reaparece)
```sql
-- Top queries por tiempo total de BD (las que cargan el primario)
SELECT substring(query,1,90) q, calls, round(total_exec_time/1000) tot_s,
       round(mean_exec_time) mean_ms, round(max_exec_time) max_ms
FROM pg_stat_statements ORDER BY total_exec_time DESC LIMIT 15;
-- ¿es cuello de conexiones o de cómputo?
SELECT count(*) conns, (SELECT setting::int FROM pg_settings WHERE name='max_connections') max
FROM pg_stat_activity WHERE datname=current_database();
```
Si `conns ≪ max` pero hay lentitud → **cómputo** → cache/replica, no más pool.
