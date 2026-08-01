const { Client } = require('pg');
const { pgConfig } = require('../../lib/db/pgSsl.cjs');
const A = 'trabajospilarfreire@gmail.com', B = 'javiergalinanesvarela@gmail.com';
(async () => {
  const c = new Client(pgConfig()); await c.connect();
  const ids = (await c.query(`SELECT id, email FROM user_profiles WHERE email = ANY($1)`, [[A, B]])).rows;
  const pA = ids.find(r => r.email === A).id, pB = ids.find(r => r.email === B).id;

  console.log('═══ ¿Trial? ¿por qué uno se topa a 25 y el otro no? ═══');
  console.table((await c.query(`
    SELECT email, plan_type, requires_payment, trial_end_date, registration_date::date AS alta
      FROM user_profiles WHERE email = ANY($1)`, [[A, B]])).rows);

  console.log('═══ HUELLA TÉCNICA del navegador (¿la misma máquina?) ═══');
  console.table((await c.query(`
    SELECT up.email, tq.screen_resolution, tq.timezone, tq.browser_language, tq.device_type,
           left(tq.user_agent, 68) AS user_agent, count(*) AS n
      FROM test_questions tq JOIN user_profiles up ON up.id = tq.user_id
     WHERE tq.user_id = ANY($1) AND tq.created_at > now() - interval '20 days'
       AND tq.user_agent IS NOT NULL
     GROUP BY 1,2,3,4,5,6 ORDER BY 1, 7 DESC`, [[pA, pB]])).rows);

  console.log('═══ ¿SE INTERCALAN el mismo día? (últimas 60 respuestas de días compartidos) ═══');
  const r = (await c.query(`
    SELECT to_char(tq.created_at,'DD/MM HH24:MI') AS momento,
           CASE WHEN tq.user_id=$1 THEN 'PILAR' ELSE 'javier' END AS quien
      FROM test_questions tq
     WHERE tq.user_id = ANY($3) AND tq.created_at::date >= DATE '2026-07-27'
     ORDER BY tq.created_at LIMIT 400`, [pA, pB, [pA, pB]])).rows;
  let prev = null; const tramos = [];
  for (const x of r) { if (x.quien !== prev) { tramos.push(`${x.momento} ${x.quien}`); prev = x.quien; } }
  console.log('  cambios de cuenta (cada línea = la otra cuenta toma el relevo):');
  console.log('  ' + tramos.join('\n  '));
  await c.end();
})().catch(e => { console.error('ERROR', e.message); process.exit(1); });
