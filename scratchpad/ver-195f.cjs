require('dotenv').config({ path: '.env.local' });
const { Client } = require('pg');
const { pgConfig } = require('../lib/db/pgSsl.cjs');
(async () => {
  const c = new Client(pgConfig(process.env.DATABASE_URL));
  await c.connect();
  const { rows } = await c.query(`SELECT id, question_text, option_a, option_b, option_c, option_d, correct_option, explanation FROM questions WHERE id::text LIKE '195f8f35%'`);
  const r = rows[0];
  console.log('Q: ' + r.question_text.replace(/\s+/g,' '));
  ['a','b','c','d'].forEach((l,i)=>console.log(`  ${l.toUpperCase()})${i===r.correct_option?' ✅':''} ${(r['option_'+l]||'').replace(/\s+/g,' ').slice(0,150)}`));
  console.log('\nEXPL:\n' + r.explanation);
  await c.end();
})();
