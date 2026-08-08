require('dotenv').config({ path: '.env.local' });
const { Client } = require('pg');
const { pgConfig } = require('../lib/db/pgSsl.cjs');
(async () => {
  const c = new Client(pgConfig(process.env.DATABASE_URL));
  await c.connect();

  console.log('=== ¿desde cuándo? por hora (36h) ===');
  const h = await c.query(`SELECT to_char(date_trunc('hour', ts),'DD/MM HH24') hora, count(*)::int n,
      count(DISTINCT user_id)::int usuarios
    FROM observable_events WHERE event_type='auth_identidad_ajena_rechazada' AND ts > now() - interval '36 hours'
    GROUP BY 1, date_trunc('hour', ts) ORDER BY date_trunc('hour', ts)`);
  h.rows.forEach(x => console.log(`  ${x.hora}h  ${String(x.n).padStart(4)} rechazos · ${x.usuarios} usuarios`));

  console.log('\n=== ¿cuándo empezó del todo? ===');
  const p = await c.query(`SELECT min(ts) primera, count(*)::int total, count(DISTINCT user_id)::int usuarios
    FROM observable_events WHERE event_type='auth_identidad_ajena_rechazada'`);
  console.log('  ' + JSON.stringify(p.rows[0]));

  console.log('\n=== qué dice el evento por dentro ===');
  const d = await c.query(`SELECT ts, user_id, endpoint, metadata FROM observable_events
    WHERE event_type='auth_identidad_ajena_rechazada' ORDER BY ts DESC LIMIT 3`);
  d.rows.forEach(x => console.log(`  ${x.ts.toISOString().slice(5,16)} user=${(x.user_id||'null')} ${x.endpoint}\n     ${JSON.stringify(x.metadata).slice(0,300)}`));

  console.log('\n=== a cuánta gente y en qué endpoints (24h) ===');
  const e = await c.query(`SELECT endpoint, count(*)::int n, count(DISTINCT user_id)::int usuarios
    FROM observable_events WHERE event_type='auth_identidad_ajena_rechazada' AND ts > now() - interval '24 hours'
    GROUP BY 1 ORDER BY n DESC LIMIT 6`);
  e.rows.forEach(x => console.log(`  ${x.endpoint.padEnd(28)} ${String(x.n).padStart(4)} · ${x.usuarios} usuarios`));

  console.log('\n=== exámenes sin completar hoy (¿cuánta gente se ha quedado sin corregir?) ===');
  const t = await c.query(`SELECT count(*)::int exams, count(DISTINCT user_id)::int usuarios
    FROM tests WHERE test_type='exam' AND created_at::date = current_date AND is_completed = false`);
  console.log('  ' + JSON.stringify(t.rows[0]));
  const t2 = await c.query(`SELECT count(*)::int exams, count(DISTINCT user_id)::int usuarios
    FROM tests WHERE test_type='exam' AND created_at::date = current_date AND is_completed = true`);
  console.log('  completados hoy: ' + JSON.stringify(t2.rows[0]));
  await c.end();
})();
