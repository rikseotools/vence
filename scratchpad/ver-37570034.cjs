require('dotenv').config({ path: '.env.local' });
const { Client } = require('pg');
const { pgConfig } = require('../lib/db/pgSsl.cjs');
(async () => {
  const c = new Client(pgConfig(process.env.DATABASE_URL));
  await c.connect();
  const { rows } = await c.query(`SELECT id, question_text, option_a, option_b, option_c, option_d, correct_option, explanation, is_official_exam FROM questions WHERE id::text LIKE '37570034%' OR id=(SELECT question_id FROM question_disputes WHERE id='c7ade8a3-1c85-4e84-a870-f9b6d0e78e88')`);
  for (const r of rows) {
    console.log('\n── ' + r.id + ' | oficial=' + r.is_official_exam);
    console.log('Q: ' + r.question_text.replace(/\s+/g,' '));
    ['a','b','c','d'].forEach((l,i)=>console.log(`  ${l.toUpperCase()})${i===r.correct_option?' ✅':''} ${r['option_'+l]}`));
    console.log('EXPL: ' + r.explanation.replace(/\s+/g,' '));
  }
  await c.end();
})();
