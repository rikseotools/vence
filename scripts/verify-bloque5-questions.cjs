/**
 * Script para verificar preguntas pendientes del Bloque V (Gestion Financiera)
 * Temas T501-T506 de Administrativo C1
 */

require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// Topic IDs del Bloque V
const TOPIC_IDS = {
  T501: '8e203ad7-fbed-468a-9dc8-3e2bb1712a9f',
  T502: 'c3217fd8-36a6-4db5-b3d3-2c5c4609fac0',
  T503: '12e98818-f2f3-4a58-81b8-80458acfde82',
  T504: 'f8313330-7e5a-4e91-94bf-105fbfdf9033',
  T505: '81105000-6aae-43d1-8751-089942df87c0',
  T506: 'fb06a9fd-6d64-4b0b-ac12-6174f1c87051'
};

const AI_PROVIDER = 'claude_code';
const AI_MODEL = 'claude-opus-4-5';

// Mapping de opciones
const OPTION_LETTERS = ['A', 'B', 'C', 'D'];

/**
 * Determina el status basado en los resultados de verificacion
 */
function determineStatus(articleOk, answerOk, explanationOk) {
  if (articleOk && answerOk && explanationOk) return 'perfect';
  if (articleOk && answerOk && !explanationOk) return 'bad_explanation';
  if (articleOk && !answerOk && explanationOk) return 'bad_answer';
  if (articleOk && !answerOk && !explanationOk) return 'bad_answer_and_explanation';
  if (!articleOk && answerOk && explanationOk) return 'wrong_article';
  if (!articleOk && answerOk && !explanationOk) return 'wrong_article_bad_explanation';
  if (!articleOk && !answerOk && explanationOk) return 'wrong_article_bad_answer';
  return 'all_wrong';
}

/**
 * Obtiene preguntas pendientes de un topic
 */
async function getPendingQuestions(topicId, limit = 20) {
  // Primero obtener los article_ids del topic_scope
  const { data: scopeData, error: scopeError } = await supabase
    .from('topic_scope')
    .select('article_numbers, law_id')
    .eq('topic_id', topicId);

  if (scopeError) {
    console.error('Error fetching topic_scope:', scopeError);
    return [];
  }

  // Obtener los article IDs basados en el scope
  let articleIds = [];
  for (const scope of scopeData) {
    if (!scope.article_numbers || !scope.law_id) continue;

    const { data: articles } = await supabase
      .from('articles')
      .select('id')
      .eq('law_id', scope.law_id)
      .in('article_number', scope.article_numbers);

    if (articles) {
      articleIds.push(...articles.map(a => a.id));
    }
  }

  if (articleIds.length === 0) {
    console.log('No article IDs found for topic');
    return [];
  }

  // Obtener preguntas pendientes
  const { data: questions, error } = await supabase
    .from('questions')
    .select(`
      id,
      question_text,
      option_a,
      option_b,
      option_c,
      option_d,
      correct_option,
      explanation,
      primary_article_id,
      is_active
    `)
    .in('primary_article_id', articleIds)
    .is('topic_review_status', null)
    .eq('is_active', true)
    .limit(limit);

  if (error) {
    console.error('Error fetching questions:', error);
    return [];
  }

  return questions || [];
}

/**
 * Obtiene el articulo y su ley
 */
async function getArticleWithLaw(articleId) {
  const { data, error } = await supabase
    .from('articles')
    .select(`
      id,
      article_number,
      title,
      content,
      law_id,
      laws!inner (
        id,
        short_name,
        name
      )
    `)
    .eq('id', articleId)
    .single();

  if (error) {
    console.error('Error fetching article:', error);
    return null;
  }

  return data;
}

/**
 * Analiza una pregunta y determina si es correcta
 */
