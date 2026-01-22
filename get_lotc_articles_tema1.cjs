const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

(async () => {
  // 1. Obtener LOTC law_id
  const { data: lotc } = await supabase
    .from('laws')
    .select('id, short_name')
    .ilike('short_name', 'LOTC')
    .single();

  if (!lotc) {
    console.error('No se encontró LOTC');
    return;
  }

  console.log(`📚 ${lotc.short_name} (ID: ${lotc.id})\n`);

  // 2. Obtener todos los artículos de LOTC
  const { data: articles } = await supabase
    .from('articles')
    .select('id, article_number')
    .eq('law_id', lotc.id)
    .order('article_number');

  if (!articles) {
    console.error('No se encontraron artículos');
    return;
  }

  console.log(`Total artículos de LOTC en BD: ${articles.length}\n`);

  // 3. Para cada artículo, contar cuántas preguntas tiene
  const articlesWithQuestions = [];

  for (const article of articles) {
    const { count } = await supabase
      .from('questions')
      .select('*', { count: 'exact', head: true })
      .eq('primary_article_id', article.id)
      .eq('is_active', true);

    if (count && count > 0) {
      articlesWithQuestions.push({
        articleNumber: article.article_number,
        articleId: article.id,
        questionCount: count
      });
    }
  }

  console.log(`📄 Artículos de LOTC con preguntas: ${articlesWithQuestions.length}\n`);

  // Ordenar numéricamente
  articlesWithQuestions.sort((a, b) => {
    const numA = parseInt(a.articleNumber.replace(/\D/g, '')) || 0;
    const numB = parseInt(b.articleNumber.replace(/\D/g, '')) || 0;
    return numA - numB;
  });

  console.log('Artículos con preguntas:');
  articlesWithQuestions.forEach(art => {
    console.log(`   Art. ${art.articleNumber}: ${art.questionCount} pregunta${art.questionCount > 1 ? 's' : ''}`);
  });

  console.log(`\nLista para topic_scope: ${articlesWithQuestions.map(a => a.articleNumber).join(', ')}`);
})();
