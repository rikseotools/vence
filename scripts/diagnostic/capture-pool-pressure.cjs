#!/usr/bin/env node
/**
 * capture-pool-pressure.cjs — Captura en directo de presión de pool durante picos.
 *
 * Objetivo: validar/falsar las hipótesis del roadmap pool-segregation.md.
 *
 * Cada SAMPLE_INTERVAL_MS captura:
 *   1. pg_stat_activity filtrado a la BD de la app (estado, wait_event, query,
 *      edad, application_name).
 *   2. Long queries / idle-in-transaction sospechosos.
 *   3. Últimos 30s de observable_events relevantes (errores 5xx, runs de crones,
 *      latencias /api/profile).
 *   4. Top queries por mean_exec_time desde pg_stat_statements (delta vs anterior).
 *   5. Deploy version actual y edad del deploy más reciente.
 *
 * Output: JSON-line en OUTPUT_PATH (default /tmp/pool-pressure-<fecha>.jsonl).
 * Cada línea = 1 sample = 1 JSON object con todas las métricas.
 *
 * Uso:
 *   # Captura de 1.5h cubriendo el pico de la mañana (8:50-10:20 UTC):
 *   node scripts/diagnostic/capture-pool-pressure.cjs --duration 5400 --interval 30
 *
 *   # Captura corta de prueba (2 min, sample cada 10s):
 *   node scripts/diagnostic/capture-pool-pressure.cjs --duration 120 --interval 10
 *
 * Análisis posterior sugerido (jq):
 *   # Conexiones activas máximas observadas
 *   jq -s 'max_by(.pg_stat.active_app_conns) | .pg_stat' /tmp/pool-pressure-*.jsonl
 *
 *   # Samples con idle-in-transaction > 5s (bandera Hipótesis B)
 *   jq 'select(.pg_stat.idle_in_tx_over_5s | length > 0)' /tmp/pool-pressure-*.jsonl
 *
 *   # Cross-tab errores 5xx vs número de conexiones activas
 *   jq -r '[.ts, .errors_recent.profile_5xx_count, .pg_stat.active_app_conns] | @tsv' /tmp/pool-pressure-*.jsonl
 *
 * Seguridad: read-only, conexión client local al pooler con max:1. No toca prod
 * más allá de las lecturas de pg_stat_* y observable_events. Coste despreciable.
 */

const path = require('path');
const fs = require('fs');

const ROOT = path.resolve(__dirname, '../..');
const pgMod = require(path.join(ROOT, 'node_modules/postgres'));
const postgres = pgMod.default || pgMod;
require(path.join(ROOT, 'node_modules/dotenv')).config({
  path: path.join(ROOT, '.env.local'),
});

// ─── Parámetros CLI ──────────────────────────────────────────────────────────
const args = process.argv.slice(2);
function getArg(name, defaultVal) {
  const i = args.indexOf('--' + name);
  if (i === -1 || i === args.length - 1) return defaultVal;
  return args[i + 1];
}

const DURATION_S = parseInt(getArg('duration', '5400'), 10); // 90 min default
const SAMPLE_INTERVAL_MS = parseInt(getArg('interval', '30'), 10) * 1000;
const OUTPUT_PATH =
  getArg('out', null) ||
  `/tmp/pool-pressure-${new Date().toISOString().slice(0, 10)}.jsonl`;

console.log('=== capture-pool-pressure.cjs ===');
console.log('  duration:    ', DURATION_S, 's');
console.log('  interval:    ', SAMPLE_INTERVAL_MS / 1000, 's');
console.log('  output:      ', OUTPUT_PATH);
console.log('  samples max: ', Math.ceil((DURATION_S * 1000) / SAMPLE_INTERVAL_MS));
console.log();

// ─── Cliente postgres (1 conn dedicada, no afecta al pool de prod) ───────────
const sql = postgres(process.env.DATABASE_URL, {
  max: 1,
  prepare: false,
  idle_timeout: 60,
  connect_timeout: 10,
});

