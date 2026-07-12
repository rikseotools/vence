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

### 3. Aislar cómputo → read replica (⏸️ PENDIENTE — decisión de coste)
La fontanería **ya existe**: `getReadDb()` + flag `USE_READ_REPLICA` + `DATABASE_URL_REPLICA` en `db/client.ts` (patrón validado en era-Supabase, Sprint 3/5). **Tras el cutover a RDS (04/07) NO hay réplica** — `getReadDb()` apunta al primario.
- **Qué falta:** provisionar un **RDS read replica** (coste ≈ otra instancia RDS) → apuntar los endpoints admin/analytics a `getReadDb()` → flip `USE_READ_REPLICA=true`.
- **Gatillo:** hacerlo **solo si**, ya con la cache (capa 1) desplegada, la contención persiste. No pagar infra por un escaneo que la cache ya mató.

### 4. (A gran escala) OLAP aparte → ETL a warehouse. Overkill hoy. (>30k DAU, Bloque 4 Fase 2 KinesisSink).

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
