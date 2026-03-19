require("dotenv").config({ path: ".env.local" });
const { createClient } = require("@supabase/supabase-js");
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

(async () => {
  const topicId = '9fa3e8bb-cd6b-4953-bdb5-d021ba921dd1'; // Tema 10 aux admin

  // Get all scope entries with details
  const { data: scope } = await supabase
    .from('topic_scope')
    .select('id, article_numbers, title_numbers, chapter_numbers, include_full_title, include_full_chapter, weight, laws:law_id(short_name, name)')
    .eq('topic_id', topicId)
    .order('weight', { ascending: false });

  console.log('=== TOPIC SCOPE - Tema 10 ===');
  for (const s of (scope || [])) {
    const artCount = (s.article_numbers || []).length;
    const isEmpty = artCount === 0 && !s.include_full_title && !s.include_full_chapter;
    console.log(
      s.laws?.short_name + ' (w:' + s.weight + '): ' + artCount + ' arts [' +
      (s.article_numbers || []).join(',') + ']' +
      (s.title_numbers ? ' titles:' + s.title_numbers : '') +
      (s.chapter_numbers ? ' chapters:' + s.chapter_numbers : '') +
      (s.include_full_title ? ' FULL_TITLE' : '') +
      (s.include_full_chapter ? ' FULL_CHAPTER' : '') +
      (isEmpty ? ' << EMPTY = ALL ARTICLES' : '')
    );
  }

  // How does the app interpret empty articles? Check question count per law for this topic
  console.log('\n=== Questions per law for topic 10 ===');
  const { data: questions } = await supabase
    .from('questions')
    .select('id, articles:primary_article_id(article_number, laws:law_id(short_name))')
    .eq('topic_number', 10)
    .eq('is_active', true);

  const lawCounts = {};
  for (const q of (questions || [])) {
    const law = q.articles?.laws?.short_name || 'sin ley';
    lawCounts[law] = (lawCounts[law] || 0) + 1;
  }

  const sorted = Object.entries(lawCounts).sort((a,b) => b[1] - a[1]);
  for (const [law, count] of sorted) {
    console.log('  ' + law + ': ' + count + ' preguntas');
  }
  console.log('  TOTAL:', (questions || []).length);
})();
