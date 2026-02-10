#!/usr/bin/env node
require('dotenv').config({ path: '.env.local' });

const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

async function generateReport() {
  console.log('📋 Generando reporte detallado de procesamiento Word 365...\n');

  // Obtener todas las verificaciones
  const { data: verifications } = await supabase
    .from('ai_verification_results')
    .select('question_id, is_correct, confidence, explanation, verified_at')
    .eq('ai_provider', 'microsoft_url_validator')
    .order('verified_at', { ascending: false });

  // Obtener información de las preguntas procesadas
  const questionIds = verifications.map(v => v.question_id);
  const { data: questions } = await supabase
    .from('questions')
    .select('id, question_text, topic_review_status')
    .in('id', questionIds);

  // Crear mapa de preguntas
  const questionsMap = {};
  questions.forEach(q => questionsMap[q.id] = q);

  // Compilar estadísticas
  const stats = {
    processingDate: new Date().toISOString(),
    totalProcessed: verifications.length,
    totalQuestions: 30,
    processed: verifications.length,
    notProcessed: 30 - verifications.length,
    verified: verifications.filter(v => v.is_correct).length,
    needsReview: verifications.filter(v => !v.is_correct).length,
    confidenceBreakdown: {
      high: verifications.filter(v => v.confidence === 'high').length,
      medium: verifications.filter(v => v.confidence === 'medium').length,
      low: verifications.filter(v => v.confidence === 'low').length
    },
    details: verifications.map((v, idx) => ({
      index: idx + 1,
      questionId: v.question_id,
      questionText: questionsMap[v.question_id]?.question_text?.substring(0, 60) || 'N/A',
      status: v.is_correct ? 'verified' : 'needs_review',
      confidence: v.confidence,
      topicReviewStatus: questionsMap[v.question_id]?.topic_review_status || 'unknown',
      verifiedAt: v.verified_at,
      explanation: v.explanation
    }))
  };

  // Mostrar en consola
  console.log('=' .repeat(80));
  console.log('📊 REPORTE DE PROCESAMIENTO WORD 365');
  console.log('='.repeat(80));
  console.log(`📅 Fecha: ${new Date(stats.processingDate).toLocaleString('es-ES')}`);
  console.log(`\n📈 RESUMEN GENERAL:`);
  console.log(`  • Total de preguntas esperadas: ${stats.totalQuestions}`);
  console.log(`  • Preguntas procesadas: ${stats.processed}`);
  console.log(`  • Preguntas sin procesar: ${stats.notProcessed}`);
  console.log(`  • Tasa de procesamiento: ${((stats.processed / stats.totalQuestions) * 100).toFixed(1)}%`);
  
  console.log(`\n✅ VERIFICACIONES COMPLETADAS:`);
  console.log(`  • Verificadas correctamente: ${stats.verified}`);
  console.log(`  • Necesitan revisión: ${stats.needsReview}`);
  console.log(`  • Tasa de verificación: ${((stats.verified / stats.processed) * 100).toFixed(1)}%`);

  console.log(`\n🔒 CONFIANZA DE RESULTADOS:`);
  console.log(`  • Alta (HIGH): ${stats.confidenceBreakdown.high}`);
  console.log(`  • Media (MEDIUM): ${stats.confidenceBreakdown.medium}`);
  console.log(`  • Baja (LOW): ${stats.confidenceBreakdown.low}`);

  console.log(`\n📋 PRIMERAS 10 PREGUNTAS PROCESADAS:`);
  stats.details.slice(0, 10).forEach(detail => {
    const statusIcon = detail.status === 'verified' ? '✅' : '⚠️ ';
    console.log(`\n  ${detail.index}. ${statusIcon} ID: ${detail.questionId}`);
    console.log(`     Pregunta: ${detail.questionText}...`);
    console.log(`     Status: ${detail.topicReviewStatus}`);
    console.log(`     Confianza: ${detail.confidence}`);
  });

  // Guardar JSON detallado
  const reportJson = {
    ...stats,
    summary: {
      processedSuccessfully: stats.verified,
      needsManualReview: stats.needsReview,
      processingRate: `${((stats.processed / stats.totalQuestions) * 100).toFixed(1)}%`,
      verificationRate: `${((stats.verified / stats.processed) * 100).toFixed(1)}%`
    }
  };

  const reportPath = './word365_detailed_report.json';
  fs.writeFileSync(reportPath, JSON.stringify(reportJson, null, 2));
  
  console.log('\n' + '='.repeat(80));
  console.log(`📄 Reporte JSON guardado en: ${reportPath}`);
  console.log(`📄 Reporte anterior en: ./word365_verification_report.json`);
  console.log('='.repeat(80));

  return stats;
}

generateReport().catch(console.error);