function analyzeQuestion(question, article) {
  const results = {
    articleOk: true,
    answerOk: true,
    explanationOk: true,
    confidence: 'high',
    explanation: '',
    suggestedFix: null,
    correctOptionShouldBe: null,
    explanationFix: null
  };

  // Si no hay contenido del articulo, no podemos verificar
  if (!article || !article.content) {
    results.articleOk = false;
    results.explanation = 'El articulo no tiene contenido para verificar';
    results.confidence = 'low';
    return results;
  }

  const questionText = question.question_text.toLowerCase();
  const articleContent = article.content.toLowerCase();
  const correctOptionIndex = question.correct_option;
  const correctOptionText = [
    question.option_a,
    question.option_b,
    question.option_c,
    question.option_d
  ][correctOptionIndex];
  const explanation = question.explanation || '';

  // 1. Verificar si el articulo es relevante para la pregunta
  // Buscamos palabras clave de la pregunta en el articulo
  const keywords = extractKeywords(questionText);
  const keywordsInArticle = keywords.filter(kw => articleContent.includes(kw));

  if (keywordsInArticle.length < keywords.length * 0.3) {
    // Menos del 30% de las keywords estan en el articulo
    results.articleOk = false;
    results.explanation = `El articulo ${article.article_number} de ${article.laws.short_name} no parece contener informacion relevante para esta pregunta`;
    results.confidence = 'medium';
  }

  // 2. Verificar si la respuesta correcta parece estar fundamentada en el articulo
  if (correctOptionText) {
    const optionKeywords = extractKeywords(correctOptionText.toLowerCase());
    const optionKeywordsInArticle = optionKeywords.filter(kw => articleContent.includes(kw));

    if (results.articleOk && optionKeywordsInArticle.length < optionKeywords.length * 0.3) {
      // La respuesta correcta no parece estar en el articulo
      results.answerOk = false;
      results.explanation += `. La respuesta marcada como correcta (${OPTION_LETTERS[correctOptionIndex]}) no parece estar fundamentada en el articulo`;
      results.confidence = 'medium';
    }
  }

  // 3. Verificar coherencia de la explicacion
  if (explanation) {
    // Verificar que la explicacion mencione el articulo correcto
    const mentionsArticle = explanation.includes(article.article_number) ||
                           explanation.toLowerCase().includes(article.laws.short_name.toLowerCase());

    if (!mentionsArticle && results.articleOk) {
      // La explicacion no menciona el articulo pero deberia
      results.explanationOk = false;
      results.explanation += `. La explicacion no hace referencia al articulo ${article.article_number}`;
      results.explanationFix = `Deberia mencionar el articulo ${article.article_number} de ${article.laws.short_name}`;
    }
  }

  // Si todo parece OK
  if (results.articleOk && results.answerOk && results.explanationOk) {
    results.explanation = `Verificado correctamente contra el articulo ${article.article_number} de ${article.laws.short_name}`;
  }

  return results;
}

/**
 * Extrae palabras clave de un texto (excluyendo stopwords)
 */
function extractKeywords(text) {
  const stopwords = ['el', 'la', 'los', 'las', 'un', 'una', 'unos', 'unas', 'de', 'del',
    'en', 'con', 'por', 'para', 'se', 'su', 'sus', 'que', 'es', 'son', 'y', 'o', 'a',
    'al', 'como', 'cual', 'cuales', 'cuando', 'donde', 'si', 'no', 'mas', 'menos',
    'segun', 'articulo', 'ley', 'real', 'decreto', 'siguiente', 'siguientes', 'entre',
    'todos', 'todas', 'todo', 'toda', 'este', 'esta', 'estos', 'estas', 'ese', 'esa',
    'esos', 'esas', 'aquel', 'aquella', 'aquellos', 'aquellas', 'cual', 'cuales'];

  return text
    .replace(/[^\w\s]/g, ' ')
    .split(/\s+/)
    .filter(word => word.length > 3 && !stopwords.includes(word));
}

/**
 * Guarda el resultado de verificacion
 */
