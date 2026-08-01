const { Client } = require('pg');
const { pgConfig } = require('../../lib/db/pgSsl.cjs');
const A = 'trabajospilarfreire@gmail.com', B = 'javiergalinanesvarela@gmail.com';
(async () => {
  const c = new Client(pgConfig()); await c.connect();

  console.log('═══ PERFILES ═══');
  console.table((await c.query(`
    SELECT email, full_name, plan_type, target_oposicion, registration_date::date AS alta,
           registration_ip, registration_source, ciudad, gender, age
      FROM user_profiles WHERE email = ANY($1)`, [[A, B]])).rows);

  const ids = (await c.query(`SELECT id, email FROM user_profiles WHERE email = ANY($1)`, [[A, B]])).rows;
  const map = Object.fromEntries(ids.map(r => [r.id, r.email.split('@')[0]]));

  console.log('═══ DISPOSITIVOS de cada uno ═══');
  console.table((await c.query(`
    SELECT up.email, ud.device_id, left(ud.hw_fingerprint, 22) AS huella,
           ud.first_seen_at::date AS visto_desde, ud.last_seen_at::date AS visto_hasta
      FROM user_devices ud JOIN user_profiles up ON up.id = ud.user_id
     WHERE up.email = ANY($1) ORDER BY up.email, ud.last_seen_at DESC`, [[A, B]])).rows);

  console.log('═══ ¿CUÁNTAS cuentas comparten esa(s) huella(s)? ═══');
  console.table((await c.query(`
    SELECT left(ud.hw_fingerprint, 22) AS huella, count(DISTINCT ud.user_id) AS cuentas,
           string_agg(DISTINCT up.email, ', ') AS quienes
      FROM user_devices ud JOIN user_profiles up ON up.id = ud.user_id
     WHERE ud.hw_fingerprint IN (SELECT hw_fingerprint FROM user_devices ud2
             JOIN user_profiles up2 ON up2.id = ud2.user_id
            WHERE up2.email = ANY($1) AND ud2.hw_fingerprint IS NOT NULL)
     GROUP BY 1 ORDER BY 2 DESC`, [[A, B]])).rows);

  console.log('═══ ACTIVIDAD por día (¿alternan o se solapan?) ═══');
  console.table((await c.query(`
    SELECT tq.created_at::date AS dia,
           count(*) FILTER (WHERE tq.user_id = $1) AS pilar,
           count(*) FILTER (WHERE tq.user_id = $2) AS javier
      FROM test_questions tq
     WHERE tq.user_id = ANY($3) AND tq.created_at > now() - interval '30 days'
     GROUP BY 1 ORDER BY 1 DESC LIMIT 20`,
    [ids.find(r => r.email === A).id, ids.find(r => r.email === B).id, ids.map(r => r.id)])).rows);

  console.log('═══ FRANJA HORARIA de cada uno (dos personas o una alternando) ═══');
  console.table((await c.query(`
    SELECT up.email, extract(hour from tq.created_at)::int AS hora, count(*) AS respuestas
      FROM test_questions tq JOIN user_profiles up ON up.id = tq.user_id
     WHERE tq.user_id = ANY($1) AND tq.created_at > now() - interval '30 days'
     GROUP BY 1,2 HAVING count(*) > 5 ORDER BY 1, 2`, [ids.map(r => r.id)])).rows);

  console.log('═══ ¿Alguna señal de fraude previa? ═══');
  console.table((await c.query(`
    SELECT alert_type, severity, status, detected_at::date FROM fraud_alerts
     WHERE user_ids && $1::uuid[] ORDER BY detected_at DESC LIMIT 10`, [ids.map(r => r.id)])).rows);

  await c.end();
})().catch(e => { console.error('ERROR', e.message); process.exit(1); });
