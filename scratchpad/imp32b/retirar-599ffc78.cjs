require('dotenv').config({ path: '.env.local' });
const postgres = require('postgres');
const sql = postgres(process.env.DATABASE_URL, { prepare: false, max: 1 });

const QID = '599ffc78-5753-4dd1-b472-d655a519921c';
const NOTES = 'Impugnación 32b0d55e (Laura Zurdo): clave errónea — 65.535 es el máximo de un campo Texto largo por interfaz, no lo que los controles pueden MOSTRAR (64.000). Duplicada de 8dd97c48-2628-44a1-a92d-96cb7ff6872c, que tiene la clave correcta.';

(async () => {
  try {
    const [before] = await sql`SELECT lifecycle_state, is_active FROM public.questions WHERE id = ${QID}`;
    console.log('ANTES:', before);
    await sql`
      SELECT public.transition_question_state(
        ${QID}::uuid,
        ${before.lifecycle_state}::text,
        'retired_duplicate'::text,
        'admin_duplicate_of'::text,
        '2fc60bc8-1f9a-42c8-9c60-845c00af4a1f'::uuid,
        NULL::uuid,
        ${NOTES}::text
      )`;
    const [after] = await sql`SELECT lifecycle_state, is_active FROM public.questions WHERE id = ${QID}`;
    console.log('DESPUÉS:', after);
    const [h] = await sql`
      SELECT to_state, reason_code, changed_at FROM public.question_lifecycle_history
      WHERE question_id = ${QID} ORDER BY changed_at DESC LIMIT 1`;
    console.log('HISTORY:', h);
  } catch (e) {
    console.error('ERROR:', e.message);
  } finally {
    await sql.end();
  }
})();
