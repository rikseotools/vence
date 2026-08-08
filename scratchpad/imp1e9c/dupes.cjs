require('dotenv').config({ path: '.env.local' });
const { pgConfig } = require('/home/manuel/Documentos/github/vence/lib/db/pgSsl.cjs');
const { Client } = require('pg');
(async () => {
  const c = new Client(pgConfig());
  await c.connect();
  const qid = (await c.query(`SELECT question_id FROM question_disputes WHERE id='1e9c09f6-b0c1-4d86-bc16-871c9c73777c'`)).rows[0].question_id;
  console.log('question_id de la impugnación:', qid);
  const r = await c.query(`SELECT id, lifecycle_state, is_active, correct_option, question_text, option_a, option_b, option_c, option_d, explanation
    FROM questions WHERE question_text ILIKE '%no contemplen un supuesto específico%'`);
  console.log('Preguntas con ese enunciado:', r.rows.length);
  for (const x of r.rows) {
    console.log('\n---', x.id, x.lifecycle_state, 'activa=' + x.is_active, 'clave=' + x.correct_option, x.id === qid ? '  ← LA IMPUGNADA' : '');
    console.log('  Q:', x.question_text.replace(/\s+/g,' '));
    console.log('  A:', x.option_a); console.log('  B:', x.option_b); console.log('  C:', x.option_c); console.log('  D:', x.option_d);
  }
  await c.end();
})();
