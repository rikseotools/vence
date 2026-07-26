#!/usr/bin/env node
/**
 * reparar-rubricas-law-sections.cjs — limpia el `title` de las secciones de ley cuya
 * rúbrica se guardó CONTAMINADA con notas editoriales del BOE o, peor, con la rúbrica
 * DEROGADA (T-140, 26/07/2026).
 *
 * Uso:
 *   node scripts/reparar-rubricas-law-sections.cjs                 # dry-run de las sucias
 *   node scripts/reparar-rubricas-law-sections.cjs --apply
 *   node scripts/reparar-rubricas-law-sections.cjs --todas         # revisa TODAS, no solo las sucias
 *   node scripts/reparar-rubricas-law-sections.cjs --ley "LOTC"    # una sola ley
 *
 * ── EL DEFECTO ──
 * `poblar-law-sections-boe.cjs` sacaba la rúbrica con un regex sobre el cuerpo CRUDO del
 * bloque del BOE, capturando hasta 140 caracteres sin punto. Como el cuerpo crudo trae
 * TODAS las redacciones históricas del bloque y también las notas editoriales, salían dos
 * defectos distintos, medidos sobre 2.048 secciones (50 afectadas):
 *
 *   · Nota pegada: «Título III. Del recurso de amparo constitucional **Ténganse en cuenta
 *     los artículos 53.2…**» (LOTC), «…De la reforma del Estatuto **Redactado conforme a la
 *     corrección de errores…**» (EA Canarias). Se le muestra al usuario en /leyes/<slug>.
 *   · **Rúbrica DEROGADA**, que es lo grave: «Título VI. Del control previo de
 *     inconstitucionalidad» (LOTC) cuando la vigente es «De la declaración sobre la
 *     constitucionalidad de los tratados internacionales»; «Título I. De la Diputación
 *     Regional de Cantabria» cuando la vigente es «De las instituciones de la Comunidad
 *     Autónoma». El regex cogía la PRIMERA coincidencia del cuerpo, que es la más antigua.
 *
 * El poblador ya está arreglado (usa `bloqueVigente`, que elige la versión por
 * `fecha_vigencia` y separa las notas), pero **salta las leyes ya pobladas**, así que las
 * filas viejas no se reparan solas. De ahí este script.
 *
 * ── QUÉ NO HACE ──
 * Solo toca `title`. No borra filas, no toca `slug` (los enlaces no cambian) ni los rangos
 * de artículos. Si la rúbrica nueva sale vacía o sospechosa, deja la fila como está: es
 * preferible una rúbrica sucia a ninguna.
 */
require('dotenv').config({ path: '.env.local' })
const sql = require('postgres')(process.env.DATABASE_URL, { ssl: { rejectUnauthorized: false }, max: 1 })
const { parseBoeSections } = require('../lib/laws/parseBoeSections')
const { bloqueVigente } = require('../lib/laws/boeBloqueVigente')
// El criterio (qué rúbrica está sucia, cuándo un cambio es LIMPIEZA y no reemplazo, y
// cuándo los números de sección son ambiguos) vive en el núcleo puro, testeado.
const { esRubricaSucia, rubricaEsLimpiezaDe, numerosAmbiguos } = require('../lib/laws/rubricaSeccion')

const XML = { headers: { Accept: 'application/xml' } }
const APPLY = process.argv.includes('--apply')
const TODAS = process.argv.includes('--todas')
const LEY = (process.argv.find((a) => a.startsWith('--ley')) ? process.argv[process.argv.indexOf(process.argv.find((a) => a.startsWith('--ley'))) + 1] : null)
const boeId = (u) => (String(u || '').match(/BOE-A-\d{4}-\d+/) || [])[0]


async function rubricaLimpia(bid, blockId) {
  const xml = await (await fetch(`https://www.boe.es/datosabiertos/api/legislacion-consolidada/id/${bid}/texto/bloque/${blockId}`, XML)).text()
  const b = bloqueVigente(xml)
  const primero = String((b && b.texto) || '').split('\n\n')[0].trim().replace(/\s+/g, ' ')
  return primero && primero.length >= 3 && primero.length <= 200 && !esRubricaSucia(primero) ? primero : null
}

