// ¿Desde cuándo y por qué 250 usuarios reciben 401 en las lecturas de su cuenta?
const { Client } = require('pg');
const { pgConfig } = require('../lib/db/pgSsl.cjs');

(async () => {
  const c = new Client(pgConfig(process.env.DATABASE_URL));
  await c.connect();

  console.log('— 401 por HORA en los endpoints de cuenta (4 días) —');
  const h = await c.query(`
    SELECT date_trunc('hour', ts) AS hora,
           count(*) FILTER (WHERE endpoint LIKE '%user-stats%')   AS stats,
           count(*) FILTER (WHERE endpoint LIKE '%exam/pending%') AS examen,
           count(*) FILTER (WHERE endpoint LIKE '%auth/token%')   AS token,
           count(DISTINCT user_id)                                 AS usuarios
      FROM observable_events
     WHERE http_status = 401 AND ts > now() - interval '4 days'
     GROUP BY 1 HAVING count(*) > 20 ORDER BY 1`);
  console.table(h.rows.map((x) => ({
    hora: new Date(x.hora).toISOString().slice(5, 16), stats: x.stats, examen: x.examen, token: x.token, usuarios: x.usuarios,
  })));

  console.log('\n— ¿Qué deploy_version traen esos 401? —');
  const v = await c.query(`
    SELECT COALESCE(deploy_version,'(sin)') AS version, count(*) AS n, count(DISTINCT user_id) AS usuarios,
           min(ts) AS desde, max(ts) AS hasta
      FROM observable_events
     WHERE http_status = 401 AND endpoint LIKE '%user-stats%' AND ts > now() - interval '4 days'
     GROUP BY 1 ORDER BY 2 DESC LIMIT 8`);
  console.table(v.rows.map((x) => ({
    version: x.version, n: x.n, usuarios: x.usuarios,
    desde: new Date(x.desde).toISOString().slice(5, 16), hasta: new Date(x.hasta).toISOString().slice(5, 16),
  })));

  console.log('\n— ¿Los mismos usuarios SIGUEN respondiendo preguntas mientras reciben 401? —');
  const act = await c.query(`
    WITH afectados AS (
      SELECT DISTINCT user_id FROM observable_events
       WHERE http_status = 401 AND endpoint LIKE '%user-stats%'
         AND ts > now() - interval '24 hours' AND user_id IS NOT NULL
    )
    SELECT count(*) AS afectados,
           count(*) FILTER (WHERE tq > 0) AS siguen_respondiendo
      FROM (SELECT a.user_id, (SELECT count(*) FROM test_questions q
                                WHERE q.user_id = a.user_id AND q.created_at > now() - interval '24 hours') AS tq
              FROM afectados a) z`);
  console.table(act.rows);

  console.log('\n— Mensajes de esos 401 (qué dice el error) —');
  const m = await c.query(`
    SELECT left(COALESCE(error_message, '(vacío)'), 80) AS msg, count(*) AS n
      FROM observable_events
     WHERE http_status = 401 AND endpoint LIKE '%user-stats%' AND ts > now() - interval '24 hours'
     GROUP BY 1 ORDER BY 2 DESC LIMIT 6`);
  console.table(m.rows);

  await c.end();
})().catch((e) => { console.error('ERR', e.message); process.exit(1); });
