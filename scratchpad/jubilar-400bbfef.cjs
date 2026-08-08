require('dotenv').config({ path: '.env.local' });
const { Client } = require('pg');
const { pgConfig } = require('../lib/db/pgSsl.cjs');
const DUP = '400bbfef-6119-411f-b1c6-7182c99a6f01';
const KEEP = 'c4d6f353-1639-4056-ac4d-b92eb9881b7e';
(async () => {
  const c = new Client(pgConfig(process.env.DATABASE_URL));
  await c.connect();
  const antes = (await c.query('SELECT lifecycle_state, is_active FROM questions WHERE id=$1', [DUP])).rows[0];
  console.log('ANTES:', JSON.stringify(antes));
  await c.query(`SELECT public.transition_question_state($1::uuid, $2::text, $3::text, $4::text, $5::uuid, NULL::uuid, $6::text)`,
    [DUP, antes.lifecycle_state, 'retired_duplicate', 'admin_duplicate_of', '2fc60bc8-1f9a-42c8-9c60-845c00af4a1f',
     `Impugnación 28745372: duplicada de ${KEEP} (mismo enunciado, opciones movidas). Ambas salieron en el mismo test (nº 9 y nº 23). Se conserva la más servida.`]);
  const despues = (await c.query('SELECT lifecycle_state, is_active FROM questions WHERE id=$1', [DUP])).rows[0];
  console.log('DESPUÉS:', JSON.stringify(despues));
  const h = (await c.query('SELECT to_state, reason_code, changed_at FROM question_lifecycle_history WHERE question_id=$1 ORDER BY changed_at DESC LIMIT 1', [DUP])).rows[0];
  console.log('HISTORY:', JSON.stringify(h));
  await c.end();
})();
