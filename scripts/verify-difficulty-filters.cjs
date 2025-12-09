const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

(async () => {
  console.log('🔍 VERIFICACIÓN: Filtros de dificultad actualizados\n');
  console.log('='.repeat(60));

  // Test 1: Filtro .or() con global_difficulty_category + fallback
  console.log('\n📊 Test 1: Filtro de dificultad "easy" con lógica OR');
  const { data: easyQuestions, error: easyError } = await supabase
    .from('questions')
    .select('id, difficulty, global_difficulty_category')
    .eq('is_active', true)
    .or('global_difficulty_category.eq.easy,and(global_difficulty_category.is.null,difficulty.eq.easy)')
    .limit(10);

  if (easyError) {
    console.error('❌ Error:', easyError);
  } else {
    console.log(`✅ Encontradas ${easyQuestions.length} preguntas easy`);
    console.log('Primeras 5:');
    easyQuestions.slice(0, 5).forEach(q => {
      console.log(`  - ID ${q.id}: global_cat=${q.global_difficulty_category || 'NULL'}, static=${q.difficulty}`);
    });
  }

  // Test 2: Filtro .in() con múltiples dificultades
  console.log('\n📊 Test 2: Filtro IN para ["easy", "medium"]');
  const { data: easyMediumQuestions, error: emError } = await supabase
    .from('questions')
    .select('id, difficulty, global_difficulty_category')
    .eq('is_active', true)
    .or('global_difficulty_category.in.(easy,medium),and(global_difficulty_category.is.null,difficulty.in.(easy,medium))')
    .limit(10);

  if (emError) {
    console.error('❌ Error:', emError);
  } else {
    console.log(`✅ Encontradas ${easyMediumQuestions.length} preguntas easy/medium`);
    console.log('Primeras 5:');
    easyMediumQuestions.slice(0, 5).forEach(q => {
      console.log(`  - ID ${q.id}: global_cat=${q.global_difficulty_category || 'NULL'}, static=${q.difficulty}`);
    });
  }

  // Test 3: Estadísticas generales
  console.log('\n📊 Test 3: Estadísticas de uso de dificultad calculada vs estática');

  const { data: withCalculated } = await supabase
    .from('questions')
    .select('id', { count: 'exact', head: true })
    .eq('is_active', true)
    .not('global_difficulty_category', 'is', null);

  const { data: withoutCalculated } = await supabase
    .from('questions')
    .select('id', { count: 'exact', head: true })
    .eq('is_active', true)
    .is('global_difficulty_category', null);

  const totalWithCalc = withCalculated?.length || 0;
  const totalWithoutCalc = withoutCalculated?.length || 0;
  const total = totalWithCalc + totalWithoutCalc;

  console.log(`  Total preguntas activas: ${total}`);
  console.log(`  Con global_difficulty_category: ${totalWithCalc} (${((totalWithCalc/total)*100).toFixed(1)}%)`);
  console.log(`  Sin global_difficulty_category (usan fallback): ${totalWithoutCalc} (${((totalWithoutCalc/total)*100).toFixed(1)}%)`);

  console.log('\n✅ Verificación completada');
  console.log('='.repeat(60));
})();
