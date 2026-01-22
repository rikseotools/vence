const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

(async () => {
  // Buscar la ley LOTC
  const { data: lotc } = await supabase
    .from('laws')
    .select('id, short_name')
    .ilike('short_name', '%LOTC%')
    .single();

  console.log('📚 LOTC:', lotc.short_name);
  console.log('   ID:', lotc.id, '\n');

  // Verificar primary_article_id
  const { data: questions, count } = await supabase
    .from('questions')
    .select('id, primary_article_id, article_number', { count: 'exact' })
    .eq('is_active', true)
    .limit(10);

  console.log('🔍 Primeras 10 preguntas en la BD:');
  if (questions && questions.length > 0) {
    questions.forEach((q, i) => {
      console.log(`   ${i+1}. primary_article_id: ${q.primary_article_id || 'NULL'}, article_number: ${q.article_number || 'NULL'}`);
    });
  } else {
    console.log('   No se encontraron preguntas');
  }
  console.log(`   Total preguntas activas: ${count}\n`);

  // Contar preguntas con y sin primary_article_id
  const { count: withArticleId } = await supabase
    .from('questions')
    .select('*', { count: 'exact', head: true })
    .eq('is_active', true)
    .not('primary_article_id', 'is', null);

  const { count: withoutArticleId } = await supabase
    .from('questions')
    .select('*', { count: 'exact', head: true })
    .eq('is_active', true)
    .is('primary_article_id', null);

  console.log(`✅ Preguntas CON primary_article_id: ${withArticleId}`);
  console.log(`❌ Preguntas SIN primary_article_id: ${withoutArticleId}\n`);

  // Si no tienen primary_article_id, revisar por article_number
  const { data: lotcQuestions } = await supabase
    .from('questions')
    .select('id, article_number, primary_article_id')
    .ilike('article_number', 'LOTC%')
    .eq('is_active', true)
    .limit(10);

  if (lotcQuestions && lotcQuestions.length > 0) {
    console.log('📋 Preguntas con article_number tipo "LOTC...":', lotcQuestions.length);
    lotcQuestions.forEach(q => {
      console.log(`   article_number: ${q.article_number}, primary_article_id: ${q.primary_article_id || 'NULL'}`);
    });
  }
})();
