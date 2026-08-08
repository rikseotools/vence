require('dotenv').config({ path: '.env.local' });
const sql = require('postgres')(process.env.DATABASE_URL, { prepare: false, max: 1 });
(async () => {
  const rows = await sql`
    SELECT id, created_at, user_answer, correct_answer, is_correct, option_order,
           question_text, options, tema_number
    FROM test_questions
    WHERE question_id='0e11c464-3bbe-4203-8286-6686916b78d5'
      AND user_id='75e32f96-358b-4623-91ea-246a3a890d91'
    ORDER BY created_at DESC`;
  for (const r of rows) {
    console.log('---', r.created_at.toISOString(), 'user_answer=', r.user_answer, 'correct_answer=', r.correct_answer, 'is_correct=', r.is_correct, 'order=', JSON.stringify(r.option_order));
    console.log('   options guardadas:', JSON.stringify(r.options));
  }
  await sql.end();
})();
