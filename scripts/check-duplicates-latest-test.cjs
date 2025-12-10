/**
 * Verificar si hay preguntas duplicadas en el test más reciente
 */

const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

async function checkDuplicates() {
  // Obtener el test más reciente de Manuel
  const { data: latestTest, error: testError } = await supabase
    .from('test_sessions')
    .select('id, created_at, total_questions')
    .eq('user_id', 'cda0b7bf-2b8c-46ae-9145-8f6b851c56fd')
    .order('created_at', { ascending: false })
    .limit(1)
    .single();

  if (testError || !latestTest) {
    console.log('❌ No se encontró el test');
    return;
  }

  console.log('\n🔍 Test más reciente:');
  console.log('   ID:', latestTest.id);
  console.log('   Fecha:', new Date(latestTest.created_at).toLocaleTimeString());
  console.log('   Total preguntas:', latestTest.total_questions);
  console.log('');

  // Obtener las preguntas del test
  const { data: questions, error: questionsError } = await supabase
    .from('test_questions')
    .select('question_order, question_id')
    .eq('test_id', latestTest.id)
    .order('question_order');

  if (questionsError || !questions) {
    console.log('❌ No se encontraron preguntas');
    return;
  }

  console.log('📝 Preguntas del test:');
  questions.forEach(q => {
    console.log(`   ${q.question_order}. Question ID: ${q.question_id}`);
  });

  // Verificar duplicados
  const questionIds = questions.map(q => q.question_id);
  const uniqueIds = new Set(questionIds);

  console.log('');
  console.log('🔍 Verificación de duplicados:');
  console.log('   Total preguntas:', questionIds.length);
  console.log('   IDs únicos:', uniqueIds.size);

  if (questionIds.length !== uniqueIds.size) {
    console.log('');
    console.log('❌ HAY PREGUNTAS REPETIDAS:');

    const duplicates = questionIds.filter((id, index) => questionIds.indexOf(id) !== index);
    const uniqueDuplicates = [...new Set(duplicates)];

    uniqueDuplicates.forEach(dupId => {
      const positions = questionIds.map((id, i) => id === dupId ? i + 1 : null).filter(x => x !== null);
      console.log(`   Question ${dupId} aparece en posiciones: ${positions.join(', ')}`);
    });
  } else {
    console.log('   ✅ NO HAY DUPLICADOS');
  }

  console.log('\n');
}

checkDuplicates().catch(error => {
  console.error('❌ Error:', error);
  process.exit(1);
});
