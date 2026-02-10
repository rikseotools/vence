require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const userId = '8e95b88c-fc35-44fb-afdb-2e8129741b2e';

(async () => {
  console.log('🔍 RESUMEN DE ACTIVIDAD DE REBECA GIRONA\n');

  // 1. User Interactions - solo URLs únicas
  const { data: interactions } = await supabase
    .from('user_interactions')
    .select('page_url, event_type, action, created_at')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });

  console.log('🌐 PÁGINAS VISITADAS (de ' + (interactions || []).length + ' interacciones):');
  console.log('─'.repeat(60));

  if (interactions && interactions.length > 0) {
    const urlCounts = {};
    interactions.forEach(i => {
      if (i.page_url) {
        urlCounts[i.page_url] = (urlCounts[i.page_url] || 0) + 1;
      }
    });

    Object.entries(urlCounts)
      .sort((a, b) => b[1] - a[1])
      .forEach(([url, count]) => {
        console.log('  ' + count + 'x  ' + url);
      });
  }

  // 2. User Question History - leyes estudiadas
  const { data: history } = await supabase
    .from('user_question_history')
    .select('question_id, is_correct, times_attempted, last_attempted_at')
    .eq('user_id', userId);

  console.log('\n📚 PREGUNTAS RESPONDIDAS (' + (history || []).length + ' total):');
  console.log('─'.repeat(60));

  if (history && history.length > 0) {
    const questionIds = history.map(h => h.question_id).filter(Boolean);

    const { data: questions } = await supabase
      .from('questions')
      .select('id, law_short_name, article_number')
      .in('id', questionIds);

    const questionsMap = {};
    if (questions) {
      questions.forEach(q => {
        questionsMap[q.id] = q;
      });
    }

    // Agrupar por ley
    const byLaw = {};
    history.forEach(h => {
      const q = questionsMap[h.question_id];
      const law = q ? q.law_short_name : 'Desconocida';
      if (!byLaw[law]) byLaw[law] = { total: 0, correct: 0, articles: new Set() };
      byLaw[law].total++;
      if (h.is_correct) byLaw[law].correct++;
      if (q && q.article_number) byLaw[law].articles.add(q.article_number);
    });

    console.log('Por ley:');
    Object.entries(byLaw)
      .sort((a, b) => b[1].total - a[1].total)
      .forEach(([law, data]) => {
        const pct = Math.round(data.correct / data.total * 100);
        console.log('  ' + law + ': ' + data.total + ' preguntas (' + pct + '% correctas)');
        console.log('    Artículos: ' + Array.from(data.articles).sort((a,b) => a-b).join(', '));
      });
  }

  // 3. Ver interacciones recientes con más detalle
  console.log('\n🕐 ÚLTIMAS 30 ACCIONES (cronológico):');
  console.log('─'.repeat(60));

  if (interactions && interactions.length > 0) {
    interactions.slice(0, 30).forEach(i => {
      const date = new Date(i.created_at).toLocaleString('es-ES');
      const action = i.action || i.event_type || '';
      console.log('  ' + date + ' | ' + i.page_url + ' | ' + action);
    });
  }

  // 4. Fechas de actividad
  console.log('\n📅 RANGO DE ACTIVIDAD:');
  console.log('─'.repeat(60));

  if (interactions && interactions.length > 0) {
    const dates = interactions.map(i => new Date(i.created_at));
    const first = new Date(Math.min(...dates));
    const last = new Date(Math.max(...dates));
    console.log('  Primera interacción: ' + first.toLocaleString('es-ES'));
    console.log('  Última interacción: ' + last.toLocaleString('es-ES'));

    // Días únicos
    const uniqueDays = new Set(dates.map(d => d.toDateString()));
    console.log('  Días activos: ' + uniqueDays.size);
  }

  console.log('\n✅ FIN DEL RESUMEN');
})();
