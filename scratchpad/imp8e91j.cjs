require('dotenv').config({ path: '.env.local' });
const sql = require('postgres')(process.env.DATABASE_URL, { prepare: false, max: 1 });
(async () => {
  const r = await sql`
    SELECT t.test_type, count(*)::int AS filas, count(DISTINCT t.id)::int AS tests
    FROM test_questions tq JOIN tests t ON t.id=tq.test_id
    WHERE tq.option_order IS NOT NULL AND tq.option_order <> ARRAY[0,1,2,3]
    GROUP BY 1 ORDER BY 2 DESC`;
  console.log('tipos de test con barajado:', r);
  const psy = await sql`
    SELECT count(*)::int FROM test_questions
    WHERE option_order IS NOT NULL AND psychometric_question_id IS NOT NULL`;
  console.log('psicotécnicas con option_order:', psy[0]);
  const lens = await sql`
    SELECT array_length(option_order,1) AS n, count(*)::int
    FROM test_questions WHERE option_order IS NOT NULL GROUP BY 1`;
  console.log('longitudes de option_order:', lens);
  await sql.end();
})();
