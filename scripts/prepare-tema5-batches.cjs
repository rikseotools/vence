/**
 * Fase 1: Preparar batches de Tema 5 con artículos candidatos
 * 269 preguntas en 11 subtemas -> batches de ~25 preguntas
 */

require('dotenv').config({ path: '.env.local' });
const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const TUE_ID = 'ddc2ffa9-d99b-4abc-b149-ab47916ab9da';
const TFUE_ID = 'eba370d3-73d9-44a9-9865-48d2effabaf4';
const BASE_PATH = 'preguntas-para-subir/tramitacion-procesal/Tema_5._La_Unión_Europea_(PRÓXIMAS_CONVOCATORIAS_TP_TL)';
const BATCH_SIZE = 25;

// Extract article numbers mentioned in text
function extractMentionedArticles(text) {
  const lowerText = text.toLowerCase();
  const refs = { TUE: [], TFUE: [] };

  // TUE patterns
  const tueMatches = [...lowerText.matchAll(/art[íi]culos?\s*\.?\s*(\d+)(?:\s*(?:y|,|a)\s*(\d+))*\s*(?:del?\s*)?tue|art\.?\s*(\d+)\s*tue/gi)];
  for (const m of tueMatches) {
    const nums = [m[1], m[2], m[3]].filter(Boolean);
    refs.TUE.push(...nums.map(n => parseInt(n)));
  }

  // TFUE patterns
  const tfueMatches = [...lowerText.matchAll(/art[íi]culos?\s*\.?\s*(\d+)(?:\s*(?:y|,|a)\s*(\d+))*\s*(?:del?\s*)?tfue|art\.?\s*(\d+)\s*tfue/gi)];
  for (const m of tfueMatches) {
    const nums = [m[1], m[2], m[3]].filter(Boolean);
    refs.TFUE.push(...nums.map(n => parseInt(n)));
  }

  return refs;
}

async function getArticlesFromDB() {
  console.log('📚 Cargando artículos de TUE y TFUE...');

  const { data: tueArticles } = await supabase
    .from('articles')
    .select('id, article_number, title, content')
    .eq('law_id', TUE_ID)
    .order('article_number');

  const { data: tfueArticles } = await supabase
    .from('articles')
    .select('id, article_number, title, content')
    .eq('law_id', TFUE_ID)
    .order('article_number');

  console.log(`  TUE: ${tueArticles?.length} artículos`);
  console.log(`  TFUE: ${tfueArticles?.length} artículos`);

  return {
    TUE: tueArticles || [],
    TFUE: tfueArticles || []
  };
}

function findCandidateArticles(question, allArticles) {
  const text = question.question + ' ' + (question.explanation || '');
  const mentioned = extractMentionedArticles(text);

  const candidates = [];

  // Add mentioned TUE articles
  for (const num of mentioned.TUE) {
    const art = allArticles.TUE.find(a => parseInt(a.article_number) === num);
    if (art) {
      candidates.push({
        id: art.id,
        law: 'TUE',
        article_number: art.article_number,
        title: art.title,
        content_preview: art.content?.substring(0, 300) + '...'
      });
    }
  }

  // Add mentioned TFUE articles
  for (const num of mentioned.TFUE) {
    const art = allArticles.TFUE.find(a => parseInt(a.article_number) === num);
    if (art) {
      candidates.push({
        id: art.id,
        law: 'TFUE',
        article_number: art.article_number,
        title: art.title,
        content_preview: art.content?.substring(0, 300) + '...'
      });
    }
  }

  return candidates;
}

async function main() {
  console.log('=== Preparando batches Tema 5: La Unión Europea ===\n');

  const allArticles = await getArticlesFromDB();

  // Get all questions from JSON files
  const files = fs.readdirSync(BASE_PATH).filter(f => f.endsWith('.json')).sort();
  const allQuestions = [];

  console.log('\n📖 Leyendo JSONs...');
  for (const file of files) {
    const filePath = path.join(BASE_PATH, file);
    const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));

    for (const q of data.questions) {
      allQuestions.push({
        ...q,
        subtema: data.subtema,
        tema: data.tema
      });
    }
  }

  console.log(`  Total preguntas: ${allQuestions.length}`);

  // Enrich with candidate articles
  console.log('\n🔍 Buscando artículos candidatos...');
  let withCandidates = 0;

  for (const q of allQuestions) {
    q.candidateArticles = findCandidateArticles(q, allArticles);
    if (q.candidateArticles.length > 0) withCandidates++;
  }

  console.log(`  Preguntas con artículo detectado: ${withCandidates}/${allQuestions.length}`);

  // Split into batches
  const batches = [];
  for (let i = 0; i < allQuestions.length; i += BATCH_SIZE) {
    batches.push(allQuestions.slice(i, i + BATCH_SIZE));
  }

  console.log(`\n📦 Generando ${batches.length} batches...`);

  // Write batch files
  for (let i = 0; i < batches.length; i++) {
    const outputPath = `/tmp/tema5-batch-${i + 1}.json`;
    fs.writeFileSync(outputPath, JSON.stringify(batches[i], null, 2));
    console.log(`  Batch ${i + 1}: ${batches[i].length} preguntas -> ${outputPath}`);
  }

  console.log('\n✅ Batches preparados. Ahora lanzar agentes para verificación.');
  console.log('\nResumen de candidatos detectados:');

  // Statistics
  const stats = { total: 0, TUE: 0, TFUE: 0, none: 0 };
  for (const q of allQuestions) {
    if (q.candidateArticles.length === 0) {
      stats.none++;
    } else {
      stats.total++;
      if (q.candidateArticles.some(c => c.law === 'TUE')) stats.TUE++;
      if (q.candidateArticles.some(c => c.law === 'TFUE')) stats.TFUE++;
    }
  }

  console.log(`  - Con artículo TUE: ${stats.TUE}`);
  console.log(`  - Con artículo TFUE: ${stats.TFUE}`);
  console.log(`  - Sin artículo detectado: ${stats.none}`);
}

main().catch(console.error);
