require('dotenv').config({ path: '/home/manuel/Documentos/github/vence/.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

(async () => {
  // Verificar que se guardaron en ai_verification_results
  const { data: aiResults, error: aiError } = await supabase
    .from('ai_verification_results')
    .select('*', { count: 'exact' })
    .eq('ai_provider', 'manual-microsoft-verification')
    .limit(5);

  console.log('ai_verification_results guardados:');
  if (aiError) {
    console.error('Error:', aiError);
  } else {
    console.log(`✅ Registros creados en ai_verification_results (mostrando 5 de los verificados)`);
    if (aiResults && aiResults.length > 0) {
      aiResults.forEach(r => {
        console.log(`   - Q: ${r.question_id}, Provider: ${r.ai_provider}, Confidence: ${r.confidence}`);
      });
    }
  }

  // Verificar topic_review_status actualizado
  const { data: questions, error: qError, count } = await supabase
    .from('questions')
    .select('id, topic_review_status, question_text', { count: 'exact' })
    .eq('topic_review_status', 'verified_microsoft_sources')
    .limit(5);

  console.log('\nQuestions con topic_review_status actualizado:');
  if (qError) {
    console.error('Error:', qError);
  } else {
    console.log(`✅ ${count} preguntas totales con estado verificado (mostrando 5)`);
    if (questions && questions.length > 0) {
      questions.forEach(q => {
        console.log(`   - ${q.id.substring(0, 8)}: ${q.topic_review_status}`);
      });
    }
  }
})();
