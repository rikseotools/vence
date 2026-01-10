const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const LAWS = {
  'RDL 5/2015': 'e602d0b8-1529-4c04-9bd1-8dccdbd5baa0'
};

const LETTER_TO_INDEX = { 'A': 0, 'B': 1, 'C': 2, 'D': 3 };

function detectArticle(explanation, questionText) {
  const text = ((explanation || '') + ' ' + (questionText || '')).toLowerCase();
  const artMatch = text.match(/art[íi]culo\s+(\d+)/i);
  if (!artMatch) return null;
  return { law: 'RDL 5/2015', articleNumber: artMatch[1] };
}

async function findArticle(law, articleNumber) {
  const lawId = LAWS[law];
  if (!lawId) return null;
  const { data } = await supabase.from('articles').select('id').eq('law_id', lawId).eq('article_number', articleNumber).single();
  return data;
}

(async () => {
  const basePath = '/home/manuel/Documentos/github/vence/preguntas-para-subir/Tema_2,_Selección_de_personal';
  const files = fs.readdirSync(basePath).filter(f => f.endsWith('.json'));

  console.log('=== IMPORTANDO T402: Selección de Personal ===\n');

  let totalImported = 0, totalSkipped = 0, totalNoArticle = 0;

  for (const fileName of files) {
    const filePath = path.join(basePath, fileName);
    const content = fs.readFileSync(filePath, 'utf8');
    const data = JSON.parse(content);
    const tag = fileName.replace(/_/g, ' ').replace('.json', '').substring(0, 25);

    console.log('--- ' + tag + ' (' + data.questions.length + ') ---');

    let fileImported = 0, fileSkipped = 0, fileNoArticle = 0;

    for (const q of data.questions) {
      const detected = detectArticle(q.explanation, q.question);
      if (!detected) { fileNoArticle++; continue; }

      const article = await findArticle(detected.law, detected.articleNumber);
      if (!article) { fileNoArticle++; continue; }

      const { error } = await supabase.from('questions').insert({
        question_text: q.question,
        option_a: q.options.find(o => o.letter === 'A')?.text || '',
        option_b: q.options.find(o => o.letter === 'B')?.text || '',
        option_c: q.options.find(o => o.letter === 'C')?.text || '',
        option_d: q.options.find(o => o.letter === 'D')?.text || '',
        correct_option: LETTER_TO_INDEX[q.correctAnswer],
        explanation: q.explanation || '',
        primary_article_id: article.id,
        difficulty: 'medium',
        is_active: true,
        is_official_exam: false,
        tags: [tag.trim(), 'T402', 'Bloque IV']
      });

      if (error) {
        if (error.message.includes('duplicate') || error.message.includes('content_hash')) fileSkipped++;
      } else fileImported++;
    }

    console.log('  ✅', fileImported, fileSkipped > 0 ? '⏭️' + fileSkipped : '', fileNoArticle > 0 ? '⚠️' + fileNoArticle : '');
    totalImported += fileImported;
    totalSkipped += fileSkipped;
    totalNoArticle += fileNoArticle;
  }

  console.log('\n==================================================');
  console.log('RESUMEN T402: ✅', totalImported, '⏭️', totalSkipped, '⚠️', totalNoArticle);

  const { count } = await supabase.from('questions').select('id', { count: 'exact', head: true }).contains('tags', ['T402']).eq('is_active', true);
  console.log('Total T402 en BD:', count);
})();
