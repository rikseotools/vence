const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const LETTER_TO_INDEX = { 'A': 0, 'B': 1, 'C': 2, 'D': 3 };

// Cargar IDs de leyes
async function loadLaws() {
  const lawSearches = [
    { key: 'LO3_2007', search: 'short_name.ilike.%3/2007%' },         // Igualdad
    { key: 'LO1_2004', search: 'short_name.eq.LO 1/2004' },           // Violencia género
    { key: 'LEY39_2006', search: 'short_name.ilike.%39/2006%' },      // Dependencia
    { key: 'RDL1_2013', search: 'short_name.ilike.%1/2013%' },        // Discapacidad
    { key: 'CE', search: 'short_name.eq.CE' }
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

  // Ley 39/2006 - Dependencia (primero, más específico)
  if (textLower.includes('39/2006') || textLower.includes('ley 39/2006') ||
      textLower.includes('dependencia') || textLower.includes('autonomía personal')) {
    const artMatch = text.match(/art[íi]culo\s+(\d+)/i) || text.match(/art\.\s*(\d+)/i);
    return { lawKey: 'LEY39_2006', article: artMatch ? artMatch[1] : null };
  }

  // RDL 1/2013 - Discapacidad
  if (textLower.includes('1/2013') || textLower.includes('discapacidad') ||
      textLower.includes('real decreto legislativo 1/2013')) {
    const artMatch = text.match(/art[íi]culo\s+(\d+)/i) || text.match(/art\.\s*(\d+)/i);
    return { lawKey: 'RDL1_2013', article: artMatch ? artMatch[1] : null };
  }

  // LO 3/2007 - Igualdad efectiva
  if (textLower.includes('3/2007') || textLower.includes('igualdad efectiva') ||
      textLower.includes('ley orgánica 3/2007')) {
    const artMatch = text.match(/art[íi]culo\s+(\d+)/i) || text.match(/art\.\s*(\d+)/i);
    return { lawKey: 'LO3_2007', article: artMatch ? artMatch[1] : null };
  }

  // LO 1/2004 - Violencia género
  if (textLower.includes('1/2004') || textLower.includes('violencia de género') ||
      textLower.includes('ley orgánica 1/2004')) {
    const artMatch = text.match(/art[íi]culo\s+(\d+)/i) || text.match(/art\.\s*(\d+)/i);
    return { lawKey: 'LO1_2004', article: artMatch ? artMatch[1] : null };
  }

  // CE
  if (textLower.includes('constitución') || textLower.match(/\bce\b/)) {
    const artMatch = text.match(/art[íi]culo\s+(\d+)/i) || text.match(/art\.\s*(\d+)/i);
    return { lawKey: 'CE', article: artMatch ? artMatch[1] : null };
  }

  return { lawKey: null, article: null };
}

async function importDir(dirPath, tag, bloque, LAWS) {
  if (!fs.existsSync(dirPath)) {
    console.log(`   ⚠️ No existe directorio: ${dirPath}`);
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
  console.log('=== Importando T207 - Igualdad/Violencia/Dependencia ===\n');

  const LAWS = await loadLaws();
  console.log('Leyes cargadas:', Object.keys(LAWS).join(', '), '\n');

  const dirPath = '/home/manuel/Documentos/github/vence/preguntas-para-subir/Tema_7,_Políticas_de_igualdad_y_contra_la_violencia_de_género_y_discapacidad_y_dependencia';

  const result = await importDir(dirPath, 'T207', 'Bloque II', LAWS);
  console.log(`\n📊 Resultado: +${result.imported}, omitidas ${result.skipped}`);

  if (result.errors.length > 0) {
    console.log(`\n❌ Errores (${result.errors.length}):`);
    result.errors.slice(0, 15).forEach(e => console.log('  -', e.reason, ':', e.q));
  }

  const { count } = await supabase.from('questions').select('id', { count: 'exact', head: true }).contains('tags', ['T207']).eq('is_active', true);
  console.log(`\n📈 Total T207: ${count}`);
})();
