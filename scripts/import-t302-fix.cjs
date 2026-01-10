const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// IDs CORRECTOS
const LAWS = {
  'Ley 39/2015': '218452f5-b9f6-48f0-a25b-26df9cb19644',
  'Ley 40/2015': '95680d57-feb1-41c0-bb27-236024815feb'
};

const LETTER_TO_INDEX = { 'A': 0, 'B': 1, 'C': 2, 'D': 3 };

function detectArticle(explanation, questionText) {
  const text = ((explanation || '') + ' ' + (questionText || '')).toLowerCase();

  const artMatch = text.match(/art[íi]culo\s+(\d+)/i);
  if (!artMatch) return null;

  const artNum = artMatch[1];

  // Si menciona Ley 40/2015 o LRJSP
  if (text.includes('40/2015') || text.includes('lrjsp') || text.includes('régimen jurídico del sector público')) {
    return { law: 'Ley 40/2015', articleNumber: artNum };
  }

  // Si menciona Ley 39/2015 o LPAC
  if (text.includes('39/2015') || text.includes('lpac') || text.includes('procedimiento administrativo común')) {
    return { law: 'Ley 39/2015', articleNumber: artNum };
  }

  return null;
}

async function findArticle(law, articleNumber) {
  const lawId = LAWS[law];
  if (!lawId) return null;

  const { data } = await supabase
    .from('articles')
    .select('id')
    .eq('law_id', lawId)
    .eq('article_number', articleNumber)
    .single();

  return data;
}

(async () => {
  const basePath = '/home/manuel/Documentos/github/vence/preguntas-para-subir/Tema_2,_El_acto_administrativo';

  const files = [
    { name: 'El_acto_administrativo_Concepto,_clases_y_elementos..json', tags: ['Concepto y elementos', 'T302', 'Bloque III'] },
    { name: 'Eficacia_y_validez_de_los_actos_administrativos.json', tags: ['Eficacia y validez', 'T302', 'Bloque III'] },
    { name: 'Notificación.json', tags: ['Notificación', 'T302', 'Bloque III'] },
    { name: 'Nulidad_y_anulabilidad.json', tags: ['Nulidad y anulabilidad', 'T302', 'Bloque III'] }
  ];

  console.log('=== IMPORTANDO RESTANTES T302 (ID corregido) ===\n');

  let totalImported = 0;
  let totalSkipped = 0;

  for (const file of files) {
    const filePath = path.join(basePath, file.name);
    if (!fs.existsSync(filePath)) continue;

    const content = fs.readFileSync(filePath, 'utf8');
    const data = JSON.parse(content);

    for (const q of data.questions) {
      const detected = detectArticle(q.explanation, q.question);
      if (!detected) continue;

      const article = await findArticle(detected.law, detected.articleNumber);
      if (!article) continue;

      const questionData = {
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
        tags: file.tags
      };

      const { error } = await supabase.from('questions').insert(questionData);

      if (error) {
        if (error.message.includes('duplicate') || error.message.includes('content_hash')) {
          totalSkipped++;
        }
      } else {
        totalImported++;
        console.log('✅', detected.law, 'Art.', detected.articleNumber, '-', q.question.substring(0, 40) + '...');
      }
    }
  }

  console.log('\n=== RESULTADO ===');
  console.log('Importadas:', totalImported);
  console.log('Duplicadas:', totalSkipped);

  // Total T302
  const { count } = await supabase
    .from('questions')
    .select('id', { count: 'exact', head: true })
    .contains('tags', ['T302'])
    .eq('is_active', true);

  console.log('Total T302:', count);
})();
