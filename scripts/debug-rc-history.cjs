const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

(async () => {
  const questionId = 'a105225c-1e0e-4093-b41f-ace559068087';

  // Buscar todos los user_question_history para esta pregunta
  const { data: histories, error } = await supabase
    .from('user_question_history')
    .select('*')
    .eq('question_id', questionId);

  if (error) {
    console.log('❌ Error:', error);
    return;
  }

  console.log('📊 History entries for this question:');
  histories.forEach(h => {
    console.log({
      user_id: h.user_id?.substring(0, 8) + '...',
      success_rate: h.success_rate,
      success_rate_type: typeof h.success_rate,
      total_attempts: h.total_attempts,
      total_attempts_type: typeof h.total_attempts
    });

    // Verificar la condición que usa el query
    const maxSuccessRate = 60;
    const minAttempts = 2;

    console.log('\n🔍 Checking conditions:');
    console.log(`  - success_rate (${h.success_rate}) < ${maxSuccessRate}? ${parseFloat(h.success_rate) < maxSuccessRate}`);
    console.log(`  - total_attempts (${h.total_attempts}) >= ${minAttempts}? ${parseInt(h.total_attempts) >= minAttempts}`);
    console.log(`  - String comparison: "${h.success_rate}" < "${maxSuccessRate}"? ${h.success_rate < String(maxSuccessRate)}`);
  });

  // También verificar qué devuelve la query directa
  console.log('\n🔍 Direct query with conditions:');
  const { data: weakHistory, error: wErr } = await supabase
    .from('user_question_history')
    .select('*')
    .eq('question_id', questionId)
    .lt('success_rate', '60')
    .gte('total_attempts', 2);

  if (wErr) {
    console.log('❌ Error:', wErr);
  } else {
    console.log('Results:', weakHistory?.length || 0);
    weakHistory?.forEach(h => console.log('  -', h.user_id?.substring(0, 8), 'rate:', h.success_rate, 'attempts:', h.total_attempts));
  }
})();
