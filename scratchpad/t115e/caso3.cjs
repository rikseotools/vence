const { Client } = require('pg');
const { pgConfig } = require('../../lib/db/pgSsl.cjs');
const A = 'trabajospilarfreire@gmail.com', B = 'javiergalinanesvarela@gmail.com';
(async () => {
  const c = new Client(pgConfig()); await c.connect();
  const ids = (await c.query(`SELECT id, email FROM user_profiles WHERE email = ANY($1)`, [[A, B]])).rows;
  const pA = ids.find(r => r.email === A).id, pB = ids.find(r => r.email === B).id;

  console.log('═══ ¿Por qué uno se topa a 25 y el otro NO? contador oficial del límite ═══');
  console.table((await c.query(`
    SELECT up.email, d.usage_date, d.questions_answered
      FROM daily_question_usage d JOIN user_profiles up ON up.id = d.user_id
     WHERE d.user_id = ANY($1) AND d.usage_date > (now() - interval '8 days')::date
     ORDER BY d.usage_date DESC, up.email`, [[pA, pB]])).rows);

  console.log('═══ Tipo de preguntas de cada uno (¿cuentan para el límite?) ═══');
  console.table((await c.query(`
    SELECT up.email, tq.question_type, count(*) AS n,
           count(*) FILTER (WHERE tq.psychometric_question_id IS NOT NULL) AS psicotecnicas
      FROM test_questions tq JOIN user_profiles up ON up.id = tq.user_id
     WHERE tq.user_id = ANY($1) AND tq.created_at > now() - interval '10 days'
     GROUP BY 1,2 ORDER BY 1,3 DESC`, [[pA, pB]])).rows);

  console.log('═══ ¿SE INTERCALAN el mismo día? ═══');
  const r = (await c.query(`
    SELECT to_char(tq.created_at,'DD/MM HH24:MI') AS momento,
           CASE WHEN tq.user_id = $1 THEN 'PILAR ' ELSE '      javier' END AS quien
      FROM test_questions tq
     WHERE tq.user_id = ANY($2) AND tq.created_at >= '2026-07-27'
     ORDER BY tq.created_at`, [pA, [pA, pB]])).rows;
  let prev = null; const tramos = [];
  for (const x of r) { if (x.quien !== prev) { tramos.push(`  ${x.momento}  →  ${x.quien.trim()}`); prev = x.quien; } }
  console.log(`  ${r.length} respuestas · ${tramos.length} relevos entre las dos cuentas:`);
  console.log(tramos.join('\n'));
  await c.end();
})().catch(e => { console.error('ERROR', e.message); process.exit(1); });
