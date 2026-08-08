const { Client } = require('pg');
(async () => {
  const c = new Client({ connectionString: process.env.DATABASE_URL.replace(/[?&]sslmode=[^&]*/,''), ssl:{rejectUnauthorized:false} });
  await c.connect();
  const r = await c.query(`SELECT a.article_number, a.title, a.content FROM articles a JOIN laws l ON l.id=a.law_id
    WHERE l.short_name='RD 203/2021' AND a.article_number IN ('46','47','48','53','54','55','41','42')
    ORDER BY a.article_number::int`);
  for (const x of r.rows) console.log('\n===== ART '+x.article_number+' — '+x.title+' =====\n'+x.content.slice(0,1600));
  await c.end();
})();
