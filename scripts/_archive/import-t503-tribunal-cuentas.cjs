const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const LETTER_TO_INDEX = { 'A': 0, 'B': 1, 'C': 2, 'D': 3 };

const DIR_PATH = '/home/manuel/Documentos/github/vence/preguntas-para-subir/Tema_3,_El_procedimiento_administrativo_de_ejecución_del_presupuesto_de_gasto';
const LO_2_1982_ID = '190f387b-e1c8-4a04-99f4-28186cdf039e'; // Tribunal de Cuentas
const LGP_ID = 'effe3259-8168-43a0-9730-9923452205c4'; // Ley 47/2003 LGP

function detectArticle(text) {
  const match = text.match(/art[íi]culo\s+(\w+)/i);
  if (match) {
    // Convertir "primero", "veintiuno" etc a número
    const ordinals = {
      'primero': '1', 'segundo': '2', 'tercero': '3', 'cuarto': '4', 'quinto': '5',
      'sexto': '6', 'séptimo': '7', 'septimo': '7', 'octavo': '8', 'noveno': '9',
      'décimo': '10', 'decimo': '10', 'undécimo': '11', 'duodécimo': '12',
      'veintiuno': '21', 'veintidos': '22', 'veintidós': '22', 'veintitres': '23',
      'veintitrés': '23', 'veinticuatro': '24', 'veinticinco': '25', 'veintiseis': '26',
      'veintiséis': '26', 'veintisiete': '27'
    };
    const num = ordinals[match[1].toLowerCase()] || match[1];
    return num;
  }
  return null;
}

(async () => {
  console.log('=== Importando preguntas T503 (Tribunal de Cuentas) ===\n');

  const files = fs.readdirSync(DIR_PATH).filter(f => f.endsWith('.json'));
  let totalImported = 0, totalSkipped = 0, totalNoArticle = 0;

  for (const fileName of files) {
    const content = fs.readFileSync(path.join(DIR_PATH, fileName), 'utf8');
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
      const textLower = text.toLowerCase();

      // Detectar ley
      let lawId = null;
      if (textLower.includes('2/1982') || textLower.includes('tribunal de cuentas')) {
        lawId = LO_2_1982_ID;
      } else if (textLower.includes('47/2003') || textLower.includes('ley general presupuestaria')) {
        lawId = LGP_ID;
      } else {
        // Default para este directorio
        lawId = LGP_ID;
      }

      // Detectar artículo
      const articleNumber = detectArticle(q.explanation || '');
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
        tags: [tag.trim(), 'T503', 'Bloque V']
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

  console.log(`\nRESUMEN: ✅ ${totalImported} ⏭️ ${totalSkipped} ⚠️ ${totalNoArticle}`);

  // Verificar total T503
  const { count } = await supabase
    .from('questions')
    .select('id', { count: 'exact', head: true })
    .contains('tags', ['T503'])
    .eq('is_active', true);
  console.log('Total T503 en BD:', count);
})();
