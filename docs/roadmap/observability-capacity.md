# Roadmap — Observabilidad de capacidad (de eventos a margen disponible)

> **Estado**: 🟢 **2/3 ACCIONES APLICADAS (01/06/2026)** — Acción 1 (userId logger) y Acción 3 (pg_stat snapshot) LIVE en repo. Acción 2 (pool capacity sampler) condicionada a Fase 0 del roadmap [`pool-segregation.md`](pool-segregation.md).
> **Propietario**: equipo Vence
> **Coste recurrente**: 0 € (cron en backend Fargate ya existente + 1 tabla pequeña + cambio en logger).
> **Última actualización**: 2026-06-01 — Acción 1 y 3 implementadas y testeadas. Pendiente Acción 2 (espera Fase 0).

---

## 🚀 PUNTO DE RETOMA — leer antes de tocar nada

**El problema en 30 segundos.**

Hoy tienes **observabilidad de eventos** (qué pasó, cuándo, con qué error) pero te falta **observabilidad de capacidad** (cuánto margen queda antes de fallar). La diferencia es la misma que entre un detector de humo y un termómetro: el detector te avisa cuando ya hay fuego; el termómetro te dice que estás subiendo a 80 °C.

Durante el diagnóstico del incidente 31/05/2026 19-21 UTC (609 errores 5xx en `/api/profile`, ver [`pool-segregation.md`](pool-segregation.md)) la falta de observabilidad de capacidad bloqueó la investigación en 3 puntos concretos:

1. **No pude saber cuántos USUARIOS distintos sufrieron el incidente.** `validation_error_logs.user_id` salía siempre `NULL` para `/api/profile` porque el logger no extrae el userId del query param `?userId=...`. Conclusión inicial errónea: "1 solo user, será un bot" — eran 478 users reales con 8+ User-Agents distintos.
2. **No pude correlacionar request fallida con query activa en BD.** Los 37 errores de 20:27 UTC tenían duración exacta de 8 003 ms = `withDbTimeout` en cascada, pero `pg_stat_activity` solo muestra estado actual, no histórico. Sin captura en tiempo real (= lo que hace el script ad-hoc `capture-pool-pressure.cjs`) no podía saber QUÉ proceso bloqueó el slot esos 30 s.
3. **No pude distinguir "lento HOY" de "lento la semana pasada".** `pg_stat_statements` lleva acumulando desde el último reset (26/05) → las queries en el top eran ruido histórico de incidentes ya cerrados. Tuve que descartar manualmente `getAllLawsWithStats` y `refresh_ranking_cache` como falsos positivos.

Los gaps son del manual `docs/runbooks/observability.md` §13 — están identificados pero priorizados como "no urgentes". El incidente del 31/05 demuestra que **sí lo son**: cada incidente futuro se diagnostica igual de a ciegas hasta que se cierren.

**Las 3 acciones de este roadmap son INDEPENDIENTES** — se pueden implementar por separado y cada una aporta valor por sí sola. Ordenadas por ROI:

| # | Acción | Esfuerzo | Gap que cierra | Estado |
|---|---|---|---|---|
| 1 | Extraer `userId` del query param en `withErrorLogging` | 30 min | "¿cuántos users sufren?" | ✅ **APLICADA 01/06/2026** (commit `88808e6e`) |
| 2 | Cron `*/1 min` muestreando `pg_stat_activity` → tabla `pool_capacity_samples` + KPI en `/admin/salud-sistema` | 2-3 h | "¿cuánto margen queda?" | ⏳ pendiente, espera Fase 0 |
| 3 | Snapshot diario de `pg_stat_statements` a tabla histórica + vista delta | 1-2 h | "¿esta query es lenta HOY o legacy?" | ✅ **APLICADA 01/06/2026** (sin commit aún — pendiente OK migración SQL) |

---

## Acción 1 — `userId` en `withErrorLogging` (30 min, ROI alto)

### Qué hay hoy

