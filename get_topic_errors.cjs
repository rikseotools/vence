const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const topicNumber = parseInt(process.argv[2]) || 12;

async function main() {
  const errorStates = [
    'bad_answer', 'bad_explanation', 'bad_answer_and_explanation',
    'wrong_article', 'wrong_article_bad_explanation', 'wrong_article_bad_answer', 'all_wrong',
    'tech_bad_answer', 'tech_bad_explanation', 'tech_bad_answer_and_explanation'
  ];

  const { data: topic } = await supabase
    .from('topics')
    .select('id, topic_number, title')
    .eq('position_type', 'auxiliar_administrativo')
    .eq('topic_number', topicNumber)
    .single();

  if (!topic) {
    console.log('No se encontró el topic T' + topicNumber);
    return;
  }

  console.log('Topic:', topic.title);

  const { data: scope } = await supabase
    .from('topic_scope')
    .select('law_id, article_numbers')
    .eq('topic_id', topic.id);

  let articleIds = [];
  for (const s of scope || []) {
    if (!s.article_numbers || s.article_numbers.length === 0) continue;
    const { data: arts } = await supabase
      .from('articles')
      .select('id')
      .eq('law_id', s.law_id)
      .in('article_number', s.article_numbers);
    if (arts) articleIds.push(...arts.map(a => a.id));
  }

  const { data: questions } = await supabase
    .from('questions')
    .select(`
      id, question_text, option_a, option_b, option_c, option_d,
      correct_option, explanation, topic_review_status, primary_article_id,
      articles(id, article_number, title, content, laws(short_name))
    `)
    .eq('is_active', true)
    .in('primary_article_id', articleIds)
    .in('topic_review_status', errorStates);

  console.log('Preguntas con errores:', questions?.length || 0);

  const output = (questions || []).map(q => ({
    id: q.id,
    question_text: q.question_text,
    option_a: q.option_a,
    option_b: q.option_b,
    option_c: q.option_c,
    option_d: q.option_d,
    correct_option: q.correct_option,
    correct_letter: ['A', 'B', 'C', 'D'][q.correct_option],
    explanation: q.explanation,
    topic_review_status: q.topic_review_status,
    article_number: q.articles?.article_number,
    article_content: q.articles?.content,
    law_short_name: q.articles?.laws?.short_name
  }));

  const filename = 't' + topicNumber + '_errors.json';
  require('fs').writeFileSync(filename, JSON.stringify(output, null, 2));
  console.log('Guardado en:', filename);
}

main().catch(console.error);
