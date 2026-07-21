require('dotenv').config({ path: '.env.local' });
const sql = require('postgres')(process.env.DATABASE_URL,{prepare:false,max:1,ssl:{rejectUnauthorized:false}});

(async () => {
  const tag = 'gen_celador_murcia_t13_reprografia_2026-07-21';
  const qs = await sql`
    SELECT id, question_text, option_a, option_b, option_c, option_d,
           correct_option, explanation, primary_article_id, lifecycle_state, tags
    FROM questions
    WHERE ${tag} = ANY(tags)
    ORDER BY id`;
  console.log('COUNT:', qs.length);
  for (const q of qs) {
    console.log('\n==================================================');
    console.log('ID:', q.id.slice(0,8), '| lifecycle:', q.lifecycle_state, '| art:', q.primary_article_id);
    console.log('Q:', q.question_text);
    console.log('A:', q.option_a);
    console.log('B:', q.option_b);
    console.log('C:', q.option_c);
    console.log('D:', q.option_d);
    console.log('CORRECT:', q.correct_option, '=', ['A','B','C','D'][q.correct_option]);
    console.log('EXPL:', q.explanation);
    // load article
    if (q.primary_article_id) {
      const [art] = await sql`SELECT id, article_number, title, content FROM articles WHERE id=${q.primary_article_id}`;
      if (art) {
        console.log('--- ARTICLE', art.article_number, '|', art.title, '---');
        console.log(art.content);
      } else {
        console.log('--- ARTICLE NOT FOUND ---');
      }
    }
  }
  await sql.end();
})().catch(e=>{console.error(e);process.exit(1)});
