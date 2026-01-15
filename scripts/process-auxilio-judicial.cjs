#!/usr/bin/env node
/**
 * Script para procesar preguntas de Auxilio Judicial
 * Añade primary_article_id y explicaciones didácticas
 */

const { createClient } = require('@supabase/supabase-js');

require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// IDs de leyes principales en la BD
const LAWS_IDS = {
  'LOPJ': 'a3d58ada-b284-46f7-ab7c-2092d4bb06ff',      // LO 6/1985
  'CE': '6ad91a6c-41ec-431f-9c80-5f5566834941',        // Constitución
  'LECrim': '8ea21d39-5f6c-4d4c-801b-ffdf7ca366e5',    // Ley Enjuiciamiento Criminal
  'LEC': '14b4b825-2078-44cb-bff8-53d332c4f473',       // Ley 1/2000
  'LRC': '5521d2cf-010d-4641-8054-0690a9d0e70d',       // Ley 20/2011 Registro Civil
  'LRJS': 'b468b0f9-590c-4872-99d5-eba966980cfe',      // Ley 36/2011
  'LJCA': '07daa1fe-7e8e-4e2d-9a33-6893229869e0',      // Ley 29/1998
  'LPAC': '218452f5-b9f6-48f0-a25b-26df9cb19644',      // Ley 39/2015
  'LO_3_2007': '6e59eacd-9298-4164-9d78-9e9343d9a900', // LO Igualdad
  'LPRL': '8b1ae300-4ed3-4019-876c-780ea40ebbfe',      // Ley 31/1995
  'LJV': '2b403577-4a8e-45f3-8320-0a7b819203cb',       // Ley 15/2015 Jurisdicción Voluntaria
  'RDAJ': 'c1700262-1ccb-41fd-a024-355d9795c441',      // RD 1608/2005
  'Ley_19_2013': 'a7bd0e06-7dcb-4a25-911b-e16f6e5e0798', // Transparencia
  'LO_4_1981': 'd129456b-51ab-4e09-bd30-731386c1aff5', // Estados de alarma
  'Ley_4_2023': 'd3a41325-047e-4d6a-99c5-fd8d5c8dc782', // Ley Trans/LGTBI
  'RDL_6_2023': '9218e38c-f514-4c5a-82ad-4e6281ffc58f', // RDL Justicia
};

// Patrones para detectar leyes en el texto de la pregunta
const LAW_PATTERNS = [
  { regex: /Ley Orgánica 6\/1985|LOPJ|Poder Judicial/i, lawId: LAWS_IDS.LOPJ, shortName: 'LOPJ' },
  { regex: /Constitución|artículo \d+ CE\b|CE\s*\)/i, lawId: LAWS_IDS.CE, shortName: 'CE' },
  { regex: /Ley de Enjuiciamiento Criminal|LECrim/i, lawId: LAWS_IDS.LECrim, shortName: 'LECrim' },
  { regex: /Ley 1\/2000|Enjuiciamiento Civil|LEC\b/i, lawId: LAWS_IDS.LEC, shortName: 'LEC' },
  { regex: /Ley 20\/2011|Registro Civil|LRC\b/i, lawId: LAWS_IDS.LRC, shortName: 'LRC' },
  { regex: /Ley 36\/2011|Jurisdicción Social|LRJS/i, lawId: LAWS_IDS.LRJS, shortName: 'LRJS' },
  { regex: /Ley 29\/1998|Contencioso-?administrativa|LJCA/i, lawId: LAWS_IDS.LJCA, shortName: 'LJCA' },
  { regex: /Ley 39\/2015|Procedimiento Administrativo|LPAC/i, lawId: LAWS_IDS.LPAC, shortName: 'LPAC' },
  { regex: /Ley Orgánica 3\/2007|igualdad efectiva.*mujeres/i, lawId: LAWS_IDS.LO_3_2007, shortName: 'LO 3/2007' },
  { regex: /Ley 31\/1995|Prevención de Riesgos|LPRL/i, lawId: LAWS_IDS.LPRL, shortName: 'LPRL' },
  { regex: /Ley 15\/2015|Jurisdicción Voluntaria|LJV/i, lawId: LAWS_IDS.LJV, shortName: 'LJV' },
  { regex: /Carta de Derechos.*ciudadanos.*Justicia/i, lawId: null, shortName: 'Carta Derechos' },
  { regex: /Ley 19\/2013|Transparencia/i, lawId: LAWS_IDS.Ley_19_2013, shortName: 'Ley Transparencia' },
  { regex: /Ley Orgánica 4\/1981|estados de alarma/i, lawId: LAWS_IDS.LO_4_1981, shortName: 'LO 4/1981' },
  { regex: /Ley 4\/2023.*trans|LGTBI/i, lawId: LAWS_IDS.Ley_4_2023, shortName: 'Ley 4/2023' },
  { regex: /Real Decreto-?ley 6\/2023/i, lawId: LAWS_IDS.RDL_6_2023, shortName: 'RDL 6/2023' },
];

