const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const LETTER_TO_INDEX = { 'A': 0, 'B': 1, 'C': 2, 'D': 3 };

// Cargar IDs de leyes dinámicamente
async function loadLaws() {
  const lawNames = [
    { key: 'CE', search: 'short_name.eq.CE' },
    { key: 'LPAC', search: 'short_name.ilike.%39/2015%' },
    { key: 'LRJSP', search: 'short_name.ilike.%40/2015%' },
    { key: 'TREBEP', search: 'short_name.ilike.%5/2015%' },
    { key: 'LO3_2007', search: 'short_name.ilike.%3/2007%' }, // Igualdad
    { key: 'LO1_2004', search: 'short_name.ilike.%1/2004%' }, // Violencia género
    { key: 'LEY19_2013', search: 'short_name.ilike.%19/2013%' }, // Transparencia
    { key: 'TUE', search: 'name.ilike.%Unión Europea%' }
  ];

  const laws = {};
  for (const l of lawNames) {
    const { data } = await supabase.from('laws').select('id').or(l.search).limit(1).single();
    if (data) laws[l.key] = data.id;
  }
  return laws;
}

const TEMAS = [
  { dir: 'Tema_7,_Políticas_de_igualdad_y_contra_la_violencia_de_género', tag: 'T207', bloque: 'Bloque II' },
  { dir: 'Tema_2,_Documento,_registro_y_archivo', tag: 'T202', bloque: 'Bloque II' },
  { dir: 'Tema_6,_Gobierno_Abierto_y_Agenda_2030', tag: 'T206', bloque: 'Bloque II' },
  { dir: 'Tema_11,_La_organización_de_la_Unión_Europea', tag: 'T111', bloque: 'Bloque I' },
  { dir: 'Tema_3,_Administración_Electrónica', tag: 'T203', bloque: 'Bloque II' },
  { dir: 'Tema_7,_La_Ley_de_transparencia', tag: 'T207b', bloque: 'Bloque II' }
];

function detectLawAndArticle(text, LAWS) {
  const textLower = text.toLowerCase();

  // LO 3/2007 - Igualdad
  if (textLower.includes('3/2007') || textLower.includes('ley orgánica 3/2007') ||
      textLower.includes('igualdad efectiva')) {
    const artMatch = text.match(/art[íi]culo\s+(\d+)/i) || text.match(/art\.\s*(\d+)/i);
    return { lawKey: 'LO3_2007', article: artMatch ? artMatch[1] : null };
  }

  // LO 1/2004 - Violencia género
  if (textLower.includes('1/2004') || textLower.includes('violencia de género')) {
    const artMatch = text.match(/art[íi]culo\s+(\d+)/i) || text.match(/art\.\s*(\d+)/i);
    return { lawKey: 'LO1_2004', article: artMatch ? artMatch[1] : null };
  }

  // Ley 19/2013 - Transparencia
  if (textLower.includes('19/2013') || textLower.includes('transparencia')) {
    const artMatch = text.match(/art[íi]culo\s+(\d+)/i) || text.match(/art\.\s*(\d+)/i);
    return { lawKey: 'LEY19_2013', article: artMatch ? artMatch[1] : null };
  }

  // LPAC - Ley 39/2015
  if (textLower.includes('39/2015') || textLower.includes('lpac') ||
      textLower.includes('procedimiento administrativo')) {
    const artMatch = text.match(/art[íi]culo\s+(\d+)/i) || text.match(/art\.\s*(\d+)/i);
    return { lawKey: 'LPAC', article: artMatch ? artMatch[1] : null };
  }

  // LRJSP - Ley 40/2015
  if (textLower.includes('40/2015') || textLower.includes('lrjsp')) {
    const artMatch = text.match(/art[íi]culo\s+(\d+)/i) || text.match(/art\.\s*(\d+)/i);
    return { lawKey: 'LRJSP', article: artMatch ? artMatch[1] : null };
  }

  // CE
  if (textLower.includes('constitución') || textLower.includes(' ce')) {
    const artMatch = text.match(/art[íi]culo\s+(\d+)/i) || text.match(/art\.\s*(\d+)/i);
    return { lawKey: 'CE', article: artMatch ? artMatch[1] : null };
  }

  return { lawKey: null, article: null };
}

async function importDir(dirPath, tag, bloque, LAWS) {
  if (!fs.existsSync(dirPath)) {
    console.log(`   ⚠️ No existe directorio`);
    return { imported: 0, skipped: 0, errors: [] };
  }

  const files = fs.readdirSync(dirPath).filter(f => f.endsWith('.json'));
  let imported = 0, skipped = 0;
  const errors = [];

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
      const { lawKey, article } = detectLawAndArticle(text, LAWS);

      if (!lawKey || !article) {
        errors.push({ q: q.question.substring(0, 40), reason: 'No detectado' });
        continue;
      }

      const lawId = LAWS[lawKey];
      if (!lawId) { errors.push({ q: q.question.substring(0, 40), reason: 'Ley: ' + lawKey }); continue; }

      const { data: art } = await supabase
        .from('articles')
        .select('id')
        .eq('law_id', lawId)
        .eq('article_number', article)
        .eq('is_active', true)
        .single();

      if (!art) {
        errors.push({ q: q.question.substring(0, 40), reason: `${lawKey} Art.${article}` });
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
        tags: [subtema.trim(), tag, bloque]
      });

      if (!error) {
        imported++;
        console.log('    ✅', lawKey, 'Art', article);
      }
    }
  }

  return { imported, skipped, errors };
}

(async () => {
  console.log('=== Importando temas pendientes varios ===\n');

  const LAWS = await loadLaws();
  console.log('Leyes cargadas:', Object.keys(LAWS).join(', '), '\n');

  for (const tema of TEMAS) {
    const dirPath = `/home/manuel/Documentos/github/vence/preguntas-para-subir/${tema.dir}`;
    console.log(`📁 ${tema.tag} - ${tema.dir.split(',')[1]?.trim() || tema.dir}`);

    const result = await importDir(dirPath, tema.tag, tema.bloque, LAWS);
    console.log(`   +${result.imported}, omitidas ${result.skipped}, errores ${result.errors.length}`);

    const { count } = await supabase.from('questions').select('id', { count: 'exact', head: true }).contains('tags', [tema.tag]).eq('is_active', true);
    console.log(`   Total ${tema.tag}: ${count}\n`);
  }
})();
