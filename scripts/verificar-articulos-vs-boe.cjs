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
 *   node scripts/verificar-articulos-vs-boe.cjs rgpd-ue-2016-679 CELEX:02016R0679-20160504 38  # UE
 *
 * ⚠️ NORMAS DE LA UE: usa el CELEX del texto CONSOLIDADO (empieza por 0), no el espejo del BOE
 *   (`DOUE-…`), que reproduce el original CON erratas y no trae las correcciones de errores.
 *
 * Sin lista de artículos verifica TODOS los activos de la ley (ojo: 1 fetch por
 * artículo, sé considerado con el BOE).
 *
 * exit 0 = todos coinciden · exit 2 = alguno diverge o no existe en el BOE.
 */
const fs = require('fs')
const path = require('path')
const pg = require(path.join(__dirname, '..', 'backend', 'node_modules', 'postgres'))
const { bloqueVigente, comparaConBd, mapaBloquesPorArticulo, bloqueDeArticulo, articuloDeDocumento, normalizar } = require(path.join(__dirname, '..', 'lib', 'laws', 'boeBloqueVigente'))
const { articuloDeEurLex, esIdEurLex, esCelexNoConsolidado } = require(path.join(__dirname, '..', 'lib', 'laws', 'eurlexConsolidado'))
const { descargarDocumentoOficial } = require(path.join(__dirname, '..', 'lib', 'laws', 'descargarEurlex.cjs'))

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
  // Lookup TOLERANTE: el BOE rotula "Artículo 6 bis" y la BD guarda `6bis`, así que
  // la comparación literal fallaba por un espacio y devolvía 404 para toda la familia
  // de reforma (T-146). El respaldo `a<N>` solo tiene sentido si el número es un
  // entero puro: para un "6bis" produciría `a6bis`, que no existe, o peor, un id que
  // sí existe y es OTRO artículo.
  const id = bloqueDeArticulo(MAPA, String(art))
  if (id) return id
  if (!/^\d+$/.test(String(art))) {
    console.log(`  ⚠️ art. ${art}: no aparece en el índice del BOE con ese nombre — revísalo a mano antes de generar`)
  }
  return `a${art}`
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

// ── Normas europeas por EUR-Lex (ids CELEX) ─────────────────────────────────
// El espejo del BOE reproduce el DOUE **ORIGINAL, con erratas**, y no incorpora las correcciones
// de errores posteriores. El RGPD tuvo una (DO L 127, 23/05/2018): comparar contra el BOE decía
// que 80 de sus 99 artículos "divergían" cuando lo que pasaba es que NUESTRO texto estaba más
// cerca del corregido. Reescribir con ese veredicto habría metido «las orientación sexuales» en
// el temario de 49 oposiciones (T-184, 27/07/2026). Para normas UE, la fuente es EUR-Lex
// CONSOLIDADA: `node …/verificar-articulos-vs-boe.cjs rgpd-ue-2016-679 CELEX:02016R0679-20160504`
const ES_EURLEX = esIdEurLex(BOE_ID)
let EURLEX_HTML = null
async function htmlEurLex() {
  if (EURLEX_HTML === null) {
    // Validar el CONTENIDO y no el código de estado: EUR-Lex responde 202 con cuerpo VACÍO
    // cuando nos raciona, y `202` pasa el filtro `r.ok` → salía «0 divergencias» sin haber
    // comparado nada. El bucle cae a Cellar y lanza si ninguna fuente sirve.
    EURLEX_HTML = (await descargarDocumentoOficial(BOE_ID, { log: (m) => console.log(`   ${m}`) })).html
  }
  return EURLEX_HTML
}

/** Compara un artículo del consolidado de EUR-Lex contra nuestro `content`. */
async function comparaEurLex(art, contenidoBd, rubrica) {
  const a = articuloDeEurLex(await htmlEurLex(), art, rubrica)
  if (!a) return { coincide: false, vigencia: null, lenBoe: 0, lenBd: normalizar(contenidoBd).length, divergeEn: 0, notaVigencia: null }
  const of_ = normalizar(a.texto)
  const bd = normalizar(contenidoBd)
  const base = { vigencia: 'consolidado UE', lenBoe: of_.length, lenBd: bd.length, notaVigencia: null }
  if (of_ === bd) return { ...base, coincide: true, divergeEn: null }
  let i = 0
  while (i < Math.min(of_.length, bd.length) && of_[i] === bd[i]) i++
  return { ...base, coincide: false, divergeEn: i }
}

