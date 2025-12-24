require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

(async () => {
  console.log('🔍 VERIFICANDO TABLAS DE RESPUESTAS\n');

  // 1. Contar registros en detailed_answers
  const { count: countDA, error: errDA } = await supabase
    .from('detailed_answers')
    .select('*', { count: 'exact', head: true });

  console.log('📊 detailed_answers:');
  if (errDA) {
    console.log(`  Error: ${errDA.message}`);
  } else {
    console.log(`  Total registros: ${countDA}`);
  }

  // 2. Contar registros en test_questions
  const { count: countTQ, error: errTQ } = await supabase
    .from('test_questions')
    .select('*', { count: 'exact', head: true });

  console.log('\n📊 test_questions:');
  if (errTQ) {
    console.log(`  Error: ${errTQ.message}`);
  } else {
    console.log(`  Total registros: ${countTQ}`);
  }

  // 3. Ver registros recientes en test_questions
  const { data: recentTQ } = await supabase
    .from('test_questions')
    .select('created_at, test_id, question_order, is_correct')
    .order('created_at', { ascending: false })
    .limit(10);

  if (recentTQ?.length > 0) {
    console.log('\n  Últimos 10 registros:');
    recentTQ.forEach(r => {
      console.log(`    ${r.created_at?.substring(0, 16)} | test: ${r.test_id?.substring(0, 8)}... | Q${r.question_order} | ${r.is_correct ? '✅' : '❌'}`);
    });
  }

  // 4. Ver registros recientes en detailed_answers
  const { data: recentDA } = await supabase
    .from('detailed_answers')
    .select('created_at, user_id, question_id, is_correct')
    .order('created_at', { ascending: false })
    .limit(10);

  if (recentDA?.length > 0) {
    console.log('\n📊 detailed_answers - Últimos 10:');
    recentDA.forEach(r => {
      console.log(`    ${r.created_at?.substring(0, 16)} | user: ${r.user_id?.substring(0, 8)}... | ${r.is_correct ? '✅' : '❌'}`);
    });
  }

  // 5. Verificar si son la misma tabla (view)
  console.log('\n\n🔍 VERIFICANDO ESTRUCTURA DE TABLAS:');

  // Columnas de detailed_answers
  const { data: colsDA } = await supabase.rpc('get_columns_info', { table_name: 'detailed_answers' }).catch(() => ({ data: null }));

  // Intentar otra forma
  const { data: sampleDA, error: sampleErrDA } = await supabase
    .from('detailed_answers')
    .select('*')
    .limit(1);

  const { data: sampleTQ, error: sampleErrTQ } = await supabase
    .from('test_questions')
    .select('*')
    .limit(1);

  console.log('\nColumnas de detailed_answers:', sampleDA?.[0] ? Object.keys(sampleDA[0]).slice(0, 10).join(', ') + '...' : sampleErrDA?.message || 'vacía');
  console.log('Columnas de test_questions:', sampleTQ?.[0] ? Object.keys(sampleTQ[0]).slice(0, 10).join(', ') + '...' : sampleErrTQ?.message || 'vacía');

  // 6. Ver test_sessions recientes
  console.log('\n\n📊 TEST_SESSIONS recientes:');
  const { data: sessions } = await supabase
    .from('test_sessions')
    .select('id, user_id, created_at, test_type, total_questions, correct_answers')
    .order('created_at', { ascending: false })
    .limit(10);

  sessions?.forEach(s => {
    console.log(`  ${s.created_at?.substring(0, 16)} | ${s.test_type} | ${s.correct_answers}/${s.total_questions} | id: ${s.id?.substring(0, 8)}...`);
  });

  // 7. Verificar si las sesiones tienen preguntas asociadas
  if (sessions?.length > 0) {
    console.log('\n🔗 PREGUNTAS POR SESIÓN:');
    for (const s of sessions.slice(0, 3)) {
      const { count } = await supabase
        .from('test_questions')
        .select('*', { count: 'exact', head: true })
        .eq('test_id', s.id);

      console.log(`  Sesión ${s.id?.substring(0, 8)}...: ${count || 0} preguntas en test_questions`);
    }
  }

  // CONCLUSIÓN
  console.log('\n\n' + '='.repeat(60));
  console.log('DIAGNÓSTICO');
  console.log('='.repeat(60));
})();
