require('dotenv').config({ path: '.env.local' });
const { Client } = require('pg');
const { pgConfig } = require('../lib/db/pgSsl.cjs');
(async () => {
  const c = new Client(pgConfig(process.env.DATABASE_URL));
  await c.connect();
  const { rows } = await c.query(`SELECT q.id, left(regexp_replace(q.question_text,'\\s+',' ','g'),95) txt, q.correct_option,
      q.option_a, q.option_b, q.option_c, q.option_d, (SELECT count(*)::int FROM test_questions t WHERE t.question_id=q.id) servida
    FROM questions q WHERE q.is_active AND q.question_text ~* '(incorrecta|falsa|no es cierta)'
      AND q.primary_article_id=(SELECT primary_article_id FROM questions WHERE id=(SELECT question_id FROM question_disputes WHERE id='42b80516-9f43-4bb8-b8bc-5fda737221f9'))`);
  for (const r of rows) {
    console.log(`\n${r.id.slice(0,8)} | ${r.servida}x | ${r.txt}`);
    ['a','b','c','d'].forEach((l,i)=>{ const v=r['option_'+l]; if(v) console.log(`   ${l.toUpperCase()})${i===r.correct_option?' ← señalada':''} ${v.replace(/\s+/g,' ').slice(0,120)}`); });
  }
  await c.end();
})();
