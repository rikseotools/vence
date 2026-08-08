const { Client } = require('pg');
(async () => {
  const c = new Client({ connectionString: process.env.DATABASE_URL.replace(/[?&]sslmode=[^&]*/,''), ssl:{rejectUnauthorized:false} });
  await c.connect();
  const r = await c.query(`
    SELECT a.article_number,
      (SELECT count(*) FROM questions q WHERE q.primary_article_id=a.id AND q.is_active) act
    FROM articles a JOIN laws l ON l.id=a.law_id
    WHERE l.slug='lo-3-2018' AND a.article_number = ANY($1) ORDER BY a.article_number`, [['26','53 bis','61','62']]);
  console.log('preguntas activas por artículo:'); for(const x of r.rows) console.log('  art', x.article_number, '→', x.act);
  await c.end();
})();