;(async () => {
  const filas = await sql`
    SELECT ls.id, ls.section_type, ls.section_number, ls.title, l.id AS law_id, l.short_name, l.boe_url
    FROM law_sections ls JOIN laws l ON l.id = ls.law_id
    WHERE ls.title IS NOT NULL ${LEY ? sql`AND l.short_name = ${LEY}` : sql``}
    ORDER BY l.short_name, ls.order_position`
  const objetivo = TODAS ? filas : filas.filter((f) => esRubricaSucia(f.title))
  console.log(`${filas.length} secciones con título · ${objetivo.length} a revisar${APPLY ? '' : '  (DRY-RUN)'}\n`)

  // Agrupar por ley: un solo fetch del índice por ley, y de ahí el blockId de cada sección.
  const porLey = new Map()
  for (const f of objetivo) {
    if (!porLey.has(f.law_id)) porLey.set(f.law_id, { short: f.short_name, bid: boeId(f.boe_url), secs: [] })
    porLey.get(f.law_id).secs.push(f)
  }

  let cambiadas = 0, sinFuente = 0, sinMejora = 0
  for (const [, ley] of porLey) {
    if (!ley.bid) { sinFuente += ley.secs.length; console.log(`⏭️  ${ley.short}: sin id BOE-A`); continue }
    let mapa = {}
    try {
      const idx = await (await fetch(`https://www.boe.es/datosabiertos/api/legislacion-consolidada/id/${ley.bid}/texto/indice`, XML)).text()
      const bl = [...idx.matchAll(/<bloque>\s*<id>([^<]*)<\/id>\s*<titulo>([\s\S]*?)<\/titulo>/g)]
        .map((m) => ({ id: m[1].trim(), label: m[2].replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim() }))
      const secs = parseBoeSections(bl).secciones
      // GUARDA 1 — números de sección DUPLICADOS = ley de nivel LIBRO (Libro I › Título I,
      // Libro II › Título I…). Casar por número asignaría la rúbrica de OTRO libro. Lo
      // enseñó la LOPJ en el dry-run: su "Título IV" pasaba de "De la fe pública judicial"
      // a "De los órganos del Consejo General del Poder Judicial". No se tocan.
      if (numerosAmbiguos(secs)) {
        console.log(`   ⏭️  ${ley.short}: números de sección duplicados (ley de nivel LIBRO) — no se toca`)
        sinFuente += ley.secs.length
        continue
      }
      for (const s of secs) mapa[String(s.num).toLowerCase()] = s.blockId
    } catch { console.log(`⏭️  ${ley.short}: no se pudo leer el índice`); sinFuente += ley.secs.length; continue }

    for (const f of ley.secs) {
      const blockId = mapa[String(f.section_number).toLowerCase()]
      if (!blockId) { sinFuente++; console.log(`   ⏭️  ${ley.short} ${f.section_number}: no está en el índice actual`); continue }
      let nueva = null
      try { nueva = await rubricaLimpia(ley.bid, blockId) } catch { /* red */ }
      if (!nueva) { sinMejora++; console.log(`   ⏭️  ${ley.short} ${f.section_number}: sin rúbrica limpia, se deja como está`); continue }
      const actual = String(f.title || '')
      // El título guardado lleva el prefijo "Título III. " que pone el poblador.
      const nuevoTitulo = `${f.section_type === 'capitulo' ? 'Capítulo' : 'Título'} ${f.section_number}. ${nueva}`
      if (nuevoTitulo === actual) { sinMejora++; continue }
      // GUARDA 2 — la reparación solo puede LIMPIAR, nunca REEMPLAZAR: se exige que la
      // rúbrica nueva ya esté contenida en el título guardado. En la contaminación real lo
      // está siempre (la nota va detrás, o la rúbrica vigente aparece tras el encabezado
      // repetido). Si no aparece, es que hemos mapeado otra sección → se deja y se avisa.
      if (!rubricaEsLimpiezaDe(actual, nueva)) {
        sinMejora++
        console.log(`   ⚠️  ${ley.short} ${f.section_number}: la rúbrica del BOE NO aparece en el título guardado — se deja para revisión humana`)
        console.log(`        guardado: ${actual.slice(0, 90)}`)
        console.log(`        BOE:      ${nueva.slice(0, 90)}`)
        continue
      }
      console.log(`   ${ley.short} ${f.section_number}`)
      console.log(`     antes: ${actual.slice(0, 110)}`)
      console.log(`     ahora: ${nuevoTitulo.slice(0, 110)}`)
      if (APPLY) await sql`UPDATE law_sections SET title = ${nuevoTitulo}, updated_at = now() WHERE id = ${f.id}`
      cambiadas++
    }
  }

  console.log(`\nresumen: ${cambiadas} ${APPLY ? 'reparadas' : 'a reparar'} · ${sinMejora} sin cambio · ${sinFuente} sin fuente`)
  if (!APPLY && cambiadas) console.log('→ repite con --apply para escribir')
  await sql.end()
})()
