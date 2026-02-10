#!/usr/bin/env node
require('dotenv').config({ path: '.env.local' });

const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

async function verify() {
  console.log('📊 Verificando resultados guardados en la base de datos...\n');

  // Contar registros en ai_verification_results para microsoft_url_validator
  const { data: verifications, error: verifyError } = await supabase
    .from('ai_verification_results')
    .select('id, question_id, is_correct, confidence')
    .eq('ai_provider', 'microsoft_url_validator');

  if (verifyError) {
    console.error('Error obteniendo verificaciones:', verifyError.message);
    return;
  }

  console.log(`✅ Registros en ai_verification_results: ${verifications.length}`);
  
  const verified = verifications.filter(v => v.is_correct).length;
  const needsReview = verifications.filter(v => !v.is_correct).length;
  
  console.log(`   • Verificadas correctamente: ${verified}`);
  console.log(`   • Necesitan revisión: ${needsReview}`);

  // Contar actualizaciones de topic_review_status
  const { data: questionsVerified, error: qError1 } = await supabase
    .from('questions')
    .select('id')
    .eq('topic_review_status', 'microsoft_verified');

  const { data: questionsReview, error: qError2 } = await supabase
    .from('questions')
    .select('id')
    .eq('topic_review_status', 'microsoft_needs_review');

  if (!qError1) {
    console.log(`\n✅ Preguntas con topic_review_status = 'microsoft_verified': ${questionsVerified.length}`);
  }

  if (!qError2) {
    console.log(`✅ Preguntas con topic_review_status = 'microsoft_needs_review': ${questionsReview.length}`);
  }

  // Mostrar detalles de verificaciones
  console.log('\n📋 Detalles de verificaciones:');
  for (const v of verifications.slice(0, 10)) {
    const mark = v.is_correct ? '✅' : '⚠️ ';
    console.log(`   ${mark} ID: ${v.question_id} - Confianza: ${v.confidence}`);
  }

  if (verifications.length > 10) {
    console.log(`   ... y ${verifications.length - 10} más`);
  }
}

verify().catch(console.error);
