require('dotenv').config({ path: '.env.local' });
const { Client } = require('pg');
const { pgConfig } = require('../lib/db/pgSsl.cjs');
(async () => {
  const c = new Client(pgConfig(process.env.DATABASE_URL));
  await c.connect();

  const { rows: u } = await c.query(`SELECT count(*)::int eventos, count(DISTINCT user_id)::int usuarios
    FROM observable_events WHERE event_type='scraping_challenge_shown' AND ts >= now() - interval '24 hours'`);
  console.log('challenges 24h: ' + JSON.stringify(u[0]));

  console.log('\n=== por usuario: cuantas preguntas SE LE SIRVIERON hoy (el gate dice 500) ===');
  const { rows } = await c.query(`
    WITH ch AS (
      SELECT user_id, count(*)::int veces, max(ts) ultimo
      FROM observable_events WHERE event_type='scraping_challenge_shown' AND ts >= now() - interval '24 hours'
        AND user_id IS NOT NULL GROUP BY 1)
    SELECT ch.user_id, ch.veces, ch.ultimo,
      coalesce((SELECT sum(d.served)::int FROM daily_questions_served d
                WHERE d.subject_key=ch.user_id::text AND d.usage_date >= current_date - 1), 0) servidas,
      coalesce(up.plan_type,'?') plan, coalesce(up.email,'?') email
    FROM ch LEFT JOIN user_profiles up ON up.id=ch.user_id
    ORDER BY ch.veces DESC LIMIT 15`);
  for (const r of rows) console.log(`  ${r.veces}x  servidas=${r.servidas}  ${r.plan.padEnd(8)} ${r.email.slice(0,34).padEnd(34)} ult ${r.ultimo.toISOString().slice(5,16)}`);

  const { rows: fp } = await c.query(`
    WITH ch AS (SELECT DISTINCT user_id FROM observable_events
       WHERE event_type='scraping_challenge_shown' AND ts >= now() - interval '24 hours' AND user_id IS NOT NULL)
    SELECT count(*)::int total,
      count(*) FILTER (WHERE coalesce((SELECT sum(d.served) FROM daily_questions_served d
        WHERE d.subject_key=ch.user_id::text AND d.usage_date >= current_date - 1),0) < 300)::int bajo_umbral
    FROM ch`);
  console.log('\nusuarios retados: ' + fp[0].total + ' · de ellos con MENOS de 300 servidas (falso positivo probable): ' + fp[0].bajo_umbral);
  await c.end();
})();
