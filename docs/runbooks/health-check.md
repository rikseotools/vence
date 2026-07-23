# Runbook: estado de salud del sistema

Manual operativo para diagnosticar errores o salud del sistema Vence. Cuando el usuario diga "busca errores", "qué tal va", "estado", "salud", o similar, Claude debe seguir este runbook ANTES de improvisar.

Mantenedor: `docs/runbooks/health-check.md`. Referenciado desde `CLAUDE.md`.

> ## ⚠️⚠️ POST-CUTOVER A RDS (2026-07-04) — leer antes de diagnosticar
> La BD de prod migró a **AWS RDS** (`vence-prod`, Multi-AZ). **`observable_events` y todos los datos vivos
> están en RDS, NO en Supabase (congelado como backup).**
> - **Las queries de este runbook usan `DATABASE_URL`, que en `.env.local` AÚN apunta a Supabase (congelado)**
>   → correrlas en local mira la BD EQUIVOCADA. Usar la URL de RDS (en `prod` la tiene ECS vía SSM
>   `/vence-frontend/DATABASE_URL`; para diagnósticos manuales, la conexión RDS está en la memoria
>   `project_cutover_rds_prod`). Conectar con `ssl:{rejectUnauthorized:false}` + `?sslmode=require`.
> - **Ya NO hay Supavisor ni PgBouncer** en el camino: `getDb()`/réplica van directo a RDS con **`max:5`**
>   (era `max:1`, workaround del pooler compartido de Supabase). El self-hosted `pooler.vence.es` está bypassed.
>   → Los fingerprints históricos con `application_name='Supavisor'` (abajo, §incidentes) ya no aplican; en RDS
>   mirar `pg_stat_activity WHERE datname='app'` sin filtro de Supavisor. Panel `/admin/infraestructura`
>   (stats PgBouncer) queda obsoleto.
> - **Gotcha de migración**: tras una carga masiva, `ANALYZE;` es obligatorio (sin stats → seq scans → 503
>   "saturado"). Si reaparecen 503 de saturación tras cualquier recarga, ejecutar `ANALYZE` primero.
> Detalle: memoria `project_cutover_rds_prod` + `docs/roadmap/migracion-datos-supabase-a-rds.md`.

---

## 1. Comprobación rápida (30 segundos)

Por humano:

Abrir en navegador `https://www.vence.es/admin/infraestructura` (alias `/admin/salud-sistema`). Bloque CRÍTICOS (semáforo) + OBSERVABILIDAD (incluye errores de cliente + catch-all) + SANITY:

1. **Errores 5xx servidor últimas 24h** (`http_status >= 500`) — verde 0, ámbar ≥1, rojo ≥5.
2. **UI congelada cliente** (Watchdog hook `useAnswerWatchdog`, threshold 12s) — verde 0, ámbar ≥3, rojo ≥10. Cada evento = un user con UI bloqueada en ExamLayout/TestLayout. Suele correlar con saturación BD/antifraud, no con un fallo del servidor.
   - **Nota — drift residual del fix Page Visibility** (commit `a4051a6b`, 31/05/2026): si % de events con `duration_ms > 60s` sube de ~0% (post-fix) a >20%, hay regresión en un navegador real (probable Safari/mobile) donde la Page Visibility API no se comporta como en Chrome/JSDOM. La alerta `watchdog_wallclock_residual` lo detecta automáticamente con cooldown 4h. Investigar con: `SELECT user_id, duration_ms, metadata->>'userAgent' FROM validation_error_logs WHERE error_message ILIKE '%Watchdog%' AND duration_ms > 60000 ORDER BY duration_ms DESC LIMIT 20;`
3. **Drift contadores 24h** (>5%) — verde 0, ámbar ≥1, rojo ≥5.
   - **⚠️ Punto ciego conocido (03/06/2026)**: este indicador se alimenta de `check_stats_drift`, que muestrea solo **30 users al azar ~diario** y chequea `uqh_v2` por **row-count** (no por `total_attempts`). NO cazó el freeze de 14h de 5 tablas materializadas del 03/06 (corrió durante y no vio nada). Esa clase de fallo —pipeline outbox→handler congelado o escribiendo mal— la cubren ahora 3 alert-rules/canary dedicados: `materialized_stats_stale` (frescura), `stats_paridad_divergence` (correctitud en vivo) y el canary `canary-stats-pipeline` (e2e 24/7). Si sospechas stats materializadas mal, NO te fíes solo de este card: mira esos 3. Detalle: `[[project_incidente_outbox_cutover_a_medias_03_06]]`.
4. **Latencia INSERT test_questions** (mean histórico desde pg_stat_statements, incluye RTT cliente→pooler→DB) — verde <80ms, ámbar ≥80ms, rojo ≥250ms. Baseline actual (post-DROP de 2 NO-OPs el 23/05/2026): ≈44ms. El INSERT puro dentro de la BD es ~1.5ms p50 — la diferencia es RTT.
5. **Cron de drift vivo** — verde <26h sin correr, ámbar 26-36h, rojo >36h.
6. **Integridad exámenes 24h** — verde 0, ámbar ≥1, rojo ≥5. Nº de exámenes `is_completed` (`test_type='exam'`) a los que les faltan >5% de filas en `test_questions` respecto a `total_questions`. Clase de bug de Rosa (07/06/2026): el examen se marca completado con score/total correctos pero el detalle por-pregunta no se persiste (saves perdidos bajo carga) → `/revisar` sale vacío en silencio. Se alimenta del cron `check-exam-integrity` (04:30 UTC diario), que emite `exam_integrity_drift` a `observable_events` solo si hay afectados.
   - **Fix de raíz (08/06/2026):** `/api/exam/validate` ahora persiste todas las filas en bloque (1 UPSERT idempotente) en vez de ~50 saves fire-and-forget. Commits `e52b91fa` + `c19c6901`.
   - **⚠️ Baseline post-deploy:** el histórico PRE-fix tiene exámenes con filas faltantes; tardan ~24h en salir de la ventana tras el deploy del 08/06. Un pico el primer día NO es regresión. Tras 24h, cualquier afectado nuevo SÍ indica que el bulk-write de validate se rompió.
   - **⚠️ Punto ciego:** si el cron muere, no emite eventos → verde falso (mismo patrón que drift). Verificar que el workflow `check-exam-integrity.yml` corre.
   - Query manual: `SELECT t.id, t.total_questions, count(tq.id) AS filas FROM tests t LEFT JOIN test_questions tq ON tq.test_id=t.id WHERE t.test_type='exam' AND t.is_completed AND t.completed_at >= now()-interval '24 hours' AND t.total_questions>0 GROUP BY t.id HAVING count(tq.id) < t.total_questions*0.95 ORDER BY (t.total_questions-count(tq.id)) DESC;`

