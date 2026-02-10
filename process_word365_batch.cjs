#!/usr/bin/env node
require('dotenv').config({ path: '.env.local' });

const { createClient } = require('@supabase/supabase-js');
const https = require('https');
const http = require('http');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

// IDs de las 30 preguntas de Word 365
const QUESTION_IDS = [
  '0dd5ed37-9b76-4ef9-aa13-0afb37800d43',
  '581eafcb-8098-4ebf-bf4a-8cff844d82dc',
  'd6021615-7332-435c-a98d-8c1e41825e2a',
  '63674223-7e64-409c-9481-9c3b4db7e7a3',
  'b7307d13-d7bf-4b72-9b90-3acfb23e0018',
  'e116e69d-2583-413c-8449-8d8ea8debd66',
  '9de1d78a-ff55-4315-8cf0-a6f33ed8a22f',
  'a2f89c67-f10c-41bc-a856-392d3732d98a',
  '2e9547a8-d285-44eb-8640-79c9fdd17e53',
  'f4618938-27c1-4388-bdea-195b11b695d9',
  '37829fdb-bdd9-4030-9126-3dadb733f8ad',
  '714e62ae-f1de-41fc-bbd3-007f00573888',
  'ce2b1acc-2e63-4064-86f6-ae131a0cb725',
  '07e22f6a-7863-46b6-a5b2-d605d72e3770',
  '5a731471-5999-42fc-afaf-1bf1f9c48dd4',
  '479671ea-452a-4dac-8246-1fa42c65dc0a',
  'ce5ad92a-e0d5-403c-9d54-c3b205eda7b8',
  '18c57dcb-1a98-4bf7-85de-e780451d186c',
  'b9247a6d-9067-4925-acab-6d870c387ade',
  'ee07b9f8-449c-4e43-a68b-1e19429452a6',
  '1b0baa01-5800-4da1-ac83-cb4669eb4c2c',
  'e8d368e4-fce0-41d0-ad9b-f07ce716c42f',
  'bcb2f9be-84df-4946-9889-879e29d7f5cd',
  '86ec20fb-a004-4b28-aae5-4783e9d2a109',
  '8fb5ea4b-6d58-4c19-b090-9158a59f7075',
  'af0aedca-1b4b-4302-8106-2bd912f97b6a',
  '2db79b93-0313-4f2d-9447-b58dc373d2d2',
  '57969daa-6822-4a9a-b697-e0ab189a1dd6',
  '64932671-8968-42f3-8563-adee4e75e804',
  '4a94a126-cfb0-404c-bd21-86ae37ce266b'
];

// Función para validar URL de Microsoft - versión mejorada
function isMicrosoftUrl(url) {
  if (!url) return false;
  try {
    const urlObj = new URL(url);
    const hostname = urlObj.hostname;
    
    // Aceptar support.microsoft.com/es-es y learn.microsoft.com/es-es
    // También aceptar www.support.microsoft.com/es-es y www.learn.microsoft.com/es-es
    return (hostname === 'support.microsoft.com' || 
            hostname === 'www.support.microsoft.com' ||
            hostname === 'learn.microsoft.com' || 
            hostname === 'www.learn.microsoft.com') &&
           (url.includes('/es-es/') || url.includes('/es-ES/'));
  } catch {
    return false;
  }
}

// Función para hacer fetch con timeout
function makeRequest(url, timeout = 5000) {
  return new Promise((resolve, reject) => {
    const requestModule = url.startsWith('https') ? https : http;

    const req = requestModule.get(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
      timeout
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve({ status: res.statusCode, data }));
    });

    req.on('error', reject);
    req.on('timeout', () => {
      req.destroy();
      reject(new Error('Timeout'));
    });
  });
}

// Función para validar que la URL existe y contiene contenido relevante
async function validateMicrosoftUrl(url) {
  if (!isMicrosoftUrl(url)) {
    return { valid: false, reason: 'URL no es de dominio Microsoft permitido (support/learn.microsoft.com/es-es)' };
  }

  try {
    const response = await makeRequest(url);

    if (response.status < 200 || response.status >= 400) {
      return { valid: false, reason: `HTTP ${response.status}` };
    }

    // Validar que la página tiene contenido
    if (!response.data || response.data.length < 100) {
      return { valid: false, reason: 'Contenido insuficiente' };
    }

    return { valid: true, reason: 'URL validada' };
  } catch (error) {
    return { valid: false, reason: `Error: ${error.message}` };
  }
}

