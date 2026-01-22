const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

(async () => {
  // Buscar el usuario por email
  const { data: profile, error: pErr } = await supabase
    .from('user_profiles')
    .select('id, full_name, email')
    .eq('email', 'manueltrader@gmail.com')
    .single();

  if (pErr) {
    console.log('❌ Error fetching profile:', pErr);
    return;
  }

  console.log('👤 User:', profile);
  const userId = profile.id;

  // Buscar todo el historial de preguntas del usuario
  const { data: history, error: hErr } = await supabase
    .from('user_question_history')
    .select('question_id, success_rate, total_attempts, updated_at')
    .eq('user_id', userId)
    .order('updated_at', { ascending: false })
    .limit(20);

  if (hErr) {
    console.log('❌ Error fetching history:', hErr);
    return;
  }

  console.log(`\n📊 User question history: ${history.length} recent entries`);

  // Para cada entrada, obtener info de la pregunta
  const rcLawId = 'd7addcab-3179-4667-8037-9fcae8097faa';

  for (const h of history) {
    const { data: q } = await supabase
      .from('questions')
      .select('primary_article_id')
      .eq('id', h.question_id)
      .single();

    let lawInfo = '';
    if (q?.primary_article_id) {
      const { data: art } = await supabase
        .from('articles')
        .select('article_number, law_id')
        .eq('id', q.primary_article_id)
        .single();

      if (art) {
        const { data: law } = await supabase
          .from('laws')
          .select('short_name')
          .eq('id', art.law_id)
          .single();

        lawInfo = `${law?.short_name || 'Unknown'}:${art.article_number}`;
        if (art.law_id === rcLawId) {
          lawInfo = `✅ RC:${art.article_number}`;
        }
      }
    }

    console.log(`  - ${h.updated_at?.substring(0, 16)}: ${lawInfo || 'No article'}, rate=${h.success_rate}, attempts=${h.total_attempts}`);
  }

  // Buscar test_sessions recientes
  console.log('\n📝 Recent test sessions:');
  const { data: sessions, error: sErr } = await supabase
    .from('test_sessions')
    .select('id, score, total_questions, questions_answered, completed_at, test_type, created_at')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(10);

  if (sErr) {
    console.log('❌ Error:', sErr);
  } else {
    sessions.forEach(s => {
      console.log(`  - ${s.created_at?.substring(0, 16)}: ${s.test_type}, ${s.score}/${s.total_questions}, completed=${s.completed_at ? 'yes' : 'no'}`);
    });
  }
})();
