const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const LETTER_TO_INDEX = { 'A': 0, 'B': 1, 'C': 2, 'D': 3 };

// Mapeo de tags a topic_number para administrativo
function tagToTopicNumber(tag) {
  // T101 -> 1, T102 -> 2, T201 -> 201, etc.
  const match = tag.match(/T(\d)(\d{2})/);
  if (!match) return null;
  const bloque = parseInt(match[1]);
  const tema = parseInt(match[2]);
  if (bloque === 1) return tema; // Bloque I: 1-11
  return bloque * 100 + tema; // Bloque II: 201-207, III: 301-307, etc.
}

// Configuración de temas pendientes
const TEMAS = [
  { dir: 'Tema_1,_Constitución_Española_de_1978', tag: 'T101', bloque: 'Bloque I', name: 'Constitución' },
  { dir: 'Tema_2,_La_Corona', tag: 'T102', bloque: 'Bloque I', name: 'La Corona' },
  { dir: 'Tema_1,_Fuentes_del_derecho_administrativo', tag: 'T301', bloque: 'Bloque III', name: 'Fuentes del derecho' },
  { dir: 'Tema_2,_El_acto_administrativo', tag: 'T302', bloque: 'Bloque III', name: 'Acto administrativo' },
  { dir: 'Tema_4,_Protección_de_datos_personales', tag: 'T204', bloque: 'Bloque II', name: 'Protección de datos' },
  { dir: 'Tema_5,_Procedimientos_y_formas_de_la_actividad_administrativa', tag: 'T305', bloque: 'Bloque III', name: 'Procedimientos' }
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
    { key: 'LODP', search: 'short_name.ilike.%3/1981%' },
    { key: 'CC', search: 'name.ilike.%Código Civil%' }
  ];

  const laws = {};
  for (const l of lawSearches) {
    const { data } = await supabase.from('laws').select('id, short_name').or(l.search).limit(1).single();
    if (data) {
      laws[l.key] = { id: data.id, short_name: data.short_name };
    }
  }
  return laws;
}

async function loadTopics() {
  const { data } = await supabase
    .from('topics')
    .select('id, topic_number')
    .eq('position_type', 'administrativo');

  const topics = {};
  for (const t of data || []) {
    topics[t.topic_number] = t.id;
  }
  return topics;
}

async function ensureArticleInScope(topicId, lawId, articleNumber) {
  // Buscar si existe entrada para este topic + law
  const { data: existing } = await supabase
    .from('topic_scope')
    .select('id, article_numbers')
    .eq('topic_id', topicId)
    .eq('law_id', lawId)
    .single();

  if (existing) {
    // Verificar si el artículo ya está
    const articles = existing.article_numbers || [];
    if (!articles.includes(articleNumber)) {
      // Añadir el artículo
      const { error } = await supabase
        .from('topic_scope')
        .update({ article_numbers: [...articles, articleNumber] })
        .eq('id', existing.id);

      if (!error) {
        return { action: 'added', article: articleNumber };
      }
    }
    return { action: 'exists' };
  } else {
    // Crear nueva entrada
    const { error } = await supabase
      .from('topic_scope')
      .insert({
        topic_id: topicId,
        law_id: lawId,
        article_numbers: [articleNumber],
        weight: 0.5
      });

    if (!error) {
      return { action: 'created', article: articleNumber };
    }
  }
  return { action: 'error' };
}

