require("dotenv").config({ path: ".env.local" });
const { createClient } = require("@supabase/supabase-js");
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

(async () => {
  // Get the full conversation (4 messages about Defensor del Pueblo)
  const logIds = [
    '2d2d889f-625d-466b-8ed4-2516ec35e664', // first message
    '35cb392a-8d47-45bb-b947-76b1b7328329', // "y cual es esa ley?"
    '31e81237-064e-4033-86c8-a78030d7343c', // "estas seguro?"
    'dbeb78e0-9759-4dc1-9a8d-e0b31eebb47e', // "y la renuncia por que no es?"
  ];

  for (const logId of logIds) {
    const { data: log } = await supabase
      .from('ai_chat_logs')
      .select('message, full_response, question_context_law, question_context_id')
      .eq('id', logId)
      .single();

    console.log('===================================');
    console.log('USER:', log.message);
    console.log('LAW:', log.question_context_law);
    console.log('QUESTION ID:', log.question_context_id);
    console.log('AI RESPONSE:');
    console.log(log.full_response);
    console.log('');
  }

  // Get the actual question
  const questionId = '654ee02b-e404-4191-a5d6-0fe36f26632e';
  const { data: q } = await supabase
    .from('questions')
    .select('question_text, option_a, option_b, option_c, option_d, correct_option, explanation')
    .eq('id', questionId)
    .single();

  if (q) {
    console.log('===================================');
    console.log('ACTUAL QUESTION:');
    console.log('Text:', q.question_text);
    console.log('A:', q.option_a);
    console.log('B:', q.option_b);
    console.log('C:', q.option_c);
    console.log('D:', q.option_d);
    console.log('Correct:', q.correct_option, '(0=A, 1=B, 2=C, 3=D)');
    console.log('Explanation:', q.explanation);
  }

  // Also get the article
  const { data: qFull } = await supabase
    .from('questions')
    .select('primary_article_id, articles:primary_article_id(article_number, content, title, laws:law_id(short_name))')
    .eq('id', questionId)
    .single();

  if (qFull && qFull.articles) {
    console.log('\n=== LINKED ARTICLE ===');
    console.log('Article:', qFull.articles.article_number);
    console.log('Title:', qFull.articles.title);
    console.log('Law:', qFull.articles.laws?.short_name);
    console.log('Content:', qFull.articles.content);
  }
})();
