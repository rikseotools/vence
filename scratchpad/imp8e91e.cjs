require('dotenv').config({ path: '.env.local' });
const sql = require('postgres')(process.env.DATABASE_URL, { prepare: false, max: 1 });
(async () => {
  const rows = await sql`
    SELECT created_at, user_answer, correct_answer, option_order, full_question_context
    FROM test_questions
    WHERE question_id='0e11c464-3bbe-4203-8286-6686916b78d5'
      AND user_id='75e32f96-358b-4623-91ea-246a3a890d91' ORDER BY created_at DESC`;
  for (const r of rows) {
    console.log('===', r.created_at.toISOString(), r.user_answer, r.correct_answer, JSON.stringify(r.option_order));
    console.log(JSON.stringify(r.full_question_context).slice(0, 1200));
  }
  await sql.end();
})();