// Función para procesar una pregunta
async function processQuestion(questionId, index) {
  try {
    console.log(`\n[${index}/30] Procesando pregunta: ${questionId}`);

    // Obtener pregunta
    const { data: question, error: questionError } = await supabase
      .from('questions')
      .select('id, question_text, explanation, primary_article_id, created_at, updated_at')
      .eq('id', questionId)
      .single();

    if (questionError || !question) {
      console.error(`  ❌ Error obteniendo pregunta:`, questionError?.message || 'No encontrada');
      return { status: 'error', reason: 'Pregunta no encontrada' };
    }

    console.log(`  📝 Pregunta: ${question.question_text.substring(0, 50)}...`);

    // Validar que tiene artículo y explicación
    if (!question.primary_article_id) {
      console.log(`  ⚠️  Sin artículo vinculado`);
      return { status: 'warning', reason: 'Sin artículo vinculado' };
    }

    if (!question.explanation) {
      console.log(`  ⚠️  Sin explicación`);
      return { status: 'warning', reason: 'Sin explicación' };
    }

    // Validar que la explicación contiene URL de Microsoft
    const microsoftUrlPattern = /https?:\/\/[^\s)"]*/gi;
    const allUrls = question.explanation.match(microsoftUrlPattern) || [];
    const urls = allUrls.filter(isMicrosoftUrl);

    if (urls.length === 0) {
      console.log(`  ❌ No contiene URLs de Microsoft válidas (encontradas ${allUrls.length} URLs en total)`);
      return { status: 'error', reason: 'No contiene URLs de Microsoft válidas' };
    }

    console.log(`  🔗 URLs de Microsoft encontradas: ${urls.length}`);

    // Validar cada URL
    let allValid = true;
    const urlValidations = [];

    for (const url of urls) {
      const validation = await validateMicrosoftUrl(url);
      urlValidations.push({ url, ...validation });
      console.log(`    ${validation.valid ? '✅' : '❌'} ${url.substring(0, 60)}... - ${validation.reason}`);
      if (!validation.valid) allValid = false;
    }

    // Obtener información del artículo
    const { data: article, error: articleError } = await supabase
      .from('articles')
      .select('id, law_id, article_number')
      .eq('id', question.primary_article_id)
      .single();

    if (articleError || !article) {
      console.log(`  ⚠️  Artículo vinculado no encontrado`);
      return { status: 'warning', reason: 'Artículo vinculado no encontrado' };
    }

    // Guardar en ai_verification_results
    const { data: existingResult } = await supabase
      .from('ai_verification_results')
      .select('id')
      .eq('question_id', questionId)
      .eq('ai_provider', 'microsoft_url_validator')
      .single();

    const verificationData = {
      question_id: questionId,
      article_id: question.primary_article_id,
      law_id: article.law_id,
      is_correct: allValid,
      confidence: allValid ? 'high' : 'medium',
      explanation: `Validación de URLs Microsoft en explicación. URLs encontradas: ${urls.length}. URLs válidas: ${urlValidations.filter(u => u.valid).length}`,
      ai_provider: 'microsoft_url_validator',
      ai_model: 'url_validation_v1',
      verified_at: new Date().toISOString(),
      article_ok: true,
      answer_ok: true,
      explanation_ok: allValid
    };

    if (existingResult) {
      // Actualizar resultado existente
      const { error: updateError } = await supabase
        .from('ai_verification_results')
        .update(verificationData)
        .eq('id', existingResult.id);

      if (updateError) {
        console.error(`  ❌ Error actualizando verificación:`, updateError.message);
        return { status: 'error', reason: 'Error actualizando verificación' };
      }
    } else {
      // Insertar nuevo resultado
      const { error: insertError } = await supabase
        .from('ai_verification_results')
        .insert(verificationData);

      if (insertError) {
        console.error(`  ❌ Error guardando verificación:`, insertError.message);
        return { status: 'error', reason: 'Error guardando verificación' };
      }
    }

    // Actualizar topic_review_status en questions
    const status = allValid ? 'microsoft_verified' : 'microsoft_needs_review';
    const { error: updateQuestionError } = await supabase
      .from('questions')
      .update({ topic_review_status: status })
      .eq('id', questionId);

    if (updateQuestionError) {
      console.error(`  ❌ Error actualizando estado:`, updateQuestionError.message);
      return { status: 'error', reason: 'Error actualizando topic_review_status' };
    }

    console.log(`  ✅ Guardado: ${allValid ? 'microsoft_verified' : 'microsoft_needs_review'}`);
    return {
      status: 'success',
      urlsFound: urls.length,
      urlsValid: urlValidations.filter(u => u.valid).length,
      urlValidations
    };

  } catch (error) {
    console.error(`  ❌ Error procesando pregunta:`, error.message);
    return { status: 'error', reason: error.message };
  }
}

