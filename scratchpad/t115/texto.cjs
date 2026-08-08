const { Client } = require('pg');
(async () => {
  const c = new Client({ connectionString: process.env.DATABASE_URL.replace(/[?&]sslmode=[^&]*/,''), ssl:{rejectUnauthorized:false} });
  await c.connect();
  const r = await c.query(`SELECT a.article_number, a.title, a.content FROM articles a JOIN laws l ON l.id=a.law_id
    WHERE l.slug='lo-3-2018' AND a.article_number = ANY($1)`, [['26','61','62','53 bis']]);
  const ord={'26':1,'53 bis':2,'61':3,'62':4};
  r.rows.sort((a,b)=>ord[a.article_number]-ord[b.article_number]);
  for (const x of r.rows) console.log('\n===== ART '+x.article_number+' — '+x.title+' =====\n'+x.content);
  await c.end();
})();
