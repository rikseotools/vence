require('dotenv').config({ path: '.env.local' });
const { pgConfig } = require('/home/manuel/Documentos/github/vence/lib/db/pgSsl.cjs');
const { Client } = require('pg');
(async () => {
  const c = new Client(pgConfig());
  await c.connect();
  const qid = (await c.query(`SELECT question_id FROM question_disputes WHERE id='39ce6e4e-bb27-4e7d-947a-2884481b0d25'`)).rows[0].question_id;
  console.log('qid:', qid);
  const r = await c.query(`SELECT id, correct_option, lifecycle_state, question_text, option_a, option_b, option_c, option_d
    FROM questions WHERE is_active=true
      AND (option_a ILIKE '%viabilidad del recurso%' OR option_b ILIKE '%viabilidad del recurso%'
        OR option_c ILIKE '%viabilidad del recurso%' OR option_d ILIKE '%viabilidad del recurso%')`);
  console.log('Activas con el distractor «viabilidad del recurso»:', r.rows.length);
  for (const x of r.rows) console.log(' -', x.id.slice(0,8), 'clave='+x.correct_option, '|', x.question_text.replace(/\s+/g,' ').slice(0,120));
  await c.end();
})();
