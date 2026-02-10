#!/usr/bin/env node
// Reformatea explicaciones de informática que están sin saltos de línea
// Uso: node scripts/format-informatica-explanations.cjs

const { createClient } = require('@supabase/supabase-js');
const OpenAI = require('openai');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const BATCH_SIZE = 20;

async function getOpenAIKey() {
  const { data } = await supabase
    .from('ai_api_config')
    .select('api_key_encrypted')
    .eq('provider', 'openai')
    .single();

  if (!data?.api_key_encrypted) {
    throw new Error('No hay API key de OpenAI configurada');
  }

  return Buffer.from(data.api_key_encrypted, 'base64').toString('utf-8');
}

async function formatExplanation(openai, explanation) {
  const response = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [
      {
        role: 'system',
        content: `Eres un formateador de texto. Tu tarea es tomar una explicación de pregunta de test y añadir formato markdown para hacerla más legible.

Reglas:
1. Mantén EXACTAMENTE el mismo contenido y texto
2. Añade saltos de línea entre párrafos/ideas diferentes
3. Usa **negrita** para términos importantes o respuesta correcta
4. Usa listas con guiones (- ) cuando haya enumeraciones
5. NO cambies el contenido, solo el formato
6. NO añadas información nueva
7. Mantén el texto en español

Devuelve SOLO el texto formateado, sin explicaciones adicionales.`
      },
      {
        role: 'user',
        content: explanation
      }
    ],
    temperature: 0.1,
    max_tokens: 1000
  });

  return response.choices[0].message.content;
}

async function main() {
  console.log('=== Formateando explicaciones de informática ===\n');

  // Obtener API key
  const apiKey = await getOpenAIKey();
  const openai = new OpenAI({ apiKey });
  console.log('✓ API key de OpenAI obtenida\n');

  // Obtener leyes de informática
  const { data: laws } = await supabase
    .from('laws')
    .select('id, short_name')
    .or('short_name.ilike.%Windows%,short_name.ilike.%Excel%,short_name.ilike.%Word%,short_name.ilike.%Internet%,short_name.ilike.%Informática%,short_name.ilike.%Access%,short_name.ilike.%Correo%,short_name.ilike.%Explorador%,short_name.ilike.%Procesadores%');

  if (!laws || laws.length === 0) {
    console.log('No se encontraron leyes de informática');
    return;
  }

  console.log('📚 Leyes encontradas:', laws.map(l => l.short_name).join(', '));

  const lawIds = laws.map(l => l.id);

  // Obtener artículos de esas leyes
  const { data: articles } = await supabase
    .from('articles')
    .select('id')
    .in('law_id', lawIds);

  if (!articles || articles.length === 0) {
    console.log('No hay artículos');
    return;
  }

  const articleIds = articles.map(a => a.id);

  // Contar preguntas sin formato
  const { data: allQuestions, error } = await supabase
    .from('questions')
    .select('id, explanation')
    .eq('is_active', true)
    .in('primary_article_id', articleIds)
    .not('explanation', 'is', null);

  if (error) {
    console.error('Error:', error.message);
    return;
  }

  // Filtrar las que NO tienen saltos de línea
  const questionsToFormat = allQuestions.filter(q =>
    q.explanation &&
    q.explanation.length > 50 &&
    !q.explanation.includes('\n')
  );

  console.log(`\n📊 Estado:`);
  console.log(`   - Total preguntas informática: ${allQuestions.length}`);
  console.log(`   - Sin formato (a procesar): ${questionsToFormat.length}`);
  console.log(`   - Ya formateadas: ${allQuestions.length - questionsToFormat.length}\n`);

  if (questionsToFormat.length === 0) {
    console.log('✅ Todas las explicaciones ya tienen formato');
    return;
  }

  // Estimar coste (gpt-4o-mini: ~$0.00015/1K input + $0.0006/1K output)
  const avgChars = questionsToFormat.reduce((sum, q) => sum + q.explanation.length, 0) / questionsToFormat.length;
  const estimatedTokens = (avgChars / 4) * questionsToFormat.length * 2; // input + output
  const estimatedCost = (estimatedTokens / 1000) * 0.0004; // promedio input/output
  console.log(`💰 Coste estimado: ~$${estimatedCost.toFixed(4)}\n`);

  let processed = 0;
  let errors = 0;

  // Procesar en batches
  for (let i = 0; i < questionsToFormat.length; i += BATCH_SIZE) {
    const batch = questionsToFormat.slice(i, i + BATCH_SIZE);
    console.log(`\n📦 Procesando batch ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(questionsToFormat.length / BATCH_SIZE)} (${batch.length} preguntas)...`);

    for (const question of batch) {
      try {
        // Formatear con IA
        const formattedExplanation = await formatExplanation(openai, question.explanation);

        // Guardar en BD
        const { error: updateError } = await supabase
          .from('questions')
          .update({ explanation: formattedExplanation })
          .eq('id', question.id);

        if (updateError) {
          console.log(`   ❌ ${question.id}: ${updateError.message}`);
          errors++;
        } else {
          processed++;
          if (processed % 50 === 0) {
            console.log(`   ✓ ${processed} preguntas procesadas...`);
          }
        }

        // Rate limiting
        await new Promise(r => setTimeout(r, 100));

      } catch (err) {
        console.log(`   ❌ ${question.id}: ${err.message}`);
        errors++;

        // Si es rate limit, esperar más
        if (err.message && err.message.includes('rate')) {
          console.log('   ⏳ Rate limit, esperando 30s...');
          await new Promise(r => setTimeout(r, 30000));
        }
      }
    }
  }

  console.log('\n' + '='.repeat(50));
  console.log('📊 RESUMEN');
  console.log('='.repeat(50));
  console.log(`✅ Procesadas: ${processed}`);
  console.log(`❌ Errores: ${errors}`);
}

main().catch(console.error);
