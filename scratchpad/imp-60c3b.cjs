require('dotenv').config({ path: '.env.local' });
const { Client } = require('pg');
const { pgConfig } = require('../lib/db/pgSsl.cjs');
(async () => {
  const c = new Client(pgConfig(process.env.DATABASE_URL));
  await c.connect();
  const d = await c.query(`SELECT question_id FROM question_disputes WHERE id='60c31b51-0018-4a88-8d55-59e5b2bd5d25'`);
  console.log('QID impugnada:', d.rows[0].question_id);
  for (const id of ['32907437','fb8980ad']) {
    const { rows } = await c.query(`SELECT id, left(regexp_replace(question_text,'\\s+',' ','g'),120) q, explanation FROM questions WHERE id::text LIKE $1||'%'`, [id]);
    for (const r of rows) {
      console.log('\n── ' + r.id + (r.id === d.rows[0].question_id ? '  ← LA IMPUGNADA' : ''));
      console.log('   Q: ' + r.q);
      const m = r.explanation.replace(/\s+/g,' ').match(/.{0,160}(tres años|3 años).{0,120}/i);
      console.log('   frag: …' + (m ? m[0] : '') + '…');
    }
  }
  await c.end();
})();
