const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const LETTER_TO_INDEX = { 'A': 0, 'B': 1, 'C': 2, 'D': 3 };

const LAWS = {
  TREBEP: 'e602d0b8-1529-4c04-9bd1-8dccdbd5baa0',    // RDL 5/2015
  RD364: 'edbce811-d91b-4b55-8689-610925dd6e63',     // RD 364/1995 (Ingreso)
  RD365: 'bd84b18b-7f6e-4d24-ac54-e2666bc7802d',     // RD 365/1995 (Situaciones)
  CE: '6ad91a6c-41ec-431f-9c80-5f5566834941'
};

const TEMAS = [
  { dir: 'Tema_1,_El_personal_al_servicio_de_las_Administraciones_públicas', tag: 'T301', bloque: 'Bloque III' },
  { dir: 'Tema_2,_Selección_de_personal', tag: 'T302', bloque: 'Bloque III' },
  { dir: 'Tema_3,_El_personal_funcionario_al_servicio_de_las_Administraciones_públicas', tag: 'T303', bloque: 'Bloque III' },
  { dir: 'Tema_4,_Las_retribuciones', tag: 'T304', bloque: 'Bloque III' },
  { dir: 'Tema_5,_Provisión_de_puestos_de_trabajo', tag: 'T305', bloque: 'Bloque III' },
  { dir: 'Tema_6,_Las_incompatibilidades_y_régimen_disciplinario', tag: 'T306', bloque: 'Bloque III' },
  { dir: 'Tema_7,_El_régimen_de_la_Seguridad_Social_de_los_funcionarios', tag: 'T307', bloque: 'Bloque III' },
  { dir: 'Tema_8,_El_personal_laboral', tag: 'T308', bloque: 'Bloque III' }
];

function detectLawAndArticle(text) {
  const textLower = text.toLowerCase();

  // RD 364/1995 - Reglamento de ingreso
  if (textLower.includes('364/1995') || textLower.includes('rd 364') ||
      textLower.includes('reglamento general de ingreso')) {
    const artMatch = text.match(/art[íi]culo\s+(\d+)/i) || text.match(/art\.\s*(\d+)/i);
    return { lawKey: 'RD364', article: artMatch ? artMatch[1] : null };
  }

  // RD 365/1995 - Reglamento de situaciones
  if (textLower.includes('365/1995') || textLower.includes('rd 365') ||
      textLower.includes('reglamento de situaciones')) {
    const artMatch = text.match(/art[íi]culo\s+(\d+)/i) || text.match(/art\.\s*(\d+)/i);
    return { lawKey: 'RD365', article: artMatch ? artMatch[1] : null };
  }

  // TREBEP - RDL 5/2015
  if (textLower.includes('5/2015') || textLower.includes('rdl 5') ||
      textLower.includes('trebep') || textLower.includes('estatuto básico') ||
      textLower.includes('texto refundido') || textLower.includes('empleado público') ||
      textLower.includes('real decreto legislativo 5/2015')) {
    const artMatch = text.match(/art[íi]culo\s+(\d+)/i) || text.match(/art\.\s*(\d+)/i);
    return { lawKey: 'TREBEP', article: artMatch ? artMatch[1] : null };
  }

  // CE
  if (textLower.includes('constitución') || textLower.includes(' ce')) {
    const artMatch = text.match(/art[íi]culo\s+(\d+)/i) || text.match(/art\.\s*(\d+)/i);
    return { lawKey: 'CE', article: artMatch ? artMatch[1] : null };
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

    console.log(`\n=== ${tema.tag} - ${tema.dir.split(',')[1]?.trim() || ''} ===`);
    const files = fs.readdirSync(dirPath).filter(f => f.endsWith('.json'));
    let imported = 0, skipped = 0, errors = [];

    for (const fileName of files) {
      const content = fs.readFileSync(path.join(dirPath, fileName), 'utf8');
      const data = JSON.parse(content);
      const subtema = data.subtema || fileName.replace(/_/g, ' ').replace('.json', '').substring(0, 30);

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
          console.log('  ✅', lawKey, 'Art', article);
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

  console.log('\n=== RESUMEN FINAL BLOQUE III ===');
  console.log('Importadas:', totalImported);
  console.log('Omitidas:', totalSkipped);
  console.log('Errores:', totalErrors.length);
})();
