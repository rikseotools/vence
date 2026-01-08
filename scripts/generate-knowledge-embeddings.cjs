#!/usr/bin/env node
// Genera embeddings para ai_knowledge_base usando OpenAI
// Uso: node scripts/generate-knowledge-embeddings.cjs

const { createClient } = require('@supabase/supabase-js');
const { Pool } = require('pg');
const OpenAI = require('openai');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const EMBEDDING_MODEL = 'text-embedding-3-small';

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

async function main() {
  console.log('=== Generando embeddings para ai_knowledge_base ===\n');

  const apiKey = await getOpenAIKey();
  const openai = new OpenAI({ apiKey });
  console.log('✓ API key de OpenAI obtenida\n');

  // Obtener FAQs sin embedding
  const { data: faqs, error } = await supabase
    .from('ai_knowledge_base')
    .select('id, title, content, keywords')
    .is('embedding', null);

  if (error) {
    console.error('Error obteniendo FAQs:', error.message);
    return;
  }

  console.log(`📊 FAQs sin embedding: ${faqs?.length || 0}\n`);

  if (!faqs || faqs.length === 0) {
    console.log('✅ Todos los registros ya tienen embedding');
    return;
  }

  const pool = new Pool({ connectionString: process.env.DATABASE_URL });

  let processed = 0;
  let errors = 0;

  for (const faq of faqs) {
    try {
      // Texto para embedding: título + contenido + keywords
      const keywordsText = (faq.keywords || []).join(', ');
      const text = `${faq.title}\n\n${faq.content}\n\nPalabras clave: ${keywordsText}`.substring(0, 30000);

      const response = await openai.embeddings.create({
        model: EMBEDDING_MODEL,
        input: text,
      });

      const embedding = response.data[0].embedding;

      // Actualizar en BD
      const client = await pool.connect();
      await client.query(
        'UPDATE ai_knowledge_base SET embedding = $1 WHERE id = $2',
        [`[${embedding.join(',')}]`, faq.id]
      );
      client.release();

      processed++;
      console.log(`✅ ${faq.title.substring(0, 50)}...`);

      // Rate limit
      await new Promise(r => setTimeout(r, 100));
    } catch (err) {
      console.error(`❌ ${faq.title}: ${err.message}`);
      errors++;
    }
  }

  await pool.end();

  console.log('\n' + '='.repeat(50));
  console.log('📊 RESUMEN');
  console.log('='.repeat(50));
  console.log(`✅ Procesados: ${processed}`);
  console.log(`❌ Errores: ${errors}`);
}

main().catch(console.error);
