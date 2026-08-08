// T-146: ¿el barrido nocturno ya CUENTA los artículos de reforma (bis/ter/…)?
const { Client } = require('pg');
(async () => {
  const c = new Client({ connectionString: process.env.DATABASE_URL.replace(/[?&]sslmode=[^&]*/,''), ssl:{rejectUnauthorized:false} });
  await c.connect();
  const runs = await c.query(`SELECT created_at::timestamp(0) cuando, status, left(coalesce(message,''),60) msg
    FROM cron_runs WHERE job_name ILIKE '%health%sweep%' OR job_name ILIKE '%content%health%'
    ORDER BY created_at DESC LIMIT 4`);
  console.log('últimas pasadas del barrido:'); console.table(runs.rows);
  const f = await c.query(`SELECT max(created_at)::timestamp(0) ultimo, count(*) n
    FROM content_health_findings WHERE kind='article_no_coverage'`);
  console.log('hallazgos article_no_coverage:', f.rows[0]);
  // ¿algún hallazgo cita un artículo de reforma en sus ejemplos?
  const bis = await c.query(`
    SELECT count(*) FILTER (WHERE details::text ~* '"[0-9]+ ?(bis|ter|qu[aá]ter|quinquies|sexies)"') con_bis,
           count(*) total
    FROM content_health_findings WHERE kind='article_no_coverage'`);
  console.log('hallazgos cuyos ejemplos incluyen un artículo de REFORMA:', bis.rows[0]);
  await c.end();
})();