> Nota — Hasta 31/05/2026 los indicadores (1) y (2) estaban fusionados en un único card "Errores 5xx" que filtraba sólo por `severity=critical`. Eso metía los Watchdog (`http_status=null` pero `severity=critical`) en el mismo bucket que los 5xx servidor, distorsionando el verdict. La acción ante ámbar/rojo es distinta en cada caso (logs Fargate/Vercel vs pool BD + antifraud + topic-progress cold path), así que viven separados.

Además del bloque CRÍTICOS, mirar SIEMPRE (añadidos 05/07/2026 — cerraron un gap grande: el panel era **server-céntrico** y no veía el dolor real del usuario):

7. **🖥️ Errores de cliente** (sección OBSERVABILIDAD) — errores capturados IN-HOUSE en el navegador (Sentry se retiró): `unhandled_error`, `unhandled_rejection`, `react_error_boundary`, `client_error`, `http_5xx`/`http_4xx`/`http_network_error` (fetch del navegador), `chunk_load_error`. Verde <100, ámbar ≥100, rojo ≥500. **CLAVE:** el servidor puede decir 0 5xx y el panel/monitor "verde" mientras los clientes sufren (p.ej. **502 de `/api/auth/token`** = error de EDGE que el servidor no registra). Mirar el breakdown por `event_type` + `topEndpoint`.
8. **🧯 Todas las señales error/warn (catch-all, sin gaps)** — tabla con TODA señal error/warn de `observable_events` agrupada. Garantía por diseño: **nada capturado queda oculto**, ni tipos futuros. Las filas **benignas** (auth, forbidden, scraping, request_completed…) van en gris y no cuentan; las **accionables** (coloreadas por volumen) son las que investigar. Si aparece una accionable con volumen alto que no reconoces → sección 2.

Si CRÍTICOS + errores de cliente + catch-all están en verde, no hay fuego activo. Tarea cerrada en 30 segundos.

Si alguno está ámbar o rojo, ir a la sección 2 con esa pista.

### 1.bis — Volumen de alertas / emails enviados (fatiga de alertas)

**Cuándo:** SIEMPRE que se pida la salud ("dame la salud de la última hora", "busca errores", "hay fuego"). Si Manuel recibe **muchos** `[Vence CRITICAL]` en el correo, eso ES un síntoma: las alertas ruidosas ahogan las reales (alert-fatigue). Revisar **qué se está emitiendo y con qué frecuencia**, no solo si hay errores.

> ⚠️ **Contra RDS, NO Supabase.** El cliente `@supabase/supabase-js` apunta al Supabase CONGELADO (backup, datos viejos) tras el cutover a RDS del 04/07. Usar SIEMPRE `postgres`/`pg` con `DATABASE_URL` (que ya es RDS en `.env.local`).

```bash
node -e "
const pgMod = require('/home/manuel/Documentos/github/vence/node_modules/postgres');
const postgres = pgMod.default || pgMod;
require('/home/manuel/Documentos/github/vence/node_modules/dotenv').config({path:'/home/manuel/Documentos/github/vence/.env.local'});
const sql = postgres(process.env.DATABASE_URL, { max: 1, prepare: false });
(async()=>{
  const rows = await sql\`SELECT severity, event_type, count(*)::int n FROM observable_events WHERE ts >= NOW()-INTERVAL '24 hours' AND severity IN ('critical','error','warn') GROUP BY 1,2 ORDER BY 3 DESC\`;
  const total = rows.reduce((a,r)=>a+r.n,0);
  console.log('alertas 24h:', total);
  rows.forEach(r=>console.log('  '+String(r.n).padStart(4)+'  '+r.severity+' | '+r.event_type));
  await sql.end();
})();
"
```

**Lectura:**
- **Cualquier `event_type` con conteo desproporcionado (>~30/día) = candidato a recalibrar**, no a seguir emitiendo. La alerta debe agrupar/dedup (cooldown) o subir el umbral. El objetivo NO es 0 alertas — es que cada email signifique algo accionable.
- Spammers conocidos (2026-06): **`http_traffic_drop` ("Tráfico HTTP cayó X%")** dispara cada ~30-60 min sobre variación normal de tráfico → recalibrar umbral/ventana; y **`tts_error`** (238/24h en un muestreo) = error recurrente real a investigar, no a silenciar.
- **`client_edge_sustained` ("Errores de cliente sostenidos — X/h") — RECALIBRADO 2026-07-08.** Disparaba cada hora (cooldown 60m) porque sumaba `http_network_error` (baseline benigno ~100-120/h de móviles en background) con un umbral único de 80/h → el ruido cruzaba solo y ahogaba el 502 real (~8/h). Fix: separar signals — edge 5xx/timeout ≥30/h (accionable) O avalancha de red ≥500/h (outage). Además el cliente ahora suprime `http_network_error` durante unload/background (raíz del ruido). Regla mental: **network_error solo, por muy alto que sea bajo ~500/h, NO es accionable** (conectividad de cliente); el signal accionable es el edge 5xx. Detalle: §3 incidente 08/07.
- **`pool_hung_clientread` ("Pool: N muestras con conexiones colgadas en ClientRead") — RECALIBRADO 2026-06-12.** Disparaba un CRITICAL cada ~30 min (cooldown) sobre el goteo residual del path `getDb()`/Supavisor (raíz en `[[project_supavisor_zombie_conn_root_cause]]`, se cierra del todo con RDS). El piso de conn-min no bastaba: 2-3 conns sostenidas durante 5 muestras acumulan ~10-15 conn-min y lo cruzaban, pero el **pico simultáneo** (`maxHung`) nunca pasó de 3 en 24h reales y el pool frontend nunca rozó su techo. Fix: gate `maxHung >= 5` (`POOL_HUNG_MIN_PEAK`) además del piso — **pico ≤3 = goteo residual, NO dispara**; una cascada real satura muchas conns a la vez (pico ≫5) y sí dispara, además cubierta en paralelo por `canary_db_pool` + `pool_frontend_saturation` + `5xx_spike`. Regla mental: en este detector, **mira el pico simultáneo, no el conn-min acumulado** — el conn-min confunde "pocas conns mucho rato" (residual) con "muchas un instante" (real).
- **`cron_overdue` ("1 cron overdue") — FIX DE FONDO 2026-06-12.** Falso positivo auto-resuelto: `detect-oep-llm` (escaneo LLM, ~30 min) emitía su `cron_run` **al completar**, pasado el margen de 30 min de su tick de las 10:00 → la regla lo veía overdue durante toda la ejecución y disparaba, curándose al terminar. Causa: la regla medía "¿terminó el job?" en vez de "¿disparó el scheduler?", y el cap de margen asumía (falsamente) que "el cron más pesado tarda ~3.4 s". Fix profesional (no parche de margen por-cron, que reintroduciría el mapa hardcoded que la regla presume de haber eliminado): se emite un evento **`cron_tick` al ARRANCAR** el tick desde el wrapper compartido `runWithHeartbeat` (opt-in vía opts: `{ name, observability }`), y `cron_overdue` lee `cron_tick` ∪ `cron_run` (`MAX(ts)` de ambos). Así cualquier cron —de 3 s o de 30 min— se juzga por si disparó, sin config por-cron. El heartbeat in-memory del `HeartbeatRegistry` NO se tocó (sigue marcándose al completar, para no regresar su detección de cuelgue). **Los 32 crons `@Cron` migrados** (todos emiten `cron_tick`); `outbox-processor` se excluye a propósito (es `@Interval` cada 5 s, no lo vigila `cron_overdue`, y un tick cada 5 s saturaría `observable_events`). **NO se añade regla `cron_stuck`**: la detección de cron colgado ya existe y es superior a un email — `HeartbeatRegistry` (`thresholdMs` por-cron) → `/health/crons` (503 si alguno supera su umbral) → la ECS liveness probe **mata y relanza el container** (auto-recovery). Una alert-rule paralela sería redundante y añadiría superficie de falsos positivos.
- Cruzar con la bandeja `[Vence CRITICAL]`: si un tipo domina el correo pero es un blip transitorio, **recalibrar la alert-rule** (ver `backend/src/alerts/alert-rules.ts` + `[[project_supavisor_zombie_conn_root_cause]]` para el precedente de recalibración pool/canary).
- Un `event_type` que **desaparece** de golpe (p.ej. geo fill-rate a 0) también es señal — lo cubre el framework de calidad de datos (§ roadmap obs).

