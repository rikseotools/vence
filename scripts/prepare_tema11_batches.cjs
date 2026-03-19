/**
 * Prepara batches del Tema 11 para verificación IA
 */
require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

const TEMA_DIR = 'preguntas-para-subir/tramitacion-procesal/Tema_11._El_letrado_de_la_Administración_de_Justicia_(PRÓXIMAS_CONVOCATORIAS_TP_TL)';
const LOPJ_ID = 'a3d58ada-b284-46f7-ab7c-2092d4bb06ff';
const BATCH_SIZE = 20;

async function main() {
  // Cargar todas las preguntas
  const files = fs.readdirSync(TEMA_DIR).filter(f => f.endsWith('.json'));
  const allQuestions = [];

  files.forEach(file => {
    const data = JSON.parse(fs.readFileSync(path.join(TEMA_DIR, file), 'utf8'));
    data.questions.forEach((q, idx) => {
      allQuestions.push({
        fileSource: file,
        originalIndex: idx,
        ...q
      });
    });
  });

  console.log(`Total preguntas: ${allQuestions.length}`);

  // Obtener artículos relevantes de la LOPJ (440-470 para Letrados)
  const { data: articles } = await supabase
    .from('articles')
    .select('id, article_number, content')
    .eq('law_id', LOPJ_ID)
    .order('article_number');

  console.log(`Artículos LOPJ disponibles: ${articles.length}`);

  // Crear función para extraer número de artículo de explicación
  function extractArticleNumber(explanation) {
    if (!explanation) return null;
    const match = explanation.match(/[Aa]rt[íi]culo\s+(\d+[a-z]*(?: bis| ter| quater| quinquies| sexies| septies| octies)?)/i);
    return match ? match[1].replace(' ', ' ') : null;
  }

  // Enriquecer cada pregunta con artículo candidato
  const enrichedQuestions = allQuestions.map((q, idx) => {
    const articleNum = extractArticleNumber(q.explanation);
    const candidateArticle = articles.find(a => a.article_number === articleNum);

    return {
      id: idx + 1,
      question: q.question,
      options: q.options,
      correctAnswer: q.correctAnswer,
      explanation: q.explanation,
      extracted_article_number: articleNum,
      candidate_article_id: candidateArticle?.id || null,
      candidate_article_content: candidateArticle?.content?.substring(0, 500) || null
    };
  });

  // Dividir en batches
  const batches = [];
  for (let i = 0; i < enrichedQuestions.length; i += BATCH_SIZE) {
    batches.push(enrichedQuestions.slice(i, i + BATCH_SIZE));
  }

  console.log(`Batches creados: ${batches.length}`);

  // Guardar batches
  batches.forEach((batch, idx) => {
    const filename = `/tmp/tema11-batch-${idx + 1}.json`;
    fs.writeFileSync(filename, JSON.stringify(batch, null, 2));
    console.log(`Guardado: ${filename} (${batch.length} preguntas)`);
  });

  // Estadísticas
  const withArticle = enrichedQuestions.filter(q => q.candidate_article_id).length;
  const withoutArticle = enrichedQuestions.filter(q => !q.candidate_article_id).length;
  console.log(`\nCon artículo candidato: ${withArticle}`);
  console.log(`Sin artículo candidato: ${withoutArticle}`);
}

main().catch(console.error);
