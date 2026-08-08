const { Client } = require('pg');
(async () => {
  const c = new Client({ connectionString: process.env.DATABASE_URL.replace(/[?&]sslmode=[^&]*/,''), ssl:{rejectUnauthorized:false} });
  await c.connect();
  const r = await c.query(`
    SELECT a.id, a.article_number, a.title, a.is_active, length(a.content) AS len,
           (SELECT count(*) FROM questions q WHERE q.primary_article_id=a.id AND q.is_active) AS act,
           (SELECT count(*) FROM questions q WHERE q.primary_article_id=a.id) AS tot
    FROM articles a JOIN laws l ON l.id=a.law_id
    WHERE l.short_name='RD 203/2021' AND a.article_number IN ('49','50','51','52','53')
    ORDER BY a.article_number::int`);
  console.table(r.rows);
  const s = await c.query(`SELECT t.position_type, t.topic_number, ts.article_numbers
    FROM topic_scope ts JOIN topics t ON t.id=ts.topic_id JOIN laws l ON l.id=ts.law_id
    WHERE l.short_name='RD 203/2021' ORDER BY t.position_type, t.topic_number`);
  for (const x of s.rows) console.log(x.position_type, 'T'+x.topic_number, JSON.stringify(x.article_numbers)?.slice(0,200));
  const cont = await c.query(`SELECT a.article_number, a.content FROM articles a JOIN laws l ON l.id=a.law_id WHERE l.short_name='RD 203/2021' AND a.article_number IN ('50','52')`);
  for (const x of cont.rows) { console.log('\n===== ART '+x.article_number+' =====\n'+x.content); }
  await c.end();
})();