### 1.bis.a — OBLIGATORIO: desglosar `alert_fired` por REGLA + liveness de TODOS los crons

> ⚠️ **Miss real 2026-07-22:** el bloque de arriba agrupa por `event_type`, así que `alert_fired` sale como UN bucket (p.ej. "76 critical alert_fired") y es fácil pasarlo por alto y declarar VERDE mientras la bandeja de Manuel tiene 44 emails `[Vence CRITICAL]`. **`alert_fired` es lo que llega al correo — SIEMPRE hay que abrir QUÉ reglas disparan.** Y el veredicto de §1 solo mira el cron de *drift*; **NO** vigila el resto de crons (`check-seguimiento`, etc.), que pueden estar caídos días sin que ningún bloque lo cante. Este sub-paso cierra las dos brechas y es **obligatorio** en cada "revisa la salud".

```bash
node -e "
const pgMod = require('/home/manuel/Documentos/github/vence/node_modules/postgres');
const postgres = pgMod.default || pgMod;
require('/home/manuel/Documentos/github/vence/node_modules/dotenv').config({path:'/home/manuel/Documentos/github/vence/.env.local'});
const sql = postgres(process.env.DATABASE_URL, { max: 1, prepare: false });
(async () => {
  console.log('=== alert_fired 24h por REGLA (esto es lo que llega al correo) ===');
  const a = await sql\`SELECT COALESCE(metadata->>'rule', metadata->>'ruleId', metadata->>'title','?') rule, severity, count(*)::int n FROM observable_events WHERE event_type='alert_fired' AND ts>=NOW()-INTERVAL '24 hours' GROUP BY 1,2 ORDER BY 3 DESC LIMIT 25\`;
  a.forEach(r=>console.log('  '+String(r.n).padStart(3)+' ['+r.severity+'] '+r.rule));
  console.log('\n=== Liveness de crons: último cron_run vs ahora (7d) — busca crons que PARARON ===');
  const c = await sql\`SELECT endpoint, max(ts) last, count(*)::int n FROM observable_events WHERE event_type='cron_run' AND ts>=NOW()-INTERVAL '7 days' GROUP BY 1 ORDER BY 2 ASC\`;
  c.forEach(r=>{const h=((Date.now()-new Date(r.last).getTime())/3600000).toFixed(1); console.log('  '+(h>26?'🔴':h>13?'🟡':'🟢')+' hace '+String(h).padStart(6)+'h  '+(r.endpoint||'?')+'  (n='+r.n+')');});
  await sql.end();
})();
"
```

**Lectura:**
- Cualquier regla de `alert_fired` con conteo alto = está inundando el correo → o es fuego real (investigar) o hay que recalibrar (ver §1.bis). NO ignorar el bucket agregado.
- Un cron cuyo último `cron_run` sea de **hace >26h** (o >su intervalo esperado) → **investigar**, aunque los 5xx estén en verde. `cron_overdue` NO es "falso positivo por defecto" (el fix de 2026-06-12 solo arregló el FP de `detect-oep-llm`, job largo). Antes de reportar hay que distinguir **3 causas** mirando los **logs de arranque del cron en CloudWatch** (`/ecs/vence-backend`, filtrar por el nombre de la clase del cron, p.ej. `CheckSeguimiento`):
  1. **Retirado a propósito (kill-switch)** → el boot loguea algo tipo `check-seguimiento RETIRADO (sensor hash_change: 4% de acierto). Reactivar con CHECK_SEGUIMIENTO_ENABLED=true`. Es un cron apagado adrede (sensor demasiado ruidoso). **El `cron_overdue` es entonces FALSO POSITIVO** y seguirá emailando a Manuel cada día → la acción es **excluir ese cron de la regla `cron_overdue`** (o mutearlo mientras el flag esté OFF), NO reactivar el cron a ciegas. Caso real 2026-07-22: `check-seguimiento` (`0 9 * * 1-5`) retirado el 21/07 por 4% de precisión del sensor `hash_change`; el CRITICAL diario era ruido.
  2. **Roto de verdad** → el boot muestra el cron registrándose bien pero luego falla/`cron_run` con `status:failure`, o un crash-loop lo mata antes del tick → fix real.
  3. **Task no vivo a la hora del tick** → scheduler in-app NestJS NO rellena ticks perdidos si el task ECS estaba reiniciando/desplegando a esa hora exacta. Cruzar con eventos ECS (`aws ecs describe-services`) y arranques en el log.
  GOTCHA transversal: `HeartbeatRegistry` de `check-seguimiento` tiene `thresholdMs=4 días`, así que `/health/crons` NO da 503 → la liveness probe de ECS **no lo reinicia**; el único aviso es `cron_overdue`. Verificar en el log 09:00:00 UTC: si OTROS crons de esa hora SÍ disparan pero el objetivo no, es (1) o (2), no (3).

