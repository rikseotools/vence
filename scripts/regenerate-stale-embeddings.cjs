#!/usr/bin/env node
// scripts/regenerate-stale-embeddings.cjs
//
// Regenera los embeddings de artículos marcados `embedding_stale=true` (o con
// `embedding IS NULL`) contra su CONTENIDO ACTUAL, y limpia el flag.
//
// Por qué existe (gap 20/07): `scripts/generate-embeddings.cjs` solo rellena
// `embedding IS NULL`; NADIE consumía `embedding_stale`. Cuando se corrige el texto de
// un artículo (p.ej. re-import verbatim del BOJA/BOCyL) se marca `embedding_stale=true`,
// pero su vector seguía calculado sobre el texto VIEJO → la búsqueda semántica / el chat
// IA casaban contra el contenido antiguo. Había ~17k artículos así, sin regenerar.
//
//   node scripts/regenerate-stale-embeddings.cjs --law <uuid> [--dry]   # una ley
//   node scripts/regenerate-stale-embeddings.cjs --all [--limit N] [--dry]  # backlog global
//
// Escribe DIRECTO a RDS (pgvector `::vector`), en sitio (sin ventana de NULL: calcula el
// vector nuevo y actualiza + baja el flag por artículo). Clave OpenAI desde `ai_api_config`.
const fs = require('fs')
const path = require('path')
const pg = require(path.join(__dirname, '..', 'backend', 'node_modules', 'postgres'))
const OpenAI = require(path.join(__dirname, '..', 'node_modules', 'openai'))

const MODEL = 'text-embedding-3-small' // 1536 dims — igual que generate-embeddings.cjs
function getUrl() {
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL
  return fs.readFileSync(path.join(__dirname, '..', '.env.local'), 'utf8').match(/^DATABASE_URL=(.*)$/m)[1].trim()
}

;(async () => {
  const args = process.argv.slice(2)
  const dry = args.includes('--dry')
  const all = args.includes('--all')
  const lawId = args[args.indexOf('--law') + 1]
  const limit = +(args[args.indexOf('--limit') + 1]) || 100000
  if (!all && !lawId) { console.error('Uso: --law <uuid> | --all [--limit N] [--dry]'); process.exit(2) }

  const sql = pg(getUrl(), { ssl: { rejectUnauthorized: false }, max: 1, connect_timeout: 60 })
  try {
    const where = all
      ? sql`is_active AND (embedding_stale OR embedding IS NULL)`
      : sql`law_id = ${lawId} AND is_active AND (embedding_stale OR embedding IS NULL)`
    const rows = await sql`SELECT id, article_number, title, content FROM articles WHERE ${where} ORDER BY law_id, article_number LIMIT ${limit}`
    console.log(`${rows.length} artículos a regenerar${dry ? ' (dry)' : ''}`)
    if (dry || !rows.length) { await sql.end(); return }

    const [k] = await sql`SELECT api_key_encrypted FROM ai_api_config WHERE provider='openai' LIMIT 1`
    if (!k) throw new Error('sin API key OpenAI en ai_api_config')
    const openai = new OpenAI({ apiKey: Buffer.from(k.api_key_encrypted, 'base64').toString('utf-8') })

    let ok = 0, err = 0
    for (const a of rows) {
      try {
        const text = [a.title || '', a.content || ''].filter(Boolean).join('\n\n').replace(/\s+/g, ' ').trim().substring(0, 30000)
        if (!text) { console.log(`  ⚠️ art ${a.article_number}: sin contenido, salto`); continue }
        const r = await openai.embeddings.create({ model: MODEL, input: text })
        const vec = '[' + r.data[0].embedding.join(',') + ']'
        await sql`UPDATE articles SET embedding = ${vec}::vector, embedding_stale = false WHERE id = ${a.id}`
        ok++; if (ok % 25 === 0) process.stdout.write(' ' + ok)
      } catch (e) { err++; console.log(`\n  ❌ art ${a.article_number}: ${e.message}`) }
    }
    console.log(`\n✅ regenerados ${ok}, errores ${err}`)
  } finally { await sql.end() }
})()
