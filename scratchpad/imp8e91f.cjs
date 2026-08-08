require('dotenv').config({ path: '.env.local' });
const sql = require('postgres')(process.env.DATABASE_URL, { prepare: false, max: 1 });
(async () => {
  const [tot] = await sql`
    SELECT count(*)::int AS filas,
           count(*) FILTER (WHERE option_order IS NOT NULL)::int AS con_orden,
           count(*) FILTER (WHERE option_order IS NOT NULL AND option_order <> ARRAY[0,1,2,3])::int AS barajadas,
           count(DISTINCT user_id) FILTER (WHERE option_order IS NOT NULL AND option_order <> ARRAY[0,1,2,3]) AS usuarios,
           min(created_at) FILTER (WHERE option_order IS NOT NULL) AS desde
    FROM test_questions WHERE created_at > now() - interval '30 days'`;
  console.log('30d:', tot);
  const porDia = await sql`
    SELECT date_trunc('day', created_at)::date AS dia, count(*)::int AS barajadas, count(DISTINCT user_id)::int AS users
    FROM test_questions
    WHERE option_order IS NOT NULL AND option_order <> ARRAY[0,1,2,3]
    GROUP BY 1 ORDER BY 1`;
  console.log('por día:', porDia);
  // ¿cuántas de esas filas tienen full_question_context.options (=orden mostrado) guardado?
  const [ctx] = await sql`
    SELECT count(*)::int AS con_ctx
    FROM test_questions
    WHERE option_order IS NOT NULL AND option_order <> ARRAY[0,1,2,3]
      AND jsonb_array_length(COALESCE(full_question_context->'options','[]'::jsonb)) > 0`;
  console.log('con options en contexto:', ctx);
  await sql.end();
})();