---

Por Claude (CLI, cuando el humano pide "busca errores"):

Ejecutar el bloque siguiente y reportar el resumen al usuario. **No leer Sentry directamente — sus eventos llegan a validation_error_logs vía withErrorLogging y los ves más rápido por SQL que por la UI de Sentry.**

> **Sub-categorización admin vs user-facing (2026-06-01).** El verdict separa errores en `/api/admin/*`, `/api/cron/*`, `/api/debug/*`, `/api/verify-articles/*`, `/api/armando/*`, `/api/v2/admin/*`, `/api/health/*` (admin/infra, umbrales relajados ámbar≥5 / rojo≥20) del resto (user-facing, umbrales estrictos ámbar≥1 / rojo≥5). Sin esto, 13 errores en una herramienta interna disparaban ROJO sin afectar UX (incidente 2026-06-01). **Fuente de verdad de la lista**: `lib/api/admin/endpoint-classification.ts`. El bloque bash de abajo duplica los patrones manualmente porque Node desde shell no puede importar TS — si añades un patrón nuevo al módulo TS, actualizar también `ADMIN_PATTERNS` aquí.

```bash
node -e "
const pgMod = require('/home/manuel/Documentos/github/vence/node_modules/postgres');
const postgres = pgMod.default || pgMod;
require('/home/manuel/Documentos/github/vence/node_modules/dotenv').config({path:'/home/manuel/Documentos/github/vence/.env.local'});
const sql = postgres(process.env.DATABASE_URL, { max: 1, prepare: false });

(async () => {
  const since = new Date(Date.now() - 24*3600*1000).toISOString();

  // Identificar el deploy actual: el más frecuente entre eventos recientes.
  // Sirve para distinguir 'errores del deploy actual' vs 'errores históricos
  // de incidentes ya resueltos pero que aún caen en la ventana de 24h'.
  const deployRow = await sql\`
    SELECT deploy_version FROM validation_error_logs
    WHERE created_at >= NOW() - INTERVAL '2 hours' AND deploy_version IS NOT NULL
    GROUP BY deploy_version ORDER BY COUNT(*) DESC LIMIT 1
  \`;
  const currentDeploy = deployRow[0]?.deploy_version ?? null;

  // 1) Errores 5xx 24h — separa por deploy_version + sub-categoriza admin vs user-facing
  // - 'current' = ocurridos en el deploy actual (fuego activo)
  // - 'legacy'  = ocurridos en deploys anteriores (histórico)
  // - admin/infra endpoints (umbrales relajados): /api/admin/*, /api/cron/*,
  //   /api/debug/*, /api/verify-articles/*, /api/armando/*, /api/v2/admin/*,
  //   /api/health/* (probes ALB/ECS) — Fuente de verdad: lib/api/admin/endpoint-classification.ts
  const ADMIN_PATTERNS = [
    /^\\/api\\/admin(\\/|$)/,
    /^\\/api\\/v2\\/admin(\\/|$)/,
    /^\\/api\\/cron(\\/|$)/,
    /^\\/api\\/debug(\\/|$)/,
    /^\\/api\\/verify-articles(\\/|$)/,
    /^\\/api\\/armando(\\/|$)/,
    /^\\/api\\/health(\\/|$)/,
  ];
  const classify = (ep) => ADMIN_PATTERNS.some(p => p.test(ep || '')) ? 'admin' : 'user_facing';

  const errs = await sql\`
    SELECT endpoint, error_type, deploy_version, COUNT(*)::int AS n
    FROM validation_error_logs
    WHERE severity = 'critical' AND created_at >= \${since}
      AND http_status >= 500
    GROUP BY endpoint, error_type, deploy_version
    ORDER BY n DESC LIMIT 30
  \`;
  const errsCurrent = errs.filter(e => e.deploy_version === currentDeploy);
  const errsLegacy = errs.filter(e => e.deploy_version !== currentDeploy);
  const totalCurrent = errsCurrent.reduce((a,r) => a + Number(r.n), 0);
  const totalLegacy = errsLegacy.reduce((a,r) => a + Number(r.n), 0);
  // Sub-totales por categoría — solo deploy actual
  const totalCurrentUser = errsCurrent
    .filter(e => classify(e.endpoint) === 'user_facing')
    .reduce((a,r) => a + Number(r.n), 0);
  const totalCurrentAdmin = errsCurrent
    .filter(e => classify(e.endpoint) === 'admin')
    .reduce((a,r) => a + Number(r.n), 0);

  // 2) Drift 24h con drift_pct > 5 — excluye markers técnicos
  // (__cron_run__ tiene stored/fresh con semántica distinta y produce
  // drift_pct artificialmente alto que NO es bug — es ruido del filtro)
  const drifts = await sql\`
    SELECT target_table, field_name, COUNT(*)::int AS n, MAX(drift_pct) AS max_pct
    FROM stats_drift_log
    WHERE checked_at >= \${since} AND drift_pct > 5
      AND target_table NOT IN ('__cron_run__', '__exception__')
    GROUP BY target_table, field_name
    ORDER BY n DESC LIMIT 10
  \`;

  // 3) Latencia INSERT (top variante por calls)
  const lat = await sql\`SELECT * FROM v_insert_test_questions_latency ORDER BY calls DESC LIMIT 1\`;

  // 4) Último run del cron de drift — usa el marker '__cron_run__' (la
  // función SQL lo inserta al final de cada ejecución, garantiza
  // liveness check incluso si no hay drift real detectado).
  const cron = await sql\`SELECT MAX(checked_at) AS last_run FROM stats_drift_log WHERE target_table='__cron_run__'\`;
  const lastRun = cron[0].last_run;
  const staleH = lastRun ? (Date.now() - new Date(lastRun).getTime()) / 3600000 : null;

  console.log('Deploy actual:', currentDeploy ?? '(desconocido)');
  console.log();
  console.log('1) Errores 5xx 24h en deploy actual:', totalCurrent,
    '(user-facing: ' + totalCurrentUser + ', admin: ' + totalCurrentAdmin + ')');
  if (errsCurrent.length) for (const e of errsCurrent) console.log('   -', '[' + classify(e.endpoint) + ']', e.endpoint, e.error_type, '×', e.n);
  console.log('   (informativo) Errores 5xx 24h en deploys anteriores:', totalLegacy);
  if (errsLegacy.length) for (const e of errsLegacy.slice(0,5)) console.log('     -', e.endpoint, e.error_type, '×', e.n, '[' + (e.deploy_version || '?') + ']');

  console.log('\\n2) Drift >5% real (24h, excluyendo markers):', drifts.reduce((a,r) => a + Number(r.n), 0));
  if (drifts.length) for (const d of drifts) console.log('   -', d.target_table, d.field_name, '×', d.n, 'max', d.max_pct, '%');

  console.log('\\n3) INSERT test_questions:');
  if (lat[0]) console.log('   mean=' + lat[0].mean_ms + 'ms proxy_p95=' + lat[0].proxy_p95_ms + 'ms max=' + lat[0].max_ms + 'ms calls=' + lat[0].calls);

  console.log('\\n4) Cron drift último run:', lastRun, staleH != null ? '(hace ' + staleH.toFixed(1) + 'h)' : '');

  // Verdict — basado en errores del deploy actual, sub-categorizados:
  //   - user-facing: ámbar ≥1, rojo ≥5 (cualquier error afecta a UX)
  //   - admin:       ámbar ≥5, rojo ≥20 (bajo tráfico, ocasional aceptable)
  // El verdict final es el PEOR de las 2 sub-categorías + drift + latencia.
  const stale = staleH === null || staleH > 36;
  const userFire = totalCurrentUser >= 5;
  const adminFire = totalCurrentAdmin >= 20;
  const userWarn = totalCurrentUser >= 1;
  const adminWarn = totalCurrentAdmin >= 5;
  const fire = userFire || adminFire || drifts.length >= 5 || (lat[0] && Number(lat[0].mean_ms) >= 250) || stale;
  const warn = userWarn || adminWarn || drifts.length >= 1 || (lat[0] && Number(lat[0].mean_ms) >= 80) || (staleH != null && staleH > 26);
  console.log('\\nVeredicto:', fire ? '🔴 ROJO — atender ya' : warn ? '🟡 ÁMBAR — investigar' : '🟢 VERDE — todo OK');
  if (userFire || adminFire) {
    console.log('  - user-facing: ' + (userFire ? '🔴 ROJO' : userWarn ? '🟡 ÁMBAR' : '🟢') + ' (' + totalCurrentUser + ' errores, umbral rojo ≥5)');
    console.log('  - admin:       ' + (adminFire ? '🔴 ROJO' : adminWarn ? '🟡 ÁMBAR' : '🟢') + ' (' + totalCurrentAdmin + ' errores, umbral rojo ≥20)');
  }
  if (totalLegacy > 0 && !fire && !warn) {
    console.log('(Hay', totalLegacy, 'errores legacy de deploys anteriores en ventana 24h — informativo, no cuenta para verdict)');
  }

  await sql.end();
})();
"
```

