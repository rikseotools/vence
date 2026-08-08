require('dotenv').config({ path: '.env.local' });
const { Client } = require('pg');
const { pgConfig } = require('../lib/db/pgSsl.cjs');
(async () => {
  const c = new Client(pgConfig(process.env.DATABASE_URL));
  await c.connect();
  const host = (await c.query('SELECT inet_server_addr()::text h, current_database() d')).rows[0];
  console.log('BD:', JSON.stringify(host));

  console.log('\n=== §0 ALERTAS DISPARADAS (24h) ===');
  const al = await c.query(`SELECT metadata->>'rule' rule, severity, count(*)::int veces,
      count(*) FILTER (WHERE metadata->>'emailed'='true')::int emailados, max(ts) ultimo,
      (array_agg(error_message ORDER BY ts DESC))[1] titulo
    FROM observable_events WHERE event_type='alert_fired' AND ts >= now() - interval '24 hours'
    GROUP BY 1,2 ORDER BY max(ts) DESC`);
  if (!al.rows.length) console.log('  0 avisos en 24h');
  else al.rows.forEach(r => console.log(`  [${r.severity}] ${r.rule} x${r.veces} (${r.emailados} al buzon) ult ${r.ultimo.toISOString().slice(5,16)} -- ${(r.titulo||'').slice(0,120)}`));

  console.log('\n=== 5xx SERVIDOR (24h) ===');
  const e5 = await c.query(`SELECT count(*)::int n, count(DISTINCT endpoint)::int endpoints FROM observable_events
    WHERE ts >= now() - interval '24 hours' AND (metadata->>'http_status')::int >= 500`).catch(e=>({rows:[{err:e.message}]}));
  console.log('  ' + JSON.stringify(e5.rows[0]));

  console.log('\n=== CATCH-ALL error/warn (24h, top 15) ===');
  const ca = await c.query(`SELECT event_type, severity, count(*)::int n, max(ts) ultimo
    FROM observable_events WHERE ts >= now() - interval '24 hours' AND severity IN ('error','warn')
    GROUP BY 1,2 ORDER BY n DESC LIMIT 15`);
  ca.rows.forEach(r => console.log(`  ${r.severity.padEnd(5)} ${r.event_type.padEnd(38)} ${String(r.n).padStart(7)}  ult ${r.ultimo.toISOString().slice(5,16)}`));

  console.log('\n=== CRONS: ultima ejecucion (7d) ===');
  const cr = await c.query(`SELECT endpoint, max(ts) ultimo, round(extract(epoch from (now()-max(ts)))/3600,1)::float h,
      (array_agg(metadata->>'status' ORDER BY ts DESC))[1] estado
    FROM observable_events WHERE event_type='cron_run' AND ts >= now() - interval '7 days'
    GROUP BY 1 ORDER BY 3 DESC`);
  cr.rows.forEach(r => console.log(`  ${(r.h>26?'ROJO':r.h>14?'ambar':'ok  ')} ${r.endpoint.padEnd(38)} hace ${String(r.h).padStart(6)} h  ${r.estado||''}`));
  await c.end();
})();
