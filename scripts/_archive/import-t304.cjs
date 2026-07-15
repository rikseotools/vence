const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const LAWS = {
  'Ley 9/2017': '4f605392-8137-4962-9e66-ca5f275e93ee'
};

const LETTER_TO_INDEX = { 'A': 0, 'B': 1, 'C': 2, 'D': 3 };

function detectArticle(explanation, questionText) {
  const text = ((explanation || '') + ' ' + (questionText || '')).toLowerCase();

  const artMatch = text.match(/art[íi]culo\s+(\d+)/i);
  if (!artMatch) return null;

  return { law: 'Ley 9/2017', articleNumber: artMatch[1] };
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
  const basePath = '/home/manuel/Documentos/github/vence/preguntas-para-subir/Tema_4,_Contratos_del_sector_público';

  const files = [
    { name: 'Los_contratos_del_sector_público_Objeto_y_clases.json', tags: ['Objeto y clases', 'T304', 'Bloque III'] },
    { name: 'Partes_del_contrato.json', tags: ['Partes del contrato', 'T304', 'Bloque III'] },
    { name: 'Elementos_objetivos_del_contrato.json', tags: ['Elementos objetivos', 'T304', 'Bloque III'] },
    { name: 'Procedimiento_de_contratación.json', tags: ['Procedimiento', 'T304', 'Bloque III'] },
    { name: 'Efectos,_cumplimiento_y_extinción_de_los_contratos.json', tags: ['Efectos y extinción', 'T304', 'Bloque III'] },
    { name: 'Contrato_de_obras.json', tags: ['Contrato de obras', 'T304', 'Bloque III'] },
    { name: 'Contrato_de_concesión_de_obras.json', tags: ['Concesión de obras', 'T304', 'Bloque III'] },
    { name: 'Contrato_de_concesión_de_servicios.json', tags: ['Concesión de servicios', 'T304', 'Bloque III'] },
    { name: 'Contrato_de_suministros.json', tags: ['Contrato de suministros', 'T304', 'Bloque III'] },
    { name: 'Contrato_de_servicios.json', tags: ['Contrato de servicios', 'T304', 'Bloque III'] },
    { name: 'El_recurso_especial_en_materia_de_contratación.json', tags: ['Recurso especial', 'T304', 'Bloque III'] }
  ];

  console.log('=== IMPORTANDO T304: Contratos del Sector Público ===\n');

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
  console.log('RESUMEN T304:');
  console.log('  ✅ Importadas:', totalImported);
  console.log('  ⏭️ Duplicadas:', totalSkipped);
  console.log('  ⚠️ Sin artículo:', totalNoArticle);

  const { count } = await supabase
    .from('questions')
    .select('id', { count: 'exact', head: true })
    .contains('tags', ['T304'])
    .eq('is_active', true);

  console.log('\nTotal T304 en BD:', count);
})();