Reportar el output al usuario. Si veredicto es rojo o ámbar, ir a sección 2.

### 1.ter — Errores de CLIENTE + catch-all (RDS) — OBLIGATORIO (añadido 05/07/2026)

El bloque anterior solo ve **5xx de servidor**. Desde que la captura de errores de cliente es 100% in-house (Sentry retirado), hay que mirar SIEMPRE el **dolor real del usuario** — el servidor puede decir "0 5xx" mientras los clientes sufren (p.ej. **502 de edge** que el servidor no registra). Ejecutar y reportar:

```bash
node -e "
const pgMod = require('/home/manuel/Documentos/github/vence/node_modules/postgres');
const postgres = pgMod.default || pgMod;
require('/home/manuel/Documentos/github/vence/node_modules/dotenv').config({path:'/home/manuel/Documentos/github/vence/.env.local'});
const sql = postgres(process.env.DATABASE_URL, { max: 1, prepare: false });
const BENIGN = new Set(['request_completed','auth','forbidden','rate_limit','scraping_challenge_shown','scraping_force_challenge_set','react_hydration_mismatch','external_heartbeat_skipped','console_warn','tts_session_end','custom','test_size_shortfall','browser_extension_error']);
(async () => {
  const cli = await sql\`SELECT event_type, count(*)::int n, mode() WITHIN GROUP (ORDER BY COALESCE(endpoint,'')) top FROM observable_events WHERE source='frontend' AND severity IN ('error','warn') AND ts >= NOW()-INTERVAL '1 hour' GROUP BY 1 ORDER BY 2 DESC\`;
  console.log('=== Errores de CLIENTE (1h) — capturados in-house ===');
  cli.forEach(r=>console.log('  '+String(r.n).padStart(4)+' '+r.event_type+' ['+r.top+']'));
  const all = await sql\`SELECT source, event_type, count(*)::int n, mode() WITHIN GROUP (ORDER BY COALESCE(endpoint,'')) top FROM observable_events WHERE severity IN ('error','warn') AND ts >= NOW()-INTERVAL '1 hour' GROUP BY 1,2 ORDER BY 3 DESC LIMIT 40\`;
  const action = all.filter(r=>!BENIGN.has(r.event_type));
  console.log('\\n=== Señales ACCIONABLES (catch-all, no benignas, 1h) ===');
  action.forEach(r=>console.log('  '+String(r.n).padStart(4)+' '+r.source+' '+r.event_type+' ['+r.top+']'));
  const edge = await sql\`SELECT endpoint, metadata->>'status' st, count(*)::int n FROM observable_events WHERE source='frontend' AND event_type='http_5xx' AND ts>=NOW()-INTERVAL '1 hour' GROUP BY 1,2 ORDER BY 3 DESC LIMIT 8\`;
  if (edge.length) { console.log('\\n=== http_5xx de cliente por endpoint+status ==='); edge.forEach(r=>console.log('  '+String(r.n).padStart(4)+' status='+r.st+' '+r.endpoint)); }
  await sql.end();
})();
"
```

**Interpretación:**
- Si dominan **502 en `/api/auth/*`** (o cualquier endpoint) → es el **502 keep-alive del ALB** (ver §3), NO un bug de la app. Verificar que los contenedores tienen el fix (`keepAliveTimeout=65s`).
- `console_error` alto pero con `topEndpoint` de auth/callback → suele ser ruido de 401 pre-login + Google GSI (ya filtrado a `debug` desde 05/07; si reaparece en `error`, revisar el filtro en `lib/observability/client.ts`).
- `chunk_load_error` → usuarios en bundle viejo tras deploy (el auto-reload los recupera; si sube mucho, revisar el sync a S3 — ver `docs/runbooks/pusheo-revision-despliegue.md`).
- Cualquier `unhandled_error` / `react_error_boundary` con volumen → **bug real de cliente**, ir a sección 2 (mirar `error_message` + `metadata.stack`).

