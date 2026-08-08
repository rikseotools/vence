require('dotenv').config({ path: '.env.local' });
const sql = require('postgres')(process.env.DATABASE_URL, { prepare: false, max: 1 });
(async () => {
  const rows = await sql`
    SELECT tq.id, tq.option_order,
           ARRAY(SELECT jsonb_array_elements_text(tq.full_question_context->'options')) AS ctx,
           ARRAY[q.option_a,q.option_b,q.option_c,q.option_d,q.option_e] AS bd
    FROM test_questions tq JOIN questions q ON q.id=tq.question_id
    WHERE tq.option_order IS NOT NULL AND tq.option_order <> ARRAY[0,1,2,3]`;
  let comoMostrado = 0, comoNatural = 0;
  for (const r of rows) {
    const okMostrado = r.option_order.every((orig, i) => r.ctx[i] === r.bd[orig]);
    const okNatural  = r.option_order.every((_, i) => r.ctx[i] === r.bd[i]);
    if (okMostrado) comoMostrado++;
    if (okNatural) comoNatural++;
  }
  console.log('filas barajadas:', rows.length);
  console.log('  casan con el orden MOSTRADO (lo que asume el arreglo):', comoMostrado);
  console.log('  casan con el orden NATURAL de la BD (lo que rompería):', comoNatural);
  await sql.end();
})();