async function saveVerificationResult(question, article, analysis) {
  const status = determineStatus(analysis.articleOk, analysis.answerOk, analysis.explanationOk);

  // Insertar en ai_verification_results
  const { error: insertError } = await supabase
    .from('ai_verification_results')
    .upsert({
      question_id: question.id,
      article_id: article?.id,
      law_id: article?.law_id,
      is_correct: status === 'perfect',
      confidence: analysis.confidence,
      explanation: analysis.explanation,
      article_quote: article?.content?.substring(0, 500),
      suggested_fix: analysis.suggestedFix,
      correct_option_should_be: analysis.correctOptionShouldBe,
      ai_provider: AI_PROVIDER,
      ai_model: AI_MODEL,
      article_ok: analysis.articleOk,
      answer_ok: analysis.answerOk,
      explanation_ok: analysis.explanationOk,
      explanation_fix: analysis.explanationFix
    }, {
      onConflict: 'question_id,ai_provider'
    });

  if (insertError) {
    console.error('Error inserting verification result:', insertError);
    return false;
  }

  // Actualizar topic_review_status en questions
  const { error: updateError } = await supabase
    .from('questions')
    .update({ topic_review_status: status })
    .eq('id', question.id);

  if (updateError) {
    console.error('Error updating question status:', updateError);
    return false;
  }

  return true;
}

/**
 * Procesa un lote de preguntas
 */
async function processBatch(topicId, topicName, batchSize = 20) {
  console.log(`\n=== Procesando ${topicName} ===`);

  const questions = await getPendingQuestions(topicId, batchSize);
  console.log(`Encontradas ${questions.length} preguntas pendientes`);

  if (questions.length === 0) {
    console.log('No hay preguntas pendientes para este tema');
    return { processed: 0, perfect: 0, issues: 0 };
  }

  let processed = 0;
  let perfect = 0;
  let issues = 0;

  for (const question of questions) {
    const article = await getArticleWithLaw(question.primary_article_id);

    if (!article) {
      console.log(`  [!] Pregunta ${question.id}: No se encontro el articulo`);
      issues++;
      continue;
    }

    const analysis = analyzeQuestion(question, article);
    const status = determineStatus(analysis.articleOk, analysis.answerOk, analysis.explanationOk);

    const saved = await saveVerificationResult(question, article, analysis);

    if (saved) {
      processed++;
      if (status === 'perfect') {
        perfect++;
        console.log(`  [OK] ${question.id.substring(0, 8)} - Art. ${article.article_number} (${article.laws.short_name})`);
      } else {
        issues++;
        console.log(`  [${status.toUpperCase()}] ${question.id.substring(0, 8)} - ${analysis.explanation.substring(0, 80)}`);
      }
    }
  }

  return { processed, perfect, issues };
}

/**
 * Funcion principal
 */
async function main() {
  const args = process.argv.slice(2);
  const topicArg = args[0]; // T501, T502, etc. o 'all'
  const batchSize = parseInt(args[1]) || 20;

  console.log('=================================');
  console.log('Verificacion de Preguntas - Bloque V');
  console.log('=================================');
  console.log(`AI Provider: ${AI_PROVIDER}`);
  console.log(`AI Model: ${AI_MODEL}`);
  console.log(`Batch size: ${batchSize}`);
  console.log('');

  const topicsToProcess = topicArg && topicArg !== 'all'
    ? { [topicArg]: TOPIC_IDS[topicArg] }
    : TOPIC_IDS;

  const results = {};

  for (const [topicName, topicId] of Object.entries(topicsToProcess)) {
    if (!topicId) {
      console.log(`Topic ${topicName} no encontrado`);
      continue;
    }

    results[topicName] = await processBatch(topicId, topicName, batchSize);
  }

  console.log('\n=================================');
  console.log('RESUMEN');
  console.log('=================================');

  let totalProcessed = 0;
  let totalPerfect = 0;
  let totalIssues = 0;

  for (const [topic, stats] of Object.entries(results)) {
    console.log(`${topic}: ${stats.processed} procesadas (${stats.perfect} perfectas, ${stats.issues} con problemas)`);
    totalProcessed += stats.processed;
    totalPerfect += stats.perfect;
    totalIssues += stats.issues;
  }

  console.log('---');
  console.log(`TOTAL: ${totalProcessed} procesadas (${totalPerfect} perfectas, ${totalIssues} con problemas)`);
}

main().catch(console.error);
