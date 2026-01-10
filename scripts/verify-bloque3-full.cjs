/**
 * Script completo para verificar preguntas del Bloque III
 * Analiza pregunta + artículo y determina estado de verificación
 */

require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY // Usar service role para poder escribir
);

// Configuración
const AI_PROVIDER = 'claude_code';
const AI_MODEL = 'claude-opus-4-5';
const BATCH_SIZE = 20;

// Mapeo de estados según la tabla de verdad
function getReviewStatus(articleOk, answerOk, explanationOk) {
  if (articleOk && answerOk && explanationOk) return 'perfect';
  if (articleOk && answerOk && !explanationOk) return 'bad_explanation';
  if (articleOk && !answerOk && explanationOk) return 'bad_answer';
  if (articleOk && !answerOk && !explanationOk) return 'bad_answer_and_explanation';
  if (!articleOk && answerOk && explanationOk) return 'wrong_article';
  if (!articleOk && answerOk && !explanationOk) return 'wrong_article_bad_explanation';
  if (!articleOk && !answerOk && explanationOk) return 'wrong_article_bad_answer';
  return 'all_wrong';
}

// Obtener preguntas pendientes con su artículo
async function getPendingQuestions(topicId, limit = 20, offset = 0) {
  // Primero obtener el scope del topic
  const { data: scope } = await supabase
    .from('topic_scope')
    .select('law_id')
    .eq('topic_id', topicId);

  if (!scope || scope.length === 0) {
    return { questions: [], total: 0 };
  }

  const lawIds = [...new Set(scope.map(s => s.law_id))];

  // Obtener artículos de esas leyes
  const { data: articles } = await supabase
    .from('articles')
    .select('id')
    .in('law_id', lawIds);

  if (!articles) {
    return { questions: [], total: 0 };
  }

  const articleIds = articles.map(a => a.id);

  // Contar total
  const { count } = await supabase
    .from('questions')
    .select('id', { count: 'exact', head: true })
    .in('primary_article_id', articleIds)
    .or('topic_review_status.is.null,topic_review_status.eq.pending')
    .eq('is_active', true);

  // Obtener preguntas con artículo relacionado
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
      articles!inner (
        id,
        article_number,
        title,
        content,
        law_id,
        laws (
          id,
          short_name,
          name
        )
      )
    `)
    .in('primary_article_id', articleIds)
    .or('topic_review_status.is.null,topic_review_status.eq.pending')
    .eq('is_active', true)
    .range(offset, offset + limit - 1);

  if (error) {
    console.error('Error obteniendo preguntas:', error);
    return { questions: [], total: 0 };
  }

  return { questions: questions || [], total: count || 0 };
}

// Analizar una pregunta con su artículo
function analyzeQuestion(question) {
  const article = question.articles;
  const law = article?.laws;

  // Si no hay contenido de artículo, no podemos verificar
  if (!article?.content) {
    return {
      articleOk: false,
      answerOk: null, // No se puede determinar
      explanationOk: null,
      notes: 'Artículo sin contenido disponible'
    };
  }

  const articleContent = article.content.toLowerCase();
  const questionText = question.question_text.toLowerCase();
  const explanation = question.explanation.toLowerCase();

  const options = [
    question.option_a,
    question.option_b,
    question.option_c,
    question.option_d
  ];
  const correctOption = options[question.correct_option];
  const correctOptionLower = correctOption.toLowerCase();

  // Verificar si el artículo es relevante para la pregunta
  // Buscar términos clave de la pregunta en el artículo
  const questionKeywords = extractKeywords(questionText);
  const articleMatchScore = calculateMatchScore(questionKeywords, articleContent);

  // Verificar si la respuesta correcta se puede derivar del artículo
  const answerInArticle = checkAnswerInArticle(correctOptionLower, articleContent);

  // Verificar coherencia de la explicación
  const explanationCoherent = checkExplanationCoherence(explanation, article, correctOption);

  // Determinar estados
  const articleOk = articleMatchScore > 0.3; // Al menos 30% de keywords coinciden
  const answerOk = answerInArticle;
  const explanationOk = explanationCoherent;

  return {
    articleOk,
    answerOk,
    explanationOk,
    matchScore: articleMatchScore,
    notes: `Match: ${(articleMatchScore * 100).toFixed(1)}%, Answer in article: ${answerInArticle}, Explanation coherent: ${explanationCoherent}`
  };
}

// Extraer palabras clave de un texto
function extractKeywords(text) {
  const stopWords = new Set([
    'el', 'la', 'los', 'las', 'un', 'una', 'unos', 'unas', 'de', 'del', 'al',
    'en', 'por', 'para', 'con', 'sin', 'sobre', 'entre', 'que', 'es', 'son',
    'se', 'su', 'sus', 'este', 'esta', 'estos', 'estas', 'cual', 'cuales',
    'como', 'cuando', 'donde', 'quien', 'quienes', 'cuanto', 'cuanta',
    'todo', 'toda', 'todos', 'todas', 'otro', 'otra', 'otros', 'otras',
    'mismo', 'misma', 'mismos', 'mismas', 'tal', 'tales', 'muy', 'mas',
    'menos', 'mucho', 'mucha', 'muchos', 'muchas', 'poco', 'poca', 'pocos',
    'alguno', 'alguna', 'algunos', 'algunas', 'ninguno', 'ninguna', 'cada',
    'siguiente', 'siguientes', 'anterior', 'anteriores', 'primero', 'primera',
    'segundo', 'segunda', 'tercero', 'tercera', 'ultimo', 'ultima',
    'ser', 'estar', 'tener', 'hacer', 'poder', 'deber', 'ir', 'ver', 'dar',
    'saber', 'querer', 'llegar', 'pasar', 'seguir', 'encontrar', 'venir',
    'no', 'si', 'pero', 'porque', 'aunque', 'sino', 'ni', 'ya', 'aun', 'asi'
  ]);

  return text
    .replace(/[^\w\sáéíóúüñ]/g, ' ')
    .split(/\s+/)
    .filter(word => word.length > 3 && !stopWords.has(word));
}

// Calcular score de coincidencia
function calculateMatchScore(keywords, content) {
  if (keywords.length === 0) return 0;

  const matches = keywords.filter(kw => content.includes(kw));
  return matches.length / keywords.length;
}

// Verificar si la respuesta está en el artículo
function checkAnswerInArticle(answer, articleContent) {
  // Extraer palabras clave de la respuesta
  const answerKeywords = extractKeywords(answer);

  if (answerKeywords.length === 0) return true; // Si no hay keywords, asumir ok

  const matchScore = calculateMatchScore(answerKeywords, articleContent);
  return matchScore > 0.4; // Al menos 40% de coincidencia
}

// Verificar coherencia de la explicación
function checkExplanationCoherence(explanation, article, correctOption) {
  // Verificar que la explicación menciona el artículo
  const mentionsArticle = explanation.includes('artículo') ||
                          explanation.includes('art.') ||
                          explanation.includes(article.article_number.toLowerCase());

  // Verificar que la explicación contiene términos de la respuesta correcta
  const answerKeywords = extractKeywords(correctOption.toLowerCase());
  const matchesAnswer = answerKeywords.some(kw => explanation.includes(kw));

  return mentionsArticle || matchesAnswer;
}

// Guardar resultado de verificación
async function saveVerificationResult(questionId, articleId, lawId, analysis) {
  const status = getReviewStatus(analysis.articleOk, analysis.answerOk, analysis.explanationOk);

  // Insertar en ai_verification_results
  const { error: insertError } = await supabase
    .from('ai_verification_results')
    .upsert({
      question_id: questionId,
      article_id: articleId,
      law_id: lawId,
      article_ok: analysis.articleOk,
      answer_ok: analysis.answerOk,
      explanation_ok: analysis.explanationOk,
      is_correct: status === 'perfect',
      confidence: analysis.matchScore > 0.7 ? 'high' : analysis.matchScore > 0.4 ? 'medium' : 'low',
      explanation: analysis.notes,
      ai_provider: AI_PROVIDER,
      ai_model: AI_MODEL,
      verified_at: new Date().toISOString()
    }, {
      onConflict: 'question_id,ai_provider'
    });

  if (insertError) {
    console.error(`Error guardando verificación para ${questionId}:`, insertError);
    return false;
  }

  // Actualizar topic_review_status en questions
  const { error: updateError } = await supabase
    .from('questions')
    .update({ topic_review_status: status })
    .eq('id', questionId);

  if (updateError) {
    console.error(`Error actualizando status para ${questionId}:`, updateError);
    return false;
  }

  return true;
}

// Procesar un lote de preguntas
async function processBatch(topicId, topicName, offset = 0) {
  const { questions, total } = await getPendingQuestions(topicId, BATCH_SIZE, offset);

  if (questions.length === 0) {
    console.log(`  No hay más preguntas pendientes`);
    return { processed: 0, remaining: 0 };
  }

  console.log(`  Procesando ${questions.length} preguntas (offset: ${offset}, total: ${total})...`);

  let stats = { perfect: 0, bad_explanation: 0, bad_answer: 0, wrong_article: 0, other: 0 };

  for (const question of questions) {
    const analysis = analyzeQuestion(question);
    const status = getReviewStatus(analysis.articleOk, analysis.answerOk, analysis.explanationOk);

    const saved = await saveVerificationResult(
      question.id,
      question.articles.id,
      question.articles.law_id,
      analysis
    );

    if (saved) {
      if (status === 'perfect') stats.perfect++;
      else if (status === 'bad_explanation') stats.bad_explanation++;
      else if (status.includes('bad_answer')) stats.bad_answer++;
      else if (status.includes('wrong_article')) stats.wrong_article++;
      else stats.other++;
    }
  }

  console.log(`  Resultados: ${stats.perfect} perfect, ${stats.bad_explanation} bad_expl, ${stats.bad_answer} bad_ans, ${stats.wrong_article} wrong_art, ${stats.other} other`);

  return { processed: questions.length, remaining: total - offset - questions.length };
}

// Procesar un tema completo
async function processTopic(topicId, topicName) {
  console.log(`\n=== Procesando ${topicName} ===`);

  let totalProcessed = 0;
  let iterations = 0;
  const MAX_ITERATIONS = 100; // Prevenir loops infinitos

  // Siempre usar offset 0 ya que las preguntas procesadas desaparecen del query
  while (iterations < MAX_ITERATIONS) {
    const { processed, remaining } = await processBatch(topicId, topicName, 0);
    totalProcessed += processed;
    iterations++;

    if (processed === 0) break;

    // Pequeña pausa entre lotes
    await new Promise(r => setTimeout(r, 300));
  }

  console.log(`  Total procesado para ${topicName}: ${totalProcessed} preguntas`);
  return totalProcessed;
}

// Main
async function main() {
  const topics = [
    { id: 'd17fcc5f-71e6-46a4-bda6-d2fdf736151b', name: 'T302 - El Acto Administrativo' },
    { id: '6be5f664-d4a2-4c17-89db-e9be6c115ad2', name: 'T304 - Contratos del Sector Público' },
    { id: 'bf5af91a-8616-45a0-8df0-b83ed330baeb', name: 'T305 - Procedimientos y Formas' },
    { id: '892eb191-99dc-4c5a-bb52-0a40ac624019', name: 'T306 - Responsabilidad Patrimonial' }
  ];

  console.log('=== Verificación Bloque III (T302-T307) ===');
  console.log(`Fecha: ${new Date().toISOString()}`);
  console.log(`Provider: ${AI_PROVIDER}, Model: ${AI_MODEL}`);
  console.log(`Batch size: ${BATCH_SIZE}`);

  let grandTotal = 0;

  for (const topic of topics) {
    const processed = await processTopic(topic.id, topic.name);
    grandTotal += processed;
  }

  console.log(`\n=== RESUMEN FINAL ===`);
  console.log(`Total preguntas procesadas: ${grandTotal}`);
}

// Ejecutar si es el script principal
if (require.main === module) {
  main().catch(console.error);
}

module.exports = { processTopic, processBatch, analyzeQuestion };