// Extraer número de artículo del texto
function extractArticleNumber(text) {
  // Buscar patrones como "artículo 72", "art. 311", "artículo 757.2"
  const patterns = [
    /artículo\s+(\d+(?:\.\d+)?(?:\s*bis)?)/i,
    /art\.\s*(\d+(?:\.\d+)?(?:\s*bis)?)/i,
    /artículos?\s+(\d+)/i,
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) {
      return match[1].trim();
    }
  }
  return null;
}

// Detectar la ley mencionada en la pregunta
function detectLaw(text) {
  for (const pattern of LAW_PATTERNS) {
    if (pattern.regex.test(text)) {
      return { lawId: pattern.lawId, shortName: pattern.shortName };
    }
  }
  return null;
}

// Buscar artículo en la BD
async function findArticle(lawId, articleNumber) {
  if (!lawId || !articleNumber) return null;

  // Normalizar el número de artículo (puede ser "72", "72.1", "72 bis", etc.)
  const baseNumber = articleNumber.toString().split('.')[0].replace(/\s*bis/i, '');

  // Buscar exacto primero
  let { data: article } = await supabase
    .from('articles')
    .select('id, article_number, title, content')
    .eq('law_id', lawId)
    .eq('article_number', articleNumber)
    .single();

  if (article) return article;

  // Buscar por número base
  ({ data: article } = await supabase
    .from('articles')
    .select('id, article_number, title, content')
    .eq('law_id', lawId)
    .eq('article_number', baseNumber)
    .single());

  if (article) return article;

  // Buscar con patrón LIKE
  ({ data: article } = await supabase
    .from('articles')
    .select('id, article_number, title, content')
    .eq('law_id', lawId)
    .ilike('article_number', `${baseNumber}%`)
    .limit(1)
    .single());

  return article;
}

// Generar explicación didáctica
function generateExplanation(question, correctOptionLetter, article, lawShortName, articleNumber) {
  const optionKey = `option_${correctOptionLetter.toLowerCase()}`;
  const correctText = question[optionKey];

  // Base de la explicación
  let explanation = '';

  // Si tenemos información del artículo
  if (articleNumber && lawShortName) {
    explanation = `La respuesta correcta es la ${correctOptionLetter}. `;

    // Explicación específica según el contenido de la pregunta
    if (question.question_text.includes('plazo')) {
      explanation += `El artículo ${articleNumber} de la ${lawShortName} establece específicamente este plazo. `;
    } else if (question.question_text.includes('Salas') || question.question_text.includes('composición')) {
      explanation += `Según el artículo ${articleNumber} de la ${lawShortName}, esta es la composición establecida legalmente. `;
    } else if (question.question_text.includes('recurso')) {
      explanation += `El artículo ${articleNumber} de la ${lawShortName} regula los recursos aplicables en este procedimiento. `;
    } else if (question.question_text.includes('competencia') || question.question_text.includes('competente')) {
      explanation += `El artículo ${articleNumber} de la ${lawShortName} determina la competencia en estos casos. `;
    } else if (question.question_text.includes('notificación') || question.question_text.includes('notificar')) {
      explanation += `El artículo ${articleNumber} de la ${lawShortName} establece los requisitos para las notificaciones. `;
    } else {
      explanation += `Conforme al artículo ${articleNumber} de la ${lawShortName}, esta es la regulación vigente. `;
    }

    // Añadir contexto adicional si hay contenido del artículo
    if (article && article.content) {
      const contentPreview = article.content.substring(0, 200);
      if (contentPreview.includes(correctText?.substring(0, 30))) {
        explanation += 'El texto literal del artículo confirma esta opción.';
      }
    }
  } else {
    // Sin artículo específico identificado
    explanation = `La respuesta correcta es la ${correctOptionLetter}. `;

    if (question.question_text.includes('Carta de Derechos')) {
      explanation += 'Según la Carta de Derechos de los ciudadanos ante la Justicia, este es el criterio establecido para garantizar los derechos de los usuarios del sistema judicial.';
    } else {
      explanation += 'Esta opción recoge fielmente lo establecido en la normativa aplicable.';
    }
  }

  return explanation;
}

// Cache de artículos para evitar consultas repetidas
const articleCache = new Map();