if (ES_DOUE) {
  console.log('⚠️  AVISO: el espejo del BOE de una norma UE es el texto ORIGINAL, CON sus erratas —')
  console.log('   no incorpora las correcciones de errores publicadas después. Si esta norma tiene')
  console.log('   corrección (el RGPD la tiene: DO L 127 de 23/05/2018), aquí saldrán DIVERGENCIAS')
  console.log('   FALSAS y "arreglarlas" empeoraría el texto. Usa el consolidado de EUR-Lex:')
  console.log(`   node scripts/verificar-articulos-vs-boe.cjs ${SLUG} CELEX:0XXXXRXXXX-AAAAMMDD\n`)
}
if (ES_EURLEX && esCelexNoConsolidado(BOE_ID)) {
  console.log('⚠️  AVISO: ese CELEX empieza por 3 = el acto tal como se PUBLICÓ (con erratas).')
  console.log('   El consolidado empieza por 0 (p. ej. `02016R0679-20160504`).\n')
}
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
    ? await s`SELECT a.article_number n, a.content, a.title FROM articles a JOIN laws l ON l.id = a.law_id
              WHERE l.slug = ${SLUG} AND a.article_number = ANY(${ARTS}) AND a.is_active
              -- Orden natural TOLERANTE al sufijo: el cast a int reventaba con
              -- "40 bis" ("invalid input syntax for type integer"), así que la herramienta
              -- no podía verificar precisamente los artículos añadidos por reforma, que es
              -- donde más suele haber texto nuevo. Caso: art. 40 bis del DL 1/2009 de
              -- Canarias (T-141). Ojo con la barra invertida en un template literal de JS:
              -- hay que doblarla o el literal llega como una D suelta.
              ORDER BY NULLIF(regexp_replace(a.article_number, '\\D', '', 'g'), '')::int NULLS LAST,
                       a.article_number`
    : await s`SELECT a.article_number n, a.content, a.title FROM articles a JOIN laws l ON l.id = a.law_id
              WHERE l.slug = ${SLUG} AND a.is_active AND a.article_number ~ '^[0-9]+$'
              ORDER BY (a.article_number)::int`

  if (!arts.length) {
    console.error(`❌ ningún artículo activo encontrado para la ley "${SLUG}"`)
    await s.end()
    process.exit(2)
  }

  let mal = 0
  let ilegibles = 0   // de los `mal`, cuántos fallaron al LEER la fuente (≠ divergir)
  for (const a of arts) {
    let r
    try {
      r = ES_EURLEX
        ? await comparaEurLex(a.n, a.content, a.title)
        : ES_DOUE
          ? await comparaDocumento(a.n, a.content)
          : comparaConBd(await xmlBloque(a.n), a.content)
    } catch (e) {
      mal++
      ilegibles++
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
      console.log(`  ✅ art. ${a.n} — idéntico ${ES_EURLEX ? 'a EUR-Lex consolidado' : r.vigencia === 'documento' ? 'al documento del BOE (el DOUE no tiene versiones consolidadas: comprueba si la norma se modificó después)' : `al BOE vigente (${r.vigencia})`}`)
      continue
    }
    mal++
    if (!r.vigencia) {
      console.log(`  ❌ art. ${a.n}: el BOE no devuelve ninguna versión para ese bloque (¿numeración distinta, "bis", derogado?)`)
      continue
    }
    const boe = ES_EURLEX
      ? articuloDeEurLex(await htmlEurLex(), a.n, a.title)
      : ES_DOUE
        ? articuloDeDocumento(await xmlDocumento(), a.n)
        : bloqueVigente(await xmlBloque(a.n))
    console.log(`  ❌ art. ${a.n} DIVERGE de ${ES_EURLEX ? 'EUR-Lex consolidado' : 'el BOE vigente'} (${r.vigencia}) — BD ${r.lenBd} ch / oficial ${r.lenBoe} ch, difieren desde el char ${r.divergeEn}`)
    console.log(`     OFI: …${boe.texto.replace(/\s+/g, ' ').slice(Math.max(0, r.divergeEn - 50), r.divergeEn + 150)}…`)
    console.log(`     BD : …${String(a.content).replace(/\s+/g, ' ').slice(Math.max(0, r.divergeEn - 50), r.divergeEn + 150)}…`)
  }

  console.log(`\n${arts.length - mal}/${arts.length} artículos coinciden con ${ES_EURLEX ? 'EUR-Lex consolidado' : 'el BOE vigente'}`)
  // "No he podido leer" NO es "no coincide". Cuando fallan TODAS las lecturas —id equivocado,
  // BOE caído, sin red— el resumen decía igualmente "0/N coinciden · NO generes preguntas", que
  // empuja a "actualizar" desde el BOE un `content` que puede estar perfecto. Pasó el 28/07 al
  // invocarlo sin el BOE-ID (el 2º argumento es el id, no el primer artículo): 15 HTTP 400
  // seguidos y un veredicto que parecía de contenido. Fail-safe: si nada se pudo leer, se dice.
  if (ilegibles === arts.length && arts.length > 0) {
    console.log(`\n🚫 NO se ha podido leer NINGÚN artículo de la fuente oficial — esto NO significa que diverjan.`)
    console.log(`   Revisa el id del documento (recibido: "${BOE_ID}") y la conectividad antes de tocar ningún \`content\`.`)
    console.log(`   uso: node scripts/verificar-articulos-vs-boe.cjs <law_slug> <BOE-ID> [<art>…]`)
  } else if (mal) {
    console.log(`⚠️ NO generes preguntas sobre los que divergen: actualiza antes el \`content\` desde ${ES_EURLEX ? 'EUR-Lex consolidado' : 'el BOE'}.`)
    if (ilegibles) console.log(`   (${ilegibles} de esos ${mal} no se pudieron LEER: eso no es divergencia, míralos aparte.)`)
  }
  await s.end()
  if (mal) process.exit(2)
})().catch((e) => {
  console.error('❌', e.message)
  process.exit(1)
})
