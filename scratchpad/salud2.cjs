require('dotenv').config({ path: '.env.local' });
const { Client } = require('pg');
const { pgConfig } = require('../lib/db/pgSsl.cjs');
(async () => {
  const c = new Client(pgConfig(process.env.DATABASE_URL));
  await c.connect();

  console.log('=== ¿SIGUE VIVO? alertas de la ULTIMA HORA ===');
  const r1 = await c.query(`SELECT metadata->>'rule' rule, severity, count(*)::int n, max(ts) ultimo
    FROM observable_events WHERE event_type='alert_fired' AND ts >= now() - interval '90 minutes'
    GROUP BY 1,2 ORDER BY max(ts) DESC`);
  r1.rows.forEach(r => console.log(`  [${r.severity}] ${r.rule} x${r.n} ult ${r.ultimo.toISOString().slice(11,16)}`));

  console.log('\n=== CANARY questions-gate: ultimos 8 ===');
  const r2 = await c.query(`SELECT ts, severity, error_message, metadata->>'status' st
    FROM observable_events WHERE event_type IN ('canary_run','cron_run') AND endpoint ILIKE '%questions%'
    ORDER BY ts DESC LIMIT 8`);
  r2.rows.forEach(r => console.log(`  ${r.ts.toISOString().slice(5,16)} ${r.severity||''} ${r.st||''} ${(r.error_message||'').slice(0,90)}`));

  console.log('\n=== 5xx por hora (ultimas 12h) ===');
  const r3 = await c.query(`SELECT date_trunc('hour', ts) h, count(*)::int n
    FROM observable_events WHERE ts >= now() - interval '12 hours' AND (metadata->>'http_status')::int >= 500
    GROUP BY 1 ORDER BY 1 DESC`);
  r3.rows.forEach(r => console.log(`  ${r.h.toISOString().slice(5,13)}h  ${r.n}`));

  console.log('\n=== GUARDADO DE RESPUESTAS (respondidas vs guardadas, 3h) ===');
  const r4 = await c.query(`SELECT count(*)::int guardadas FROM test_questions WHERE created_at >= now() - interval '3 hours'`);
  const r5 = await c.query(`SELECT count(*)::int respondidas FROM observable_events
     WHERE event_type='question_answered' AND ts >= now() - interval '3 hours'`).catch(()=>({rows:[{respondidas:null}]}));
  console.log('  ' + JSON.stringify({ ...r4.rows[0], ...r5.rows[0] }));

  console.log('\n=== REGLA DE ALERTA QUE REVIENTA ===');
  const r6 = await c.query(`SELECT error_message, metadata, max(ts) ultimo FROM observable_events
     WHERE event_type='alert_fired' AND metadata->>'rule'='alert_rule_failing' AND ts >= now() - interval '24 hours'
     GROUP BY 1,2 ORDER BY 3 DESC LIMIT 2`);
  r6.rows.forEach(r => console.log('  ' + JSON.stringify(r.metadata).slice(0, 400)));

  await c.end();
})();
