# Runbook: estado de salud del sistema

Manual operativo para diagnosticar errores o salud del sistema Vence. Cuando el usuario diga "busca errores", "qué tal va", "estado", "salud", o similar, Claude debe seguir este runbook ANTES de improvisar.

Mantenedor: `docs/runbooks/health-check.md`. Referenciado desde `CLAUDE.md`.

---

## 1. Comprobación rápida (30 segundos)

Por humano:

Abrir en navegador `https://www.vence.es/admin/salud-sistema` (alias `/admin/infraestructura`). Cinco indicadores con semáforo:

1. **Errores 5xx servidor últimas 24h** (`http_status >= 500`) — verde 0, ámbar ≥1, rojo ≥5.
2. **UI congelada cliente** (Watchdog hook `useAnswerWatchdog`, threshold 12s) — verde 0, ámbar ≥3, rojo ≥10. Cada evento = un user con UI bloqueada en ExamLayout/TestLayout. Suele correlar con saturación BD/antifraud, no con un fallo del servidor.
   - **Nota — drift residual del fix Page Visibility** (commit `a4051a6b`, 31/05/2026): si % de events con `duration_ms > 60s` sube de ~0% (post-fix) a >20%, hay regresión en un navegador real (probable Safari/mobile) donde la Page Visibility API no se comporta como en Chrome/JSDOM. La alerta `watchdog_wallclock_residual` lo detecta automáticamente con cooldown 4h. Investigar con: `SELECT user_id, duration_ms, metadata->>'userAgent' FROM validation_error_logs WHERE error_message ILIKE '%Watchdog%' AND duration_ms > 60000 ORDER BY duration_ms DESC LIMIT 20;`
3. **Drift contadores 24h** (>5%) — verde 0, ámbar ≥1, rojo ≥5.
   - **⚠️ Punto ciego conocido (03/06/2026)**: este indicador se alimenta de `check_stats_drift`, que muestrea solo **30 users al azar ~diario** y chequea `uqh_v2` por **row-count** (no por `total_attempts`). NO cazó el freeze de 14h de 5 tablas materializadas del 03/06 (corrió durante y no vio nada). Esa clase de fallo —pipeline outbox→handler congelado o escribiendo mal— la cubren ahora 3 alert-rules/canary dedicados: `materialized_stats_stale` (frescura), `stats_paridad_divergence` (correctitud en vivo) y el canary `canary-stats-pipeline` (e2e 24/7). Si sospechas stats materializadas mal, NO te fíes solo de este card: mira esos 3. Detalle: `[[project_incidente_outbox_cutover_a_medias_03_06]]`.
4. **Latencia INSERT test_questions** (mean histórico desde pg_stat_statements, incluye RTT cliente→pooler→DB) — verde <80ms, ámbar ≥80ms, rojo ≥250ms. Baseline actual (post-DROP de 2 NO-OPs el 23/05/2026): ≈44ms. El INSERT puro dentro de la BD es ~1.5ms p50 — la diferencia es RTT.
5. **Cron de drift vivo** — verde <26h sin correr, ámbar 26-36h, rojo >36h.

> Nota — Hasta 31/05/2026 los indicadores (1) y (2) estaban fusionados en un único card "Errores 5xx" que filtraba sólo por `severity=critical`. Eso metía los Watchdog (`http_status=null` pero `severity=critical`) en el mismo bucket que los 5xx servidor, distorsionando el verdict. La acción ante ámbar/rojo es distinta en cada caso (logs Fargate/Vercel vs pool BD + antifraud + topic-progress cold path), así que viven separados.

Si los cinco están en verde, no hay fuego activo. Tarea cerrada en 30 segundos.

Si alguno está ámbar o rojo, ir a la sección 2 con esa pista.

### 1.bis — Volumen de alertas / emails enviados (fatiga de alertas)

**Cuándo:** SIEMPRE que se pida la salud ("dame la salud de la última hora", "busca errores", "hay fuego"). Si Manuel recibe **muchos** `[Vence CRITICAL]` en el correo, eso ES un síntoma: las alertas ruidosas ahogan las reales (alert-fatigue). Revisar **qué se está emitiendo y con qué frecuencia**, no solo si hay errores.

```bash
node -e "
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({path:'.env.local'});
const s = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
(async()=>{
  const since = new Date(Date.now()-24*3600*1000).toISOString();
  const { data } = await s.from('observable_events').select('event_type,severity').gte('ts',since).in('severity',['critical','error','warning']);
  const by={}; (data||[]).forEach(x=>{const k=x.severity+' | '+x.event_type; by[k]=(by[k]||0)+1;});
  console.log('alertas 24h:', data?.length);
  Object.entries(by).sort((a,b)=>b[1]-a[1]).forEach(([k,n])=>console.log('  '+String(n).padStart(4)+'  '+k));
})();
"
```

**Lectura:**
- **Cualquier `event_type` con conteo desproporcionado (>~30/día) = candidato a recalibrar**, no a seguir emitiendo. La alerta debe agrupar/dedup (cooldown) o subir el umbral. El objetivo NO es 0 alertas — es que cada email signifique algo accionable.
- Spammers conocidos (2026-06): **`http_traffic_drop` ("Tráfico HTTP cayó X%")** dispara cada ~30-60 min sobre variación normal de tráfico → recalibrar umbral/ventana; y **`tts_error`** (238/24h en un muestreo) = error recurrente real a investigar, no a silenciar.
- Cruzar con la bandeja `[Vence CRITICAL]`: si un tipo domina el correo pero es un blip transitorio, **recalibrar la alert-rule** (ver `backend/src/alerts/alert-rules.ts` + `[[project_supavisor_zombie_conn_root_cause]]` para el precedente de recalibración pool/canary).
- Un `event_type` que **desaparece** de golpe (p.ej. geo fill-rate a 0) también es señal — lo cubre el framework de calidad de datos (§ roadmap obs).

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
