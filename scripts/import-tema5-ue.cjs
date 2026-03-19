/**
 * Import Tema 5 - La Unión Europea questions
 * 269 questions from 11 subtemas
 */

require('dotenv').config({ path: '.env.local' });
const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const TOPIC_ID = '30210e71-02ef-4012-8931-99063d1db546';
const TUE_ID = 'ddc2ffa9-d99b-4abc-b149-ab47916ab9da';
const TFUE_ID = 'eba370d3-73d9-44a9-9865-48d2effabaf4';

const BASE_PATH = 'preguntas-para-subir/tramitacion-procesal/Tema_5._La_Unión_Europea_(PRÓXIMAS_CONVOCATORIAS_TP_TL)';

// Convert letter to 0-indexed number
function letterToIndex(letter) {
  return { 'A': 0, 'B': 1, 'C': 2, 'D': 3 }[letter.toUpperCase()] ?? 0;
}

// Extract article reference from text
function extractArticleRef(text) {
  const lowerText = text.toLowerCase();

  // TUE patterns
  const tueMatch = lowerText.match(/art[íi]culo?\s*\.?\s*(\d+)(?:\.\d+)?\s*(?:del?\s*)?tue|art\.?\s*(\d+)\s*tue/i);
  if (tueMatch) {
    return { law: 'TUE', article: tueMatch[1] || tueMatch[2] };
  }

  // TFUE patterns
  const tfueMatch = lowerText.match(/art[íi]culo?\s*\.?\s*(\d+)(?:\.\d+)?\s*(?:del?\s*)?tfue|art\.?\s*(\d+)\s*tfue/i);
  if (tfueMatch) {
    return { law: 'TFUE', article: tfueMatch[1] || tfueMatch[2] };
  }

  return null;
}

async function getArticleId(lawId, articleNumber) {
  const { data } = await supabase
    .from('articles')
    .select('id')
    .eq('law_id', lawId)
    .eq('article_number', articleNumber)
    .single();

  return data?.id || null;
}

async function main() {
  console.log('=== Importando Tema 5: La Unión Europea ===\n');

  // Get all JSON files
  const files = fs.readdirSync(BASE_PATH)
    .filter(f => f.endsWith('.json'))
    .sort();

  let totalImported = 0;
  let totalSkipped = 0;
  let articlesLinked = 0;

  for (const file of files) {
    const filePath = path.join(BASE_PATH, file);
    const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    const subtema = data.subtema || file.replace('.json', '');

    console.log(`\n📚 ${subtema} (${data.questions.length} preguntas)`);

    for (const q of data.questions) {
      // Check for duplicates
      const { data: existing } = await supabase
        .from('questions')
        .select('id')
        .eq('question_text', q.question)
        .eq('topic_id', TOPIC_ID)
        .single();

      if (existing) {
        totalSkipped++;
        continue;
      }

      // Extract article reference
      const textToSearch = q.question + ' ' + (q.explanation || '');
      const articleRef = extractArticleRef(textToSearch);

      let primaryArticleId = null;
      let lawId = null;

      if (articleRef) {
        lawId = articleRef.law === 'TUE' ? TUE_ID : TFUE_ID;
        primaryArticleId = await getArticleId(lawId, articleRef.article);
        if (primaryArticleId) articlesLinked++;
      }

      // Insert question
      const { error } = await supabase
        .from('questions')
        .insert({
          question_text: q.question,
          option_a: q.options.find(o => o.letter === 'A')?.text || '',
          option_b: q.options.find(o => o.letter === 'B')?.text || '',
          option_c: q.options.find(o => o.letter === 'C')?.text || '',
          option_d: q.options.find(o => o.letter === 'D')?.text || '',
          correct_option: letterToIndex(q.correctAnswer),
          explanation: q.explanation || '',
          topic_id: TOPIC_ID,
          law_id: lawId,
          primary_article_id: primaryArticleId,
          source: 'opositatest',
          subtema: subtema,
          is_active: true,
          verification_status: 'pending',
          topic_review_status: 'pending'
        });

      if (error) {
        console.error(`  ❌ Error:`, error.message);
      } else {
        totalImported++;
        process.stdout.write('.');
      }
    }
  }

  console.log('\n\n=== RESUMEN ===');
  console.log(`✅ Importadas: ${totalImported}`);
  console.log(`⏭️  Omitidas (duplicadas): ${totalSkipped}`);
  console.log(`🔗 Con artículo vinculado: ${articlesLinked}`);
}

main().catch(console.error);