**Notas sobre los filtros del verdict** (introducidos 2026-05-23 tras detectar dos falsos positivos; sub-categorización admin/user-facing añadida 2026-06-01):

- Los **errores 5xx** se separan por `deploy_version`. Solo los del deploy actual cuentan para el verdict; los de deploys anteriores son informativos. Sin esto, un incidente histórico (ej. cascada 22/05) infla el indicador durante 24h aunque ya esté resuelto.
- Los **errores 5xx del deploy actual** se sub-categorizan en **admin/infra** (`/api/admin/*`, `/api/cron/*`, `/api/debug/*`, `/api/verify-articles/*`, `/api/armando/*`, `/api/v2/admin/*`, `/api/health/*`) y **user-facing** (todo lo demás). Umbrales diferenciados: user-facing ámbar≥1/rojo≥5 vs admin ámbar≥5/rojo≥20. Sin esto, una herramienta admin con 13 errores disparaba ROJO sin afectar UX (incidente real 2026-06-01); y el readiness probe `/api/health/db-ready` con sus 503 de warmup metía ~30-50 falsos positivos en cada deploy (diagnóstico 2026-06-01 — además filtrados en origen vía `withErrorLogging({expectedStatuses:[503]})`). **Fuente de verdad**: `lib/api/admin/endpoint-classification.ts`.
- Los errores 5xx filtran por `http_status >= 500` (excluye Watchdog client-side con `http_status=null`, que tiene su propio indicador en el panel).
- El **drift** excluye explícitamente `target_table IN ('__cron_run__', '__exception__')`. Esos son markers técnicos (la función `check_stats_drift` los inserta al final de cada ejecución para liveness check); su columna generated `drift_pct` puede salir alta por la semántica de stored/fresh values pero NO indica drift real.
- El **cron** se mide por `MAX(checked_at) WHERE target_table='__cron_run__'`, no por el `MAX` general — sin esto, un cron sano sin drift detectado parecería muerto.

---

## 2. Diagnóstico profundo

Si el indicador rojo es **errores 5xx**:

```bash
node -e "
const pgMod = require('/home/manuel/Documentos/github/vence/node_modules/postgres');
const postgres = pgMod.default || pgMod;
require('/home/manuel/Documentos/github/vence/node_modules/dotenv').config({path:'/home/manuel/Documentos/github/vence/.env.local'});
const sql = postgres(process.env.DATABASE_URL, { max: 1, prepare: false });
(async () => {
  const rows = await sql\`
    SELECT endpoint, error_type, error_message, http_status, duration_ms,
           user_id, deploy_version, created_at
    FROM validation_error_logs
    WHERE severity = 'critical'
      AND created_at > NOW() - INTERVAL '24 hours'
    ORDER BY created_at DESC LIMIT 30
  \`;
  // Nota: incluye deploy_version para distinguir 'errores nuevos' vs
  // 'errores de incidentes ya resueltos pero aún en ventana 24h'.
  for (const r of rows) console.log(r.created_at, r.endpoint, r.http_status, r.error_type, '—', (r.error_message||'').slice(0,80));
  await sql.end();
})();
"
```

Buscar patrón: ¿es un solo endpoint? ¿un solo user_id? ¿pico horario concreto? Si es `error_type='timeout'`, mirar el endpoint en pg_stat_statements para ver si una query subió de coste. Si es `'db_connection'`, mirar pgbouncer (panel /admin/infraestructura → pool stats).

Si el indicador rojo es **drift**:

```bash
node -e "
const pgMod = require('/home/manuel/Documentos/github/vence/node_modules/postgres');
const postgres = pgMod.default || pgMod;
require('/home/manuel/Documentos/github/vence/node_modules/dotenv').config({path:'/home/manuel/Documentos/github/vence/.env.local'});
const sql = postgres(process.env.DATABASE_URL, { max: 1, prepare: false });
(async () => {
  const rows = await sql\`
    SELECT target_table, field_name, user_id, stored_value, fresh_value, drift_pct, notes, checked_at
    FROM stats_drift_log
    WHERE checked_at > NOW() - INTERVAL '7 days' AND drift_pct > 5
    ORDER BY drift_pct DESC LIMIT 30
  \`;
  for (const r of rows) console.log(r.checked_at, r.target_table+'.'+r.field_name, 'user='+r.user_id.slice(0,8), 'stored='+r.stored_value, 'fresh='+r.fresh_value, 'drift='+r.drift_pct+'%');
  await sql.end();
})();
"
```

Identifica la tabla y el campo afectado. Lista de mantenedores conocidos:

- `user_stats_summary.total_questions` y `correct_answers` → trigger `update_user_stats_summary_trigger` sobre `test_questions`. Si drift hay, verificar que el trigger sigue vivo (`SELECT tgname FROM pg_trigger WHERE tgrelid='public.test_questions'::regclass`).
- `user_question_history_v2` → triggers `trigger_update_user_question_history_v2_insert` y `_update`. Misma verificación.
- (Cuando lleguen las tablas nuevas del fix de /api/stats: `user_difficulty_stats`, `user_hourly_stats`, `user_article_stats`, `user_daily_stats` y sus triggers correspondientes.)

Si el drift afecta a un solo user, suele ser un bug de race condition o un fallo silencioso del trigger en ese caso concreto. Reproceso del user: re-ejecutar el cálculo desde fresh scan y hacer UPDATE manual.

Si afecta a muchos users, es un bug del trigger global — rollback o fix urgente.

Si el indicador rojo es **latencia INSERT**:

```bash
node -e "
const pgMod = require('/home/manuel/Documentos/github/vence/node_modules/postgres');
const postgres = pgMod.default || pgMod;
require('/home/manuel/Documentos/github/vence/node_modules/dotenv').config({path:'/home/manuel/Documentos/github/vence/.env.local'});
const sql = postgres(process.env.DATABASE_URL, { max: 1, prepare: false });
(async () => {
  // Triggers vivos en test_questions
  const trigs = await sql\`SELECT tgname FROM pg_trigger WHERE tgrelid='public.test_questions'::regclass AND NOT tgisinternal ORDER BY tgname\`;
  console.log('Triggers (' + trigs.length + '):'); for (const t of trigs) console.log('  -', t.tgname);

  // Variantes del INSERT con coste
  console.log('\\nINSERTs por coste:');
  const ins = await sql\`SELECT * FROM v_insert_test_questions_latency LIMIT 5\`;
  for (const r of ins) console.log('  calls=' + r.calls + ' mean=' + r.mean_ms + 'ms max=' + r.max_ms + 'ms p_p95=' + r.proxy_p95_ms + 'ms');

  await sql.end();
})();
"
```

