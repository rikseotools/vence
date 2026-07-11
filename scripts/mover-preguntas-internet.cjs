require('dotenv').config({ path: '.env.local' });
const { createClient } = require('./lib/pg-agnostic-client.cjs');
const fs = require('fs');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// Normalizar texto igual que comparar-preguntas.cjs
function normalizeText(text) {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\w\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

(async () => {
  console.log('🚀 Moviendo preguntas de La Red Internet a sus artículos correctos...\n');

  // Obtener artículos de La Red Internet
  const { data: law } = await supabase
    .from('laws')
    .select('id')
    .eq('short_name', 'La Red Internet')
    .single();

  const { data: articles } = await supabase
    .from('articles')
    .select('id, article_number, title')
    .eq('law_id', law.id)
    .order('article_number');

  console.log('📚 Artículos disponibles:');
  articles.forEach(a => console.log(`   Art. ${a.article_number}: ${a.title}`));

  // Cargar TODAS las preguntas de La Red Internet (de cualquier artículo)
  const allArticleIds = articles.map(a => a.id);
  const { data: allQuestions } = await supabase
    .from('questions')
    .select('id, question_text, primary_article_id')
    .in('primary_article_id', allArticleIds);

  console.log(`\n📊 Total preguntas en La Red Internet: ${allQuestions.length}`);

  // Crear mapa: texto normalizado -> pregunta BD
  const dbMap = new Map();
  allQuestions.forEach(q => {
    const normalized = normalizeText(q.question_text);
    dbMap.set(normalized, q);
  });

  // Mapeo: nombre archivo -> artículo
  const fileToArticle = {
    'Origen,_evolución_y_estado_actual_de_Internet.json': articles.find(a => a.article_number === '1'),
    'Conceptos_elementales_sobre_protocolos_y_servicios_en_Internet.json': articles.find(a => a.article_number === '2'),
  };

  const baseDir = '/home/manuel/Documentos/github/vence/preguntas-para-subir/Tema_8__La_Red_Internet';

  let movedCount = 0;
  let notFoundCount = 0;
  let alreadyCorrect = 0;

  for (const [filename, targetArticle] of Object.entries(fileToArticle)) {
    const filepath = `${baseDir}/${filename}`;
    if (!fs.existsSync(filepath)) {
      console.log(`⚠️ Archivo no encontrado: ${filename}`);
      continue;
    }

    const data = JSON.parse(fs.readFileSync(filepath));
    console.log(`\n📁 Procesando: ${filename}`);
    console.log(`   → Destino: Art. ${targetArticle.article_number} (${targetArticle.title})`);
    console.log(`   Preguntas en archivo: ${data.questions.length}`);

    for (const q of data.questions) {
      const normalized = normalizeText(q.question);
      const dbQuestion = dbMap.get(normalized);

      if (!dbQuestion) {
        notFoundCount++;
        // Mostrar las primeras no encontradas para debug
        if (notFoundCount <= 3) {
          console.log(`   ⚠️ No encontrada: ${q.question.substring(0, 50)}...`);
        }
        continue;
      }

      // ¿Ya está en el artículo correcto?
      if (dbQuestion.primary_article_id === targetArticle.id) {
        alreadyCorrect++;
        continue;
      }

      // Mover al artículo correcto
      const { error: updateError } = await supabase
        .from('questions')
        .update({ primary_article_id: targetArticle.id })
        .eq('id', dbQuestion.id);

      if (updateError) {
        console.log(`   ❌ Error moviendo: ${q.question.substring(0, 40)}...`);
      } else {
        movedCount++;
      }
    }
  }

  console.log('\n📊 Resumen:');
  console.log(`   ✅ Movidas: ${movedCount}`);
  console.log(`   ✓ Ya correctas: ${alreadyCorrect}`);
  console.log(`   ⚠️ No encontradas: ${notFoundCount}`);

  // Verificar distribución final
  console.log('\n📚 Distribución final:');
  for (const a of articles) {
    const { count } = await supabase
      .from('questions')
      .select('*', { count: 'exact', head: true })
      .eq('primary_article_id', a.id);
    console.log(`   Art. ${a.article_number}: ${count} preguntas`);
  }
})();
