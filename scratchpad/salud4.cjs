require('dotenv').config({ path: '.env.local' });
const { Client } = require('pg');
const { pgConfig } = require('../lib/db/pgSsl.cjs');
(async () => {
  const c = new Client(pgConfig(process.env.DATABASE_URL));
  await c.connect();

  console.log('=== tipos de evento con "gate"/"human"/"challenge" (48h) ===');
  const t = await c.query(`SELECT event_type, severity, count(*)::int n, max(ts) ultimo FROM observable_events
    WHERE ts >= now() - interval '48 hours' AND (event_type ILIKE '%gate%' OR event_type ILIKE '%human%' OR event_type ILIKE '%challenge%' OR event_type ILIKE '%verificacion%')
    GROUP BY 1,2 ORDER BY n DESC LIMIT 12`);
  t.rows.forEach(r => console.log(`  ${r.event_type.padEnd(40)} [${r.severity}] ${String(r.n).padStart(6)} ult ${r.ultimo.toISOString().slice(5,16)}`));

  console.log('\n=== GUARDADO: filas en test_questions por hora (12h) ===');
  const g = await c.query(`SELECT date_trunc('hour', created_at) h, count(*)::int n
    FROM test_questions WHERE created_at >= now() - interval '12 hours' GROUP BY 1 ORDER BY 1 DESC`);
  g.rows.forEach(r => console.log(`  ${r.h.toISOString().slice(5,13)}h  ${r.n}`));

  console.log('\n=== eventos de la cola de guardado (24h) ===');
  const q = await c.query(`SELECT event_type, severity, count(*)::int n, max(ts) ultimo FROM observable_events
    WHERE ts >= now() - interval '24 hours' AND (event_type ILIKE '%answer%' OR event_type ILIKE '%save%')
    GROUP BY 1,2 ORDER BY n DESC LIMIT 12`);
  q.rows.forEach(r => console.log(`  ${r.event_type.padEnd(40)} [${r.severity}] ${String(r.n).padStart(6)} ult ${r.ultimo.toISOString().slice(5,16)}`));

  console.log('\n=== http_5xx: rutas (24h) ===');
  const e = await c.query(`SELECT coalesce(endpoint,'?') ep, count(*)::int n, max(ts) ultimo FROM observable_events
    WHERE ts >= now() - interval '24 hours' AND event_type='http_5xx' GROUP BY 1 ORDER BY n DESC LIMIT 10`);
  e.rows.forEach(r => console.log(`  ${r.ep.padEnd(46)} ${String(r.n).padStart(4)} ult ${r.ultimo.toISOString().slice(5,16)}`));
  await c.end();
})();