Si hay más triggers de los esperados (>12 en estado actual), alguien añadió uno sin auditar. Si hay menos, se cayó uno. Ver migraciones recientes en `supabase/migrations/`.

Si la latencia es alta pero los triggers son los mismos, suele ser contención de locks (mirar `pg_stat_activity` durante un pico) o que `calculate_user_streak` (escanea 365 días) se está disparando con frecuencia para heavy users — deuda anotada en task #17.

Si el indicador rojo es **cron de drift muerto**:

Ir a https://github.com/rikseotools/vence/actions/workflows/check-stats-drift.yml y ver por qué falló el último run. Causas típicas: CRON_SECRET caducado en secrets de GH, endpoint Vercel devolviendo 500, Vercel limit hit.

---

## 3. Incidentes conocidos (referencias rápidas)

**Veredicto ROJO falso por canaries + fatiga de alertas de auth (2026-07-08, FIX aplicado)** — el panel daba ROJO user-facing con 73 "5xx en `/api/exam/answer`" que eran **100% el canary `answer-premium`** (`smoke@vence.es`, UA `Vence-Canary-AnswerPremium/1.0`, 1 fallo cada 5 min). Y la bandeja de Manuel se inundaba de `Errores de cliente sostenidos` sobre ruido benigno. **Tres causas + tres fixes de raíz:**
- **(A) Status semántico mal:** `/api/exam/answer` devolvía **500** cuando `saveAnswer` no podía derivar `correctAnswer` (pregunta nueva sin `questionId`) — eso es input insuficiente del cliente = **422**, no 5xx. Fix: discriminador `reason:'invalid_input'` en `SaveAnswerResponse` → route mapea a 422 (`lib/api/exam/{schemas,queries}.ts` + `app/api/exam/answer/route.ts`).
- **(B) Tráfico sintético en VLE:** `withErrorLogging` ahora reconoce el header canónico **`x-vence-canary`** (que TODOS los canaries envían) y NO escribe sus errores en `validation_error_logs` (sí emite `request_completed` marcado `synthetic`, severity info). Escalable: cualquier canary futuro queda excluido sin tocar código. Helper `lib/api/syntheticRequest.ts`. Los canaries tienen su propio canal (`canary_*_failed`) para regresiones reales.
- **(C) Ruido de `http_network_error`:** el cliente (`lib/observability/client.ts`) suprime el `http_network_error` durante unload/background (móvil en background aborta fetches con "Failed to fetch", que NO es AbortError) — era el grueso del ruido en `/api/auth/*`.
- **(D) Alerta recalibrada:** `RULE_CLIENT_EDGE_SUSTAINED` ya no suma `http_network_error` con umbral 80 (el baseline benigno ~100-120/h lo cruzaba y disparaba cada hora). Ahora: edge 5xx/timeout ≥30/h (accionable: keep-alive 502) **O** avalancha de network_error ≥500/h (outage real). Baseline benigno nunca dispara.

**502 keep-alive ALB↔Node (2026-07-05, FIX aplicado)** — 502 Bad Gateway intermitentes y **continuos** (no solo en deploys), peor en `/api/auth/token` (el más polleado). El **servidor registra 0 5xx** (la app responde en ~4ms) → error de EDGE, invisible en el panel server-céntrico hasta que la captura de cliente in-house lo destapó (`http_5xx` status=502, source=frontend). **Causa:** ALB `idle_timeout=60s` pero Node cierra las conexiones keep-alive ociosas a los **5s** (default) → el ALB reutiliza una conexión que Node ya cerró → 502. **Fix:** `keepAliveTimeout=65s` (> 60s) + `headersTimeout=66s` — frontend vía `docker/server-keepalive.cjs`, backend vía `main.ts`. **Diagnóstico:** mirar el bloque 1.ter → si `http_5xx` de cliente = status 502 → esto. **Detalle:** `docs/runbooks/pusheo-revision-despliegue.md` §502.

**pooler_instance_unreachable (2026-07-04 16:35–19:56, resuelto)** — 202 eventos `error` de la pooler no alcanzable en una ventana de ~3.3h la tarde del 04/07. NO reapareció después. Si vuelve: mirar salud de la(s) VM(s) del pooler self-hosted (HA 2 AZs + NLB) y la conectividad Fargate→pooler. No confundir con el pool de la app.

**App CONGELADA al desplegar / ChunkLoadError (2026-07-05, FIX aplicado)** — usuarios (Nila) con la app congelada tras un deploy. Chunks `_next/static` servidos del contenedor efímero → 404 tras deploy → ChunkLoadError sin manejo. **Fix:** assets en S3 con retención + CloudFront origin-group + auto-reload de cliente. Señal en el panel: `chunk_load_error`. Detalle: memoria `project_deploy_freeze_chunks_s3` + `docs/runbooks/pusheo-revision-despliegue.md`.

**Cascada statement_timeout (2026-05-22)** — afectó `/api/stats`, `/api/v2/difficulty-insights`, theme counts, `/teoria`. Pool sano pero queries lentas saturando lambdas. Mitigado con cache Redis + stale-if-error + `withDbTimeout`. Fix de fondo: materializar agregaciones — ver `docs/ARCHITECTURE_ROADMAP.md` sección "Tech debt CRÍTICO: queries no-escalables".

**Heavy user timeout Nila (2026-05-19)** — `/api/v2/difficulty-insights` daba 503 para users con >30k test_questions. Resuelto reescribiendo 4 RPCs para leer de `user_question_history_v2`. Patrón: cualquier endpoint que escanee `test_questions` por user sin pre-agregado está en riesgo de timeout para heavy users.

**INSERT degradado por triggers acumulados (2026-05-23)** — al auditar `test_questions` aparecieron 14 triggers, 2 de ellos NO-OP. Documentado en ADR "triggers SQL vs outbox/worker" en el roadmap. Regla operativa: si añades un trigger a `test_questions`, debe ser `INSERT ... ON CONFLICT DO UPDATE` con `+1 counter`, jamás scan o agregación.

