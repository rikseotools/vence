// scripts/regenerate-article-embeddings.mjs
// Regenera embeddings de artículos enriquecidos con preguntas asociadas.
//
// Uso:
//   node scripts/regenerate-article-embeddings.mjs              # Solo stale
//   node scripts/regenerate-article-embeddings.mjs --all        # Todos los que tienen preguntas
//   node scripts/regenerate-article-embeddings.mjs --article-id UUID  # Uno específico
//
// El embedding incluye: ley + artículo + título + contenido + preguntas asociadas
// Así la búsqueda semántica encuentra artículos tanto por lenguaje legal como coloquial.

import pg from 'pg'
import OpenAI from 'openai'

const { Pool } = pg

async function main() {
  const args = process.argv.slice(2)
  const mode = args.includes('--all') ? 'all' : args.includes('--article-id') ? 'single' : 'stale'
  const singleId = mode === 'single' ? args[args.indexOf('--article-id') + 1] : null

  const pool = new Pool({ connectionString: process.env.DATABASE_URL })

  // Obtener API key
  const { rows: keyRows } = await pool.query(
    "SELECT api_key_encrypted FROM ai_api_config WHERE provider = 'openai' AND is_active = true LIMIT 1"
  )
  if (!keyRows[0]) {
    console.error('❌ No OpenAI key found')
    await pool.end()
    return
  }
  const apiKey = Buffer.from(keyRows[0].api_key_encrypted, 'base64').toString('utf-8')
  const openai = new OpenAI({ apiKey })

  // Obtener artículos a procesar
  let query
  if (mode === 'single') {
    query = `SELECT a.id, a.article_number, a.title, a.content, l.short_name, l.full_name
             FROM articles a JOIN laws l ON a.law_id = l.id
             WHERE a.id = $1 AND a.is_active = true`
  } else if (mode === 'all') {
    query = `SELECT DISTINCT a.id, a.article_number, a.title, a.content, l.short_name, l.full_name
             FROM articles a
             JOIN laws l ON a.law_id = l.id
             JOIN questions q ON q.primary_article_id = a.id AND q.is_active = true
             WHERE a.is_active = true
             ORDER BY l.short_name, a.article_number`
  } else {
    // Solo stale
    query = `SELECT DISTINCT a.id, a.article_number, a.title, a.content, l.short_name, l.full_name
             FROM articles a
             JOIN laws l ON a.law_id = l.id
             WHERE a.is_active = true AND a.embedding_stale = true
             ORDER BY l.short_name, a.article_number`
  }

  const { rows: articles } = mode === 'single'
    ? await pool.query(query, [singleId])
    : await pool.query(query)

  console.log(`📝 Modo: ${mode} | Artículos a procesar: ${articles.length}`)

  if (articles.length === 0) {
    console.log('✅ Nada que procesar')
    await pool.end()
    return
  }

  let processed = 0
  let errors = 0
  const batchSize = 20

  for (let i = 0; i < articles.length; i += batchSize) {
    const batch = articles.slice(i, i + batchSize)

    await Promise.all(batch.map(async (art) => {
      try {
        // Obtener preguntas del artículo
        const { rows: questions } = await pool.query(
          `SELECT question_text FROM questions
           WHERE primary_article_id = $1 AND is_active = true
           ORDER BY created_at DESC LIMIT 15`,
          [art.id]
        )

        // Construir texto enriquecido
        let enrichedText = `${art.short_name} Artículo ${art.article_number}`
        if (art.title) enrichedText += ` - ${art.title}`
        if (art.full_name) enrichedText += `\nLey: ${art.full_name}`
        enrichedText += `\n\n${art.content || ''}`

        if (questions.length > 0) {
          enrichedText += '\n\nPreguntas frecuentes sobre este artículo:'
          questions.forEach(q => {
            enrichedText += `\n- ${q.question_text}`
          })
        }

        // Truncar a ~8000 tokens (~32000 chars) para no exceder límite del modelo
        if (enrichedText.length > 30000) {
          enrichedText = enrichedText.substring(0, 30000)
        }

        // Generar embedding
        const response = await openai.embeddings.create({
          model: 'text-embedding-3-small',
          input: enrichedText,
        })

        const embedding = '[' + response.data[0].embedding.join(',') + ']'

        // Guardar y marcar como no stale
        await pool.query(
          'UPDATE articles SET embedding = $1, embedding_stale = false WHERE id = $2',
          [embedding, art.id]
        )

        processed++
        if (processed % 50 === 0 || processed === articles.length) {
          console.log(`✅ ${processed}/${articles.length} (${art.short_name} Art. ${art.article_number})`)
        }
      } catch (err) {
        errors++
        console.error(`❌ ${art.short_name} Art. ${art.article_number}: ${err.message}`)
      }
    }))

    // Rate limiting: esperar entre batches
    if (i + batchSize < articles.length) {
      await new Promise(r => setTimeout(r, 500))
    }
  }

  console.log(`\n📊 Resultado: ${processed} procesados, ${errors} errores`)
  await pool.end()
}

main().catch(err => {
  console.error('❌ Error fatal:', err.message)
  process.exit(1)
})