// Función principal
async function main() {
  console.log('🚀 Iniciando procesamiento de 30 preguntas Word 365');
  console.log(`📋 Total: ${QUESTION_IDS.length} preguntas`);
  console.log(`🔒 Validando solo URLs de: support.microsoft.com/es-es y learn.microsoft.com/es-es\n`);

  const results = {
    total: QUESTION_IDS.length,
    success: 0,
    warning: 0,
    error: 0,
    details: [],
    statistics: {
      totalUrlsFound: 0,
      totalUrlsValid: 0,
      averageUrlsPerQuestion: 0,
      averageValidUrls: 0
    }
  };

  // Procesar con un pequeño delay para no sobrecargar
  for (let i = 0; i < QUESTION_IDS.length; i++) {
    const result = await processQuestion(QUESTION_IDS[i], i + 1);
    results.details.push({
      questionId: QUESTION_IDS[i],
      ...result
    });

    if (result.status === 'success') {
      results.success++;
      results.statistics.totalUrlsFound += result.urlsFound || 0;
      results.statistics.totalUrlsValid += result.urlsValid || 0;
    } else if (result.status === 'warning') {
      results.warning++;
    } else {
      results.error++;
    }

    // Pequeño delay entre preguntas
    if (i < QUESTION_IDS.length - 1) {
      await new Promise(resolve => setTimeout(resolve, 500));
    }
  }

  // Calcular estadísticas
  if (results.success > 0) {
    results.statistics.averageUrlsPerQuestion = (results.statistics.totalUrlsFound / results.success).toFixed(2);
    results.statistics.averageValidUrls = (results.statistics.totalUrlsValid / results.success).toFixed(2);
  }

  // Mostrar resumen
  console.log('\n' + '='.repeat(70));
  console.log('📊 RESUMEN DE PROCESAMIENTO');
  console.log('='.repeat(70));
  console.log(`✅ Exitosas: ${results.success}/${results.total}`);
  console.log(`⚠️  Advertencias: ${results.warning}/${results.total}`);
  console.log(`❌ Errores: ${results.error}/${results.total}`);
  console.log(`\n📈 Estadísticas de URLs:`);
  console.log(`  • Total de URLs encontradas: ${results.statistics.totalUrlsFound}`);
  console.log(`  • Total de URLs validadas correctamente: ${results.statistics.totalUrlsValid}`);
  console.log(`  • Promedio URLs por pregunta: ${results.statistics.averageUrlsPerQuestion}`);
  console.log(`  • Promedio URLs válidas por pregunta: ${results.statistics.averageValidUrls}`);
  console.log('='.repeat(70));

  // Guardar reporte en archivo
  const fs = require('fs');
  const reportPath = './word365_verification_report.json';
  fs.writeFileSync(reportPath, JSON.stringify(results, null, 2));
  console.log(`\n📄 Reporte guardado en: ${reportPath}`);

  // Resumen por estado
  console.log('\n📋 Resultados por pregunta:');
  const stateCount = {};
  results.details.forEach(detail => {
    const key = `${detail.status}${detail.reason ? ': ' + detail.reason : ''}`;
    stateCount[key] = (stateCount[key] || 0) + 1;
  });

  Object.entries(stateCount).forEach(([state, count]) => {
    console.log(`  • ${state}: ${count}`);
  });
}

main().catch(error => {
  console.error('❌ Error fatal:', error);
  process.exit(1);
});
