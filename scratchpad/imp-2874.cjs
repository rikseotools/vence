require('dotenv').config({ path: '.env.local' });
const { Client } = require('pg');
const { pgConfig } = require('../lib/db/pgSsl.cjs');
(async () => {
  const c = new Client(pgConfig(process.env.DATABASE_URL));
  await c.connect();
  const d = await c.query(`SELECT question_id, user_id FROM question_disputes WHERE id='28745372-8564-450a-a506-54900118bbb7'`);
  const QID = d.rows[0].question_id;
  const { rows } = await c.query(`SELECT id, question_text, option_a, option_b, option_c, option_d, correct_option, explanation, lifecycle_state, created_at, exam_source, is_official_exam,
     (SELECT count(*)::int FROM test_questions t WHERE t.question_id=q.id) servida FROM questions q WHERE id = ANY($1)`,
     [[QID, '400bbfef-0000-0000-0000-000000000000']]);
  // el id corto: buscar por prefijo
  const { rows: gemelas } = await c.query(`SELECT id, option_a, option_b, option_c, option_d, correct_option, lifecycle_state, created_at, exam_source, is_official_exam, left(explanation, 220) expl,
      (SELECT count(*)::int FROM test_questions t WHERE t.question_id=q.id) servida
    FROM questions q WHERE q.question_text ILIKE '%evaluación del cumplimiento de los planes y programas anuales y plurianuales%' AND q.is_active`);
  for (const g of gemelas) {
    console.log(`\n── ${g.id}${g.id===QID?'  ← LA IMPUGNADA':''} | servida ${g.servida}x | ${g.created_at.toISOString().slice(0,10)} | fuente=${g.exam_source||'-'} | oficial=${g.is_official_exam} | ${g.lifecycle_state}`);
    ['a','b','c','d'].forEach((l,i) => console.log(`   ${l.toUpperCase()})${i===g.correct_option?' ✅':''} ${g['option_'+l]}`));
    console.log('   expl: ' + (g.expl||'').replace(/\n+/g,' ⏎ '));
  }
  // ¿coincidieron en el mismo test de Adrián?
  const t = await c.query(`SELECT test_id, question_id, question_order FROM test_questions
     WHERE user_id=$1 AND question_id = ANY($2) ORDER BY created_at DESC LIMIT 10`, [d.rows[0].user_id, gemelas.map(g=>g.id)]);
  console.log('\nExposiciones a Adrián:'); for (const r of t.rows) console.log('   test ' + r.test_id.slice(0,8) + ' · nº' + r.question_order + ' · ' + r.question_id.slice(0,8));
  await c.end();
})();
