const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const LETTER_TO_INDEX = { 'A': 0, 'B': 1, 'C': 2, 'D': 3 };

const LAWS = {
  CE: '6ad91a6c-41ec-431f-9c80-5f5566834941',
  LOREG: 'd69ff916-62c3-4a31-85f0-394a88cc8adf',
  RCD: null // Buscaremos el ID
};

const DIR_PATH = '/home/manuel/Documentos/github/vence/preguntas-para-subir/Tema_3,_Las_Cortes_Generales';

async function findRCDId() {
  const { data } = await supabase
    .from('laws')
    .select('id')
    .eq('short_name', 'RCD')
    .single();
  return data?.id;
}

function detectLawAndArticle(text) {
  const textLower = text.toLowerCase();

  // LOREG
  if (textLower.includes('loreg') || textLower.includes('régimen electoral') || textLower.includes('5/1985')) {
    const artMatch = textLower.match(/art[íi]culo\s+(\d+)/i) || textLower.match(/art\.\s*(\d+)/i);
    return { lawKey: 'LOREG', article: artMatch ? artMatch[1] : null };
  }

  // Reglamento del Congreso
  if (textLower.includes('reglamento del congreso') || textLower.includes('reglamento congreso')) {
    const artMatch = textLower.match(/art[íi]culo\s+(\d+)/i) || textLower.match(/art\.\s*(\d+)/i);
    return { lawKey: 'RCD', article: artMatch ? artMatch[1] : null };
  }

  // CE
  if (textLower.includes('constitución')) {
    const artMatch = textLower.match(/art[íi]culo\s+(\d+)/i) || textLower.match(/art\.\s*(\d+)/i);
    return { lawKey: 'CE', article: artMatch ? artMatch[1] : null };
  }

  return { lawKey: null, article: null };
}

(async () => {
  // Obtener ID del RCD
  LAWS.RCD = await findRCDId();
  console.log('RCD ID:', LAWS.RCD);

  const files = fs.readdirSync(DIR_PATH).filter(f => f.endsWith('.json'));
  let imported = 0, skipped = 0, errors = [];

  console.log('\n=== Importando preguntas restantes de Cortes Generales ===\n');

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
        skipped++;
        continue;
      }

      const text = (q.explanation || '') + ' ' + (q.question || '');
      const { lawKey, article } = detectLawAndArticle(text);

      if (!lawKey || !article) {
        errors.push({ q: q.question.substring(0, 50), reason: 'No detectado' });
        continue;
      }

      const lawId = LAWS[lawKey];
      if (!lawId) {
        errors.push({ q: q.question.substring(0, 50), reason: 'Ley no encontrada: ' + lawKey });
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
        tags: [tag.trim(), 'T103', 'Bloque I']
      });

      if (error) {
        if (!error.message.includes('duplicate')) {
          errors.push({ q: q.question.substring(0, 50), reason: error.message.substring(0, 40) });
        }
      } else {
        imported++;
        console.log('  ✅', lawKey, 'Art', article + ':', q.question.substring(0, 40) + '...');
      }
    }
  }

  console.log('\n=== RESUMEN ===');
  console.log('Importadas:', imported);
  console.log('Omitidas:', skipped);
  console.log('Errores:', errors.length);

  if (errors.length > 0) {
    console.log('\nErrores pendientes:');
    for (const e of errors) {
      console.log('  -', e.q);
      console.log('    ', e.reason);
    }
  }

  // Total T103
  const { count } = await supabase
    .from('questions')
    .select('id', { count: 'exact', head: true })
    .contains('tags', ['T103'])
    .eq('is_active', true);
  console.log('\nTotal T103 en BD:', count);
})();
