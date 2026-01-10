const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const s = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

(async () => {
  // Get all topics
  const { data: topics, error: tErr } = await s.from('topics')
    .select('id, title, topic_number, position_type')
    .order('topic_number');

  if (tErr) {
    console.log('Error topics:', tErr);
    return;
  }

  console.log('Total topics found:', topics ? topics.length : 0);

  if (!topics || topics.length === 0) {
    console.log('No topics found');
    return;
  }

  console.log('RESUMEN DE TODOS LOS TEMAS');
  console.log('═══════════════════════════════════════════════════════════════');

  let totalQuestions = 0;
  let totalPerfect = 0;

  for (const t of topics) {
    const { data: questions, error: qErr } = await s.from('questions')
      .select('topic_review_status')
      .eq('topic_id', t.id)
      .eq('is_active', true);

    if (qErr) {
      console.log('Error questions for', t.topic_number, qErr);
      continue;
    }

    if (!questions || questions.length === 0) continue;

    const perfect = questions.filter(q => q.topic_review_status === 'perfect').length;
    const total = questions.length;
    const pct = Math.round((perfect / total) * 100);

    totalQuestions += total;
    totalPerfect += perfect;

    const status = pct === 100 ? '✅' : '❌';
    console.log(`${status} T${t.topic_number.toString().padStart(3,'0')} | ${total.toString().padStart(4)} preg | ${pct}% | ${t.title.substring(0,45)}`);
  }

  console.log('═══════════════════════════════════════════════════════════════');
  console.log(`TOTAL: ${totalQuestions} preguntas, ${totalPerfect} perfect (${Math.round((totalPerfect/totalQuestions)*100)}%)`);
})();