`lib/api/withErrorLogging.ts` envuelve cada route handler y registra errores en `validation_error_logs`. Captura `request_body` cuando es POST/PUT, pero **NO captura query params**. Para endpoints como `/api/profile?userId=xxx`, `/api/exam/answer?testId=yyy`, `/api/topics/[numero]` (dynamic route), `/api/questions/filtered?oposicion=zzz`, el contexto del incidente queda incompleto.

Resultado actual al investigar: `user_id=NULL` en 100 % de los errores → diagnóstico empieza pensando "bot" o "anónimo" cuando son usuarios autenticados. Pasó hoy con `/api/profile`.

### Qué hacer

**Cambio quirúrgico en `lib/api/withErrorLogging.ts`:**

1. Definir un mapa explícito `ENDPOINT_USER_ID_EXTRACTORS: Record<string, (req: NextRequest) => string | null>` que documente, por endpoint, dónde está el userId:
   - `/api/profile`: `new URL(req.url).searchParams.get('userId')`
   - `/api/exam/answer`: `body.userId` (ya en request_body)
   - `/api/answer`: `body.userId`
   - …
2. En el handler del error, si `userId` aún es `NULL` y el endpoint tiene extractor, intentar extraerlo.
3. Añadir test en `__tests__/lib/api/withErrorLogging.test.ts` que verifique que `/api/profile` extrae el userId correctamente.

**Riesgo**: cero. Solo lectura del request. Si el extractor falla, el `user_id` queda `NULL` (estado actual).

**Métrica de éxito**: en el próximo incidente, `SELECT COUNT(DISTINCT user_id) FROM validation_error_logs WHERE endpoint='/api/profile' AND created_at > NOW() - INTERVAL '1 hour'` devuelve un número realista (>1), no `NULL`.

---

## Acción 2 — Pool capacity sampler (2-3 h, ROI muy alto)

### Qué hay hoy

El runbook `health-check.md` mide latencia INSERT y errores 5xx — ambos son **lagging indicators** (se ven después de que el problema impactó). No hay leading indicator que muestre "pool al 95 %, vas a fallar en 60 s".

El script ad-hoc `scripts/diagnostic/capture-pool-pressure.cjs` (creado en pool-segregation Fase 0) hace exactamente este muestreo, pero es **una herramienta externa** que se ejecuta manualmente cuando ya sospechas. Lo robusto es internalizarlo como cron permanente.

### Qué hacer

**Infraestructura nueva (3 piezas):**

1. **Tabla `pool_capacity_samples`** (migration SQL):
   ```sql
   CREATE TABLE pool_capacity_samples (
     ts                    timestamptz NOT NULL DEFAULT NOW(),
     total_conns           int NOT NULL,
     active_app_conns      int NOT NULL,             -- application_name='postgres-js' AND state='active'
     idle_in_tx_count      int NOT NULL,             -- state='idle in transaction'
     idle_in_tx_over_5s    int NOT NULL,             -- subset que lleva >5s
     long_active_over_5s   int NOT NULL,             -- state='active' AND query >5s
     by_app                jsonb NOT NULL,           -- {"postgres-js/active":2,"Supavisor/idle":8,...}
     PRIMARY KEY (ts)
   );
   -- Retención: 7 días (drop diario en cron de poda existente)
   CREATE INDEX idx_pool_capacity_samples_ts ON pool_capacity_samples (ts DESC);
   ```

2. **Cron Fargate `pool-capacity-sampler`** (nuevo módulo `backend/src/pool-capacity-sampler/`):
   - Pattern idéntico a `refresh-rankings.cron.ts` — `@Cron('*/1 * * * *')`, jitter 5 s, heartbeat, observability emit.
   - Cada tick ejecuta el mismo SQL que `capture-pool-pressure.cjs` y hace `INSERT INTO pool_capacity_samples (...)`.
   - Coste: 1 INSERT/min = 1 440 filas/día = 10 k filas/sem, ~1 MB → despreciable.

3. **KPI card en `/admin/salud-sistema`** (modificar `app/admin/salud-sistema/page.tsx`):
   - 6º indicador: **"Capacidad pool"** = `active_app_conns / max_pool_estimated * 100` últimos 5 min, peor caso.
   - Verde <50 %, ámbar 50-75 %, rojo >75 % sostenido 3+ min.
   - Si `idle_in_tx_over_5s > 0` → rojo automático con label "slot zombi detectado".
   - Endpoint API: `/api/admin/salud-sistema` ya devuelve JSON — añadir campo `pool_capacity`.

