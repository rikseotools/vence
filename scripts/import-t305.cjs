const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const LAWS = {
  'Ley 38/2003': '09c18214-a630-4ae8-9f63-a742919f7f4c',
  'Ley 40/2015': '95680d57-feb1-41c0-bb27-236024815feb'
};

const LETTER_TO_INDEX = { 'A': 0, 'B': 1, 'C': 2, 'D': 3 };

function detectArticle(explanation, questionText) {
  const text = ((explanation || '') + ' ' + (questionText || '')).toLowerCase();

  const artMatch = text.match(/art[íi]culo\s+(\d+)/i);
  if (!artMatch) return null;

  const artNum = artMatch[1];

  // Detectar Ley 38/2003 - Subvenciones
  if (text.includes('38/2003') || text.includes('subvenci') || text.includes('lgs')) {
    return { law: 'Ley 38/2003', articleNumber: artNum };
  }

  // Detectar Ley 40/2015 - LRJSP
  if (text.includes('40/2015') || text.includes('lrjsp')) {
    return { law: 'Ley 40/2015', articleNumber: artNum };
  }

  // Por defecto según el rango de artículos
  const num = parseInt(artNum);
  if (num <= 69) {
    return { law: 'Ley 38/2003', articleNumber: artNum };
  }

  return { law: 'Ley 40/2015', articleNumber: artNum };
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
  const basePath = '/home/manuel/Documentos/github/vence/preguntas-para-subir/Tema_5,_Procedimientos_y_formas_de_la_actividad_administrativa';

  const files = [
    { name: 'Procedimientos_y_formas_de_la_actividad_administrativa._La_actividad_de_limitación,_arbitral,_de_ser.json', tags: ['Actividad administrativa', 'T305', 'Bloque III'] },
    { name: 'Formas_de_gestión_de_los_servicios_públicos.json', tags: ['Gestión servicios', 'T305', 'Bloque III'] },
    { name: 'Las_subvenciones_públicas.json', tags: ['Subvenciones', 'T305', 'Bloque III'] }
  ];

  console.log('=== IMPORTANDO T305: Procedimientos y Formas ===\n');

  let totalImported = 0;
  let totalSkipped = 0;
  let totalNoArticle = 0;

  for (const file of files) {
    const filePath = path.join(basePath, file.name);
    if (!fs.existsSync(filePath)) {
      console.log('❌ No existe:', file.name);
      continue;
    }

    const content = fs.readFileSync(filePath, 'utf8');
    const data = JSON.parse(content);

    console.log('--- ' + file.tags[0] + ' (' + data.questions.length + ') ---');

    let fileImported = 0;
    let fileSkipped = 0;
    let fileNoArticle = 0;

    for (const q of data.questions) {
      const detected = detectArticle(q.explanation, q.question);
      if (!detected) {
        fileNoArticle++;
        continue;
      }

      const article = await findArticle(detected.law, detected.articleNumber);
      if (!article) {
        fileNoArticle++;
        continue;
      }

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
          fileSkipped++;
        }
      } else {
        fileImported++;
      }
    }

    console.log('  ✅', fileImported, fileSkipped > 0 ? '⏭️' + fileSkipped : '', fileNoArticle > 0 ? '⚠️' + fileNoArticle : '');

    totalImported += fileImported;
    totalSkipped += fileSkipped;
    totalNoArticle += fileNoArticle;
  }

  console.log('\n==================================================');
  console.log('RESUMEN T305:');
  console.log('  ✅ Importadas:', totalImported);
  console.log('  ⏭️ Duplicadas:', totalSkipped);
  console.log('  ⚠️ Sin artículo:', totalNoArticle);

  const { count } = await supabase
    .from('questions')
    .select('id', { count: 'exact', head: true })
    .contains('tags', ['T305'])
    .eq('is_active', true);

  console.log('\nTotal T305 en BD:', count);
})();
