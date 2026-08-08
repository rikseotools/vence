require('dotenv').config({ path: '.env.local' });
const { Client } = require('pg');
const { pgConfig } = require('../lib/db/pgSsl.cjs');
(async () => {
  const c = new Client(pgConfig(process.env.DATABASE_URL));
  await c.connect();
  const d = await c.query(`SELECT question_id FROM question_disputes WHERE id=$1`, ['3d3dd74e-b5e6-467b-af11-521443c398a1']);
  const qid = d.rows[0].question_id;
  const qq = await c.query(`SELECT q.id, q.is_official_exam, (q.explanation_data IS NOT NULL) AS tiene_estructura, q.shuffle_safety, q.exam_source, q.tags,
      a.article_number, a.title, a.content, l.short_name, l.boe_url
     FROM questions q LEFT JOIN articles a ON a.id=q.primary_article_id LEFT JOIN laws l ON l.id=a.law_id WHERE q.id=$1`, [qid]);
  const r = qq.rows[0];
  console.log('QID', qid);
  console.log(JSON.stringify({ oficial: r.is_official_exam, estructura: r.tiene_estructura, shuffle: r.shuffle_safety, exam_source: r.exam_source, tags: r.tags, ley: r.short_name, art: r.article_number, boe: r.boe_url }, null, 1));
  console.log('\n=== ARTÍCULO ' + r.article_number + ' — ' + r.title + ' ===\n' + r.content);
  await c.end();
})();