4. **Alerta** (extensión de `backend/src/alerts/alert-rules.ts`):
   - RULE `POOL_CAPACITY_SUSTAINED_HIGH`: si `active_app_conns >= 80% * max_estimated` durante 3 min consecutivos → email + dashboard.
   - RULE `POOL_IDLE_IN_TX_DETECTED`: si `idle_in_tx_over_5s > 0` 2 muestras consecutivas → email inmediato.
   - Cooldown 30 min para evitar spam.

### Cómo evitar el antipatrón "telemetría que satura el sistema que monitoriza"

El cron muestrea con **su propio cliente DB dedicado** (no comparte pool con `getDb()`). Usa `getAdminDb()` (max:12 vía self-hosted pooler) o crea `getCapacitySamplerDb()` con su propio `max: 1` separado del path user-facing. **NUNCA** debe el muestreador competir por el slot que está intentando medir.

**Riesgo**: bajo. El cron no escribe en tablas calientes (solo `pool_capacity_samples`, propia). Si el cron muere, el peor caso es ceguera temporal — el runbook `health-check.md` sigue funcionando.

**Métrica de éxito**: al revisar el próximo incidente, debe poderse responder "el pool subió a 90 % a las 09:08 UTC, 3 min antes del primer 503 a las 09:11" con un `SELECT` simple. Hoy esa pregunta es irrespondible.

---

## Acción 3 — Snapshot histórico de `pg_stat_statements` (1-2 h, ROI medio-alto)

> **✅ APLICADA en repo (2026-06-01)**. Migración SQL + módulo NestJS + tests creados.
> **PENDIENTE OK del usuario**: aplicar `supabase/migrations/20260601_pg_stat_statements_snapshots.sql` en BD producción + commit + push.
>
> **Archivos creados**:
> - `supabase/migrations/20260601_pg_stat_statements_snapshots.sql` — tabla + función `take_pg_stat_statements_snapshot()` + función `prune_pg_stat_statements_snapshots(days)` + vista `v_pg_stat_statements_delta` + verificación pg_stat_statements habilitado.
> - `backend/src/pg-stat-snapshot/pg-stat-snapshot.service.ts` — wrapper Drizzle de las funciones SQL + helper puro `parseSnapshotResult` testeado.
> - `backend/src/pg-stat-snapshot/pg-stat-snapshot.cron.ts` — `@Cron('5 0 * * *')` UTC + jitter + HeartbeatRegistry (threshold 28h) + observability emit.
> - `backend/src/pg-stat-snapshot/pg-stat-snapshot.module.ts` — NestJS module estándar.
> - `backend/src/pg-stat-snapshot/pg-stat-snapshot.service.spec.ts` — 15 tests (6 unit puros sobre `parseSnapshotResult` + 9 contract asserts sobre source code del service + cron).
> - `backend/src/app.module.ts` — registro de `PgStatSnapshotModule` junto a `RefreshTopicSummaryModule`.
>
> **Tests**: 15/15 OK. `npx tsc --noEmit` sin errores.

### Qué hay hoy

`pg_stat_statements` es acumulado desde el último `pg_stat_statements_reset()` (verificado hoy: reset 2026-05-26 09:40 UTC, lleva 5+ días acumulando). Cuando se investiga un incidente, las queries del top son una mezcla de:

- Queries que están lentas **ahora mismo**.
- Queries que estuvieron lentas durante un incidente cerrado hace 4 días pero siguen pesando en `mean_exec_time`.
- Queries de crones que se ejecutaron miles de veces y agregan latencia diluida.

**Caso real del 31/05**: `getAllLawsWithStats` aparecía con `mean=2 927 ms` y 174 calls → parecía protagonista del incidente. Investigación: solo se llama desde `/test/por-leyes` (página de bajo tráfico, 174 calls en 5 días = 35/día). Era ruido histórico, no causa actual.

### Qué hacer

