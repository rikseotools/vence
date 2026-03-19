const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

(async () => {
  const shortIds = [
    '686fe453', '0bf88c3c', '3c0704b0', '71c9ed5b', '08b7b28e',
    '10fe5fe7', '91a08871', 'dc633295', '9dc7a367', '39101579'
  ];

  // Try fetching without the primary_article_id filter
  // and paginate through all questions
  let allQ = [];
  let page = 0;
  const pageSize = 1000;
  
  while (true) {
    const { data, error } = await supabase
      .from('questions')
      .select('id, question_text, option_a, option_b, option_c, option_d, correct_option, explanation, primary_article_id')
      .range(page * pageSize, (page + 1) * pageSize - 1);
    
    if (error) { console.error('Error page', page, error); break; }
    if (!data || data.length === 0) break;
    allQ = allQ.concat(data);
    if (data.length < pageSize) break;
    page++;
  }

  console.log('Total questions fetched:', allQ.length);

  const articleIds = new Set();
  const matched = [];

  for (const q of allQ) {
    for (const shortId of shortIds) {
      if (q.id.startsWith(shortId)) {
        matched.push(q);
        if (q.primary_article_id) articleIds.add(q.primary_article_id);
        break;
      }
    }
  }

  console.log('Matched:', matched.length);
  
  const letters = ['A','B','C','D'];
  for (const q of matched) {
    console.log('=== QUESTION ' + q.id.substring(0,8) + ' ===');
    console.log('ID:', q.id);
    console.log('Text:', q.question_text);
    console.log('A:', q.option_a);
    console.log('B:', q.option_b);
    console.log('C:', q.option_c);
    console.log('D:', q.option_d);
    console.log('Correct:', q.correct_option, '(' + letters[q.correct_option] + ')');
    console.log('Explanation:', q.explanation);
    console.log('Article ID:', q.primary_article_id);
    console.log('');
  }

  console.log('\n\n========== ARTICLES ==========\n');

  for (const artId of articleIds) {
    const { data, error } = await supabase
      .from('articles')
      .select('id, article_number, title, content')
      .eq('id', artId)
      .limit(1);

    if (error) { console.error('Error fetching article', artId, error); continue; }
    if (!data || data.length === 0) { console.log('ARTICLE NOT FOUND:', artId); continue; }

    const a = data[0];
    console.log('=== ARTICLE ' + a.article_number + ' ===');
    console.log('ID:', a.id);
    console.log('Title:', a.title);
    console.log('Content:', a.content);
    console.log('');
  }
})();
