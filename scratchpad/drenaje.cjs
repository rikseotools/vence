require('dotenv').config({ path: '.env.local' });
const { Client } = require('pg');
const { pgConfig } = require('../lib/db/pgSsl.cjs');
(async () => {
  const c = new Client(pgConfig(process.env.DATABASE_URL));
  await c.connect();

  console.log('=== cron_run de los drenadores (7d) ===');
  const { rows } = await c.query(`SELECT ts, endpoint, severity, error_message, metadata, duration_ms
    FROM observable_events WHERE event_type='cron_run'
      AND endpoint IN ('telemetry-retention','archive-interactions','observability-cleanup')
      AND ts >= now() - interval '7 days' ORDER BY ts DESC LIMIT 12`);
  rows.forEach(r => console.log(`  ${r.ts.toISOString().slice(5,16)} ${r.endpoint.padEnd(22)} [${r.severity||'-'}] ${r.duration_ms||'?'}ms ${JSON.stringify(r.metadata)} ${(r.error_message||'').slice(0,120)}`));

  console.log('\n=== atraso REAL en las tablas ===');
  const tablas = [
    ['observable_events', 'ts', '30 days'],
    ['validation_error_logs', 'created_at', '30 days'],
    ['user_interactions', 'created_at', '30 days'],
  ];
  for (const [t, col, ret] of tablas) {
    try {
      const { rows: r } = await c.query(
        `SELECT count(*)::bigint fuera, pg_size_pretty(pg_total_relation_size('${t}')) tam,
                (SELECT count(*)::bigint FROM ${t}) total
           FROM ${t} WHERE ${col} < now() - interval '${ret}'`);
      console.log(`  ${t.padEnd(24)} total=${r[0].total}  fuera de retencion=${r[0].fuera}  tamaño=${r[0].tam}`);
    } catch (e) { console.log(`  ${t}: ${e.message}`); }
  }

  console.log('\n=== la regla que revienta: alert_rule_failing (24h) ===');
  const { rows: ar } = await c.query(`SELECT ts, error_message, metadata FROM observable_events
    WHERE event_type='alert_fired' AND metadata->>'rule'='alert_rule_failing' AND ts >= now() - interval '24 hours'
    ORDER BY ts DESC LIMIT 3`);
  ar.forEach(r => console.log(`  ${r.ts.toISOString().slice(5,16)} ${r.error_message} :: ${JSON.stringify(r.metadata)}`));

  console.log('\n=== ¿hay evento propio del fallo de la regla? ===');
  const { rows: rf } = await c.query(`SELECT ts, event_type, severity, error_message, metadata FROM observable_events
    WHERE ts >= now() - interval '24 hours'
      AND (error_message ILIKE '%drenaje%' OR metadata::text ILIKE '%drenaje_atrasado%')
      AND event_type <> 'alert_fired' ORDER BY ts DESC LIMIT 5`);
  if (!rf.length) console.log('  (ninguno: la regla revienta y solo lo dice el meta-aviso)');
  rf.forEach(r => console.log(`  ${r.ts.toISOString().slice(5,16)} ${r.event_type} [${r.severity}] ${(r.error_message||'').slice(0,200)}`));
  await c.end();
})();
