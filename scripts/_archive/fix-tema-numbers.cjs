#!/usr/bin/env node
/**
 * Script para arreglar tema_number en test_questions históricos
 * VERSIÓN OPTIMIZADA - usa batch queries
 *
 * Uso:
 *   node scripts/fix-tema-numbers.cjs --dry-run     # Ver qué se arreglaría
 *   node scripts/fix-tema-numbers.cjs --apply       # Aplicar cambios
 *   node scripts/fix-tema-numbers.cjs --sample 10   # Procesar solo 10 registros (debug)
 */

require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const BATCH_SIZE = 100; // Supabase .in() tiene límite de ~100
const DRY_RUN = !process.argv.includes('--apply');
const SAMPLE_ARG = process.argv.indexOf('--sample');
const SAMPLE_SIZE = SAMPLE_ARG !== -1 ? parseInt(process.argv[SAMPLE_ARG + 1]) : null;

// Mapeo de oposicion a position_type
// NOTA: En la BD topics.position_type usa nombres como 'auxiliar_administrativo', 'administrativo', etc.
const OPOSICION_TO_POSITION_TYPE = {
  'auxiliar_administrativo_estado': 'auxiliar_administrativo',
  'administrativo_estado': 'administrativo',  // No existe administrativo_estado, es 'administrativo'
  'tramitacion_procesal': 'tramitacion_procesal',
  'gestion_procesal': 'gestion_procesal',  // Verificar si existe
  'administrativo_castilla_leon': 'administrativo',  // Probablemente usa 'administrativo'
  'auxilio_judicial': 'auxilio_judicial',
};

