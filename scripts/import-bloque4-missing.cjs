const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const LETTER_TO_INDEX = { 'A': 0, 'B': 1, 'C': 2, 'D': 3 };

const BASE_PATH = '/home/manuel/Documentos/github/vence/preguntas-para-subir';

// IDs de leyes (CORRECTOS)
const LAWS = {
  'LPAC': '218452f5-b9f6-48f0-a25b-26df9cb19644',      // Ley 39/2015
  'LRJSP': '95680d57-feb1-41c0-bb27-236024815feb',     // Ley 40/2015
  'LJCA': '07daa1fe-7e8e-4e2d-9a33-6893229869e0',      // Ley 29/1998
  'LCSP': '4f605392-8137-4962-9e66-ca5f275e93ee'       // Ley 9/2017
};

// Mapeo de directorios a temas
const DIR_TO_TEMA = {
  'Tema_3,_Ley_392015,_Ley_402015_y_jurisdicción_contencioso-administrativa': { tema: 'T403', bloque: 'Bloque IV' },
  'Tema_5,_Procedimientos_y_formas_de_la_actividad_administrativa': { tema: 'T405', bloque: 'Bloque IV' },
  'Tema_6,_La_responsabilidad_patrimonial_de_las_Administraciones_públicas': { tema: 'T406', bloque: 'Bloque IV' },
  'Tema_4,_Contratos_del_sector_público': { tema: 'T404', bloque: 'Bloque IV' }
};

function detectLawAndArticle(text) {
  text = text.toLowerCase();
  let lawId = null;

  // Detectar ley
  if (text.includes('39/2015') || text.includes('lpac') || text.includes('procedimiento administrativo común')) {
    lawId = LAWS.LPAC;
  } else if (text.includes('40/2015') || text.includes('lrjsp') || text.includes('régimen jurídico del sector público')) {
    lawId = LAWS.LRJSP;
  } else if (text.includes('29/1998') || text.includes('ljca') || text.includes('contencioso-administrativa') || text.includes('contencioso administrativa')) {
    lawId = LAWS.LJCA;
  } else if (text.includes('9/2017') || text.includes('lcsp') || text.includes('contratos del sector público')) {
    lawId = LAWS.LCSP;
  }

  // Detectar artículo
  let articleNumber = null;
  const artMatch = text.match(/art[íi]culo\s+(\d+)/i) || text.match(/art\.\s*(\d+)/i);
  if (artMatch) {
    articleNumber = artMatch[1];
  }

  return { lawId, articleNumber };
}

async function importMissingQuestions() {
  console.log('=== Importando preguntas faltantes Bloque IV ===\n');

  let totalImported = 0, totalSkipped = 0, totalNoArticle = 0;

  for (const [dirName, config] of Object.entries(DIR_TO_TEMA)) {
    const dirPath = path.join(BASE_PATH, dirName);
    if (!fs.existsSync(dirPath)) continue;

    const files = fs.readdirSync(dirPath).filter(f => f.endsWith('.json'));
    console.log(`📁 ${dirName.substring(0, 50)}...`);

    for (const fileName of files) {
      const content = fs.readFileSync(path.join(dirPath, fileName), 'utf8');
      const data = JSON.parse(content);
      const tag = fileName.replace(/_/g, ' ').replace('.json', '').substring(0, 25);

      for (const q of data.questions) {
        // Verificar si ya existe
        const { count } = await supabase
          .from('questions')
          .select('id', { count: 'exact', head: true })
          .eq('question_text', q.question);

        if (count > 0) {
          totalSkipped++;
          continue;
        }

        const text = (q.explanation || '') + ' ' + (q.question || '');
        let { lawId, articleNumber } = detectLawAndArticle(text);

        // Default law based on directory
        if (!lawId) {
          if (dirName.includes('Contratos')) lawId = LAWS.LCSP;
          else if (dirName.includes('39')) lawId = LAWS.LPAC;
          else lawId = LAWS.LRJSP;
        }

        let articleId = null;

        if (articleNumber && lawId) {
          const { data: article } = await supabase
            .from('articles')
            .select('id')
            .eq('law_id', lawId)
            .eq('article_number', articleNumber)
            .eq('is_active', true)
            .single();

          if (article) articleId = article.id;
        }

        // Fallback: artículo 1
        if (!articleId && lawId) {
          const { data: fallback } = await supabase
            .from('articles')
            .select('id')
            .eq('law_id', lawId)
            .eq('article_number', '1')
            .eq('is_active', true)
            .single();

          if (fallback) articleId = fallback.id;
        }

        if (!articleId) {
          console.log('  ⚠️ Sin artículo:', q.question.substring(0, 50) + '...');
          totalNoArticle++;
          continue;
        }

        const { error } = await supabase.from('questions').insert({
          question_text: q.question,
          option_a: q.options.find(o => o.letter === 'A')?.text || '',
          option_b: q.options.find(o => o.letter === 'B')?.text || '',
          option_c: q.options.find(o => o.letter === 'C')?.text || '',
          option_d: q.options.find(o => o.letter === 'D')?.text || '',
          correct_option: LETTER_TO_INDEX[q.correctAnswer],
          explanation: q.explanation || '',
          primary_article_id: articleId,
          difficulty: 'medium',
          is_active: true,
          is_official_exam: false,
          tags: [tag.trim(), config.tema, config.bloque]
        });

        if (error) {
          if (error.message.includes('duplicate') || error.message.includes('content_hash')) {
            totalSkipped++;
          } else {
            console.log('  ❌ Error:', error.message.substring(0, 50));
          }
        } else {
          totalImported++;
          console.log('  ✅ ' + q.question.substring(0, 50) + '...');
        }
      }
    }
  }

  console.log(`\nRESUMEN: ✅ ${totalImported} ⏭️ ${totalSkipped} ⚠️ ${totalNoArticle}`);
}

importMissingQuestions();
