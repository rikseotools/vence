require('dotenv').config({ path: '.env.local' });
const postgres = require('postgres');
const sql = postgres(process.env.DATABASE_URL, { prepare: false, max: 1 });
const QID = '9ae2b4d5';
(async () => {
  const [d] = await sql`SELECT * FROM question_disputes WHERE id='8e9142c0-5371-481d-9047-00a583ed3cc3'`;
  console.log('DISPUTE:', { qid: d.question_id, uid: d.user_id, created: d.created_at, type: d.dispute_type, src: d.source });
  const [u] = await sql`SELECT id, full_name, email, plan_type, target_oposicion, created_at FROM user_profiles WHERE id=${d.user_id}`;
  console.log('USER:', u);
  const tq = await sql`
    SELECT tq.id, tq.created_at, tq.user_answer, tq.is_correct, tq.option_order, tq.test_id
    FROM test_questions tq WHERE tq.question_id=${d.question_id} AND tq.user_id=${d.user_id}
    ORDER BY tq.created_at DESC LIMIT 10`;
  console.log('EXPOSICIONES:', tq);
  const [q] = await sql`SELECT id, correct_option, option_a, option_b, option_c, option_d, is_official_exam, primary_article_id, lifecycle_state, shuffle_safety, explanation_data IS NOT NULL AS has_struct, tags, exam_source FROM questions WHERE id=${d.question_id}`;
  console.log('QUESTION:', q);
  await sql.end();
})();
