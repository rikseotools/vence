require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

(async () => {
  const { data: user } = await supabase
    .from('user_profiles')
    .select('id')
    .eq('email', 'manueltrader@gmail.com')
    .single();

  // Últimos 3 tests
  const { data: tests } = await supabase
    .from('tests')
    .select('*')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(3);

  for (const test of tests) {
    console.log('\n📋 Test:', new Date(test.created_at).toLocaleString('es-ES'));
    console.log('   Preguntas:', test.total_questions, '| Score:', test.score || 'N/A');

    const { data: answers } = await supabase
      .from('test_answers')
      .select('*')
      .eq('test_id', test.id)
      .order('created_at', { ascending: true });

    console.log('   Respuestas guardadas:', answers?.length || 0);
    
    if (answers && answers.length > 0) {
      const correctCount = answers.filter(a => a.is_correct).length;
      console.log('   Correctas:', correctCount, '/', answers.length);
      
      answers.forEach((a, i) => {
        const time = new Date(a.created_at).toLocaleTimeString('es-ES');
        console.log('     ' + (i+1) + '. ' + time + ' | ' + (a.is_correct ? '✅' : '❌') + ' | Respuesta: ' + a.selected_option);
      });
    }
  }
})();
