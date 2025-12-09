/**
 * Test de integración para verificar que los filtros de dificultad
 * usan correctamente global_difficulty_category con fallback a difficulty
 */

const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

let testsRun = 0;
let testsPassed = 0;
let testsFailed = 0;

function assert(condition, message) {
  testsRun++;
  if (!condition) {
    console.error(`  ❌ FAIL: ${message}`);
    testsFailed++;
    return false;
  }
  console.log(`  ✅ PASS: ${message}`);
  testsPassed++;
  return true;
}

async function runTests() {
  console.log('\n🧪 TESTS DE FILTROS DE DIFICULTAD\n');
  console.log('='.repeat(70));

  // Test 1: Filtro .or() con global_difficulty_category.eq.easy
  console.log('\n📊 Test 1: Filtro .or() para difficulty = easy');
  const { data: easyQuestions, error: easyError } = await supabase
    .from('questions')
    .select('id, difficulty, global_difficulty_category')
    .eq('is_active', true)
    .or('global_difficulty_category.eq.easy,and(global_difficulty_category.is.null,difficulty.eq.easy)')
    .limit(10);

  assert(!easyError, 'No debe haber errores de sintaxis SQL');
  assert(easyQuestions && easyQuestions.length > 0, 'Debe retornar preguntas');

  let allCorrect = true;
  easyQuestions?.forEach(q => {
    const hasCalculated = q.global_difficulty_category === 'easy';
    const hasStatic = q.global_difficulty_category === null && q.difficulty === 'easy';
    if (!hasCalculated && !hasStatic) allCorrect = false;
  });
  assert(allCorrect, 'Todas las preguntas deben tener difficulty=easy (calculada o estática)');

  // Test 2: Filtro .or() para medium
  console.log('\n📊 Test 2: Filtro .or() para difficulty = medium');
  const { data: mediumQuestions, error: mediumError } = await supabase
    .from('questions')
    .select('id, difficulty, global_difficulty_category')
    .eq('is_active', true)
    .or('global_difficulty_category.eq.medium,and(global_difficulty_category.is.null,difficulty.eq.medium)')
    .limit(10);

  assert(!mediumError, 'No debe haber errores de sintaxis SQL');
  assert(mediumQuestions && mediumQuestions.length > 0, 'Debe retornar preguntas');

  // Test 3: Filtro .or() para hard
  console.log('\n📊 Test 3: Filtro .or() para difficulty = hard');
  const { data: hardQuestions, error: hardError } = await supabase
    .from('questions')
    .select('id, difficulty, global_difficulty_category')
    .eq('is_active', true)
    .or('global_difficulty_category.eq.hard,and(global_difficulty_category.is.null,difficulty.eq.hard)')
    .limit(10);

  assert(!hardError, 'No debe haber errores de sintaxis SQL');
  assert(hardQuestions && hardQuestions.length > 0, 'Debe retornar preguntas');

  // Test 4: Filtro .or() para extreme
  console.log('\n📊 Test 4: Filtro .or() para difficulty = extreme');
  const { data: extremeQuestions, error: extremeError } = await supabase
    .from('questions')
    .select('id, difficulty, global_difficulty_category')
    .eq('is_active', true)
    .or('global_difficulty_category.eq.extreme,and(global_difficulty_category.is.null,difficulty.eq.extreme)')
    .limit(10);

  assert(!extremeError, 'No debe haber errores de sintaxis SQL');
  assert(extremeQuestions && extremeQuestions.length > 0, 'Debe retornar preguntas');

  // Test 5: Filtro .in() para múltiples dificultades
  console.log('\n📊 Test 5: Filtro .or() con .in.(easy,medium)');
  const { data: multiQuestions, error: multiError } = await supabase
    .from('questions')
    .select('id, difficulty, global_difficulty_category')
    .eq('is_active', true)
    .or('global_difficulty_category.in.(easy,medium),and(global_difficulty_category.is.null,difficulty.in.(easy,medium))')
    .limit(20);

  assert(!multiError, 'No debe haber errores de sintaxis SQL');
  assert(multiQuestions && multiQuestions.length > 0, 'Debe retornar preguntas');

  let allEasyOrMedium = true;
  multiQuestions?.forEach(q => {
    const hasCalculated = q.global_difficulty_category === 'easy' || q.global_difficulty_category === 'medium';
    const hasStatic = q.global_difficulty_category === null && (q.difficulty === 'easy' || q.difficulty === 'medium');
    if (!hasCalculated && !hasStatic) allEasyOrMedium = false;
  });
  assert(allEasyOrMedium, 'Todas las preguntas deben ser easy o medium');

  // Test 6: Combinación con filtro de ley
  console.log('\n📊 Test 6: Combinar filtro de dificultad con filtro de ley');
  const { data: lawQuestions, error: lawError } = await supabase
    .from('questions')
    .select(`
      id, difficulty, global_difficulty_category,
      articles!inner(
        article_number,
        laws!inner(short_name)
      )
    `)
    .eq('is_active', true)
    .eq('articles.laws.short_name', 'Ley 19/2013')
    .or('global_difficulty_category.eq.easy,and(global_difficulty_category.is.null,difficulty.eq.easy)')
    .limit(5);

  assert(!lawError, 'No debe haber errores al combinar con filtro de ley');
  assert(lawQuestions && lawQuestions.length > 0, 'Debe retornar preguntas de la ley');

  let allFromCorrectLaw = true;
  lawQuestions?.forEach(q => {
    if (q.articles.laws.short_name !== 'Ley 19/2013') allFromCorrectLaw = false;
  });
  assert(allFromCorrectLaw, 'Todas las preguntas deben ser de Ley 19/2013');

  // Test 7: Combinación con is_official_exam
  console.log('\n📊 Test 7: Combinar filtro de dificultad con is_official_exam');
  const { data: officialQuestions, error: officialError } = await supabase
    .from('questions')
    .select('id, difficulty, global_difficulty_category, is_official_exam')
    .eq('is_active', true)
    .eq('is_official_exam', true)
    .or('global_difficulty_category.eq.easy,and(global_difficulty_category.is.null,difficulty.eq.easy)')
    .limit(5);

  assert(!officialError, 'No debe haber errores al combinar con is_official_exam');

  // Test 8: Verificar distribución de calculadas vs estáticas
  console.log('\n📊 Test 8: Distribución de preguntas calculadas vs estáticas');
  const { data: mixQuestions } = await supabase
    .from('questions')
    .select('id, difficulty, global_difficulty_category')
    .eq('is_active', true)
    .or('global_difficulty_category.eq.easy,and(global_difficulty_category.is.null,difficulty.eq.easy)')
    .limit(30);

  const withCalculated = mixQuestions?.filter(q => q.global_difficulty_category !== null).length || 0;
  const withStatic = mixQuestions?.filter(q => q.global_difficulty_category === null).length || 0;

  console.log(`  📈 Distribución: ${withCalculated} calculadas, ${withStatic} estáticas`);
  assert(withCalculated + withStatic === (mixQuestions?.length || 0), 'Total debe coincidir');
  assert(withCalculated > 0 || withStatic > 0, 'Debe haber al menos alguna pregunta');

  // Test 9: Verificar que todas las dificultades funcionan sin errores
  console.log('\n📊 Test 9: Todas las dificultades deben funcionar sin errores SQL');
  const difficulties = ['easy', 'medium', 'hard', 'extreme'];
  let allDifficultiesWork = true;

  for (const diff of difficulties) {
    const { error } = await supabase
      .from('questions')
      .select('id')
      .eq('is_active', true)
      .or(`global_difficulty_category.eq.${diff},and(global_difficulty_category.is.null,difficulty.eq.${diff})`)
      .limit(1);

    if (error) {
      console.error(`    ❌ Error en dificultad ${diff}:`, error.message);
      allDifficultiesWork = false;
    }
  }
  assert(allDifficultiesWork, 'Todas las dificultades deben funcionar sin errores');

  // Resumen
  console.log('\n' + '='.repeat(70));
  console.log('\n📊 RESUMEN DE TESTS:');
  console.log(`  Total ejecutados: ${testsRun}`);
  console.log(`  ✅ Pasados: ${testsPassed}`);
  console.log(`  ❌ Fallidos: ${testsFailed}`);
  console.log(`  📈 Tasa de éxito: ${((testsPassed / testsRun) * 100).toFixed(1)}%`);

  if (testsFailed === 0) {
    console.log('\n✅ TODOS LOS TESTS PASARON\n');
    process.exit(0);
  } else {
    console.log('\n❌ ALGUNOS TESTS FALLARON\n');
    process.exit(1);
  }
}

runTests().catch(error => {
  console.error('\n❌ ERROR FATAL:', error);
  process.exit(1);
});
