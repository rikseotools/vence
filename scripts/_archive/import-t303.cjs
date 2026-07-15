const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// IDs CORRECTOS de las leyes
const LAWS = {
  'Ley 39/2015': '218452f5-b9f6-48f0-a25b-26df9cb19644',
  'Ley 40/2015': '95680d57-feb1-41c0-bb27-236024815feb',
  'Ley 29/1998': '07daa1fe-7e8e-4e2d-9a33-6893229869e0'
};

const LETTER_TO_INDEX = { 'A': 0, 'B': 1, 'C': 2, 'D': 3 };

function detectArticle(explanation, questionText) {
  const text = ((explanation || '') + ' ' + (questionText || '')).toLowerCase();

  const artMatch = text.match(/art[íi]culo\s+(\d+)/i);
  if (!artMatch) return null;

  const artNum = artMatch[1];

  // Detectar Ley 29/1998 - Contencioso-administrativa
  if (text.includes('29/1998') || text.includes('ljca') || text.includes('contencioso-administrativa') || text.includes('contencioso administrativa')) {
    return { law: 'Ley 29/1998', articleNumber: artNum };
  }

  // Detectar Ley 40/2015 - LRJSP
  if (text.includes('40/2015') || text.includes('lrjsp') || text.includes('régimen jurídico del sector público')) {
    return { law: 'Ley 40/2015', articleNumber: artNum };
  }

  // Detectar Ley 39/2015 - LPAC (por defecto para procedimiento)
  if (text.includes('39/2015') || text.includes('lpac') || text.includes('procedimiento administrativo común')) {
    return { law: 'Ley 39/2015', articleNumber: artNum };
  }

  // Por defecto, asumir Ley 39/2015 para este tema
  return { law: 'Ley 39/2015', articleNumber: artNum };
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
  const basePath = '/home/manuel/Documentos/github/vence/preguntas-para-subir/Tema_3,_Ley_392015,_Ley_402015_y_jurisdicción_contencioso-administrativa';

  const files = [
    { name: 'Conceptos_generales_de_las_Leyes_del_Procedimiento_Administrativo_Común_de_las_Administraciones_Públ.json', tags: ['Conceptos generales', 'T303', 'Bloque III'] },
    { name: 'El_procedimiento_administrativo.json', tags: ['Procedimiento', 'T303', 'Bloque III'] },
    { name: 'La_jurisdicción_contencioso-administrativa.json', tags: ['Contencioso-administrativa', 'T303', 'Bloque III'] },
    { name: 'La_revisión_de_oficio.json', tags: ['Revisión de oficio', 'T303', 'Bloque III'] },
    { name: 'Los_recursos_administrativos.json', tags: ['Recursos administrativos', 'T303', 'Bloque III'] },
    { name: 'Términos_y_plazos_de_la_actividad_de_las_Administraciones_Públicas.json', tags: ['Términos y plazos', 'T303', 'Bloque III'] }
  ];

  console.log('=== IMPORTANDO T303: Las Leyes del Procedimiento Administrativo ===\n');

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

    console.log('\n--- ' + file.tags[0] + ' (' + data.questions.length + ' preguntas) ---');

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
        } else {
          console.log('❌ Error:', error.message.substring(0, 50));
        }
      } else {
        fileImported++;
      }
    }

    console.log('  ✅ Importadas:', fileImported);
    if (fileSkipped > 0) console.log('  ⏭️ Duplicadas:', fileSkipped);
    if (fileNoArticle > 0) console.log('  ⚠️ Sin artículo:', fileNoArticle);

    totalImported += fileImported;
    totalSkipped += fileSkipped;
    totalNoArticle += fileNoArticle;
  }

  console.log('\n' + '='.repeat(50));
  console.log('RESUMEN T303:');
  console.log('  ✅ Importadas:', totalImported);
  console.log('  ⏭️ Duplicadas:', totalSkipped);
  console.log('  ⚠️ Sin artículo:', totalNoArticle);

  // Total T303
  const { count } = await supabase
    .from('questions')
    .select('id', { count: 'exact', head: true })
    .contains('tags', ['T303'])
    .eq('is_active', true);

  console.log('\nTotal preguntas T303 en BD:', count);
})();