**1. Tabla snapshot diaria** (migration SQL):

```sql
CREATE TABLE pg_stat_statements_snapshots (
  snapshot_at    timestamptz NOT NULL,
  queryid        bigint NOT NULL,
  calls          bigint NOT NULL,
  total_exec_ms  numeric NOT NULL,
  mean_exec_ms   numeric NOT NULL,
  max_exec_ms    numeric NOT NULL,
  rows           bigint NOT NULL,
  query          text NOT NULL,        -- LEFT(query, 1000) para acotar
  PRIMARY KEY (snapshot_at, queryid)
);
-- Retención: 30 días
CREATE INDEX idx_pgss_snap_ts ON pg_stat_statements_snapshots (snapshot_at DESC);
```

**2. Cron diario `pg-stat-snapshot`** (backend Fargate, `@Cron('5 0 * * *', { timeZone: 'UTC' })`):

- `INSERT INTO pg_stat_statements_snapshots SELECT NOW(), queryid, calls, total_exec_time, mean_exec_time, max_exec_time, rows, LEFT(query, 1000) FROM pg_stat_statements WHERE calls > 10;`
- **NO reseteamos** `pg_stat_statements` — solo lo leemos. El reset queda como operación manual cuando se decida (decisión consciente, no automática).

**3. Vista `v_pg_stat_statements_delta`** (SQL — facilita análisis):

```sql
CREATE OR REPLACE VIEW v_pg_stat_statements_delta AS
WITH today AS (
  SELECT * FROM pg_stat_statements_snapshots
  WHERE snapshot_at = (SELECT MAX(snapshot_at) FROM pg_stat_statements_snapshots)
),
yesterday AS (
  SELECT * FROM pg_stat_statements_snapshots
  WHERE snapshot_at = (
    SELECT MAX(snapshot_at) FROM pg_stat_statements_snapshots
    WHERE snapshot_at < (SELECT MAX(snapshot_at) FROM pg_stat_statements_snapshots)
  )
)
SELECT
  t.queryid,
  t.calls - COALESCE(y.calls, 0) AS calls_delta_24h,
  CASE WHEN t.calls > COALESCE(y.calls, 0)
       THEN (t.total_exec_ms - COALESCE(y.total_exec_ms, 0)) / NULLIF(t.calls - COALESCE(y.calls, 0), 0)
       ELSE NULL END AS mean_ms_last_24h,
  t.mean_exec_ms AS mean_ms_all_time,
  t.query
FROM today t
LEFT JOIN yesterday y ON y.queryid = t.queryid
WHERE t.calls - COALESCE(y.calls, 0) > 5
ORDER BY (t.total_exec_ms - COALESCE(y.total_exec_ms, 0)) DESC;
```

Esta vista da el **delta real de las últimas 24 h**: cuántas calls nuevas, su mean efectivo de las últimas 24 h (no acumulado), comparable con el mean histórico. Si una query empieza a degradarse hoy, `mean_ms_last_24h >> mean_ms_all_time` lo señala inmediatamente.

**4. Sección en runbook `health-check.md`** — añadir paso "para queries lentas, usar `v_pg_stat_statements_delta` (24h reales), NO `pg_stat_statements` directo (acumulado eterno)".

**Riesgo**: cero. Solo añade tabla + cron read-only. No toca queries existentes.

**Métrica de éxito**: en el siguiente incidente, una query del top de `pg_stat_statements_delta` que aparezca con `mean_ms_last_24h > 1 000 ms` es **siempre** culpable real, no histórico.

---

## Defensa-en-profundidad (no son acciones nuevas, son recordatorios)

- **No muestres en `/admin/salud-sistema` métricas que NO sean accionables.** Cada KPI nuevo debe responder a una pregunta operativa concreta ("¿debo intervenir?"), no a vanidad ("mira qué bonito"). El panel hoy tiene 5 indicadores con semáforo claro — mantenerlo así.
- **Cualquier cron nuevo debe registrarse en `HeartbeatRegistry`** y exponer en `/health/crons` para que la ECS liveness probe lo monitorice. Patrón ya documentado en `backend/src/refresh-rankings/refresh-rankings.cron.ts`. Sin esto, un cron muerto pasa desapercibido durante días.
- **Pruebas en CI**: cada nuevo extractor de userId en `withErrorLogging` debe tener su test. Sin esto, regresiones silenciosas en el log.

