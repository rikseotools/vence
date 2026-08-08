require('dotenv').config({ path: '.env.local' });
const { Client } = require('pg');
const { pgConfig } = require('../lib/db/pgSsl.cjs');
(async () => {
  const c = new Client(pgConfig(process.env.DATABASE_URL));
  await c.connect();
  console.log('=== scraping_force_challenge_set (7d) ===');
  const { rows } = await c.query(`SELECT ts, user_id, error_message, metadata FROM observable_events
    WHERE event_type='scraping_force_challenge_set' AND ts >= now() - interval '7 days' ORDER BY ts DESC`);
  for (const r of rows) console.log(`  ${r.ts.toISOString().slice(5,16)} user=${(r.user_id||'-').slice(0,8)} ${(r.error_message||'').slice(0,80)} ${JSON.stringify(r.metadata).slice(0,220)}`);

  console.log('\n=== challenges del canario smoke@vence.es (48h) ===');
  const { rows: s } = await c.query(`SELECT ts, metadata FROM observable_events
    WHERE event_type='scraping_challenge_shown' AND user_id=(SELECT id FROM user_profiles WHERE email='smoke@vence.es')
      AND ts >= now() - interval '48 hours' ORDER BY ts DESC LIMIT 5`);
  s.forEach(r => console.log(`  ${r.ts.toISOString().slice(5,16)} ${JSON.stringify(r.metadata).slice(0,260)}`));

  console.log('\n=== ¿siguen retados los premium? challenges por hora (12h) ===');
  const { rows: h } = await c.query(`SELECT date_trunc('hour', ts) h, count(*)::int n, count(DISTINCT user_id)::int users
    FROM observable_events WHERE event_type='scraping_challenge_shown' AND ts >= now() - interval '12 hours'
    GROUP BY 1 ORDER BY 1 DESC`);
  h.forEach(r => console.log(`  ${r.h.toISOString().slice(5,13)}h  ${r.n} eventos / ${r.users} usuarios`));
  await c.end();
})();
