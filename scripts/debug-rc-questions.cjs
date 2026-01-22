const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

(async () => {
  const userId = '2fc60bc8-1f9a-42c8-9c60-845c00af4a1f';

  // Obtener las preguntas RC del historial del usuario
  const { data: history } = await supabase
    .from('user_question_history')
    .select('question_id, success_rate, total_attempts')
    .eq('user_id', userId)
    .order('updated_at', { ascending: false })
    .limit(3);

  console.log('Recent question history:');

  for (const h of history) {
    // Obtener la pregunta
    const { data: q } = await supabase
      .from('questions')
      .select('id, question_text, primary_article_id')
      .eq('id', h.question_id)
      .single();

    if (!q) {
      console.log(`  ❌ Question ${h.question_id} not found!`);
      continue;
    }

    console.log(`\n📋 Question: ${q.id.substring(0, 8)}...`);
    console.log(`   Text: ${q.question_text?.substring(0, 60)}...`);
    console.log(`   primary_article_id: ${q.primary_article_id || 'NULL!'}`);
    console.log(`   History: rate=${h.success_rate}, attempts=${h.total_attempts}`);

    if (q.primary_article_id) {
      const { data: art } = await supabase
        .from('articles')
        .select('id, article_number, law_id')
        .eq('id', q.primary_article_id)
        .single();

      if (art) {
        const { data: law } = await supabase
          .from('laws')
          .select('short_name')
          .eq('id', art.law_id)
          .single();

        console.log(`   Article: ${law?.short_name}:${art.article_number}`);

        // Verificar si este artículo está en topic_scope
        const { data: scope } = await supabase
          .from('topic_scope')
          .select('topic_id, article_numbers, topics(topic_number, position_type)')
          .eq('law_id', art.law_id);

        const matchingScope = scope?.filter(s => s.article_numbers?.includes(art.article_number));
        if (matchingScope?.length > 0) {
          console.log(`   Topic mappings:`);
          matchingScope.forEach(s => {
            console.log(`     - Topic ${s.topics?.topic_number} (${s.topics?.position_type})`);
          });
        } else {
          console.log(`   ❌ NO topic_scope mapping for this article!`);
        }
      }
    }
  }

  // Ahora simular la query exacta de weak-articles
  console.log('\n\n=== Simulating weak-articles query ===');
  const maxSuccessRate = 60;
  const minAttempts = 2;
  const positionType = 'auxiliar_administrativo';

  // Paso 1: Obtener topic_scope filtrado
  const { data: scopeData } = await supabase
    .from('topic_scope')
    .select('topic_id, law_id, article_numbers, topics(topic_number, position_type)')
    .eq('topics.position_type', positionType);

  console.log(`\nFiltered scope entries for ${positionType}: ${scopeData?.length || 0}`);

  // Construir mapping
  const articleToTopic = {};
  const rcLawId = 'd7addcab-3179-4667-8037-9fcae8097faa';

  scopeData?.forEach(s => {
    if (!s.topics?.topic_number || !s.law_id || !s.article_numbers) return;
    s.article_numbers.forEach(artNum => {
      if (!artNum) return;
      const key = `${s.law_id}_${artNum}`;
      articleToTopic[key] = s.topics.topic_number;
    });
  });

  // Verificar si RC:146 está en el mapping
  const rcKey = `${rcLawId}_146`;
  console.log(`\nRC:146 key = ${rcKey}`);
  console.log(`RC:146 in mapping? ${articleToTopic[rcKey] ? `Yes -> Topic ${articleToTopic[rcKey]}` : 'NO!'}`);

  // Paso 2: Query weak questions
  // This mimics the Drizzle query but using Supabase directly
  const { data: weakQuestions, error } = await supabase
    .from('user_question_history')
    .select(`
      success_rate,
      total_attempts,
      questions!inner(
        primary_article_id,
        articles!inner(
          article_number,
          law_id,
          laws!inner(short_name)
        )
      )
    `)
    .eq('user_id', userId)
    .lt('success_rate', maxSuccessRate)
    .gte('total_attempts', minAttempts);

  if (error) {
    console.log('Error:', error);
    return;
  }

  console.log(`\nWeak questions found: ${weakQuestions?.length || 0}`);

  weakQuestions?.forEach(wq => {
    const art = wq.questions?.articles;
    if (!art) return;
    const key = `${art.law_id}_${art.article_number}`;
    const topicNum = articleToTopic[key];
    const isRC = art.law_id === rcLawId;
    console.log(`  ${isRC ? '✅ RC' : art.laws?.short_name}:${art.article_number} -> key=${key} -> Topic=${topicNum || 'NO MAPPING'}`);
  });
})();
