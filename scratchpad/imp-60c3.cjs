require('dotenv').config({ path: '.env.local' });
const { Client } = require('pg');
const { pgConfig } = require('../lib/db/pgSsl.cjs');
(async () => {
  const c = new Client(pgConfig(process.env.DATABASE_URL));
  await c.connect();
  const art = await c.query(`SELECT a.article_number, a.content FROM articles a JOIN laws l ON l.id=a.law_id
    WHERE l.short_name='Ley 39/2015' AND a.article_number='125' AND a.is_active`);
  console.log('=== ART. 125 ===\n' + (art.rows[0]?.content||'NO ENCONTRADO').slice(0, 1400));
  // explicaciones activas que hablan del recurso extraordinario de revisión y dicen "años"
  const { rows } = await c.query(`SELECT q.id, left(regexp_replace(q.explanation,'\\s+',' ','g'),0) x,
      substring(regexp_replace(q.explanation,'\\s+',' ','g') from '.{0,90}(tres años|3 años).{0,60}') frag,
      (SELECT count(*)::int FROM test_questions t WHERE t.question_id=q.id) servida
    FROM questions q
    WHERE q.is_active AND q.explanation ~* '(tres años|3 años)'
      AND (q.explanation ~* 'revisi[óo]n' AND q.explanation ~* 'recurso')`);
  console.log('\nExplicaciones activas que mezclan "años" con el recurso de revisión: ' + rows.length);
  for (const r of rows.slice(0,15)) console.log(`  ${r.id.slice(0,8)} | ${r.servida}x | …${(r.frag||'').trim()}…`);
  await c.end();
})();
