#!/usr/bin/env node
// Genera embeddings para todos los artículos usando OpenAI
// Uso: node scripts/generate-embeddings.cjs

const { createClient } = require('@supabase/supabase-js');
const OpenAI = require('openai');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const BATCH_SIZE = 100; // Procesar de 100 en 100
const EMBEDDING_MODEL = 'text-embedding-3-small'; // 1536 dimensiones, más barato

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

async function generateEmbedding(openai, text) {
  // Limpiar y truncar texto (max 8191 tokens ~ 32000 chars para estar seguros)
  const cleanText = text
    .replace(/\s+/g, ' ')
    .trim()
    .substring(0, 30000);

  const response = await openai.embeddings.create({
    model: EMBEDDING_MODEL,
    input: cleanText,
  });

  return response.data[0].embedding;
}

async function main() {
  console.log('=== Generando embeddings para artículos ===\n');

  // Obtener API key
  const apiKey = await getOpenAIKey();
  const openai = new OpenAI({ apiKey });
  console.log('✓ API key de OpenAI obtenida\n');

  // Contar artículos sin embedding
  const { count: totalPending } = await supabase
    .from('articles')
    .select('id', { count: 'exact', head: true })
    .eq('is_active', true)
    .is('embedding', null);

  const { count: totalWithEmbedding } = await supabase
    .from('articles')
    .select('id', { count: 'exact', head: true })
    .eq('is_active', true)
    .not('embedding', 'is', null);

  console.log(`📊 Estado actual:`);
  console.log(`   - Con embedding: ${totalWithEmbedding || 0}`);
  console.log(`   - Sin embedding: ${totalPending || 0}`);
  console.log(`   - Total a procesar: ${totalPending || 0}\n`);

  if (!totalPending || totalPending === 0) {
    console.log('✅ Todos los artículos ya tienen embedding');
    return;
  }

  // Estimar coste
  // text-embedding-3-small: $0.00002 / 1K tokens
  // Estimando ~500 tokens por artículo en promedio
  const estimatedTokens = totalPending * 500;
  const estimatedCost = (estimatedTokens / 1000) * 0.00002;
  console.log(`💰 Coste estimado: ~$${estimatedCost.toFixed(4)}\n`);

  let processed = 0;
  let errors = 0;
  let offset = 0;

  while (true) {
    // Obtener batch de artículos sin embedding
    const { data: articles, error } = await supabase
      .from('articles')
      .select('id, article_number, title, content, law_id')
      .eq('is_active', true)
      .is('embedding', null)
      .order('id')
      .range(offset, offset + BATCH_SIZE - 1);

    if (error) {
      console.error('Error obteniendo artículos:', error.message);
      break;
    }

    if (!articles || articles.length === 0) {
      break;
    }

    console.log(`\n📦 Procesando batch ${Math.floor(offset / BATCH_SIZE) + 1} (${articles.length} artículos)...`);

    for (const article of articles) {
      try {
        // Crear texto para embedding: título + contenido
        const textForEmbedding = [
          article.title || '',
          article.content || ''
        ].filter(Boolean).join('\n\n');

        if (!textForEmbedding.trim()) {
          console.log(`   ⚠️  Art. ${article.article_number}: sin contenido, saltando`);
          continue;
        }

        // Generar embedding
        const embedding = await generateEmbedding(openai, textForEmbedding);

        // Guardar en BD
        const { error: updateError } = await supabase
          .from('articles')
          .update({ embedding })
          .eq('id', article.id);

        if (updateError) {
          console.log(`   ❌ Art. ${article.article_number}: ${updateError.message}`);
          errors++;
        } else {
          processed++;
          if (processed % 50 === 0) {
            console.log(`   ✓ ${processed} artículos procesados...`);
          }
        }

        // Rate limiting: pequeña pausa para no saturar la API
        await new Promise(r => setTimeout(r, 50));

      } catch (err) {
        console.log(`   ❌ Art. ${article.article_number}: ${err.message}`);
        errors++;

        // Si es error de rate limit, esperar más
        if (err.message.includes('rate')) {
          console.log('   ⏳ Rate limit, esperando 10s...');
          await new Promise(r => setTimeout(r, 10000));
        }
      }
    }

    offset += BATCH_SIZE;
  }

  console.log('\n' + '='.repeat(50));
  console.log('📊 RESUMEN');
  console.log('='.repeat(50));
  console.log(`✅ Procesados: ${processed}`);
  console.log(`❌ Errores: ${errors}`);

  // Verificar total final
  const { count: finalCount } = await supabase
    .from('articles')
    .select('id', { count: 'exact', head: true })
    .eq('is_active', true)
    .not('embedding', 'is', null);

  console.log(`\n📈 Total artículos con embedding: ${finalCount}`);
}

main().catch(console.error);
