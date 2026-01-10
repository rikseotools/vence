const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const LETTER_TO_INDEX = { 'A': 0, 'B': 1, 'C': 2, 'D': 3 };

// Cargar IDs de leyes de la UE
async function loadLaws() {
  const laws = {};

  for (const shortName of ['TUE', 'TFUE', 'CE']) {
    const { data } = await supabase.from('laws').select('id').eq('short_name', shortName).single();
    if (data) laws[shortName] = data.id;
  }

  return laws;
}

function detectLawAndArticle(text) {
  const textLower = text.toLowerCase();

  // TUE - Tratado de la Unión Europea
  if (textLower.includes('tue') || textLower.includes('tratado de la unión europea') ||
      textLower.includes('tratado de la union europea')) {
    const artMatch = text.match(/art[íi]culo\s+(\d+)/i) || text.match(/art\.\s*(\d+)/i);
    return { lawKey: 'TUE', article: artMatch ? artMatch[1] : null };
  }

  // TFUE - Tratado de Funcionamiento
  if (textLower.includes('tfue') || textLower.includes('tratado de funcionamiento') ||
      textLower.includes('tratado funcionamiento')) {
    const artMatch = text.match(/art[íi]culo\s+(\d+)/i) || text.match(/art\.\s*(\d+)/i);
    return { lawKey: 'TFUE', article: artMatch ? artMatch[1] : null };
  }

  // Detección por contexto de institución
  const instituciones = {
    'parlamento europeo': { law: 'TFUE', defaultArt: '14' },
    'consejo europeo': { law: 'TUE', defaultArt: '15' },
    'consejo de la unión': { law: 'TFUE', defaultArt: '16' },
    'comisión europea': { law: 'TUE', defaultArt: '17' },
    'tribunal de justicia': { law: 'TFUE', defaultArt: '19' }
  };

  for (const [inst, config] of Object.entries(instituciones)) {
    if (textLower.includes(inst)) {
      const artMatch = text.match(/art[íi]culo\s+(\d+)/i) || text.match(/art\.\s*(\d+)/i);
      return { lawKey: config.law, article: artMatch ? artMatch[1] : config.defaultArt };
    }
  }

  // CE - Constitución Española
  if (textLower.includes('constitución') || textLower.match(/\bce\b/)) {
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
        errors.push({ q: q.question.substring(0, 50), reason: 'No detectado' });
        continue;
      }

      const lawId = LAWS[lawKey];
      if (!lawId) { errors.push({ q: q.question.substring(0, 50), reason: 'Ley: ' + lawKey }); continue; }

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
        tags: [subtema.trim(), tag, bloque]
      });

      if (!error) {
        imported++;
        console.log('  ✅', lawKey, 'Art', article);
      }
    }
  }

  return { imported, skipped, errors };
}

(async () => {
  console.log('=== Importando T111 - Unión Europea ===\n');

  const LAWS = await loadLaws();
  console.log('Leyes cargadas:', Object.keys(LAWS).join(', '), '\n');

  const dirPath = '/home/manuel/Documentos/github/vence/preguntas-para-subir/Tema_11,_La_organización_de_la_Unión_Europea';

  const result = await importDir(dirPath, 'T111', 'Bloque I', LAWS);
  console.log(`\n📊 Resultado: +${result.imported}, omitidas ${result.skipped}`);

  if (result.errors.length > 0) {
    console.log(`\n❌ Errores (${result.errors.length}):`);
    result.errors.slice(0, 15).forEach(e => console.log('  -', e.reason, ':', e.q));
  }

  const { count } = await supabase.from('questions').select('id', { count: 'exact', head: true }).contains('tags', ['T111']).eq('is_active', true);
  console.log(`\n📈 Total T111: ${count}`);
})();
