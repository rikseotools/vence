// Para cada día: lo que respondió Diego vs lo que sumaban las cuentas que comparten su huella.
const { Client } = require('pg');
const { pgConfig } = require('../lib/db/pgSsl.cjs');

const UID = '355d33fb-3b85-43cd-aedb-aa9d0e546005';
const FP = 'fp2_5ac2ab39a0b7b408d88cac2d1b32911a';

(async () => {
  const c = new Client(pgConfig(process.env.DATABASE_URL));
  await c.connect();

  const r = await c.query(`
    WITH dias AS (
      SELECT generate_series((now() - interval '9 days')::date, now()::date, interval '1 day')::date AS d
    ), suyas AS (
      SELECT usage_date AS d, questions_answered FROM daily_question_usage WHERE user_id = $1
    ), grupo AS (
      SELECT dqu.usage_date AS d, sum(dqu.questions_answered) AS total
        FROM daily_question_usage dqu
       WHERE EXISTS (SELECT 1 FROM user_devices ud
                      WHERE ud.user_id = dqu.user_id AND ud.hw_fingerprint = $2
                        AND ud.last_seen_at > now() - interval '30 days')
       GROUP BY 1
    ), tests AS (
      SELECT created_at::date AS d, count(*) AS abiertos,
             count(*) FILTER (WHERE (SELECT count(*) FROM test_questions q WHERE q.test_id = t.id) = 0) AS sin_responder
        FROM tests t WHERE user_id = $1 GROUP BY 1
    )
    SELECT dias.d,
           COALESCE(suyas.questions_answered, 0) AS suyas,
           COALESCE(grupo.total, 0)              AS grupo_huella,
           COALESCE(tests.abiertos, 0)           AS tests_abiertos,
           COALESCE(tests.sin_responder, 0)      AS tests_sin_responder
      FROM dias
      LEFT JOIN suyas ON suyas.d = dias.d
      LEFT JOIN grupo ON grupo.d = dias.d
      LEFT JOIN tests ON tests.d = dias.d
     ORDER BY dias.d`, [UID, FP]);

  console.table(r.rows.map((x) => ({
    dia: x.d.toISOString().slice(0, 10),
    respondio_el: x.suyas,
    sumaban_los_9_de_su_huella: x.grupo_huella,
    muro: Number(x.grupo_huella) >= 25 ? '🚧 SÍ' : 'no',
    tests_abiertos: x.tests_abiertos,
    abandonados_sin_responder: x.tests_sin_responder,
  })));

  await c.end();
})().catch((e) => { console.error('ERR', e.message); process.exit(1); });
