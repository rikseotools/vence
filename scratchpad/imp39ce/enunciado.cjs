require('dotenv').config({ path: '.env.local' });
const { pgConfig } = require('/home/manuel/Documentos/github/vence/lib/db/pgSsl.cjs');
const { Client } = require('pg');
const QID='3edfd052-1ad0-4ae6-8602-79d148cd8309';
const NUEVO='De acuerdo con la Ley 39/2015 del Procedimiento Administrativo Común de las Administraciones Públicas, señale la respuesta INCORRECTA. Toda notificación deberá contener:';
(async () => {
  const c = new Client(pgConfig());
  await c.connect();
  console.log('ANTES:', (await c.query(`SELECT question_text FROM questions WHERE id=$1`,[QID])).rows[0].question_text);
  await c.query(`UPDATE questions SET question_text=$2, updated_at=now() WHERE id=$1`,[QID,NUEVO]);
  console.log('DESPUÉS:', (await c.query(`SELECT question_text FROM questions WHERE id=$1`,[QID])).rows[0].question_text);
  await c.end();
})();
