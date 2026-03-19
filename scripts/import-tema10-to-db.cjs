// Fase 3: Importar preguntas verificadas del Tema 10 a la BD
// Tema 10: Modernización de la Oficina judicial

const fs = require('fs');
require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const TOPIC_ID = '3a4b2f43-911c-448e-8703-ccb38289ca07'; // Tema 10
const LETTER_TO_INDEX = { 'A': 0, 'B': 1, 'C': 2, 'D': 3 };
const NUM_BATCHES = 9;

async function main() {
  console.log('='.repeat(60));
  console.log('FASE 3: IMPORTAR TEMA 10 A BD');
  console.log('='.repeat(60));
  console.log('');

  // 1. Fusionar batches verificados
  console.log('📦 Fusionando batches verificados...');
  const allQuestions = [];

  for (let i = 1; i <= NUM_BATCHES; i++) {
    const filePath = `/tmp/tema10-batch-${i}-verified.json`;
    try {
      const batch = JSON.parse(fs.readFileSync(filePath, 'utf8'));
      allQuestions.push(...batch);
      console.log(`   Batch ${i}: ${batch.length} preguntas`);
    } catch (e) {
      console.error(`   ❌ Error leyendo batch ${i}:`, e.message);
    }
  }

  console.log(`\n📊 Total fusionadas: ${allQuestions.length}`);

  // 2. Filtrar solo las que tienen artículo verificado
  const ready = allQuestions.filter(q => q.verified_article_id);
  const withoutArticle = allQuestions.filter(q => !q.verified_article_id);

  console.log(`✅ Con artículo verificado: ${ready.length}`);
  console.log(`⚠️  Sin artículo (pendientes): ${withoutArticle.length}`);

  // Guardar para referencia
  fs.writeFileSync('/tmp/tema10-ready-to-import.json', JSON.stringify(ready, null, 2));
  fs.writeFileSync('/tmp/tema10-without-article.json', JSON.stringify(withoutArticle, null, 2));

  // 3. Importar a BD
  console.log('\n📥 Importando a BD...');
  let inserted = 0;
  let duplicates = 0;
  let errors = 0;

  for (const q of ready) {
    // Verificar duplicado por texto
    const { data: existing } = await supabase
      .from('questions')
      .select('id')
      .eq('question_text', q.question)
      .single();

    if (existing) {
      duplicates++;
      continue;
    }

    // Preparar datos
    const questionData = {
      question_text: q.question,
      option_a: q.options.find(o => o.letter === 'A')?.text || '',
      option_b: q.options.find(o => o.letter === 'B')?.text || '',
      option_c: q.options.find(o => o.letter === 'C')?.text || '',
      option_d: q.options.find(o => o.letter === 'D')?.text || '',
      correct_option: LETTER_TO_INDEX[q.correctAnswer],
      explanation: q.explanation,
      primary_article_id: q.verified_article_id,
      difficulty: 'medium',
      is_active: true,
      topic_review_status: 'perfect',
      verification_status: 'verified',
      tags: ['Tema 10', q.subtema || 'Modernización Oficina Judicial', 'Tramitación Procesal', 'IA-Verified']
    };

    const { error } = await supabase.from('questions').insert(questionData);

    if (error) {
      errors++;
      if (errors <= 3) {
        console.error(`   ❌ Error:`, error.message, '- Pregunta:', q.question.substring(0, 50));
      }
    } else {
      inserted++;
    }
  }

  console.log(`\n📊 Resultado:`);
  console.log(`   ✅ Insertadas: ${inserted}`);
  console.log(`   ⚠️  Duplicadas: ${duplicates}`);
  console.log(`   ❌ Errores: ${errors}`);

  // 4. Verificar inserción
  const { count } = await supabase
    .from('questions')
    .select('id', { count: 'exact' })
    .contains('tags', ['Tema 10'])
    .eq('is_active', true);

  console.log(`\n📚 Total preguntas Tema 10 (por tags): ${count}`);
  console.log('');
}

main().catch(console.error);