---

## Antipatrones a evitar

1. **Crear métricas que se monitorizan a sí mismas.** El cron sampler **NO** debe insertar en `pool_capacity_samples` desde el mismo pool que está midiendo — eso falsea la lectura. Usar pool dedicado.
2. **Acumular sin podar.** Las tablas `pool_capacity_samples` (1 440 filas/día) y `pg_stat_statements_snapshots` (~50 k filas/snapshot) deben tener retención explícita (7 d y 30 d respectivamente) integrada en el cron de poda existente. Sin esto, en 6 meses ocupan más que las tablas hot.
3. **Dashboard sin alerta.** Una métrica que solo se ve cuando alguien abre el dashboard **no es observabilidad**, es decoración. Cada nueva métrica de capacidad debe tener una regla en `alert-rules.ts` que dispare email/notif cuando cruza umbral.

---

## Orden de ejecución sugerido

1. ✅ **Acción 1** (userId en logger) — APLICADA 01/06/2026 (commit `88808e6e`).
2. ✅ **Acción 3** (snapshot pg_stat_statements) — APLICADA en repo 01/06/2026, pendiente migración SQL en BD.
3. ⏳ **Fase 0 de pool-segregation** (captura del próximo pico) — script ad-hoc listo en `scripts/diagnostic/capture-pool-pressure.cjs`.
4. ⏳ **Acción 2** (pool capacity sampler) — 2-3 h, internaliza lo que hoy es ad-hoc. Espera Fase 0.

**Razón del reorden**: las acciones 1 y 3 son no-bloqueantes para Fase 0 y enriquecen los datos disponibles cuando se ejecute. Acción 2 sí se beneficia de Fase 0 para confirmar el formato exacto del muestreo necesario.

Total ejecutado hoy: **~2 h** (Acción 1 + Acción 3 con tests + roadmap + commits parciales). Pendiente: ~3 h (Fase 0 + Acción 2).

---

## Dependencias y enlaces

- **Roadmap hermano**: [`docs/roadmap/pool-segregation.md`](pool-segregation.md) — la captura ad-hoc de Fase 0 es el precursor del cron sampler de Acción 2.
- **Manual de observability**: [`docs/runbooks/observability.md`](../runbooks/observability.md) §13 — gaps identificados que este roadmap cierra parcialmente (Gap 9 ya hecho dashboard `/admin/observability`; pendientes Gap 11 SLO budgets, Gap 12 OpenTelemetry).
- **Runbook salud sistema**: [`docs/runbooks/health-check.md`](../runbooks/health-check.md) — se actualizará tras Acción 3 con paso explícito sobre `v_pg_stat_statements_delta`.
- **Roadmap padre**: [`docs/ARCHITECTURE_ROADMAP.md`](../ARCHITECTURE_ROADMAP.md) § Bloque 4 (Materializar pendientes + resiliencia).

---

## Histórico de decisiones

- **2026-06-01** — Roadmap creado tras incidente 31/05 demostrar que los 3 gaps de capacidad son operativamente bloqueantes (no opcionales).
- **2026-06-01** — Acción 1 (`extractUserIdFromRequest`) APLICADA + commit `88808e6e` + push a `origin/main`. 19 tests unitarios + regression del incidente 31/05. Decisión arquitectónica: módulo aparte (`lib/api/extractUserId.ts`) en vez de inline, para reutilización futura (Acción 2 pool sampler, Sentry scope enrichment) y testabilidad directa.
- **2026-06-01** — Acción 3 (pg_stat_statements snapshot) APLICADA en repo: migración SQL + módulo NestJS backend + 15 tests OK + `tsc --noEmit` clean. Pendiente aplicar migración en BD prod (decisión del usuario — no automatizada por ser DDL en producción) + commit + push. Reordenado el plan: Acción 3 antes que Fase 0 porque enriquece los datos que mañana se analizarán en la captura del pico.
