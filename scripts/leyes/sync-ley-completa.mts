/**
 * sync-ley-completa.mts — reimporta una ley ENTERA desde el BOE, sin huerfanar preguntas.
 *
 * Uso:  npx tsx scripts/leyes/sync-ley-completa.mts "<short_name>"
 *
 * ## Qué añade sobre lo que ya había
 *
 * NO reimplementa nada: llama a `syncArticlesFromBoe` (lib/api/article-sync), la MISMA
 * función que sirve `/api/verify-articles/sync-all` y el botón "Sincronizar BOE" del panel.
 * Lo que aporta son dos cosas que la vía HTTP no da:
 *
 * 1. **Guarda anti-huérfanas.** El sync desactiva los artículos que ya no están en el BOE.
 *    Es correcto en general, pero se lleva por delante los artículos NO NUMÉRICOS que
 *    nosotros creamos y el índice del BOE no tiene (`etiquetado`, `5-6`, `17-18`…), y esos
 *    SÍ tienen preguntas colgando. Aquí se detecta y se revierte esa desactivación
 *    concreta, dejando el resto del sync intacto. **No es hipotético: saltó en 2 de las 8
 *    leyes del T-239 y habría dejado preguntas sin artículo servible.**
 * 2. **No necesita servidor ni expone un endpoint sin auth** (`sync-all` no valida admin).
 *
 * ## Después de correrlo, comprobar SIEMPRE
 *
 * - Si algún tema escopa la ley ENTERA (`topic_scope.article_numbers IS NULL`), lo importado
 *   pasa a servirse solo → **revalidar caché** de esos temas con `scripts/lib/temario-recache.cjs`.
 * - `scripts/poblar-law-sections-boe.cjs --law "<short_name>" --apply`: con la ley completa
 *   suele poder delimitarla, y antes no podía (7 de 8 en el T-239).
 *
 * Manual: docs/maintenance/monitoreo-boe-y-crear-leyes-nuevas.md §3.
 */
import 'dotenv/config'
import fs from 'fs'
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0'
// db/client.ts lee DATABASE_URL EN EL IMPORT: hay que fijarla ANTES de importarlo.
const url = fs.readFileSync('.env.local', 'utf8').match(/^DATABASE_URL=(.*)$/m)![1].trim()
process.env.DATABASE_URL = url
const { syncArticlesFromBoe } = await import('../../lib/api/article-sync/queries.ts')
const postgres = (await import('postgres')).default
const sql = postgres(url, { ssl: { rejectUnauthorized: false }, max: 1, connect_timeout: 25, onnotice: () => {} })

const shortName = process.argv[2]
if (!shortName) { console.error('uso: npx tsx scripts/leyes/sync-ley-completa.mts "<short_name>"'); process.exit(2) }

const [l] = await sql`SELECT id, short_name FROM laws WHERE short_name=${shortName}`
if (!l) { console.error(`ley no encontrada: ${shortName}`); process.exit(2) }

const antes = await sql`
  SELECT a.id, a.article_number, a.is_active,
    (SELECT count(*)::int FROM questions q WHERE q.primary_article_id = a.id AND q.is_active) preg
  FROM articles a WHERE a.law_id = ${l.id}`
const conPreg = new Map(antes.filter((a: any) => a.preg > 0).map((a: any) => [a.id, a]))
console.log(`ANTES: ${antes.length} artículos (${antes.filter((a: any) => a.is_active).length} activos), ${conPreg.size} con preguntas`)

const r = await syncArticlesFromBoe({ lawId: l.id, mode: 'sync', includeDisposiciones: false })
if (!r.success) { console.error('❌ sync falló:', r.error); process.exit(1) }
console.log('sync:', JSON.stringify(r.stats))

const despues = await sql`SELECT id, article_number, is_active FROM articles WHERE law_id = ${l.id}`
const rotos = despues.filter((a: any) => !a.is_active && conPreg.has(a.id))
if (rotos.length) {
  console.log(`🛑 ${rotos.length} artículo(s) CON PREGUNTAS desactivados → revirtiendo SOLO esa desactivación`)
  for (const a of rotos) await sql`UPDATE articles SET is_active = true WHERE id = ${a.id}`
  console.log('   revertidos:', rotos.map((a: any) => a.article_number).join(', '))
} else {
  console.log('✅ ningún artículo con preguntas fue desactivado')
}
const [f] = await sql`SELECT count(*)::int n FROM articles WHERE law_id = ${l.id} AND is_active`
console.log(`DESPUÉS: ${f.n} artículos activos`)
await sql.end({ timeout: 5 })
