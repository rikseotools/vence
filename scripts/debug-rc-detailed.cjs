const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

(async () => {
  const rcLawId = 'd7addcab-3179-4667-8037-9fcae8097faa';

  // Buscar artículos del RC
  const { data: rcArticles } = await supabase
    .from('articles')
    .select('id, article_number')
    .eq('law_id', rcLawId);

  const articleIds = rcArticles.map(a => a.id);

  // Buscar preguntas del RC
  const { data: rcQuestions } = await supabase
    .from('questions')
    .select('id')
    .in('primary_article_id', articleIds);

  const questionIds = rcQuestions.map(q => q.id);

  console.log(`❓ RC question IDs: ${questionIds.length}`);

  // Buscar en detailed_answers
  const { data: detailed, error } = await supabase
    .from('detailed_answers')
    .select('id, user_id, question_id, is_correct, created_at')
    .in('question_id', questionIds)
    .order('created_at', { ascending: false });

  if (error) {
    console.log('❌ Error:', error);
    return;
  }

  console.log(`📊 Detailed answers for RC: ${detailed.length}`);
  detailed.forEach(d => {
    const q = rcQuestions.find(q => q.id === d.question_id);
    console.log(`  - ${d.created_at}: User ${d.user_id?.substring(0, 8)}, Q ${d.question_id?.substring(0, 8)}, correct=${d.is_correct}`);
  });

  // Verificar si user_question_history se actualiza via trigger o manualmente
  console.log('\n🔍 Checking if there is a trigger to update user_question_history...');

  // Comprobar las últimas entradas de user_question_history
  const { data: recentHist } = await supabase
    .from('user_question_history')
    .select('*')
    .order('updated_at', { ascending: false })
    .limit(5);

  console.log('📊 Most recent user_question_history entries:');
  recentHist?.forEach(h => {
    console.log(`  - Updated ${h.updated_at}: User ${h.user_id?.substring(0, 8)}, Q ${h.question_id?.substring(0, 8)}, rate=${h.success_rate}, attempts=${h.total_attempts}`);
  });
})();
