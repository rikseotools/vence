# Runbook: estado de salud del sistema

Manual operativo para diagnosticar errores o salud del sistema Vence. Cuando el usuario diga "busca errores", "qué tal va", "estado", "salud", o similar, Claude debe seguir este runbook ANTES de improvisar.

Mantenedor: `docs/runbooks/health-check.md`. Referenciado desde `CLAUDE.md`.

---

## 1. Comprobación rápida (30 segundos)

Por humano:

Abrir en navegador `https://www.vence.es/admin/salud-sistema`. Cuatro indicadores con semáforo:

1. **Errores 5xx últimas 24h** — verde 0, ámbar ≥1, rojo ≥5.
2. **Drift contadores 24h** (>5%) — verde 0, ámbar ≥1, rojo ≥5.
3. **Latencia INSERT test_questions** (mean histórico desde pg_stat_statements, incluye RTT cliente→pooler→DB) — verde <80ms, ámbar ≥80ms, rojo ≥250ms. Baseline actual (post-DROP de 2 NO-OPs el 23/05/2026): ≈44ms. El INSERT puro dentro de la BD es ~1.5ms p50 — la diferencia es RTT.
4. **Cron de drift vivo** — verde <26h sin correr, ámbar 26-36h, rojo >36h.

Si los cuatro están en verde, no hay fuego activo. Tarea cerrada en 30 segundos.

Si alguno está ámbar o rojo, ir a la sección 2 con esa pista.

---

Por Claude (CLI, cuando el humano pide "busca errores"):

Ejecutar el bloque siguiente y reportar el resumen al usuario. **No leer Sentry directamente — sus eventos llegan a validation_error_logs vía withErrorLogging y los ves más rápido por SQL que por la UI de Sentry.**

```bash
node -e "
const pgMod = require('/home/manuel/Documentos/github/vence/node_modules/postgres');
const postgres = pgMod.default || pgMod;
require('/home/manuel/Documentos/github/vence/node_modules/dotenv').config({path:'/home/manuel/Documentos/github/vence/.env.local'});
const sql = postgres(process.env.DATABASE_URL, { max: 1, prepare: false });

(async () => {
  const since = new Date(Date.now() - 24*3600*1000).toISOString();

  // 1) Errores 5xx 24h
  const errs = await sql\`
    SELECT endpoint, error_type, COUNT(*)::int AS n
    FROM validation_error_logs
    WHERE severity = 'critical' AND created_at >= \${since}
    GROUP BY endpoint, error_type
    ORDER BY n DESC LIMIT 10
  \`;
  const totalErrs = errs.reduce((a,r) => a + Number(r.n), 0);

  // 2) Drift 24h con drift_pct > 5
  const drifts = await sql\`
    SELECT target_table, field_name, COUNT(*)::int AS n, MAX(drift_pct) AS max_pct
    FROM stats_drift_log
    WHERE checked_at >= \${since} AND drift_pct > 5
    GROUP BY target_table, field_name
    ORDER BY n DESC LIMIT 10
  \`;

  // 3) Latencia INSERT (top variante por calls)
  const lat = await sql\`SELECT * FROM v_insert_test_questions_latency ORDER BY calls DESC LIMIT 1\`;

  // 4) Último run del cron de drift
  const cron = await sql\`SELECT MAX(checked_at) AS last_run FROM stats_drift_log\`;
  const lastRun = cron[0].last_run;
  const staleH = lastRun ? (Date.now() - new Date(lastRun).getTime()) / 3600000 : null;

  console.log('1) Errores 5xx 24h total:', totalErrs);
  if (totalErrs > 0) for (const e of errs) console.log('   -', e.endpoint, e.error_type, '×', e.n);

  console.log('\\n2) Drift >5% (24h):', drifts.reduce((a,r) => a + Number(r.n), 0));
  if (drifts.length) for (const d of drifts) console.log('   -', d.target_table, d.field_name, '×', d.n, 'max', d.max_pct, '%');

  console.log('\\n3) INSERT test_questions:');
  if (lat[0]) console.log('   mean=' + lat[0].mean_ms + 'ms proxy_p95=' + lat[0].proxy_p95_ms + 'ms max=' + lat[0].max_ms + 'ms calls=' + lat[0].calls);

  console.log('\\n4) Cron drift último run:', lastRun, staleH ? '(hace ' + staleH.toFixed(1) + 'h)' : '');

  // Verdict
  const stale = staleH === null || staleH > 36;
  const fire = totalErrs >= 5 || drifts.length >= 5 || (lat[0] && Number(lat[0].mean_ms) >= 250) || stale;
  const warn = totalErrs >= 1 || drifts.length >= 1 || (lat[0] && Number(lat[0].mean_ms) >= 80) || (staleH > 26);
  console.log('\\nVeredicto:', fire ? '🔴 ROJO — atender ya' : warn ? '🟡 ÁMBAR — investigar' : '🟢 VERDE — todo OK');

  await sql.end();
})();
"
```

Reportar el output al usuario. Si veredicto es rojo o ámbar, ir a sección 2.

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
           user_id, created_at
    FROM validation_error_logs
    WHERE severity = 'critical'
      AND created_at > NOW() - INTERVAL '24 hours'
    ORDER BY created_at DESC LIMIT 30
  \`;
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

---

## 4. Umbrales — fuente de verdad

Los umbrales también están codificados en `app/api/admin/system-health/route.ts`. Si los cambias, actualiza ambos.

- Errores 5xx 24h: ámbar ≥ 1, rojo ≥ 5
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
