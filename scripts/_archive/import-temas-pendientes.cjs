const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const LETTER_TO_INDEX = { 'A': 0, 'B': 1, 'C': 2, 'D': 3 };

// Configuración de temas pendientes
const TEMAS = [
  { dir: 'Tema_1,_Constitución_Española_de_1978', tag: 'T101', bloque: 'Bloque I', name: 'Constitución' },
  { dir: 'Tema_2,_La_Corona', tag: 'T102', bloque: 'Bloque I', name: 'La Corona' },
  { dir: 'Tema_1,_Fuentes_del_derecho_administrativo', tag: 'T106', bloque: 'Bloque I', name: 'Fuentes del derecho' },
  { dir: 'Tema_2,_El_acto_administrativo', tag: 'T107', bloque: 'Bloque I', name: 'Acto administrativo' },
  { dir: 'Tema_4,_Protección_de_datos_personales', tag: 'T204', bloque: 'Bloque II', name: 'Protección de datos' },
  { dir: 'Tema_5,_Procedimientos_y_formas_de_la_actividad_administrativa', tag: 'T205', bloque: 'Bloque II', name: 'Procedimientos' }
];

async function loadLaws() {
  const lawSearches = [
    { key: 'CE', search: 'short_name.eq.CE' },
    { key: 'LPAC', search: 'short_name.ilike.%39/2015%' },
    { key: 'LRJSP', search: 'short_name.ilike.%40/2015%' },
    { key: 'LOPDGDD', search: 'short_name.ilike.%3/2018%' },
    { key: 'RGPD', search: 'short_name.ilike.%2016/679%' },
    { key: 'LGS', search: 'short_name.ilike.%38/2003%' },
    { key: 'LOTC', search: 'short_name.ilike.%2/1979%' },
    { key: 'LODP', search: 'short_name.ilike.%3/1981%' }
  ];

  const laws = {};
  for (const l of lawSearches) {
    const { data } = await supabase.from('laws').select('id').or(l.search).limit(1).single();
    if (data) laws[l.key] = data.id;
  }
  return laws;
}

function detectLawAndArticle(text) {
  const textLower = text.toLowerCase();

  // LOPDGDD - LO 3/2018
  if (textLower.includes('3/2018') || textLower.includes('lopdgdd') ||
      textLower.includes('ley orgánica 3/2018') || textLower.includes('protección de datos personales')) {
    const artMatch = text.match(/art[íi]culo\s+(\d+)/i) || text.match(/art\.\s*(\d+)/i);
    return { lawKey: 'LOPDGDD', article: artMatch ? artMatch[1] : null };
  }

  // RGPD - Reglamento UE 2016/679
  if (textLower.includes('2016/679') || textLower.includes('rgpd') ||
      textLower.includes('reglamento general de protección') || textLower.includes('reglamento europeo')) {
    const artMatch = text.match(/art[íi]culo\s+(\d+)/i) || text.match(/art\.\s*(\d+)/i);
    return { lawKey: 'RGPD', article: artMatch ? artMatch[1] : null };
  }

  // LPAC - Ley 39/2015
  if (textLower.includes('39/2015') || textLower.includes('lpac') ||
      textLower.includes('ley 39/2015') || textLower.includes('procedimiento administrativo común')) {
    const artMatch = text.match(/art[íi]culo\s+(\d+)/i) || text.match(/art\.\s*(\d+)/i);
    return { lawKey: 'LPAC', article: artMatch ? artMatch[1] : null };
  }

  // LRJSP - Ley 40/2015
  if (textLower.includes('40/2015') || textLower.includes('lrjsp') ||
      textLower.includes('ley 40/2015') || textLower.includes('régimen jurídico del sector público')) {
    const artMatch = text.match(/art[íi]culo\s+(\d+)/i) || text.match(/art\.\s*(\d+)/i);
    return { lawKey: 'LRJSP', article: artMatch ? artMatch[1] : null };
  }

  // LGS - Ley 38/2003 (Subvenciones)
  if (textLower.includes('38/2003') || textLower.includes('ley general de subvenciones') ||
      textLower.includes('subvenciones')) {
    const artMatch = text.match(/art[íi]culo\s+(\d+)/i) || text.match(/art\.\s*(\d+)/i);
    return { lawKey: 'LGS', article: artMatch ? artMatch[1] : null };
  }

  // LOTC - LO 2/1979 (Tribunal Constitucional)
  if (textLower.includes('2/1979') || textLower.includes('lotc') ||
      textLower.includes('tribunal constitucional') && textLower.includes('ley orgánica')) {
    const artMatch = text.match(/art[íi]culo\s+(\d+)/i) || text.match(/art\.\s*(\d+)/i);
    return { lawKey: 'LOTC', article: artMatch ? artMatch[1] : null };
  }

  // LODP - LO 3/1981 (Defensor del Pueblo)
  if (textLower.includes('3/1981') || textLower.includes('defensor del pueblo')) {
    const artMatch = text.match(/art[íi]culo\s+(\d+)/i) || text.match(/art\.\s*(\d+)/i);
    return { lawKey: 'LODP', article: artMatch ? artMatch[1] : null };
  }

  // CE - Constitución Española (al final, más genérico)
  if (textLower.includes('constitución') || textLower.match(/\bce\b/) ||
      textLower.includes('constitución española')) {
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
      const { lawKey, article } = detectLawAndArticle(text);

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
  console.log('=== Importando temas pendientes ===\n');

  const LAWS = await loadLaws();
  console.log('Leyes cargadas:', Object.keys(LAWS).join(', '), '\n');

  let totalImported = 0;

  for (const tema of TEMAS) {
    const dirPath = `/home/manuel/Documentos/github/vence/preguntas-para-subir/${tema.dir}`;
    console.log(`📁 ${tema.tag} - ${tema.name}`);

    const result = await importDir(dirPath, tema.tag, tema.bloque, LAWS);
    totalImported += result.imported;
    console.log(`   +${result.imported}, omitidas ${result.skipped}, errores ${result.errors.length}`);

    if (result.errors.length > 0 && result.errors.length <= 5) {
      result.errors.forEach(e => console.log('     ❌', e.reason));
    }

    const { count } = await supabase.from('questions').select('id', { count: 'exact', head: true }).contains('tags', [tema.tag]).eq('is_active', true);
    console.log(`   Total ${tema.tag}: ${count}\n`);
  }

  console.log(`\n📊 Total importadas esta ejecución: ${totalImported}`);
})();
