require('dotenv').config({ path: '.env.local' });
const sql = require('postgres')(process.env.DATABASE_URL, { prepare: false, max: 1 });
(async () => {
  const cols = await sql`SELECT column_name FROM information_schema.columns WHERE table_name='test_questions' ORDER BY ordinal_position`;
  console.log(cols.map(c=>c.column_name).join(', '));
  const rows = await sql`
    SELECT * FROM test_questions
    WHERE question_id='0e11c464-3bbe-4203-8286-6686916b78d5'
      AND user_id='75e32f96-358b-4623-91ea-246a3a890d91' ORDER BY created_at DESC`;
  for (const r of rows) {
    const {id, created_at, user_answer, correct_answer, is_correct, option_order, question_text} = r;
    console.log('---', created_at.toISOString(), {user_answer, correct_answer, is_correct, option_order});
  }
  await sql.end();
})();
