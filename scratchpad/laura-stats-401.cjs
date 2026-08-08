// «Mis estadísticas están a 0»: el rastro de Laura tiene 401 repetidos en /api/v2/user-stats.
// ¿Es solo ella o le pasa a más gente? ¿Y tiene datos de verdad detrás?
const { Client } = require('pg');
const { pgConfig } = require('../lib/db/pgSsl.cjs');

const UID_MAIL = 'laurasimar@gmail.com';

(async () => {
  const c = new Client(pgConfig(process.env.DATABASE_URL));
  await c.connect();
  const u = (await c.query('SELECT id FROM user_profiles WHERE email=$1', [UID_MAIL])).rows[0];

  console.log('— ¿TIENE datos detrás? (si sí, el 0 es de lectura, no de pérdida) —');
  const datos = await c.query(`
    SELECT (SELECT count(*) FROM tests WHERE user_id=$1)                    AS tests,
           (SELECT count(*) FROM test_questions WHERE user_id=$1)           AS respuestas,
           (SELECT count(*) FROM test_questions WHERE user_id=$1 AND created_at > now()-interval '7 days') AS ultimos_7d,
           (SELECT max(created_at) FROM test_questions WHERE user_id=$1)    AS ultima`, [u.id]);
  console.table(datos.rows);

  console.log('\n— SUS 401 por endpoint (7 días) —');
  const suyos = await c.query(`
    SELECT endpoint, count(*) AS n, min(ts) AS desde, max(ts) AS hasta
      FROM observable_events
     WHERE user_id=$1 AND http_status=401 AND ts > now()-interval '7 days'
     GROUP BY 1 ORDER BY 2 DESC`, [u.id]);
  console.table(suyos.rows.map((x) => ({
    endpoint: x.endpoint, n: x.n,
    desde: new Date(x.desde).toISOString().slice(5, 16),
    hasta: new Date(x.hasta).toISOString().slice(5, 16),
  })));

  console.log('\n— ¿ES SOLO ELLA? 401 de user-stats en 7 días, por día —');
  const global = await c.query(`
    SELECT date_trunc('day', ts)::date AS dia,
           count(*) AS eventos, count(DISTINCT user_id) AS usuarios
      FROM observable_events
     WHERE endpoint LIKE '%user-stats%' AND http_status=401 AND ts > now()-interval '7 days'
     GROUP BY 1 ORDER BY 1`);
  console.table(global.rows.map((x) => ({ dia: x.dia.toISOString().slice(0, 10), eventos: x.eventos, usuarios: x.usuarios })));

  console.log('\n— Los endpoints con más 401 en 24 h (¿patrón general?) —');
  const top = await c.query(`
    SELECT endpoint, count(*) AS n, count(DISTINCT user_id) AS usuarios
      FROM observable_events
     WHERE http_status=401 AND ts > now()-interval '24 hours'
     GROUP BY 1 ORDER BY 2 DESC LIMIT 10`);
  console.table(top.rows);

  await c.end();
})().catch((e) => { console.error('ERR', e.message); process.exit(1); });
