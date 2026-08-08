require('dotenv').config({ path: '.env.local' });
const { Client } = require('pg');
const { pgConfig } = require('../lib/db/pgSsl.cjs');
(async () => {
  const c = new Client(pgConfig(process.env.DATABASE_URL));
  await c.connect();
  const { rows } = await c.query(`SELECT q.id, left(regexp_replace(q.question_text,'\\s+',' ','g'),90) txt,
      substring(regexp_replace(q.explanation,'\\s+',' ','g') from '.{0,110}(al año|un año|1 año).{0,60}') frag,
      (SELECT count(*)::int FROM test_questions t WHERE t.question_id=q.id) servida
    FROM questions q JOIN articles a ON a.id=q.primary_article_id
    WHERE q.is_active AND a.law_id='2d7d6f10-c38c-44a2-8ff3-1f8805e9f9a2'
      AND q.explanation ~* 'prescrib' AND q.explanation ~* '(al año|un año|1 año)'`);
  console.log('preguntas de la Ley 1/1986 CM cuya explicación mezcla prescripción con "año": ' + rows.length);
  for (const r of rows) console.log(`  ${r.id.slice(0,8)} | ${r.servida}x | ${r.txt}\n     …${(r.frag||'').trim()}…`);
  await c.end();
})();
