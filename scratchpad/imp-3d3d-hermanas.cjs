require('dotenv').config({ path: '.env.local' });
const { Client } = require('pg');
const { pgConfig } = require('../lib/db/pgSsl.cjs');
(async () => {
  const c = new Client(pgConfig(process.env.DATABASE_URL));
  await c.connect();
  const { rows } = await c.query(`
    SELECT q.id, q.question_text, q.option_a, q.option_b, q.option_c, q.option_d, q.correct_option, q.explanation, q.tags
    FROM questions q
    WHERE q.primary_article_id = (SELECT primary_article_id FROM questions WHERE id='4da2101b-f471-4597-8893-864859b9b112')
      AND q.is_active = true ORDER BY q.created_at`);
  for (const r of rows) {
    console.log('\n───────── ' + r.id.slice(0,8) + ' | tags=' + JSON.stringify(r.tags));
    console.log('Q: ' + r.question_text);
    ['a','b','c','d'].forEach((l,i) => { const v = r['option_'+l]; if (v) console.log(`  ${l.toUpperCase()})${i===r.correct_option?' ✅':''} ${v}`); });
    console.log('EXPL: ' + (r.explanation||'(vacía)').replace(/\n+/g,' ⏎ ').slice(0,700));
  }
  console.log('\nTOTAL: ' + rows.length);
  await c.end();
})();
