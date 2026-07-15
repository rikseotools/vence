const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const LAWS = {
  'LO 3/2007': '6e59eacd-9298-4164-9d78-9e9343d9a900',
  'LO 1/2004': 'f5c17b23-2547-43d2-800c-39f5ea925c2f',
  'Ley 15/2022': 'aa7d0693-106f-47a8-b41d-9c713d20781d',
  'Ley 4/2023': 'd3a41325-047e-4d6a-99c5-fd8d5c8dc782',
  'Ley 39/2006': '02a0a8db-af96-45d0-8fd4-4d24b825cb13'
};

const LETTER_TO_INDEX = { 'A': 0, 'B': 1, 'C': 2, 'D': 3 };

function detectArticle(explanation, questionText, fileName) {
  const text = ((explanation || '') + ' ' + (questionText || '')).toLowerCase();

  const artMatch = text.match(/art[íi]culo\s+(\d+)/i);
  if (!artMatch) return null;

  const artNum = artMatch[1];

  // Detectar por mención explícita
  if (text.includes('3/2007') || text.includes('igualdad efectiva')) {
    return { law: 'LO 3/2007', articleNumber: artNum };
  }
  if (text.includes('1/2004') || text.includes('violencia de género')) {
    return { law: 'LO 1/2004', articleNumber: artNum };
  }
  if (text.includes('15/2022')) {
    return { law: 'Ley 15/2022', articleNumber: artNum };
  }
  if (text.includes('4/2023') || text.includes('lgtbi')) {
    return { law: 'Ley 4/2023', articleNumber: artNum };
  }
  if (text.includes('39/2006') || text.includes('dependencia')) {
    return { law: 'Ley 39/2006', articleNumber: artNum };
  }

  // Detectar por nombre de archivo
  if (fileName.includes('Igualdad_efectiva')) {
    return { law: 'LO 3/2007', articleNumber: artNum };
  }
  if (fileName.includes('Violencia')) {
    return { law: 'LO 1/2004', articleNumber: artNum };
  }
  if (fileName.includes('152022')) {
    return { law: 'Ley 15/2022', articleNumber: artNum };
  }
  if (fileName.includes('42023')) {
    return { law: 'Ley 4/2023', articleNumber: artNum };
  }
  if (fileName.includes('Discapacidad') || fileName.includes('dependencia')) {
    return { law: 'Ley 39/2006', articleNumber: artNum };
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
  const basePath = '/home/manuel/Documentos/github/vence/preguntas-para-subir/Tema_7,_Políticas_de_igualdad_y_contra_la_violencia_de_género_y_discapacidad_y_dependencia';

  const files = [
    { name: 'Igualdad_efectiva_entre_hombres_y_mujeres.json', tags: ['Igualdad efectiva', 'T307', 'Bloque III'] },
    { name: 'Violencia_de_género.json', tags: ['Violencia de género', 'T307', 'Bloque III'] },
    { name: 'Ley_152022,_de_12_de_julio,_integral_para_la_igualdad_de_trato_y_la_no_discriminación.json', tags: ['Ley 15/2022', 'T307', 'Bloque III'] },
    { name: 'Ley_42023,_de_28_de_febrero,_para_la_igualdad_real_y_efectiva_de_las_personas_trans_y_para_la_garant.json', tags: ['Ley LGTBI', 'T307', 'Bloque III'] },
    { name: 'Discapacidad_y_dependencia.json', tags: ['Dependencia', 'T307', 'Bloque III'] }
  ];

  console.log('=== IMPORTANDO T307: Políticas de Igualdad ===\n');

  let totalImported = 0;
  let totalSkipped = 0;
  let totalNoArticle = 0;

  for (const file of files) {
    const filePath = path.join(basePath, file.name);
    if (!fs.existsSync(filePath)) {
      console.log('❌ No existe:', file.name.substring(0, 40));
      continue;
    }

    const content = fs.readFileSync(filePath, 'utf8');
    const data = JSON.parse(content);

    console.log('--- ' + file.tags[0] + ' (' + data.questions.length + ') ---');

    let fileImported = 0;
    let fileSkipped = 0;
    let fileNoArticle = 0;

    for (const q of data.questions) {
      const detected = detectArticle(q.explanation, q.question, file.name);
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
  console.log('RESUMEN T307:');
  console.log('  ✅ Importadas:', totalImported);
  console.log('  ⏭️ Duplicadas:', totalSkipped);
  console.log('  ⚠️ Sin artículo:', totalNoArticle);

  const { count } = await supabase
    .from('questions')
    .select('id', { count: 'exact', head: true })
    .contains('tags', ['T307'])
    .eq('is_active', true);

  console.log('\nTotal T307 en BD:', count);
})();
