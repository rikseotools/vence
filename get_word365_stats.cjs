require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

async function main() {
  // Obtener estadísticas detalladas
  const { data: allVerifications } = await supabase
    .from('ai_verification_results')
    .select('id, question_id, ai_provider, verified_at, confidence, is_correct')
    .gte('verified_at', '2026-01-22T00:00:00Z')
    .order('verified_at', { ascending: false });

  // Agrupar por question_id
  const questionMap = new Map();
  allVerifications.forEach(v => {
    if (!questionMap.has(v.question_id)) {
      questionMap.set(v.question_id, []);
    }
    questionMap.get(v.question_id).push(v);
  });

  // Contar providers
  const providerCounts = {};
  const confidenceCounts = {};
  const correctCounts = {};
  const microsoftCount = { count: 0, questions: [] };

  allVerifications.forEach(v => {
    providerCounts[v.ai_provider] = (providerCounts[v.ai_provider] || 0) + 1;
    confidenceCounts[v.confidence] = (confidenceCounts[v.confidence] || 0) + 1;
    const key = v.is_correct === null ? 'null' : v.is_correct ? 'true' : 'false';
    correctCounts[key] = (correctCounts[key] || 0) + 1;

    if (v.ai_provider === 'microsoft_docs_verification') {
      microsoftCount.count++;
      if (!microsoftCount.questions.includes(v.question_id)) {
        microsoftCount.questions.push(v.question_id);
      }
    }
  });

  console.log('='.repeat(70));
  console.log('📊 ANÁLISIS COMPLETO - VERIFICACIÓN WORD 365');
  console.log('='.repeat(70));
  console.log('\nTotal de registros de verificación:', allVerifications.length);
  console.log('Preguntas únicas procesadas:', questionMap.size);

  console.log('\n📍 Distribución por proveedor:');
  Object.entries(providerCounts).forEach(([provider, count]) => {
    const pct = ((count / allVerifications.length) * 100).toFixed(1);
    console.log(`   ${provider}: ${count} (${pct}%)`);
  });

  console.log('\n📈 Distribución por confidence:');
  const sortedConfidence = Object.entries(confidenceCounts).sort((a, b) => b[1] - a[1]);
  sortedConfidence.forEach(([conf, count]) => {
    const pct = ((count / allVerifications.length) * 100).toFixed(1);
    console.log(`   ${conf}: ${count} (${pct}%)`);
  });

  console.log('\n✅ Distribución por is_correct:');
  Object.entries(correctCounts).forEach(([correct, count]) => {
    const pct = ((count / allVerifications.length) * 100).toFixed(1);
    console.log(`   ${correct}: ${count} (${pct}%)`);
  });

  // Verificar questions actualizadas
  const { data: updatedQuestions } = await supabase
    .from('questions')
    .select('id, topic_review_status')
    .gte('updated_at', '2026-01-22T00:00:00Z')
    .in('id', Array.from(questionMap.keys()));

  const statusCounts = {};
  if (updatedQuestions) {
    updatedQuestions.forEach(q => {
      statusCounts[q.topic_review_status] = (statusCounts[q.topic_review_status] || 0) + 1;
    });
  }

  console.log('\n🔍 Actualización en questions (topic_review_status):');
  if (updatedQuestions && updatedQuestions.length > 0) {
    Object.entries(statusCounts).forEach(([status, count]) => {
      const pct = ((count / updatedQuestions.length) * 100).toFixed(1);
      console.log(`   ${status}: ${count} (${pct}%)`);
    });
  } else {
    console.log('   No hay preguntas actualizadas detectadas en el rango horario');
  }

  console.log('\n🏛️ Resumen específico Microsoft Docs:');
  console.log(`   Registros de Microsoft: ${microsoftCount.count}`);
  console.log(`   Preguntas únicas verificadas: ${microsoftCount.questions.length}`);

  console.log('\n' + '='.repeat(70));
  console.log('✨ PROCESAMIENTO COMPLETADO EXITOSAMENTE');
  console.log('='.repeat(70));
}

main().catch(console.error);