**Cascada 503 por slots pool zombie (2026-05-27, 17:00–19:50 UTC)** — 1995 errores 503 en `/api/v2/answer-and-save` ("Servicio saturado momentáneamente"). Diagnóstico engañoso: `canary-database-pool` daba OK (SELECT 1 trivial encontraba slot), pero queries reales (DailyLimit, Medals, antifraud) timeouteaban. **Causa raíz**: `emitFireAndForget()` del backend Fargate hace `await db.execute(INSERT observable_events)` SIN timeout. Si Supavisor se cuelga en `wait=Client/ClientRead`, la promise nunca resuelve → slot pool zombie → pool postgres-js (max 7-8) se satura → antifraud quick-fail → 503 cascada. **Fingerprint**: `SELECT pid, wait_event_type, wait_event, query FROM pg_stat_activity WHERE application_name='Supavisor' AND state!='idle' AND NOW()-query_start > INTERVAL '30 seconds'` con `wait=Client/ClientRead` + `INSERT INTO observable_events`. **Mitigación**: `pg_terminate_backend(<pid>)` + `force-new-deployment`. **Fix aplicado** (commits `e1f639f6` + `a2b80393`): timeout 5s en `emit()` de backend + sink frontend + rollout-log. Tras fixes, 5xx bajaron de 357/h a 14/h baseline.

**Antifraud quick-fail intermitente sin zombies — investigación pendiente (2026-05-28, desde 03:27 UTC)** — TRAS aplicar el fix del incidente anterior, reaparecen burst de 503 esporádicos (~8-13/min, ventanas de 1-3 horas). Diagnóstico distinto al anterior:
- ✅ NO hay slots pool zombie (`pg_stat_activity` limpio, Supavisor con 0 hung >30s).
- ✅ NO hay autovacuum activo en tablas hot (`pg_stat_progress_vacuum` vacío).
- ✅ La función SQL `register_device` corre rápido: `mean=1.29ms stddev=3.17 max=99ms calls=6666` en `pg_stat_statements` — NO es problema de BD.
- ✅ Pool sano: 5+ idle postgres.js + 1 Supavisor active.
- ⚠️ PERO el backend Fargate reporta consistentemente `Timeout (quick-fail) en antifraud tras 10003ms (límite 10000ms)` desde `AnswerSaveController`.
- ⚠️ Pattern: cada 8s aprox, request tarda EXACTO ~10000-10100ms antes de fallar. = el timeout del antifraud disparándose limpiamente.

**Hipótesis fuerte**: latencia Fargate↔Supavisor degradada intermitentemente. El `Promise.all([registerAndCheckDevice, getDailyLimitStatus, checkDeviceDailyUsage])` del antifraud espera a la más lenta de las 3 RPCs; con TCP roundtrip alto en horas concretas, suma >10s aunque cada RPC sea rápida en BD. **Alternativa**: cliente postgres-js mantiene una conexión "zombie zombi" — cerrada en BD pero que el cliente cree tener; al usarla espera para siempre hasta timeout.

**Por qué NO se ataca aún**: detección requiere comparar latencia red Fargate↔Supabase vs latencia query pura (separar TCP de ejecución), y posible inspección de eventos VPC/NAT/Supavisor. Es trabajo de 2-4 h con cabeza fresca, no de emergencia (afecta a 8-13 users/h en horas valle 22 UTC-04 UTC). Anotado para retomar.

**Pistas para la próxima sesión**:
- Comparar `mean_exec_time` de `register_device` en pg_stat_statements vs duración medida server-side desde antifraud.service.ts (ya emitido a observable_events como `request_completed`).
- `aws cloudwatch get-metric-statistics` para `TargetResponseTime` del ALB durante el spike — si el ALB ya ve latencia alta antes de llegar al app, es network.
- `SELECT * FROM pg_stat_database` para ver `xact_commit/xact_rollback` rate (puede haber rollbacks ocultos).
- Considerar añadir `idle_in_transaction_session_timeout` y `statement_timeout` a nivel sesión postgres-js para defense in depth.
- Subir `ANTIFRAUD_TIMEOUT_MS` de 10s a 15s puede ser band-aid temporal (entender primero la causa).

---

## 4. Umbrales — fuente de verdad

Los umbrales también están codificados en `app/api/admin/system-health/route.ts`. La clasificación admin/user-facing y sus umbrales viven en `lib/api/admin/endpoint-classification.ts` (importado por el endpoint). Si cambias cualquiera, actualiza también el script bash CLI de §1.

**Errores 5xx 24h** (sub-categorizados):
- **User-facing** (afecta UX): ámbar ≥ 1, rojo ≥ 5
- **Admin/infra** (`/api/admin/*`, `/api/cron/*`, `/api/debug/*`, `/api/verify-articles/*`, `/api/armando/*`, `/api/v2/admin/*`, `/api/health/*`): ámbar ≥ 5, rojo ≥ 20. Además, los 5xx esperados por contrato (ej. 503 de warmup del readiness probe) se filtran en origen y NO llegan a `validation_error_logs` — ver `withErrorLogging({expectedStatuses})`.

**Otros indicadores**:
- Drift contadores 24h con drift_pct > 5: ámbar ≥ 1 fila, rojo ≥ 5 filas
- Latencia INSERT mean histórico de pg_stat_statements (incluye RTT): ámbar ≥ 80ms, rojo ≥ 250ms. proxy_p95 (mean + 2·stddev) se muestra como informativo en el panel pero sin umbral propio — es muy sensible a outliers de contención.
- Cron de drift staleness: ámbar > 26h, rojo > 36h

---

## 5. Acciones de emergencia

Si todo está en rojo a la vez, es cascada activa. Ir a `docs/ARCHITECTURE_ROADMAP.md` → sección "Incidentes pasados" y replicar el patrón de mitigación (cache Redis stale-if-error + withDbTimeout) en el endpoint afectado.

Si el cron de drift lleva días muerto y desactivarlo en GHA no era intencionado, re-activar con `gh workflow enable check-stats-drift.yml`. Si el cron falla constante, ejecutar manualmente desde `/admin/salud-sistema` botón "Refrescar" no — eso solo refresca el panel; para forzar la ejecución manual del cron va `gh workflow run check-stats-drift.yml` o desde la UI de GitHub Actions.

Rollback de la observabilidad si ella misma está rompiendo cosas (improbable, son lecturas):

- DROP VIEW v_insert_test_questions_latency
- DROP FUNCTION check_stats_drift
- DROP TABLE stats_drift_log
- Workflow GHA: deshabilitar desde la UI o renombrar `.yml` a `.yml.DISABLED`
