const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

// Mapeo de tags a topic_number para administrativo
function tagToTopicNumber(tag) {
  const match = tag.match(/T(\d)(\d{2})/);
  if (!match) return null;
  const bloque = parseInt(match[1]);
  const tema = parseInt(match[2]);
  if (bloque === 1) return tema;
  return bloque * 100 + tema;
}

const TEMAS = [
  { dir: 'Tema_1,_Constitución_Española_de_1978', tag: 'T101', bloque: 'Bloque I', name: 'Constitución' },
  { dir: 'Tema_2,_La_Corona', tag: 'T102', bloque: 'Bloque I', name: 'La Corona' },
  { dir: 'Tema_1,_Fuentes_del_derecho_administrativo', tag: 'T301', bloque: 'Bloque III', name: 'Fuentes del derecho' },
  { dir: 'Tema_2,_El_acto_administrativo', tag: 'T302', bloque: 'Bloque III', name: 'Acto administrativo' },
  { dir: 'Tema_4,_Protección_de_datos_personales', tag: 'T204', bloque: 'Bloque II', name: 'Protección de datos' },
  { dir: 'Tema_5,_Procedimientos_y_formas_de_la_actividad_administrativa', tag: 'T305', bloque: 'Bloque III', name: 'Procedimientos' }
];

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
  const { data: existing } = await supabase
    .from('topic_scope')
    .select('id, article_numbers')
    .eq('topic_id', topicId)
    .eq('law_id', lawId)
    .single();

  if (existing) {
    const articles = existing.article_numbers || [];
    if (!articles.includes(articleNumber)) {
      await supabase
        .from('topic_scope')
        .update({ article_numbers: [...articles, articleNumber] })
        .eq('id', existing.id);
      return 'added';
    }
    return 'exists';
  } else {
    await supabase
      .from('topic_scope')
      .insert({
        topic_id: topicId,
        law_id: lawId,
        article_numbers: [articleNumber],
        weight: 0.5
      });
    return 'created';
  }
}

async function processDir(dirPath, tag, bloque, TOPICS) {
  if (!fs.existsSync(dirPath)) {
    console.log(`   ⚠️ No existe directorio`);
    return { updated: 0, scopeUpdates: 0 };
  }

  const topicNumber = tagToTopicNumber(tag);
  const topicId = TOPICS[topicNumber];

  if (!topicId) {
    console.log(`   ⚠️ No existe topic para ${tag}`);
    return { updated: 0, scopeUpdates: 0 };
  }

  const files = fs.readdirSync(dirPath).filter(f => f.endsWith('.json'));
  let updated = 0, scopeUpdates = 0;

  for (const fileName of files) {
    const content = fs.readFileSync(path.join(dirPath, fileName), 'utf8');
    const data = JSON.parse(content);

    for (const q of data.questions) {
      // Buscar pregunta existente
      const { data: existing } = await supabase
        .from('questions')
        .select('id, tags, primary_article_id, articles!primary_article_id(article_number, law_id)')
        .eq('question_text', q.question)
        .single();

      if (!existing) continue;

      // Actualizar tags si no tiene el tag del tema
      const currentTags = existing.tags || [];
      if (!currentTags.includes(tag)) {
        const newTags = [...new Set([...currentTags, tag, bloque])];
        await supabase
          .from('questions')
          .update({ tags: newTags })
          .eq('id', existing.id);
        updated++;
      }

      // Actualizar scope si tiene artículo vinculado
      if (existing.articles) {
        const artNum = existing.articles.article_number;
        const lawId = existing.articles.law_id;
        const result = await ensureArticleInScope(topicId, lawId, artNum);
        if (result === 'added' || result === 'created') {
          scopeUpdates++;
        }
      }
    }
  }

  return { updated, scopeUpdates };
}

(async () => {
  console.log('=== Actualizando tags y topic_scope ===\n');

  const TOPICS = await loadTopics();
  console.log('Topics cargados:', Object.keys(TOPICS).length, '\n');

  let totalUpdated = 0, totalScopeUpdates = 0;

  for (const tema of TEMAS) {
    const dirPath = `/home/manuel/Documentos/github/vence/preguntas-para-subir/${tema.dir}`;
    console.log(`📁 ${tema.tag} - ${tema.name}`);

    const result = await processDir(dirPath, tema.tag, tema.bloque, TOPICS);
    totalUpdated += result.updated;
    totalScopeUpdates += result.scopeUpdates;

    console.log(`   Tags actualizados: ${result.updated}, Scope: +${result.scopeUpdates}`);

    const { count } = await supabase
      .from('questions')
      .select('id', { count: 'exact', head: true })
      .contains('tags', [tema.tag])
      .eq('is_active', true);
    console.log(`   Total ${tema.tag}: ${count}\n`);
  }

  console.log(`\n📊 Resumen:`);
  console.log(`   Tags actualizados: ${totalUpdated}`);
  console.log(`   Artículos añadidos a scope: ${totalScopeUpdates}`);
})();
