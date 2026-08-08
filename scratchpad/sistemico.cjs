require('dotenv').config({ path: '.env.local' });
const { pgConfig } = require('/home/manuel/Documentos/github/vence/lib/db/pgSsl.cjs');
const { Client } = require('pg');
(async () => {
  const c = new Client(pgConfig());
  await c.connect();
  const r = await c.query(`SELECT q.id, q.question_text, q.correct_option, q.lifecycle_state
    FROM questions q WHERE q.primary_article_id=(SELECT primary_article_id FROM questions WHERE id='0b206d6f-2a8c-4124-9d8b-7f719e6d6496')
    AND q.is_active=true ORDER BY q.question_text`);
  console.log('Preguntas activas en art 95:', r.rows.length);
  for (const x of r.rows) console.log('-', x.id.slice(0,8), '|', x.question_text.replace(/\s+/g,' ').slice(0,150));
  await c.end();
})();
