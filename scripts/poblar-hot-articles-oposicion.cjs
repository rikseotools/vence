/**
 * Script para poblar target_oposicion en hot_articles
 *
 * FASE 4 del ROADMAP-FIX-OFICIAL-POR-OPOSICION.md
 *
 * Lógica:
 * 1. Obtener hot_articles sin target_oposicion
 * 2. Para cada uno, buscar preguntas oficiales que referencian ese artículo
 * 3. Derivar la oposición más frecuente de las preguntas
 * 4. Actualizar el hot_article con target_oposicion
 */
require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function poblarTargetOposicion() {
  console.log('=== POBLACIÓN DE target_oposicion EN hot_articles ===\n');

  // 1. Obtener hot_articles sin target_oposicion
  const { data: hotArticles, error: hotError } = await supabase
    .from('hot_articles')
    .select('id, article_id, article_number, law_name')
    .is('target_oposicion', null);

  if (hotError) {
    console.error('❌ Error obteniendo hot_articles:', hotError);
    return;
  }

  console.log(`📊 Hot articles sin target_oposicion: ${hotArticles.length}`);

  // 2. Para cada hot_article, buscar preguntas oficiales con exam_position
  const updates = [];
  let noExamPositionCount = 0;

  for (const ha of hotArticles) {
    // Buscar preguntas oficiales que referencian este artículo
    const { data: questions } = await supabase
      .from('questions')
      .select('exam_position')
      .eq('primary_article_id', ha.article_id)
      .eq('is_official_exam', true)
      .not('exam_position', 'is', null);

    if (!questions || questions.length === 0) {
      noExamPositionCount++;
      continue;
    }

    // Contar frecuencia de cada exam_position
    const positionCounts = {};
    questions.forEach(q => {
      if (q.exam_position) {
        positionCounts[q.exam_position] = (positionCounts[q.exam_position] || 0) + 1;
      }
    });

    // Obtener la posición más frecuente
    const mostFrequent = Object.entries(positionCounts)
      .sort((a, b) => b[1] - a[1])[0];

    if (mostFrequent) {
      updates.push({
        id: ha.id,
        target_oposicion: mostFrequent[0],
        article: `${ha.law_name} Art. ${ha.article_number}`,
        count: mostFrequent[1]
      });
    }
  }

  console.log(`\n📋 Actualizaciones a realizar: ${updates.length}`);
  console.log(`   Sin preguntas oficiales con exam_position: ${noExamPositionCount}`);

  // Mostrar distribución
  const distribution = {};
  updates.forEach(u => {
    distribution[u.target_oposicion] = (distribution[u.target_oposicion] || 0) + 1;
  });

  console.log('\n📊 Distribución de target_oposicion:');
  Object.entries(distribution)
    .sort((a, b) => b[1] - a[1])
    .forEach(([pos, count]) => {
      console.log(`   ${pos}: ${count}`);
    });

  // Mostrar algunos ejemplos
  console.log('\n📝 Ejemplos de actualizaciones:');
  updates.slice(0, 10).forEach(u => {
    console.log(`   ${u.article} → ${u.target_oposicion} (${u.count} preguntas)`);
  });

  // Ejecutar si se pasa --execute
  if (process.argv.includes('--execute')) {
    console.log('\n⏳ Ejecutando actualizaciones...');

    let successCount = 0;
    let errorCount = 0;

    for (const update of updates) {
      const { error } = await supabase
        .from('hot_articles')
        .update({
          target_oposicion: update.target_oposicion,
          updated_at: new Date().toISOString()
        })
        .eq('id', update.id);

      if (error) {
        console.log(`❌ Error actualizando ${update.article}:`, error.message);
        errorCount++;
      } else {
        successCount++;
      }
    }

    console.log('\n=== RESUMEN ===');
    console.log(`✅ Actualizados: ${successCount}`);
    console.log(`❌ Errores: ${errorCount}`);
  } else {
    console.log('\n⚠️  Modo DRY-RUN: No se hicieron cambios');
    console.log('    Ejecuta con --execute para aplicar cambios');
  }
}

poblarTargetOposicion().catch(console.error);