const outStream = fs.createWriteStream(OUTPUT_PATH, { flags: 'a' });

// Track delta para pg_stat_statements
let prevStatementCalls = new Map(); // queryid -> calls

async function captureSample() {
  const ts = new Date().toISOString();
  const sample = { ts };

  // 1. pg_stat_activity — conexiones de la app
  try {
    const rows = await sql`
      SELECT pid, application_name, client_addr::text AS client_addr, state,
             wait_event_type, wait_event,
             EXTRACT(EPOCH FROM (NOW() - query_start))::float AS query_age_s,
             EXTRACT(EPOCH FROM (NOW() - state_change))::float AS state_age_s,
             LEFT(query, 250) AS query
      FROM pg_stat_activity
      WHERE datname IS NOT NULL
        AND application_name IN ('postgres-js', 'Supavisor', 'postgrest', 'pgbouncer')
      ORDER BY COALESCE(query_start, state_change) ASC
    `;

    const activeApp = rows.filter(
      (r) => r.application_name === 'postgres-js' && r.state === 'active',
    );
    const idleInTxOver5s = rows.filter(
      (r) =>
        r.state === 'idle in transaction' && Number(r.state_age_s) > 5,
    );
    const longActive = rows.filter(
      (r) => r.state === 'active' && Number(r.query_age_s) > 5,
    );

    sample.pg_stat = {
      total_conns: rows.length,
      active_app_conns: activeApp.length,
      idle_in_tx_over_5s: idleInTxOver5s.map((r) => ({
        pid: r.pid,
        app: r.application_name,
        state_age_s: r.state_age_s,
        wait: `${r.wait_event_type}/${r.wait_event}`,
        query: r.query,
      })),
      long_active_over_5s: longActive.map((r) => ({
        pid: r.pid,
        app: r.application_name,
        query_age_s: r.query_age_s,
        wait: `${r.wait_event_type}/${r.wait_event}`,
        query: r.query,
      })),
      by_app: rows.reduce((acc, r) => {
        const k = `${r.application_name || '?'}/${r.state}`;
        acc[k] = (acc[k] || 0) + 1;
        return acc;
      }, {}),
    };
  } catch (e) {
    sample.pg_stat = { error: e.message.slice(0, 200) };
  }

  // 2. Errores 5xx recientes /api/profile (últimos 30s)
  try {
    const errs = await sql`
      SELECT endpoint, http_status, duration_ms, error_message, deploy_version
      FROM observable_events
      WHERE http_status >= 500
        AND ts > NOW() - INTERVAL '30 seconds'
      ORDER BY ts DESC LIMIT 50
    `;
    sample.errors_recent = {
      total_5xx_30s: errs.length,
      profile_5xx_count: errs.filter((e) => e.endpoint === '/api/profile').length,
      by_endpoint: errs.reduce((acc, e) => {
        acc[e.endpoint || '?'] = (acc[e.endpoint || '?'] || 0) + 1;
        return acc;
      }, {}),
      samples: errs.slice(0, 5).map((e) => ({
        endpoint: e.endpoint,
        status: e.http_status,
        dur_ms: e.duration_ms,
        msg: (e.error_message || '').slice(0, 100),
      })),
    };
  } catch (e) {
    sample.errors_recent = { error: e.message.slice(0, 200) };
  }

  // 3. Runs de crones pesados en los últimos 30s (Hipótesis: cron drena slot)
  try {
    const crons = await sql`
      SELECT endpoint, duration_ms, severity
      FROM observable_events
      WHERE event_type = 'cron_run'
        AND ts > NOW() - INTERVAL '30 seconds'
      ORDER BY duration_ms DESC LIMIT 10
    `;
    sample.crons_recent = crons.map((c) => ({
      endpoint: c.endpoint,
      dur_ms: c.duration_ms,
      severity: c.severity,
    }));
  } catch (e) {
    sample.crons_recent = { error: e.message.slice(0, 200) };
  }

  // 4. Top queries por mean_exec_time + delta de calls vs anterior
  try {
    const stmts = await sql`
      SELECT queryid::text AS qid, calls,
             ROUND(mean_exec_time::numeric, 1) AS mean_ms,
             ROUND(max_exec_time::numeric, 1) AS max_ms,
             LEFT(query, 200) AS query
      FROM pg_stat_statements
      WHERE calls > 5
      ORDER BY mean_exec_time DESC LIMIT 10
    `;
    sample.top_queries = stmts.map((s) => {
      const prevCalls = prevStatementCalls.get(s.qid) || 0;
      const deltaCalls = Number(s.calls) - prevCalls;
      prevStatementCalls.set(s.qid, Number(s.calls));
      return {
        qid: s.qid,
        mean_ms: s.mean_ms,
        max_ms: s.max_ms,
        calls_total: s.calls,
        calls_delta: deltaCalls,
        query: s.query.replace(/\s+/g, ' ').slice(0, 150),
      };
    });
  } catch (e) {
    sample.top_queries = { error: e.message.slice(0, 200) };
  }

  // 5. Deploy version actual (último visto en observable_events)
  try {
    const dep = await sql`
      SELECT deploy_version, MAX(ts) AS last_ts
      FROM observable_events
      WHERE deploy_version IS NOT NULL
        AND ts > NOW() - INTERVAL '10 minutes'
      GROUP BY deploy_version
      ORDER BY last_ts DESC LIMIT 3
    `;
    sample.deploys_recent = dep.map((d) => ({
      version: d.deploy_version,
      last_seen: d.last_ts,
    }));
  } catch (e) {
    sample.deploys_recent = { error: e.message.slice(0, 200) };
  }

  // Volcar a fichero y log resumido
  outStream.write(JSON.stringify(sample) + '\n');
  const flags = [];
  if (sample.pg_stat?.idle_in_tx_over_5s?.length)
    flags.push(`⚠️ idle-in-tx>5s: ${sample.pg_stat.idle_in_tx_over_5s.length}`);
  if (sample.pg_stat?.long_active_over_5s?.length)
    flags.push(`⚠️ long-active>5s: ${sample.pg_stat.long_active_over_5s.length}`);
  if (sample.errors_recent?.total_5xx_30s > 0)
    flags.push(`🔴 5xx-30s: ${sample.errors_recent.total_5xx_30s}`);

  console.log(
    `[${ts.slice(11, 19)}]`,
    `conn=${sample.pg_stat?.total_conns ?? '?'}`,
    `active_app=${sample.pg_stat?.active_app_conns ?? '?'}`,
    `5xx_30s=${sample.errors_recent?.total_5xx_30s ?? '?'}`,
    flags.length ? '  ' + flags.join(' ') : '',
  );
}

// ─── Loop principal ──────────────────────────────────────────────────────────
const startMs = Date.now();
const endMs = startMs + DURATION_S * 1000;

async function tick() {
  try {
    await captureSample();
  } catch (e) {
    console.error('Sample error:', e.message);
  }
  if (Date.now() < endMs) {
    setTimeout(tick, SAMPLE_INTERVAL_MS);
  } else {
    console.log();
    console.log('=== Captura completada ===');
    console.log('  output:', OUTPUT_PATH);
    console.log('  duración real:', ((Date.now() - startMs) / 1000).toFixed(0), 's');
    outStream.end();
    await sql.end();
  }
}

// Captura señales para cierre limpio
process.on('SIGINT', async () => {
  console.log('\n[SIGINT] cerrando…');
  outStream.end();
  await sql.end();
  process.exit(0);
});
process.on('SIGTERM', async () => {
  outStream.end();
  await sql.end();
  process.exit(0);
});

tick();
