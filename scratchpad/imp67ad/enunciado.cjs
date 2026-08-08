require('dotenv').config({ path: '.env.local' });
const { pgConfig } = require('/home/manuel/Documentos/github/vence/lib/db/pgSsl.cjs');
const { Client } = require('pg');
const NUEVO = 'De acuerdo con la Ley 39/2015, ¿cuál de las siguientes afirmaciones sobre los efectos de la caducidad del procedimiento NO es correcta?';
(async () => {
  const c = new Client(pgConfig());
  await c.connect();
  const before = await c.query(`SELECT question_text FROM questions WHERE id='0b206d6f-2a8c-4124-9d8b-7f719e6d6496'`);
  console.log('ANTES:', before.rows[0].question_text);
  await c.query(`UPDATE questions SET question_text=$1, updated_at=now() WHERE id='0b206d6f-2a8c-4124-9d8b-7f719e6d6496'`, [NUEVO]);
  const after = await c.query(`SELECT question_text FROM questions WHERE id='0b206d6f-2a8c-4124-9d8b-7f719e6d6496'`);
  console.log('DESPUÉS:', after.rows[0].question_text);
  await c.end();
})();
