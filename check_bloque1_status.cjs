const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function main() {
  // Obtener topics del Bloque I de Auxiliar
  const { data: topics } = await supabase
    .from('topics')
    .select('id, topic_number, title')
    .eq('position_type', 'auxiliar_administrativo')
    .gte('topic_number', 1)
    .lte('topic_number', 16)
    .order('topic_number');

  console.log('═══════════════════════════════════════════════════════════════════════════════');
  console.log('ESTADO DE VERIFICACIÓN - BLOQUE I AUXILIAR ADMINISTRATIVO DEL ESTADO');
  console.log('═══════════════════════════════════════════════════════════════════════════════\n');

  for (const topic of topics || []) {
    // Obtener scope del tema
    const { data: scope } = await supabase
      .from('topic_scope')
      .select('law_id, article_numbers')
      .eq('topic_id', topic.id);

    // Obtener article IDs
    let articleIds = [];
    for (const s of scope || []) {
      if (!s.article_numbers || s.article_numbers.length === 0) continue;
      const { data: arts } = await supabase
        .from('articles')
        .select('id')
        .eq('law_id', s.law_id)
        .in('article_number', s.article_numbers);
      if (arts) articleIds.push(...arts.map(a => a.id));
    }

    if (articleIds.length === 0) {
      console.log(`T${topic.topic_number}: ${topic.title.substring(0, 50)}`);
      console.log('   ⚠️  Sin artículos vinculados\n');
      continue;
    }

    // Contar preguntas por estado
    const { data: questions } = await supabase
      .from('questions')
      .select('topic_review_status')
      .eq('is_active', true)
      .in('primary_article_id', articleIds);

    const stats = {
      total: questions?.length || 0,
      pending: 0,
      perfect: 0,
      tech_perfect: 0,
      bad_explanation: 0,
      bad_answer: 0,
      bad_answer_and_explanation: 0,
      wrong_article: 0,
      all_wrong: 0,
      other_errors: 0
    };

    for (const q of questions || []) {
      const status = q.topic_review_status || 'pending';
      if (status === 'pending') stats.pending++;
      else if (status === 'perfect') stats.perfect++;
      else if (status === 'tech_perfect') stats.tech_perfect++;
      else if (status === 'bad_explanation') stats.bad_explanation++;
      else if (status === 'bad_answer') stats.bad_answer++;
      else if (status === 'bad_answer_and_explanation') stats.bad_answer_and_explanation++;
      else if (status.includes('wrong_article')) stats.wrong_article++;
      else if (status === 'all_wrong') stats.all_wrong++;
      else stats.other_errors++;
    }

    const totalErrors = stats.bad_explanation + stats.bad_answer + stats.bad_answer_and_explanation +
                        stats.wrong_article + stats.all_wrong + stats.other_errors;
    const verified = stats.perfect + stats.tech_perfect;
    const pctVerified = stats.total > 0 ? Math.round((verified / stats.total) * 100) : 0;

    console.log(`T${topic.topic_number}: ${topic.title.substring(0, 55)}`);
    console.log(`   Total: ${stats.total} | ✅ Verificadas: ${verified} (${pctVerified}%) | ⏳ Pendientes: ${stats.pending} | ❌ Errores: ${totalErrors}`);

    if (totalErrors > 0) {
      const errorDetails = [];
      if (stats.bad_answer_and_explanation > 0) errorDetails.push(`resp+expl: ${stats.bad_answer_and_explanation}`);
      if (stats.bad_answer > 0) errorDetails.push(`resp: ${stats.bad_answer}`);
      if (stats.bad_explanation > 0) errorDetails.push(`expl: ${stats.bad_explanation}`);
      if (stats.wrong_article > 0) errorDetails.push(`art: ${stats.wrong_article}`);
      if (stats.all_wrong > 0) errorDetails.push(`todo: ${stats.all_wrong}`);
      console.log(`   Detalle errores: ${errorDetails.join(' | ')}`);
    }
    console.log('');
  }
}

main().catch(console.error);