async function main() {
  console.log('🔧 Fix tema_number en test_questions históricos');
  console.log(DRY_RUN ? '📋 MODO: Dry-run (sin cambios)' : '⚡ MODO: Aplicar cambios');
  if (SAMPLE_SIZE) console.log(`🔬 MODO DEBUG: Solo ${SAMPLE_SIZE} registros`);
  console.log('');

  // 1. Obtener todos los test_questions sin tema con sus question_ids
  console.log('📥 Cargando test_questions sin tema...');

  const allTestQuestions = [];
  let offset = 0;

  while (true) {
    const query = supabase
      .from('test_questions')
      .select('id, question_id, test_id')
      .or('tema_number.is.null,tema_number.eq.0')
      .not('question_id', 'is', null)
      .range(offset, offset + 999);

    const { data, error } = await query;

    if (error) {
      console.error('Error cargando test_questions:', error);
      break;
    }
    if (!data || data.length === 0) break;

    allTestQuestions.push(...data);
    offset += 1000;

    if (SAMPLE_SIZE && allTestQuestions.length >= SAMPLE_SIZE) {
      allTestQuestions.length = SAMPLE_SIZE; // Truncar
      break;
    }
  }

  console.log(`📊 Total test_questions sin tema: ${allTestQuestions.length}`);

  // 2. Obtener question_ids únicos
  const uniqueQuestionIds = [...new Set(allTestQuestions.map(tq => tq.question_id))];
  console.log(`📊 Questions únicas: ${uniqueQuestionIds.length}`);

  // 3. Cargar preguntas con sus artículos en batch
  console.log('📥 Cargando preguntas con artículos...');

  const questionToArticle = new Map();

  for (let i = 0; i < uniqueQuestionIds.length; i += BATCH_SIZE) {
    const batch = uniqueQuestionIds.slice(i, i + BATCH_SIZE);

    const { data: questions } = await supabase
      .from('questions')
      .select('id, primary_article_id')
      .in('id', batch);

    if (questions) {
      for (const q of questions) {
        if (q.primary_article_id) {
          questionToArticle.set(q.id, q.primary_article_id);
        }
      }
    }

    process.stdout.write(`\r   Preguntas: ${Math.min(i + BATCH_SIZE, uniqueQuestionIds.length)}/${uniqueQuestionIds.length}`);
  }
  console.log('');

  // 4. Cargar artículos con sus law_ids en batch
  console.log('📥 Cargando artículos...');

  const uniqueArticleIds = [...new Set(questionToArticle.values())];
  const articleToLaw = new Map();

  for (let i = 0; i < uniqueArticleIds.length; i += BATCH_SIZE) {
    const batch = uniqueArticleIds.slice(i, i + BATCH_SIZE);

    const { data: articles } = await supabase
      .from('articles')
      .select('id, article_number, law_id')
      .in('id', batch);

    if (articles) {
      for (const a of articles) {
        articleToLaw.set(a.id, { articleNumber: a.article_number, lawId: a.law_id });
      }
    }

    process.stdout.write(`\r   Artículos: ${Math.min(i + BATCH_SIZE, uniqueArticleIds.length)}/${uniqueArticleIds.length}`);
  }
  console.log('');

  // 5. Cargar test -> user -> oposicion mapping
  console.log('📥 Cargando oposiciones de usuarios...');

  const uniqueTestIds = [...new Set(allTestQuestions.map(tq => tq.test_id))];
  const testToPositionType = new Map();

  for (let i = 0; i < uniqueTestIds.length; i += BATCH_SIZE) {
    const batch = uniqueTestIds.slice(i, i + BATCH_SIZE);

    const { data: tests } = await supabase
      .from('tests')
      .select('id, user_id')
      .in('id', batch);

    if (tests) {
      const userIds = [...new Set(tests.map(t => t.user_id).filter(Boolean))];

      const { data: profiles } = await supabase
        .from('user_profiles')
        .select('id, target_oposicion')
        .in('id', userIds);

      const userToOposicion = new Map();
      if (profiles) {
        for (const p of profiles) {
          userToOposicion.set(p.id, p.target_oposicion);
        }
      }

      for (const t of tests) {
        const oposicion = userToOposicion.get(t.user_id) || 'auxiliar_administrativo_estado';
        const positionType = OPOSICION_TO_POSITION_TYPE[oposicion] || 'auxiliar_administrativo';
        testToPositionType.set(t.id, positionType);
      }
    }

    process.stdout.write(`\r   Tests: ${Math.min(i + BATCH_SIZE, uniqueTestIds.length)}/${uniqueTestIds.length}`);
  }
  console.log('');

  // 6. Cargar topic_scope completo
  console.log('📥 Cargando topic_scope...');

  const { data: topicScopes } = await supabase
    .from('topic_scope')
    .select(`
      law_id,
      article_numbers,
      topics!inner (
        topic_number,
        position_type,
        is_active
      )
    `);

  // Crear índice law_id -> position_type -> [{ articleNumbers, topicNumber }]
  const scopeIndex = new Map();

  if (topicScopes) {
    for (const scope of topicScopes) {
      if (!scope.topics?.is_active) continue;

      const key = `${scope.law_id}:${scope.topics.position_type}`;
      if (!scopeIndex.has(key)) {
        scopeIndex.set(key, []);
      }
      scopeIndex.get(key).push({
        articleNumbers: scope.article_numbers,
        topicNumber: scope.topics.topic_number,
      });
    }
  }

  console.log(`📊 topic_scope entries: ${topicScopes?.length || 0}`);
  console.log('');

  // 7. Resolver temas para cada test_question
  console.log('🔍 Resolviendo temas...');

  const updates = [];
  const examples = [];
  let resolved = 0;
  let notResolved = 0;

  for (const tq of allTestQuestions) {
    const articleId = questionToArticle.get(tq.question_id);
    if (!articleId) {
      notResolved++;
      continue;
    }

    const articleInfo = articleToLaw.get(articleId);
    if (!articleInfo) {
      notResolved++;
      continue;
    }

    const positionType = testToPositionType.get(tq.test_id) || 'auxiliar_administrativo';
    const key = `${articleInfo.lawId}:${positionType}`;
    const scopes = scopeIndex.get(key);

    if (!scopes) {
      notResolved++;
      continue;
    }

    let temaNumber = null;
    let resolvedVia = null;

    // Buscar match específico por artículo
    for (const scope of scopes) {
      if (scope.articleNumbers && scope.articleNumbers.includes(articleInfo.articleNumber)) {
        temaNumber = scope.topicNumber;
        resolvedVia = 'article';
        break;
      }
    }

    // Si no hay match específico, buscar ley completa
    if (!temaNumber) {
      for (const scope of scopes) {
        if (!scope.articleNumbers || scope.articleNumbers.length === 0) {
          temaNumber = scope.topicNumber;
          resolvedVia = 'full_law';
          break;
        }
      }
    }

    if (temaNumber) {
      resolved++;
      updates.push({ id: tq.id, tema_number: temaNumber });

      if (examples.length < 10) {
        examples.push({
          test_question_id: tq.id.substring(0, 8) + '...',
          article: articleInfo.articleNumber,
          tema: temaNumber,
          via: resolvedVia,
          positionType,
        });
      }
    } else {
      notResolved++;
    }
  }

  console.log('');
  console.log('📊 RESULTADOS:');
  console.log(`   Total procesados: ${allTestQuestions.length}`);
  console.log(`   ✅ Resueltos: ${resolved}`);
  console.log(`   ❌ No resueltos: ${notResolved}`);
  console.log('');

  console.log('📋 EJEMPLOS de resolución:');
  console.table(examples);

  // 8. Aplicar updates si no es dry-run
  if (!DRY_RUN && updates.length > 0) {
    console.log('');
    console.log(`💾 Aplicando ${updates.length} actualizaciones...`);

    let updated = 0;
    let errors = 0;

    for (let i = 0; i < updates.length; i += 50) {
      const batch = updates.slice(i, i + 50);

      // Supabase no soporta bulk update directo, hacemos uno por uno pero en paralelo
      const promises = batch.map(u =>
        supabase
          .from('test_questions')
          .update({ tema_number: u.tema_number })
          .eq('id', u.id)
      );

      const results = await Promise.all(promises);

      for (const r of results) {
        if (r.error) errors++;
        else updated++;
      }

      process.stdout.write(`\r   Actualizados: ${updated}/${updates.length}`);
    }

    console.log('');
    console.log(`   ✅ Actualizados: ${updated}`);
    if (errors > 0) console.log(`   ❌ Errores: ${errors}`);
  }

  if (DRY_RUN) {
    console.log('');
    console.log('💡 Para aplicar los cambios, ejecuta:');
    console.log('   node scripts/fix-tema-numbers.cjs --apply');
  }
}

main().catch(console.error);
