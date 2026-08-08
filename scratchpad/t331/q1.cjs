const { Client } = require('pg');
(async () => {
  const c = new Client({ connectionString: process.env.DATABASE_URL.replace(/[?&]sslmode=[^&]*/,''), ssl:{rejectUnauthorized:false} });
  await c.connect();
  const r = await c.query(`
    SELECT a.id, a.article_number, a.title, a.is_active, length(a.content) AS len,
           (SELECT count(*) FROM questions q WHERE q.primary_article_id=a.id AND q.is_active) AS preg_activas,
           (SELECT count(*) FROM questions q WHERE q.primary_article_id=a.id) AS preg_total
    FROM articles a JOIN laws l ON l.id=a.law_id
    WHERE l.short_name='RD 203/2021' AND a.article_number IN ('50','51','52','49')
    ORDER BY a.article_number::int`);
  console.table(r.rows);
  const s = await c.query(`SELECT ts.topic_id, t.topic_number, ts.article_numbers FROM topic_scope ts JOIN topics t ON t.id=ts.topic_id JOIN laws l ON l.id=ts.law_id WHERE ts.position_type='auxiliar_administrativo_sms' AND l.short_name='RD 203/2021'`);
  console.log(JSON.stringify(s.rows, null, 1));
  await c.end();
})();
