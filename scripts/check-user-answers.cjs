const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

(async () => {
  const userId = '2fc60bc8-1f9a-42c8-9c60-845c00af4a1f';

  console.log('=== VERIFICANDO RESPUESTAS DE MANUEL ===\n');

  // 1. Buscar TODAS las respuestas del usuario en user_question_history
  const { data: allHistory, error } = await supabase
    .from('user_question_history')
    .select('*')
    .eq('user_id', userId)
    .order('updated_at', { ascending: false });

  console.log(`Total registros en user_question_history: ${allHistory?.length || 0}\n`);

  // 2. Filtrar solo las de Reglamento del Congreso
  const rcLawId = 'd7addcab-3179-4667-8037-9fcae8097faa';

  console.log('--- Preguntas del Reglamento del Congreso ---');
  let rcCount = 0;

  for (const h of allHistory || []) {
    const { data: q } = await supabase
      .from('questions')
      .select('primary_article_id, question_text')
      .eq('id', h.question_id)
      .single();

    if (q?.primary_article_id) {
      const { data: art } = await supabase
        .from('articles')
        .select('article_number, law_id')
        .eq('id', q.primary_article_id)
        .single();

      if (art?.law_id === rcLawId) {
        rcCount++;
        console.log(`${rcCount}. Art ${art.article_number}: rate=${h.success_rate}, attempts=${h.total_attempts}`);
        console.log(`   Pregunta: ${q.question_text?.substring(0, 60)}...`);
        console.log(`   Actualizado: ${h.updated_at}\n`);
      }
    }
  }

  console.log(`\nTotal preguntas RC guardadas: ${rcCount}`);

  // 3. Verificar test_sessions recientes
  console.log('\n--- Sesiones de test recientes ---');
  const { data: sessions } = await supabase
    .from('test_sessions')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(5);

  if (sessions?.length === 0) {
    console.log('No hay sesiones de test registradas');
  } else {
    sessions?.forEach((s, i) => {
      console.log(`${i + 1}. ${s.test_type || 'unknown'}: ${s.score}/${s.total_questions} (${s.created_at})`);
    });
  }
})();