function detectLawAndArticle(text) {
  const textLower = text.toLowerCase();

  // LOPDGDD - LO 3/2018
  if (textLower.includes('3/2018') || textLower.includes('lopdgdd') ||
      textLower.includes('ley orgánica 3/2018')) {
    const artMatch = text.match(/art[íi]culo\s+(\d+)/i) || text.match(/art\.\s*(\d+)/i);
    return { lawKey: 'LOPDGDD', article: artMatch ? artMatch[1] : null };
  }

  // RGPD - Reglamento UE 2016/679
  if (textLower.includes('2016/679') || textLower.includes('rgpd') ||
      textLower.includes('reglamento general de protección')) {
    const artMatch = text.match(/art[íi]culo\s+(\d+)/i) || text.match(/art\.\s*(\d+)/i);
    return { lawKey: 'RGPD', article: artMatch ? artMatch[1] : null };
  }

  // LPAC - Ley 39/2015
  if (textLower.includes('39/2015') || textLower.includes('lpac')) {
    const artMatch = text.match(/art[íi]culo\s+(\d+)/i) || text.match(/art\.\s*(\d+)/i);
    return { lawKey: 'LPAC', article: artMatch ? artMatch[1] : null };
  }

  // LRJSP - Ley 40/2015
  if (textLower.includes('40/2015') || textLower.includes('lrjsp')) {
    const artMatch = text.match(/art[íi]culo\s+(\d+)/i) || text.match(/art\.\s*(\d+)/i);
    return { lawKey: 'LRJSP', article: artMatch ? artMatch[1] : null };
  }

  // LGS - Ley 38/2003
  if (textLower.includes('38/2003') || textLower.includes('subvenciones')) {
    const artMatch = text.match(/art[íi]culo\s+(\d+)/i) || text.match(/art\.\s*(\d+)/i);
    return { lawKey: 'LGS', article: artMatch ? artMatch[1] : null };
  }

  // LOTC - LO 2/1979
  if (textLower.includes('2/1979') || textLower.includes('tribunal constitucional')) {
    const artMatch = text.match(/art[íi]culo\s+(\d+)/i) || text.match(/art\.\s*(\d+)/i);
    return { lawKey: 'LOTC', article: artMatch ? artMatch[1] : null };
  }

  // LODP - LO 3/1981
  if (textLower.includes('3/1981') || textLower.includes('defensor del pueblo')) {
    const artMatch = text.match(/art[íi]culo\s+(\d+)/i) || text.match(/art\.\s*(\d+)/i);
    return { lawKey: 'LODP', article: artMatch ? artMatch[1] : null };
  }

  // CE - Constitución Española
  if (textLower.includes('constitución') || textLower.match(/\bce\b/)) {
    const artMatch = text.match(/art[íi]culo\s+(\d+)/i) || text.match(/art\.\s*(\d+)/i);
    return { lawKey: 'CE', article: artMatch ? artMatch[1] : null };
  }

  return { lawKey: null, article: null };
}

async function importDir(dirPath, tag, bloque, LAWS, TOPICS) {
  if (!fs.existsSync(dirPath)) {
    console.log(`   ⚠️ No existe directorio`);
    return { imported: 0, skipped: 0, errors: [], scopeUpdates: [] };
  }

  const topicNumber = tagToTopicNumber(tag);
  const topicId = TOPICS[topicNumber];

  if (!topicId) {
    console.log(`   ⚠️ No existe topic para ${tag} (topic_number: ${topicNumber})`);
    return { imported: 0, skipped: 0, errors: [], scopeUpdates: [] };
  }

  const files = fs.readdirSync(dirPath).filter(f => f.endsWith('.json'));
  let imported = 0, skipped = 0;
  const errors = [];
  const scopeUpdates = [];

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

      const lawInfo = LAWS[lawKey];
      if (!lawInfo) { errors.push({ q: q.question.substring(0, 40), reason: 'Ley: ' + lawKey }); continue; }

      const { data: art } = await supabase
        .from('articles')
        .select('id')
        .eq('law_id', lawInfo.id)
        .eq('article_number', article)
        .eq('is_active', true)
        .single();

      if (!art) {
        errors.push({ q: q.question.substring(0, 40), reason: `${lawKey} Art.${article}` });
        continue;
      }

      // Verificar/actualizar topic_scope
      const scopeResult = await ensureArticleInScope(topicId, lawInfo.id, article);
      if (scopeResult.action === 'added' || scopeResult.action === 'created') {
        scopeUpdates.push(`${lawInfo.short_name} Art.${article}`);
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

  return { imported, skipped, errors, scopeUpdates };
}

(async () => {
  console.log('=== Importando temas con actualización de topic_scope ===\n');

  const LAWS = await loadLaws();
  const TOPICS = await loadTopics();

  console.log('Leyes cargadas:', Object.keys(LAWS).join(', '));
  console.log('Topics cargados:', Object.keys(TOPICS).length, '\n');

  let totalImported = 0;
  let totalScopeUpdates = 0;

  for (const tema of TEMAS) {
    const dirPath = `/home/manuel/Documentos/github/vence/preguntas-para-subir/${tema.dir}`;
    console.log(`📁 ${tema.tag} - ${tema.name}`);

    const result = await importDir(dirPath, tema.tag, tema.bloque, LAWS, TOPICS);
    totalImported += result.imported;
    totalScopeUpdates += result.scopeUpdates.length;

    console.log(`   +${result.imported} preguntas, ${result.skipped} omitidas, ${result.errors.length} errores`);

    if (result.scopeUpdates.length > 0) {
      console.log(`   📋 Scope actualizado: ${result.scopeUpdates.join(', ')}`);
    }

    if (result.errors.length > 0 && result.errors.length <= 5) {
      result.errors.forEach(e => console.log('     ❌', e.reason));
    }

    const { count } = await supabase.from('questions').select('id', { count: 'exact', head: true }).contains('tags', [tema.tag]).eq('is_active', true);
    console.log(`   Total ${tema.tag}: ${count}\n`);
  }

  console.log(`\n📊 Resumen:`);
  console.log(`   Preguntas importadas: ${totalImported}`);
  console.log(`   Artículos añadidos a scope: ${totalScopeUpdates}`);
})();
