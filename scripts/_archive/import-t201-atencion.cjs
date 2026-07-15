const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const LETTER_TO_INDEX = { 'A': 0, 'B': 1, 'C': 2, 'D': 3 };

// IDs de leyes relevantes
const LAWS = {
  LPAC: '218452f5-b9f6-48f0-a25b-26df9cb19644',    // Ley 39/2015
  LRJSP: '95680d57-feb1-41c0-bb27-236024815feb',   // Ley 40/2015
  RD208: 'a76f584e-26d4-4c50-afef-b7811cc2bffd',   // RD 208/1996
  RD951: '07c2113d-cc6b-499c-8412-adf79692d390',   // RD 951/2005
  CE: '6ad91a6c-41ec-431f-9c80-5f5566834941'       // Constitución
};

const DIR_PATH = '/home/manuel/Documentos/github/vence/preguntas-para-subir/Tema_1,_Atención_al_público';

function detectLawAndArticle(text) {
  const textLower = text.toLowerCase();

  // RD 951/2005 - Quejas y sugerencias
  if (textLower.includes('951/2005') || textLower.includes('rd 951') || textLower.includes('real decreto 951')) {
    const artMatch = text.match(/art[íi]culo\s+(\d+)/i) || text.match(/art\.\s*(\d+)/i);
    return { lawKey: 'RD951', article: artMatch ? artMatch[1] : null };
  }

  // RD 208/1996 - Información administrativa
  if (textLower.includes('208/1996') || textLower.includes('rd 208') || textLower.includes('real decreto 208') ||
      textLower.includes('servicios de información administrativa')) {
    const artMatch = text.match(/art[íi]culo\s+(\d+)/i) || text.match(/art\.\s*(\d+)/i);
    return { lawKey: 'RD208', article: artMatch ? artMatch[1] : null };
  }

  // Ley 40/2015 - LRJSP
  if (textLower.includes('40/2015') || textLower.includes('ley 40') ||
      textLower.includes('régimen jurídico del sector público') || textLower.includes('lrjsp')) {
    const artMatch = text.match(/art[íi]culo\s+(\d+)/i) || text.match(/art\.\s*(\d+)/i);
    return { lawKey: 'LRJSP', article: artMatch ? artMatch[1] : null };
  }

  // Ley 39/2015 - LPAC
  if (textLower.includes('39/2015') || textLower.includes('ley 39') ||
      textLower.includes('procedimiento administrativo común') || textLower.includes('lpac')) {
    const artMatch = text.match(/art[íi]culo\s+(\d+)/i) || text.match(/art\.\s*(\d+)/i);
    return { lawKey: 'LPAC', article: artMatch ? artMatch[1] : null };
  }

  // Constitución
  if (textLower.includes('constitución') || textLower.includes('ce')) {
    const artMatch = text.match(/art[íi]culo\s+(\d+)/i) || text.match(/art\.\s*(\d+)/i);
    return { lawKey: 'CE', article: artMatch ? artMatch[1] : null };
  }

  return { lawKey: null, article: null };
}

(async () => {
  console.log('=== Importando preguntas T201 - Atención al público ===\n');

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
        tags: [subtema.trim(), 'T201', 'Bloque II']
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
      if (e.explanation) console.log('    Explicación:', e.explanation);
    }
  }

  // Total T201
  const { count } = await supabase
    .from('questions')
    .select('id', { count: 'exact', head: true })
    .contains('tags', ['T201'])
    .eq('is_active', true);
  console.log('\n✅ Total T201 en BD:', count);
})();
