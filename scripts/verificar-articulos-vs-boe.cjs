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
 *   node scripts/verificar-articulos-vs-boe.cjs rgpd-ue-2016-679 DOUE-L-2016-80807 38   # normas UE
 *
 * Sin lista de artículos verifica TODOS los activos de la ley (ojo: 1 fetch por
 * artículo, sé considerado con el BOE).
 *
 * exit 0 = todos coinciden · exit 2 = alguno diverge o no existe en el BOE.
 */
const fs = require('fs')
const path = require('path')
const pg = require(path.join(__dirname, '..', 'backend', 'node_modules', 'postgres'))
const { bloqueVigente, comparaConBd, mapaBloquesPorArticulo, articuloDeDocumento, normalizar } = require(path.join(__dirname, '..', 'lib', 'laws', 'boeBloqueVigente'))

const [SLUG, BOE_ID, ...ARTS] = process.argv.slice(2)
if (!SLUG || !BOE_ID) {
  console.error('uso: node scripts/verificar-articulos-vs-boe.cjs <law_slug> <BOE-ID> [<art>…]')
  process.exit(1)
}

const envPath = path.join(__dirname, '..', '.env.local')
const url = fs.readFileSync(envPath, 'utf8').match(/^DATABASE_URL=(.*)$/m)[1].trim()
const s = pg(url, { ssl: { rejectUnauthorized: false }, max: 1, connect_timeout: 60 })

const API = 'https://www.boe.es/datosabiertos/api/legislacion-consolidada/id'

// El id de bloque NO es siempre `a<N>` (Ley 9/2017: "Artículo 10" es `a1-2`),
// así que se resuelve por el índice y `a<N>` queda solo como último recurso.
let MAPA = null
async function bloqueId(art) {
  if (MAPA === null) {
    try {
      const r = await fetch(`${API}/${BOE_ID}/texto/indice`, { headers: { Accept: 'application/xml' } })
      MAPA = r.ok ? mapaBloquesPorArticulo(await r.text()) : {}
    } catch {
      MAPA = {}
    }
    if (!Object.keys(MAPA).length) console.log('⚠️ no se pudo leer el índice del BOE — se probará con el id "a<N>"')
  }
  return MAPA[String(art)] || `a${art}`
}

async function xmlBloque(art) {
  const r = await fetch(`${API}/${BOE_ID}/texto/bloque/${await bloqueId(art)}`, { headers: { Accept: 'application/xml' } })
  if (!r.ok) throw new Error(`HTTP ${r.status}`)
  return await r.text()
}

// ── Normas EUROPEAS (ids DOUE-*) ────────────────────────────────────────────
// No están en legislación consolidada (la API devuelve 400), pero sí existen como
// DOCUMENTO y se sirven en XML por otro endpoint. Sin esta rama, toda la
// legislación de la UE del temario quedaba fuera del Paso 1 (T-143, 26/07/2026).
const ES_DOUE = /^DOUE-/i.test(BOE_ID || '')
let DOC_XML = null
async function xmlDocumento() {
  if (DOC_XML === null) {
    const r = await fetch(`https://www.boe.es/buscar/xml.php?id=${BOE_ID}`, { redirect: 'follow' })
    if (!r.ok) throw new Error(`HTTP ${r.status} al pedir el documento ${BOE_ID}`)
    DOC_XML = await r.text()
  }
  return DOC_XML
}

/** Compara un artículo de un documento DOUE contra nuestro `content`. */
async function comparaDocumento(art, contenidoBd) {
  const a = articuloDeDocumento(await xmlDocumento(), art)
  if (!a) return { coincide: false, vigencia: null, lenBoe: 0, lenBd: normalizar(contenidoBd).length, divergeEn: 0, notaVigencia: null, noEncontrado: true }
  const boe = normalizar(a.texto)
  const bd = normalizar(contenidoBd)
  // El documento es el texto PUBLICADO: no hay versiones por fecha_vigencia, así
  // que no se puede afirmar que sea el vigente si la norma se modificó después.
  const base = { vigencia: 'documento', lenBoe: boe.length, lenBd: bd.length, notaVigencia: null }
  if (boe === bd) return { ...base, coincide: true, divergeEn: null }
  let i = 0
  while (i < Math.min(boe.length, bd.length) && boe[i] === bd[i]) i++
  return { ...base, coincide: false, divergeEn: i }
}

;(async () => {
  const arts = ARTS.length
    ? await s`SELECT a.article_number n, a.content FROM articles a JOIN laws l ON l.id = a.law_id
              WHERE l.slug = ${SLUG} AND a.article_number = ANY(${ARTS}) AND a.is_active
              -- Orden natural TOLERANTE al sufijo: el cast a int reventaba con
              -- "40 bis" ("invalid input syntax for type integer"), así que la herramienta
              -- no podía verificar precisamente los artículos añadidos por reforma, que es
              -- donde más suele haber texto nuevo. Caso: art. 40 bis del DL 1/2009 de
              -- Canarias (T-141). Ojo con la barra invertida en un template literal de JS:
              -- hay que doblarla o el literal llega como una D suelta.
              ORDER BY NULLIF(regexp_replace(a.article_number, '\\D', '', 'g'), '')::int NULLS LAST,
                       a.article_number`
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
      r = ES_DOUE ? await comparaDocumento(a.n, a.content) : comparaConBd(await xmlBloque(a.n), a.content)
    } catch (e) {
      mal++
      console.log(`  ❌ art. ${a.n}: no se pudo leer del BOE (${e.message})`)
      continue
    }
    // Una nota de vigencia del BOE ("Téngase en cuenta que se declara…") NO es
    // texto del artículo, pero SÍ es información que puede invalidar una pregunta:
    // se avisa aunque el texto coincida. Caso real: art. 72 Ley 9/2017, cuyo
    // apartado 4 declaró no conforme con el orden constitucional de competencias
    // la STC 68/2021 y nuestro `content` no lo refleja.
    if (r.notaVigencia) {
      console.log(`  ⚠️ art. ${a.n} — el BOE trae NOTA DE VIGENCIA que no está en nuestro texto:`)
      console.log(`     «${r.notaVigencia.replace(/\s+/g, ' ').slice(0, 220)}»`)
      console.log('     → NO generes sobre el apartado afectado sin resolver antes la vigencia.')
    }

    if (r.coincide) {
      console.log(`  ✅ art. ${a.n} — idéntico al BOE ${r.vigencia === 'documento' ? '(documento publicado; el DOUE no tiene versiones consolidadas, comprueba si la norma se modificó después)' : 'vigente (' + r.vigencia + ')'}`)
      continue
    }
    mal++
    if (!r.vigencia) {
      console.log(`  ❌ art. ${a.n}: el BOE no devuelve ninguna versión para ese bloque (¿numeración distinta, "bis", derogado?)`)
      continue
    }
    const boe = ES_DOUE ? articuloDeDocumento(await xmlDocumento(), a.n) : bloqueVigente(await xmlBloque(a.n))
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
