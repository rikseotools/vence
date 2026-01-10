const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const LETTER_TO_INDEX = { 'A': 0, 'B': 1, 'C': 2, 'D': 3 };

// IDs de leyes
const LAWS = {
  CE: '6ad91a6c-41ec-431f-9c80-5f5566834941',
  LRJSP: '95680d57-feb1-41c0-bb27-236024815feb',   // Ley 40/2015
  LBRL: '06784434-f549-4ea2-894f-e2e400881545'     // Ley 7/1985
};

const TEMAS = [
  { dir: 'Tema_8,_La_Administración_General_del_Estado', tag: 'T108', bloque: 'Bloque I' },
  { dir: 'Tema_9,_La_Organización_territorial_del_Estado', tag: 'T109', bloque: 'Bloque I' },
  { dir: 'Tema_10,_La_Administración_Local', tag: 'T110', bloque: 'Bloque I' }
];

function detectLawAndArticle(text) {
  const textLower = text.toLowerCase();

  // LBRL - Ley 7/1985
  if (textLower.includes('7/1985') || textLower.includes('ley 7') ||
      textLower.includes('bases del régimen local') || textLower.includes('lbrl') ||
      textLower.includes('reguladora de las bases')) {
    const artMatch = text.match(/art[íi]culo\s+(\d+)/i) || text.match(/art\.\s*(\d+)/i);
    return { lawKey: 'LBRL', article: artMatch ? artMatch[1] : null };
  }

  // LRJSP - Ley 40/2015
  if (textLower.includes('40/2015') || textLower.includes('ley 40') ||
      textLower.includes('régimen jurídico del sector público') || textLower.includes('lrjsp')) {
    const artMatch = text.match(/art[íi]culo\s+(\d+)/i) || text.match(/art\.\s*(\d+)/i);
    return { lawKey: 'LRJSP', article: artMatch ? artMatch[1] : null };
  }

  // Constitución
  if (textLower.includes('constitución') || textLower.includes(' ce') ||
      textLower.includes('ce.') || textLower.includes('ce,')) {
    const artMatch = text.match(/art[íi]culo\s+(\d+)/i) || text.match(/art\.\s*(\d+)/i);
    return { lawKey: 'CE', article: artMatch ? artMatch[1] : null };
  }

  // Detectar artículos típicos de cada tema
  const artMatch = text.match(/art[íi]culo\s+(\d+)/i) || text.match(/art\.\s*(\d+)/i);
  if (artMatch) {
    const num = parseInt(artMatch[1]);
    // Organización territorial CE: 137-158
    if (num >= 137 && num <= 158) return { lawKey: 'CE', article: artMatch[1] };
    // AGE en LRJSP: 54-80
    if (num >= 54 && num <= 80) return { lawKey: 'LRJSP', article: artMatch[1] };
  }

  return { lawKey: null, article: null };
}

(async () => {
  let totalImported = 0, totalSkipped = 0, totalErrors = [];

  for (const tema of TEMAS) {
    const dirPath = `/home/manuel/Documentos/github/vence/preguntas-para-subir/${tema.dir}`;
    if (!fs.existsSync(dirPath)) {
      console.log(`\n⚠️ No existe: ${tema.dir}`);
      continue;
    }

    console.log(`\n=== ${tema.dir} (${tema.tag}) ===`);
    const files = fs.readdirSync(dirPath).filter(f => f.endsWith('.json'));
    let imported = 0, skipped = 0, errors = [];

    for (const fileName of files) {
      const content = fs.readFileSync(path.join(dirPath, fileName), 'utf8');
      const data = JSON.parse(content);
      const subtema = data.subtema || fileName.replace(/_/g, ' ').replace('.json', '').substring(0, 30);
      console.log(`  📁 ${fileName} (${data.questionCount || data.questions?.length})`);

      for (const q of data.questions) {
        const { count } = await supabase
          .from('questions')
          .select('id', { count: 'exact', head: true })
          .eq('question_text', q.question);

        if (count > 0) { skipped++; continue; }

        const text = (q.explanation || '') + ' ' + (q.question || '');
        const { lawKey, article } = detectLawAndArticle(text);

        if (!lawKey || !article) {
          errors.push({ q: q.question.substring(0, 50), reason: 'No detectado' });
          continue;
        }

        const lawId = LAWS[lawKey];
        if (!lawId) {
          errors.push({ q: q.question.substring(0, 50), reason: 'Ley: ' + lawKey });
          continue;
        }

        const { data: art } = await supabase
          .from('articles')
          .select('id')
          .eq('law_id', lawId)
          .eq('article_number', article)
          .eq('is_active', true)
          .single();

        if (!art) {
          errors.push({ q: q.question.substring(0, 50), reason: `${lawKey} Art.${article}` });
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

        if (error && !error.message.includes('duplicate')) {
          errors.push({ q: q.question.substring(0, 50), reason: error.message.substring(0, 30) });
        } else if (!error) {
          imported++;
          console.log('    ✅', lawKey, 'Art', article);
        }
      }
    }

    console.log(`  Resultado: +${imported}, omitidas ${skipped}, errores ${errors.length}`);
    totalImported += imported;
    totalSkipped += skipped;
    totalErrors = totalErrors.concat(errors.map(e => ({ ...e, tema: tema.tag })));

    const { count } = await supabase.from('questions').select('id', { count: 'exact', head: true }).contains('tags', [tema.tag]).eq('is_active', true);
    console.log(`  Total ${tema.tag}: ${count}`);
  }

  console.log('\n=== RESUMEN FINAL ===');
  console.log('Importadas:', totalImported);
  console.log('Omitidas:', totalSkipped);
  console.log('Errores:', totalErrors.length);

  if (totalErrors.length > 0) {
    console.log('\nErrores por tema:');
    const byTema = {};
    for (const e of totalErrors) {
      if (!byTema[e.tema]) byTema[e.tema] = [];
      byTema[e.tema].push(e);
    }
    for (const [tema, errs] of Object.entries(byTema)) {
      console.log(`\n  ${tema} (${errs.length}):`);
      for (const e of errs.slice(0, 5)) {
        console.log('    -', e.q);
        console.log('      ', e.reason);
      }
    }
  }
})();
