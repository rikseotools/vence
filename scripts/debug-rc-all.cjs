const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

(async () => {
  const rcLawId = 'd7addcab-3179-4667-8037-9fcae8097faa';

  // Buscar todas las preguntas del Reglamento del Congreso (via articles)
  const { data: rcArticles, error: aErr } = await supabase
    .from('articles')
    .select('id, article_number')
    .eq('law_id', rcLawId);

  if (aErr) {
    console.log('❌ Error fetching articles:', aErr);
    return;
  }

  console.log(`📄 Articles from Reglamento del Congreso: ${rcArticles.length}`);

  // Buscar preguntas que referencian estos artículos
  const articleIds = rcArticles.map(a => a.id);
  const { data: rcQuestions, error: qErr } = await supabase
    .from('questions')
    .select('id, question_text, primary_article_id')
    .in('primary_article_id', articleIds);

  if (qErr) {
    console.log('❌ Error fetching questions:', qErr);
    return;
  }

  console.log(`❓ Questions for RC: ${rcQuestions.length}`);
  rcQuestions.forEach(q => {
    const art = rcArticles.find(a => a.id === q.primary_article_id);
    console.log(`  - ${q.id.substring(0, 8)}... Article ${art?.article_number}: ${q.question_text?.substring(0, 50)}...`);
  });

  // Buscar si alguna de estas preguntas tiene historial
  const questionIds = rcQuestions.map(q => q.id);
  const { data: histories, error: hErr } = await supabase
    .from('user_question_history')
    .select('user_id, question_id, success_rate, total_attempts')
    .in('question_id', questionIds);

  if (hErr) {
    console.log('❌ Error fetching history:', hErr);
    return;
  }

  console.log(`\n📊 History entries for RC questions: ${histories.length}`);
  histories.forEach(h => {
    const q = rcQuestions.find(q => q.id === h.question_id);
    const art = rcArticles.find(a => a.id === q?.primary_article_id);
    console.log(`  - User ${h.user_id?.substring(0, 8)}: Art ${art?.article_number}, rate=${h.success_rate}, attempts=${h.total_attempts}`);
  });

  // Si no hay historial en RC, buscar preguntas recientes del usuario
  if (histories.length === 0) {
    console.log('\n⚠️ No history for RC questions. Checking user recent history...');

    // Buscar el historial más reciente de cualquier usuario
    const { data: recentHistory, error: rErr } = await supabase
      .from('user_question_history')
      .select('user_id, question_id, success_rate, total_attempts, updated_at')
      .order('updated_at', { ascending: false })
      .limit(20);

    if (rErr) {
      console.log('❌ Error:', rErr);
    } else {
      console.log('📊 Recent history entries:');
      for (const h of recentHistory) {
        // Buscar info de la pregunta
        const { data: q } = await supabase
          .from('questions')
          .select('primary_article_id')
          .eq('id', h.question_id)
          .single();

        if (q?.primary_article_id) {
          const { data: art } = await supabase
            .from('articles')
            .select('article_number, law_id')
            .eq('id', q.primary_article_id)
            .single();

          if (art?.law_id === rcLawId) {
            console.log(`  ✅ RC FOUND: User ${h.user_id?.substring(0, 8)}: Art ${art.article_number}, rate=${h.success_rate}, attempts=${h.total_attempts}`);
          }
        }
      }
    }
  }
})();
