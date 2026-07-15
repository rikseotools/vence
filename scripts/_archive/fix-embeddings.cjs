#!/usr/bin/env node
/**
 * Script para regenerar embeddings corruptos de artículos
 *
 * Uso:
 *   node scripts/fix-embeddings.js                    # Arregla Ley 50/1997
 *   node scripts/fix-embeddings.js --all              # Verifica todas las leyes
 *   node scripts/fix-embeddings.js --law-id <uuid>    # Arregla ley específica
 */

require('dotenv').config({ path: '.env.local' })
const { createClient } = require('@supabase/supabase-js')
const OpenAI = require('openai')

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

// Ley 50/1997 por defecto
const DEFAULT_LAW_ID = '1ed89e01-ace0-4894-8bd4-fa00db74d34a'

async function getOpenAIClient() {
  const { data: apiConfig } = await supabase
    .from('ai_api_config')
    .select('api_key_encrypted')
    .eq('provider', 'openai')
    .eq('is_active', true)
    .single()

  if (!apiConfig?.api_key_encrypted) {
    throw new Error('No se encontró API key de OpenAI')
  }

  const apiKey = Buffer.from(apiConfig.api_key_encrypted, 'base64').toString('utf-8')
  return new OpenAI({ apiKey })
}

async function generateEmbedding(openai, text) {
  const response = await openai.embeddings.create({
    model: 'text-embedding-3-small',
    input: text.substring(0, 8000) // Límite de tokens
  })
  return response.data[0].embedding
}

async function testSearchFunction() {
  // Verificar que la función RPC existe
  const { error } = await supabase.rpc('update_article_embedding', {
    article_id: '00000000-0000-0000-0000-000000000000',
    embedding_json: '[' + Array(1536).fill(0).join(',') + ']'
  })

  if (error && error.message.includes('does not exist')) {
    console.error('❌ La función update_article_embedding no existe.')
    console.error('   Ejecuta primero el SQL en Supabase Dashboard.')
    return false
  }
  return true
}

async function fixLawEmbeddings(lawId) {
  console.log(`\n🔧 Arreglando embeddings para ley: ${lawId}\n`)

  // Obtener artículos de la ley
  const { data: articles, error } = await supabase
    .from('articles')
    .select('id, article_number, title, content')
    .eq('law_id', lawId)
    .eq('is_active', true)
    .order('article_number')

  if (error) {
    console.error('Error obteniendo artículos:', error)
    return
  }

  console.log(`📚 Encontrados ${articles.length} artículos\n`)

  const openai = await getOpenAIClient()
  let fixed = 0
  let errors = 0

  for (const article of articles) {
    const textToEmbed = [
      article.title || '',
      article.content || ''
    ].filter(Boolean).join('\n\n')

    if (!textToEmbed.trim()) {
      console.log(`⏭️  Art. ${article.article_number}: Sin contenido, saltando`)
      continue
    }

    try {
      // Generar embedding
      const embedding = await generateEmbedding(openai, textToEmbed)
      const embeddingJson = JSON.stringify(embedding)

      // Guardar usando la función RPC
      const { data, error: updateError } = await supabase.rpc('update_article_embedding', {
        article_id: article.id,
        embedding_json: embeddingJson
      })

      if (updateError) {
        console.error(`❌ Art. ${article.article_number}: ${updateError.message}`)
        errors++
      } else {
        console.log(`✅ Art. ${article.article_number}: Embedding regenerado (${embedding.length} dims)`)
        fixed++
      }

      // Pequeña pausa para no saturar la API
      await new Promise(r => setTimeout(r, 100))

    } catch (err) {
      console.error(`❌ Art. ${article.article_number}: ${err.message}`)
      errors++
    }
  }

  console.log(`\n📊 Resumen:`)
  console.log(`   ✅ Arreglados: ${fixed}`)
  console.log(`   ❌ Errores: ${errors}`)
  console.log(`   📚 Total: ${articles.length}`)
}

async function verifyEmbeddings(lawId) {
  console.log(`\n🔍 Verificando embeddings de ley: ${lawId}\n`)

  const openai = await getOpenAIClient()

  // Buscar algo específico de la ley
  const searchText = 'El Gobierno cesa tras la celebración de elecciones generales'
  const embedding = await generateEmbedding(openai, searchText)

  const { data: results, error } = await supabase.rpc('match_articles', {
    query_embedding: embedding,
    match_threshold: 0.3,
    match_count: 10
  })

  if (error) {
    console.error('Error en búsqueda:', error)
    return
  }

  const fromLaw = results?.filter(r => r.law_id === lawId) || []

  console.log(`Búsqueda: "${searchText}"`)
  console.log(`Resultados totales: ${results?.length || 0}`)
  console.log(`De la ley objetivo: ${fromLaw.length}`)

  if (fromLaw.length > 0) {
    console.log('\n✅ Artículos encontrados de la ley:')
    fromLaw.forEach(a => {
      console.log(`   Art. ${a.article_number} - similitud: ${a.similarity?.toFixed(3)}`)
    })
  } else {
    console.log('\n⚠️  No se encontraron artículos de la ley en la búsqueda')
  }
}

async function main() {
  const args = process.argv.slice(2)
  const lawId = args.includes('--law-id')
    ? args[args.indexOf('--law-id') + 1]
    : DEFAULT_LAW_ID

  console.log('🚀 Fix Embeddings Script')
  console.log('========================\n')

  // Verificar que existe la función RPC
  const rpcExists = await testSearchFunction()
  if (!rpcExists) {
    process.exit(1)
  }

  if (args.includes('--verify')) {
    await verifyEmbeddings(lawId)
  } else {
    await fixLawEmbeddings(lawId)
    console.log('\n🔍 Verificando resultado...')
    await verifyEmbeddings(lawId)
  }
}

main().catch(console.error)
