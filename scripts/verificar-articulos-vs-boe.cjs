#!/usr/bin/env node
/**
 * Paso 1 del manual `generar-preguntas-con-ia.md`: comprobar que el `content` de
 * los artículos sobre los que se va a generar coincide con el texto VIGENTE del
 * BOE consolidado. Anclar preguntas a un `content` desactualizado es enseñar
 * Derecho derogado, y ningún gate posterior lo detecta (todos comparan la
 * pregunta contra el `content`, no el `content` contra el BOE).
 *
 * Uso:
 *   node scripts/verificar-articulos-vs-boe.cjs <law_slug> <BOE-ID> <art> [<art>…]
 *   node scripts/verificar-articulos-vs-boe.cjs lprl BOE-A-1995-24292 10 11 12 32 39
 *
 * Sin lista de artículos verifica TODOS los activos de la ley (ojo: 1 fetch por
 * artículo, sé considerado con el BOE).
 *
 * exit 0 = todos coinciden · exit 2 = alguno diverge o no existe en el BOE.
 */
const fs = require('fs')
const path = require('path')
const pg = require(path.join(__dirname, '..', 'backend', 'node_modules', 'postgres'))
const { bloqueVigente, comparaConBd } = require(path.join(__dirname, '..', 'lib', 'laws', 'boeBloqueVigente'))

const [SLUG, BOE_ID, ...ARTS] = process.argv.slice(2)
if (!SLUG || !BOE_ID) {
  console.error('uso: node scripts/verificar-articulos-vs-boe.cjs <law_slug> <BOE-ID> [<art>…]')
  process.exit(1)
}

const envPath = path.join(__dirname, '..', '.env.local')
const url = fs.readFileSync(envPath, 'utf8').match(/^DATABASE_URL=(.*)$/m)[1].trim()
const s = pg(url, { ssl: { rejectUnauthorized: false }, max: 1, connect_timeout: 60 })

const API = 'https://www.boe.es/datosabiertos/api/legislacion-consolidada/id'

async function xmlBloque(art) {
  const r = await fetch(`${API}/${BOE_ID}/texto/bloque/a${art}`, { headers: { Accept: 'application/xml' } })
  if (!r.ok) throw new Error(`HTTP ${r.status}`)
  return await r.text()
}

;(async () => {
  const arts = ARTS.length
    ? await s`SELECT a.article_number n, a.content FROM articles a JOIN laws l ON l.id = a.law_id
              WHERE l.slug = ${SLUG} AND a.article_number = ANY(${ARTS}) AND a.is_active
              ORDER BY (a.article_number)::int`
    : await s`SELECT a.article_number n, a.content FROM articles a JOIN laws l ON l.id = a.law_id
              WHERE l.slug = ${SLUG} AND a.is_active AND a.article_number ~ '^[0-9]+$'
              ORDER BY (a.article_number)::int`

  if (!arts.length) {
    console.error(`❌ ningún artículo activo encontrado para la ley "${SLUG}"`)
    await s.end()
    process.exit(2)
  }

  let mal = 0
  for (const a of arts) {
    let r
    try {
      r = comparaConBd(await xmlBloque(a.n), a.content)
    } catch (e) {
      mal++
      console.log(`  ❌ art. ${a.n}: no se pudo leer del BOE (${e.message})`)
      continue
    }
    if (r.coincide) {
      console.log(`  ✅ art. ${a.n} — idéntico al BOE vigente (${r.vigencia})`)
      continue
    }
    mal++
    if (!r.vigencia) {
      console.log(`  ❌ art. ${a.n}: el BOE no devuelve ninguna versión para ese bloque (¿numeración distinta, "bis", derogado?)`)
      continue
    }
    const boe = bloqueVigente(await xmlBloque(a.n))
    console.log(`  ❌ art. ${a.n} DIVERGE del BOE vigente (${r.vigencia}) — BD ${r.lenBd} ch / BOE ${r.lenBoe} ch, difieren desde el char ${r.divergeEn}`)
    console.log(`     BOE: …${boe.texto.replace(/\s+/g, ' ').slice(Math.max(0, r.divergeEn - 50), r.divergeEn + 150)}…`)
    console.log(`     BD : …${String(a.content).replace(/\s+/g, ' ').slice(Math.max(0, r.divergeEn - 50), r.divergeEn + 150)}…`)
  }

  console.log(`\n${arts.length - mal}/${arts.length} artículos coinciden con el BOE vigente`)
  if (mal) console.log('⚠️ NO generes preguntas sobre los que divergen: actualiza antes el `content` desde el BOE.')
  await s.end()
  if (mal) process.exit(2)
})().catch((e) => {
  console.error('❌', e.message)
  process.exit(1)
})
