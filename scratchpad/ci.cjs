require('dotenv').config({ path: '.env.local' });
const { Client } = require('pg');
const { pgConfig } = require('../lib/db/pgSsl.cjs');
(async () => {
  const c = new Client(pgConfig(process.env.DATABASE_URL));
  await c.connect();
  console.log('=== eventos de workflow (48h) ===');
  const { rows } = await c.query(`SELECT ts, event_type, severity, deploy_version sha, metadata->>'workflow' wf,
      metadata->>'ref' ref, metadata->>'conclusion' concl, metadata->>'runUrl' url
    FROM observable_events WHERE event_type ILIKE 'workflow%' AND ts >= now() - interval '48 hours'
    ORDER BY ts DESC LIMIT 30`);
  rows.forEach(r => console.log(`  ${r.ts.toISOString().slice(5,16)} ${r.event_type.padEnd(18)} ${(r.wf||'?').padEnd(22)} ${(r.ref||'').replace('refs/heads/','').padEnd(12)} ${(r.sha||'').slice(0,8)} ${r.concl||''}`));
  const u = rows.find(r => r.url); if (u) console.log('\n  ultimo runUrl: ' + u.url);

  console.log('\n=== ci_integracion_rojo: causas (7d) ===');
  const { rows: ci } = await c.query(`SELECT ts, metadata FROM observable_events
    WHERE event_type='alert_fired' AND metadata->>'rule'='ci_integracion_rojo' AND ts >= now() - interval '7 days'
    ORDER BY ts DESC LIMIT 6`);
  ci.forEach(r => console.log('  ' + r.ts.toISOString().slice(5,16) + ' ' + JSON.stringify(r.metadata).slice(0,200)));

  console.log('\n=== eventos de CI de integracion (7d) ===');
  const { rows: it } = await c.query(`SELECT ts, event_type, severity, metadata FROM observable_events
    WHERE event_type ILIKE '%integracion%' OR event_type ILIKE '%integration%' AND ts >= now() - interval '7 days'
    ORDER BY ts DESC LIMIT 10`);
  it.forEach(r => console.log(`  ${r.ts.toISOString().slice(5,16)} ${r.event_type} [${r.severity}] ${JSON.stringify(r.metadata).slice(0,180)}`));
  await c.end();
})();