async function findArticleCached(lawId, articleNumber) {
  const key = `${lawId}-${articleNumber}`;
  if (articleCache.has(key)) {
    return articleCache.get(key);
  }
  const article = await findArticle(lawId, articleNumber);
  articleCache.set(key, article);
  return article;
}

async function processQuestions(startIndex, endIndex) {
  console.log(`\n=== Procesando preguntas ${startIndex + 1} a ${endIndex} ===\n`);

  // Obtener todas las preguntas de Auxilio Judicial
  const { data: allQuestions, error } = await supabase
    .from('questions')
    .select('id, question_text, option_a, option_b, option_c, option_d, correct_option, explanation, primary_article_id')
    .ilike('exam_source', '%Auxilio Judicial%')
    .order('created_at', { ascending: true });

  if (error) {
    console.error('Error obteniendo preguntas:', error);
    return;
  }

  const questions = allQuestions.slice(startIndex, endIndex);
  let processed = 0;
  let updated = 0;
  let skipped = 0;

  for (const question of questions) {
    processed++;
    const idx = startIndex + processed;

    // Detectar ley y artículo
    const lawInfo = detectLaw(question.question_text);
    const articleNumber = extractArticleNumber(question.question_text);

    // Buscar artículo en BD si tenemos ley y número
    let article = null;
    if (lawInfo?.lawId && articleNumber) {
      article = await findArticleCached(lawInfo.lawId, articleNumber);
    }

    // Generar explicación
    const correctLetter = ['A', 'B', 'C', 'D'][question.correct_option];
    const newExplanation = generateExplanation(
      question,
      correctLetter,
      article,
      lawInfo?.shortName,
      articleNumber
    );

    // Determinar primary_article_id
    const newArticleId = article?.id || question.primary_article_id;

    // Solo actualizar si hay cambios significativos
    const currentExplanation = question.explanation || '';
    const needsUpdate =
      currentExplanation.includes('Pregunta oficial del examen') ||
      currentExplanation.includes('Pendiente') ||
      currentExplanation.trim() === '' ||
      (article && question.primary_article_id !== article.id);

    if (needsUpdate) {
      // Actualizar en BD
      const { error: updateError } = await supabase
        .from('questions')
        .update({
          explanation: newExplanation,
          primary_article_id: newArticleId,
          updated_at: new Date().toISOString()
        })
        .eq('id', question.id);

      if (updateError) {
        console.error(`❌ Error actualizando pregunta ${idx}:`, updateError);
      } else {
        updated++;
        console.log(`✅ [${idx}] Actualizada - Ley: ${lawInfo?.shortName || 'N/A'}, Art: ${articleNumber || 'N/A'}`);
      }
    } else {
      skipped++;
      console.log(`⏭️  [${idx}] Ya procesada`);
    }

    // Mostrar progreso cada 10 preguntas
    if (processed % 10 === 0) {
      console.log(`\n--- Progreso: ${processed}/${questions.length} (${updated} actualizadas, ${skipped} omitidas) ---\n`);
    }
  }

  console.log(`\n=== Resumen lote ${startIndex + 1}-${endIndex} ===`);
  console.log(`Total procesadas: ${processed}`);
  console.log(`Actualizadas: ${updated}`);
  console.log(`Omitidas: ${skipped}`);

  return { processed, updated, skipped };
}

async function main() {
  const args = process.argv.slice(2);
  const startIdx = parseInt(args[0]) || 20; // Por defecto desde la 21 (índice 20)
  const endIdx = parseInt(args[1]) || 206;  // Hasta la 206

  console.log('=== Procesamiento de preguntas Auxilio Judicial ===');
  console.log(`Rango: ${startIdx + 1} a ${endIdx}`);
  console.log('Inicio:', new Date().toISOString());

  const batchSize = 40;
  let totalProcessed = 0;
  let totalUpdated = 0;
  let totalSkipped = 0;

  for (let i = startIdx; i < endIdx; i += batchSize) {
    const batchEnd = Math.min(i + batchSize, endIdx);
    const result = await processQuestions(i, batchEnd);

    totalProcessed += result.processed;
    totalUpdated += result.updated;
    totalSkipped += result.skipped;

    // Pausa entre lotes para no sobrecargar
    if (batchEnd < endIdx) {
      console.log('\n⏳ Pausa de 1 segundo entre lotes...\n');
      await new Promise(r => setTimeout(r, 1000));
    }
  }

  console.log('\n========================================');
  console.log('=== RESUMEN FINAL ===');
  console.log('========================================');
  console.log(`Total preguntas procesadas: ${totalProcessed}`);
  console.log(`Total actualizadas: ${totalUpdated}`);
  console.log(`Total omitidas: ${totalSkipped}`);
  console.log('Fin:', new Date().toISOString());
}

main().catch(console.error);
