const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const LETTER_TO_INDEX = { 'A': 0, 'B': 1, 'C': 2, 'D': 3 };

// IDs de leyes relevantes
const LAWS = {
  CE: '6ad91a6c-41ec-431f-9c80-5f5566834941',          // Constitución
  LG: 'ce77ea74-b832-4fde-a4e8-76a09f9c7a6a',          // Ley 50/1997 del Gobierno
  LRJSP: '95680d57-feb1-41c0-bb27-236024815feb'        // Ley 40/2015
};

// Temas a procesar
const TEMAS = [
  {
    dir: 'Tema_2,_La_Corona',
    tag: 'T102',
    bloque: 'Bloque I'
  },
  {
    dir: 'Tema_5,_El_Gobierno',
    tag: 'T105',
    bloque: 'Bloque I'
  }
];

function detectLawAndArticle(text) {
  const textLower = text.toLowerCase();

  // Ley 50/1997 del Gobierno
  if (textLower.includes('50/1997') || textLower.includes('ley 50') ||
      textLower.includes('ley del gobierno')) {
    const artMatch = text.match(/art[íi]culo\s+(\d+)/i) || text.match(/art\.\s*(\d+)/i);
    return { lawKey: 'LG', article: artMatch ? artMatch[1] : null };
  }

  // Ley 40/2015 LRJSP
  if (textLower.includes('40/2015') || textLower.includes('ley 40') ||
      textLower.includes('régimen jurídico del sector público')) {
    const artMatch = text.match(/art[íi]culo\s+(\d+)/i) || text.match(/art\.\s*(\d+)/i);
    return { lawKey: 'LRJSP', article: artMatch ? artMatch[1] : null };
  }

  // Constitución (default para estos temas)
  if (textLower.includes('constitución') || textLower.includes(' ce') ||
      textLower.includes('ce.') || textLower.includes('ce,') || textLower.includes('de la ce') ||
      textLower.includes('ce:')) {
    const artMatch = text.match(/art[íi]culo\s+(\d+)/i) || text.match(/art\.\s*(\d+)/i);
    return { lawKey: 'CE', article: artMatch ? artMatch[1] : null };
  }

  // Si menciona artículo pero no ley, asumir CE para estos temas
  const artMatch = text.match(/art[íi]culo\s+(\d+)/i) || text.match(/art\.\s*(\d+)/i);
  if (artMatch) {
    const num = parseInt(artMatch[1]);
    // Corona: 56-65, Gobierno: 97-107
    if ((num >= 56 && num <= 65) || (num >= 97 && num <= 107)) {
      return { lawKey: 'CE', article: artMatch[1] };
    }
  }

  return { lawKey: null, article: null };
}

(async () => {
  // Verificar si existe Ley del Gobierno
  const { data: lg } = await supabase.from('laws').select('id').eq('short_name', 'Ley 50/1997').single();
  if (lg) LAWS.LG = lg.id;
  console.log('Ley 50/1997 ID:', LAWS.LG || 'No encontrada');

  let totalImported = 0, totalSkipped = 0, totalErrors = [];

  for (const tema of TEMAS) {
    const dirPath = `/home/manuel/Documentos/github/vence/preguntas-para-subir/${tema.dir}`;

    if (!fs.existsSync(dirPath)) {
      console.log(`\n⚠️ Directorio no existe: ${tema.dir}`);
      continue;
    }

    console.log(`\n=== Procesando ${tema.dir} (${tema.tag}) ===`);

    const files = fs.readdirSync(dirPath).filter(f => f.endsWith('.json'));
    let imported = 0, skipped = 0, errors = [];

    for (const fileName of files) {
      const content = fs.readFileSync(path.join(dirPath, fileName), 'utf8');
      const data = JSON.parse(content);
      const subtema = data.subtema || fileName.replace(/_/g, ' ').replace('.json', '').substring(0, 30);

      console.log(`  📁 ${fileName} (${data.questionCount || data.questions?.length} preguntas)`);

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
            file: fileName
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
          tags: [subtema.trim(), tema.tag, tema.bloque]
        });

        if (error) {
          if (!error.message.includes('duplicate')) {
            errors.push({ q: q.question.substring(0, 50), reason: error.message.substring(0, 40) });
          } else {
            skipped++;
          }
        } else {
          imported++;
          console.log('    ✅', lawKey, 'Art', article);
        }
      }
    }

    console.log(`  Resumen ${tema.tag}: Importadas ${imported}, Omitidas ${skipped}, Errores ${errors.length}`);
    totalImported += imported;
    totalSkipped += skipped;
    totalErrors = totalErrors.concat(errors);

    // Mostrar total en BD
    const { count } = await supabase
      .from('questions')
      .select('id', { count: 'exact', head: true })
      .contains('tags', [tema.tag])
      .eq('is_active', true);
    console.log(`  Total ${tema.tag} en BD: ${count}`);
  }

  console.log('\n=== RESUMEN FINAL ===');
  console.log('Total importadas:', totalImported);
  console.log('Total omitidas:', totalSkipped);
  console.log('Total errores:', totalErrors.length);

  if (totalErrors.length > 0) {
    console.log('\nErrores (primeros 10):');
    for (const e of totalErrors.slice(0, 10)) {
      console.log('  -', e.q);
      console.log('    Razón:', e.reason);
    }
  }
})();
