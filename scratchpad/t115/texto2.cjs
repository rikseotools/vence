const { Client } = require('pg');
(async () => {
  const c = new Client({ connectionString: process.env.DATABASE_URL.replace(/[?&]sslmode=[^&]*/,''), ssl:{rejectUnauthorized:false} });
  await c.connect();
  const r = await c.query(`SELECT a.article_number, a.title, a.content FROM articles a JOIN laws l ON l.id=a.law_id
    WHERE l.slug='ley-9-2017' AND a.article_number = ANY($1) ORDER BY a.article_number::int`, [['146','148']]);
  for (const x of r.rows) console.log('\n===== ART '+x.article_number+' — '+x.title+' =====\n'+x.content);
  await c.end();
})();
