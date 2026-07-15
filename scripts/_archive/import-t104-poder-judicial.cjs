const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const LETTER_TO_INDEX = { 'A': 0, 'B': 1, 'C': 2, 'D': 3 };

// IDs de leyes relevantes
const LAWS = {
  CE: '6ad91a6c-41ec-431f-9c80-5f5566834941',          // Constitución
  LOPJ: 'a3d58ada-b284-46f7-ab7c-2092d4bb06ff',       // LO 6/1985 Poder Judicial
  EOMF: '8f8cb31f-c8ca-4967-9fa6-6fc94d77a932'        // Ley 50/1981 Estatuto MF
};

const DIR_PATH = '/home/manuel/Documentos/github/vence/preguntas-para-subir/Tema_4,_El_Poder_Judicial';

function detectLawAndArticle(text) {
  const textLower = text.toLowerCase();

  // Ley 50/1981 - Estatuto Ministerio Fiscal
  if (textLower.includes('50/1981') || textLower.includes('ley 50') ||
      textLower.includes('estatuto orgánico del ministerio fiscal')) {
    const artMatch = text.match(/art[íi]culo\s+(\d+)/i) || text.match(/art\.\s*(\d+)/i);
    return { lawKey: 'EOMF', article: artMatch ? artMatch[1] : null };
  }

  // LOPJ - LO 6/1985
  if (textLower.includes('6/1985') || textLower.includes('lo 6') ||
      textLower.includes('ley orgánica del poder judicial') || textLower.includes('lopj') ||
      textLower.includes('ley orgánica 6/1985')) {
    const artMatch = text.match(/art[íi]culo\s+(\d+)/i) || text.match(/art\.\s*(\d+)/i);
    return { lawKey: 'LOPJ', article: artMatch ? artMatch[1] : null };
  }

  // Constitución - detectar arts 117-127 (Título VI)
  if (textLower.includes('constitución') || textLower.includes(' ce') ||
      textLower.includes('ce.') || textLower.includes('ce,') || textLower.includes('de la ce')) {
    const artMatch = text.match(/art[íi]culo\s+(\d+)/i) || text.match(/art\.\s*(\d+)/i);
    return { lawKey: 'CE', article: artMatch ? artMatch[1] : null };
  }

  return { lawKey: null, article: null };
}

(async () => {
  console.log('=== Importando preguntas T104 - El Poder Judicial ===\n');

  const files = fs.readdirSync(DIR_PATH).filter(f => f.endsWith('.json'));
  let imported = 0, skipped = 0, errors = [];

  for (const fileName of files) {
    const content = fs.readFileSync(path.join(DIR_PATH, fileName), 'utf8');
    const data = JSON.parse(content);
    const subtema = data.subtema || fileName.replace(/_/g, ' ').replace('.json', '').substring(0, 30);

    console.log(`\n📁 ${fileName} (${data.questionCount} preguntas)`);

    for (const q of data.questions) {
      // Verificar si ya existe
      const { count } = await supabase
        .from('questions')
        .select('id', { count: 'exact', head: true })
        .eq('question_text', q.question);

      if (count > 0) {
        skipped++;
        continue;
      }

      const text = (q.explanation || '') + ' ' + (q.question || '');
      const { lawKey, article } = detectLawAndArticle(text);

      if (!lawKey || !article) {
        errors.push({
          q: q.question.substring(0, 50),
          reason: 'No detectado',
          explanation: (q.explanation || '').substring(0, 80)
        });
        continue;
      }

      const lawId = LAWS[lawKey];
      if (!lawId) {
        errors.push({ q: q.question.substring(0, 50), reason: 'Ley no configurada: ' + lawKey });
        continue;
      }

      // Buscar artículo
      const { data: art } = await supabase
        .from('articles')
        .select('id')
        .eq('law_id', lawId)
        .eq('article_number', article)
        .eq('is_active', true)
        .single();

      if (!art) {
        errors.push({ q: q.question.substring(0, 50), reason: `${lawKey} Art.${article} no existe` });
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
        primary_article_id: art.id,
        difficulty: 'medium',
        is_active: true,
        is_official_exam: false,
        tags: [subtema.trim(), 'T104', 'Bloque I']
      });

      if (error) {
        if (!error.message.includes('duplicate')) {
          errors.push({ q: q.question.substring(0, 50), reason: error.message.substring(0, 40) });
        } else {
          skipped++;
        }
      } else {
        imported++;
        console.log('  ✅', lawKey, 'Art', article);
      }
    }
  }

  console.log('\n=== RESUMEN ===');
  console.log('Importadas:', imported);
  console.log('Omitidas (duplicadas):', skipped);
  console.log('Errores:', errors.length);

  if (errors.length > 0) {
    console.log('\nErrores (primeros 15):');
    for (const e of errors.slice(0, 15)) {
      console.log('  -', e.q);
      console.log('    Razón:', e.reason);
    }
  }

  // Total T104
  const { count } = await supabase
    .from('questions')
    .select('id', { count: 'exact', head: true })
    .contains('tags', ['T104'])
    .eq('is_active', true);
  console.log('\n✅ Total T104 en BD:', count);
})();
