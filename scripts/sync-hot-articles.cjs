/**
 * Script para sincronizar hot_articles con preguntas oficiales
 *
 * Ejecutar después de importar preguntas oficiales:
 *   node scripts/sync-hot-articles.cjs
 *
 * También se puede ejecutar en modo dry-run para ver qué se insertaría:
 *   DRY_RUN=1 node scripts/sync-hot-articles.cjs
 */

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const DRY_RUN = process.env.DRY_RUN === '1';

// Mapeo de exam_source a target_oposicion (con guiones)
function getOposicionFromSource(examSource) {
  if (!examSource) return null;
  const src = examSource.toLowerCase();

  if (src.includes('auxiliar administrativo') || src.includes('aux-l')) {
    return 'auxiliar-administrativo-estado';
  }
  if (src.includes('auxilio judicial')) {
    return 'auxilio-judicial';
  }
  if (src.includes('tramitación procesal') || src.includes('tramitacion procesal')) {
    return 'tramitacion-procesal';
  }
  if (src.includes('gestión procesal') || src.includes('gestion procesal')) {
    return 'gestion-estado';
  }
  if (src.includes('gestión') || src.includes('gestion')) {
    return 'gestion-estado';
  }
  if (src.includes('cuerpo general administrativo') || src.includes('administrativo de la administración')) {
    return 'administrativo-estado';
  }
  if (src.includes('administrativo') || src.includes('age')) {
    return 'administrativo-estado';
  }

  return null;
}

async function syncHotArticles() {
  console.log('🔄 Sincronizando hot_articles con preguntas oficiales...');
  if (DRY_RUN) console.log('   (Modo DRY_RUN - no se insertará nada)\n');

  // 1. Obtener preguntas oficiales con artículos
  const { data: questions, error: e1 } = await supabase
    .from('questions')
    .select('primary_article_id, exam_source')
    .eq('is_official_exam', true)
    .eq('is_active', true)
    .not('primary_article_id', 'is', null);

  if (e1) {
    console.error('❌ Error obteniendo preguntas:', e1);
    process.exit(1);
  }

  console.log(`📊 Preguntas oficiales con artículo: ${questions.length}`);

  // 2. Obtener entradas existentes en hot_articles
  const { data: existing, error: e2 } = await supabase
    .from('hot_articles')
    .select('article_id, target_oposicion');

  if (e2) {
    console.error('❌ Error obteniendo hot_articles:', e2);
    process.exit(1);
  }

  const existingSet = new Set(existing.map(h => `${h.article_id}|${h.target_oposicion}`));
  console.log(`📊 Entradas actuales en hot_articles: ${existing.length}`);

  // 3. Agrupar preguntas por artículo + oposición
  const toInsert = {};
  let skippedNoOposicion = 0;

  questions.forEach(q => {
    const oposicion = getOposicionFromSource(q.exam_source);
    if (!oposicion) {
      skippedNoOposicion++;
      return;
    }

    const key = `${q.primary_article_id}|${oposicion}`;
    if (existingSet.has(key)) return;

    if (!toInsert[key]) {
      toInsert[key] = {
        article_id: q.primary_article_id,
        target_oposicion: oposicion,
        count: 0,
        sources: new Set()
      };
    }
    toInsert[key].count++;
    toInsert[key].sources.add(q.exam_source);
  });

  if (skippedNoOposicion > 0) {
    console.log(`⚠️  Preguntas sin oposición identificable: ${skippedNoOposicion}`);
  }

  const entries = Object.values(toInsert);

  if (entries.length === 0) {
    console.log('\n✅ Ya está sincronizado! No hay artículos nuevos que añadir.');
    return;
  }

  console.log(`\n📝 Artículos nuevos a insertar: ${entries.length}`);

  // 4. Obtener info de los artículos
  const articleIds = [...new Set(entries.map(e => e.article_id))];
  const { data: articles, error: e3 } = await supabase
    .from('articles')
    .select('id, article_number, law_id, laws(id, short_name)')
    .in('id', articleIds);

  if (e3) {
    console.error('❌ Error obteniendo artículos:', e3);
    process.exit(1);
  }

  const articleMap = {};
  articles.forEach(a => {
    articleMap[a.id] = a;
  });

  // 5. Preparar inserts
  const inserts = entries.map(e => {
    const article = articleMap[e.article_id];
    if (!article) {
      console.warn(`⚠️  Artículo no encontrado: ${e.article_id}`);
      return null;
    }

    const priorityLevel = e.count >= 5 ? 'critical'
                        : e.count >= 3 ? 'high'
                        : e.count >= 2 ? 'medium'
                        : 'low';

    return {
      article_id: e.article_id,
      law_id: article.law_id,
      target_oposicion: e.target_oposicion,
      article_number: article.article_number,
      law_name: article.laws?.short_name || 'Desconocida',
      total_official_appearances: e.count,
      unique_exams_count: e.sources.size,
      priority_level: priorityLevel,
      hotness_score: e.count * 10
    };
  }).filter(Boolean);

  // Mostrar resumen por oposición
  const byOpo = {};
  inserts.forEach(i => {
    byOpo[i.target_oposicion] = (byOpo[i.target_oposicion] || 0) + 1;
  });

  console.log('\nNuevos artículos por oposición:');
  Object.entries(byOpo).sort((a,b) => b[1]-a[1]).forEach(([opo, count]) => {
    console.log(`  ${opo}: +${count}`);
  });

  if (DRY_RUN) {
    console.log('\n🔍 Modo DRY_RUN - no se insertó nada.');
    console.log('   Ejecuta sin DRY_RUN=1 para aplicar los cambios.');
    return;
  }

  // 6. Insertar
  console.log(`\n⏳ Insertando ${inserts.length} entradas...`);

  const { error: insertError } = await supabase
    .from('hot_articles')
    .insert(inserts);

  if (insertError) {
    console.error('❌ Error insertando:', insertError);
    process.exit(1);
  }

  console.log('✅ Insertados correctamente!');

  // 7. Mostrar estado final
  const { data: final } = await supabase
    .from('hot_articles')
    .select('target_oposicion');

  const finalByOpo = {};
  final.forEach(h => {
    finalByOpo[h.target_oposicion] = (finalByOpo[h.target_oposicion] || 0) + 1;
  });

  console.log('\n📊 Estado final de hot_articles:');
  Object.entries(finalByOpo).sort((a,b) => b[1]-a[1]).forEach(([opo, count]) => {
    console.log(`  ${opo}: ${count}`);
  });
  console.log(`  TOTAL: ${final.length}`);
}

syncHotArticles().catch(err => {
  console.error('❌ Error:', err);
  process.exit(1);
});
