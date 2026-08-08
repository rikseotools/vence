require('dotenv').config({ path: '.env.local' });
const { Client } = require('pg');
const { pgConfig } = require('../lib/db/pgSsl.cjs');
(async () => {
  const c = new Client(pgConfig(process.env.DATABASE_URL));
  await c.connect();

  for (const rule of ['canary_questions_gate_failed','cron_overdue','scraping_sweep','client_error_spike','save_reconciliation','main_ci_rojo','ci_integracion_rojo']) {
    const { rows } = await c.query(`SELECT ts, error_message, metadata FROM observable_events
      WHERE event_type='alert_fired' AND metadata->>'rule'=$1 ORDER BY ts DESC LIMIT 1`, [rule]);
    if (!rows.length) { console.log(`\n## ${rule}: sin filas`); continue; }
    const r = rows[0];
    console.log(`\n## ${rule}  (ult ${r.ts.toISOString().slice(5,16)})`);
    console.log('   ' + (r.error_message||''));
    console.log('   ' + JSON.stringify(r.metadata).slice(0, 700));
  }

  console.log('\n=== 5xx: como se guardan ===');
  const s = await c.query(`SELECT event_type, severity, count(*)::int n FROM observable_events
    WHERE ts >= now() - interval '24 hours' AND (event_type ILIKE '%5xx%' OR event_type='server_render_error' OR event_type='api_error')
    GROUP BY 1,2 ORDER BY n DESC LIMIT 10`);
  s.rows.forEach(r => console.log(`  ${r.event_type} [${r.severity}] ${r.n}`));

  console.log('\n=== canaries fallando (24h) ===');
  const cn = await c.query(`SELECT endpoint, count(*) FILTER (WHERE severity IN ('error','critical'))::int malos, count(*)::int total, max(ts) ultimo
    FROM observable_events WHERE event_type IN ('cron_run','canary_run') AND endpoint ILIKE 'canary%' AND ts >= now() - interval '24 hours'
    GROUP BY 1 HAVING count(*) FILTER (WHERE severity IN ('error','critical')) > 0 ORDER BY malos DESC`);
  if (!cn.rows.length) console.log('  ninguno con severidad error/critical');
  cn.rows.forEach(r => console.log(`  ${r.endpoint.padEnd(34)} ${r.malos}/${r.total} malos, ult ${r.ultimo.toISOString().slice(5,16)}`));
  await c.end();
})();
