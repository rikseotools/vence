'use strict'
/**
 * epigrafeEnFuente.cjs — ¿el epígrafe que servimos ESTÁ en el documento del que dice venir?
 *
 * ── LA PREGUNTA QUE NADIE HACÍA ──────────────────────────────────────────────────────────────
 * El Paso 1 (`verify:epigrafe`) responde «¿es literal?» **de una oposición que alguien decide
 * mirar**. `audit:epigrafe` compara epígrafe↔scope, que es otra cosa. Entre los dos quedaba el
 * hueco de [T-528]: **2.295 temas (60%) sin contrastar nunca contra su fuente**, con el
 * `programa_url` disponible en las 126 activas. No faltaba el documento: faltaba mirar.
 *
 * Y el motivo de que no se mirara es que parecía caro. No lo es, si se hace la pregunta correcta.
 *
 * ── POR QUÉ NO HACE FALTA PARSEAR EL BOLETÍN ─────────────────────────────────────────────────
 * El instinto es parsear el programa oficial en temas y comparar tema a tema. Eso es justo lo
 * que **falla en un tercio de los boletines** (formatos heterogéneos, anexos por cuerpo, dos
 * partes numeradas 1-N…), y encima obliga a alinear la numeración.
 *
 * La pregunta barata es la contraria y no necesita estructura ninguna:
 *
 *      ¿el texto del epígrafe de la BD APARECE dentro del documento oficial?
 *
 * Si es literal, aparece. Si es una paráfrasis, no. Sin parser, sin alinear temas, sin LLM.
 * Es exactamente la comprobación con la que se validó el clonado de `administrativo_asturias`
 * (04/08): dio 38/38 sobre los epígrafes ya literales y 8/38 sobre los de antes.
 *
 * ── LO QUE HACE QUE LA MEDIDA NO MIENTA ──────────────────────────────────────────────────────
 * 1. **Aplanar de verdad.** Un tema puede cruzar un salto de página con la cabecera del boletín
 *    metida en medio, y el PDF corta palabras con guion (`procedi-\nmientos`). Se comparan las
 *    dos cadenas sin espacios, sin guiones y sin saltos: si no, un epígrafe PERFECTO se declara
 *    ausente. Medido en Asturias: sin esto, 1 de 38 daba falso negativo.
 * 2. **«No medible» NO es «miente».** Un `programa_url` que no descarga, que sirve el cascarón
 *    de una SPA o que apunta a un portal **no dice nada** sobre nuestros epígrafes. Confundirlo
 *    con drift pondría en cabeza de la cola justo las oposiciones de las que no sabemos nada.
 *    Va en su propio cubo y se cuenta aparte.
 * 3. **Un epígrafe corto no se juzga.** Debajo de `MIN_LONGITUD` caracteres, aparecer dentro de
 *    un documento de 200 páginas puede ser casualidad. Se marca `no_medible`, no `contenido`.
 *
 * ── QUÉ SIGNIFICA EL RESULTADO, Y QUÉ NO ─────────────────────────────────────────────────────
 * Mide **distancia a la propia fuente**, no corrección. Un epígrafe ausente puede ser una
 * paráfrasis nuestra (el caso normal) o un `programa_url` que apunta a un ciclo distinto (el
 * caso de Cantabria: el programa lo había modificado una Orden posterior). Las dos cosas hay
 * que mirarlas; ninguna se arregla sola. Por eso esto **ordena una cola**, no pinga un badge.
 */

/** Debajo de esto, encontrar el texto dentro de un documento largo puede ser casualidad. */
const MIN_LONGITUD = 40

/** Un documento más corto que esto no es un temario: es un error, un login o un cascarón. */
const MIN_FUENTE = 2000

/**
 * Quita el mobiliario de página (cabeceras, pies, URLs, numeración) del texto de un boletín.
 *
 * **Sin esto la medida da falsos «ausente», y en el peor sitio:** un tema que cruza un salto de
 * página tiene la cabecera del boletín INCRUSTADA en mitad de la frase, así que un epígrafe
 * impecable no aparece como cadena contigua. Medido en Asturias (04/08): 29 de 30 epígrafes
 * literales se reconocían, y el que fallaba era exactamente el que cruzaba de página.
 *
 * Es GENÉRICO a propósito, sin patrones por boletín: el mobiliario se delata porque **se repite
 * en cada página**. Una línea que aparece tres veces o más en el documento no es temario. Una
 * lista de expresiones por boletín envejecería sola y solo funcionaría con los que ya conocemos.
 *
 * ⚠️ Y con un TOPE de longitud, que no es adorno: al enmascarar los dígitos, catorce líneas de
 * un temario que solo se distinguen por su número comparten clave y el filtro **se las llevaría
 * enteras**, borrando justo lo que se quiere medir. Lo cazó un test. Medido sobre el BOPA de
 * Asturias: el mobiliario ocupa entre 8 y 66 caracteres y las líneas de temario arrancan en 87,
 * así que el corte va en 80 — con margen por los dos lados.
 */
function limpiarRuidoDePagina(texto) {
  const lineas = String(texto || '').split('\n')
  // Los DÍGITOS se enmascaran antes de contar. Es lo que decide si esto sirve: el pie
  // «núm. 248 de 24-xii-2024   15/18» cambia en cada página por la paginación, así que contado
  // literalmente aparece UNA vez y sobrevive al filtro — y era justo el que partía en dos el
  // único tema que cruzaba de página en Asturias.
  const clave = (s) => s.replace(/\d+/g, '#')
  const MAX_MOBILIARIO = 80
  const veces = new Map()
  for (const l of lineas) {
    const k = l.trim()
    if (k.length >= 8 && k.length <= MAX_MOBILIARIO) veces.set(clave(k), (veces.get(clave(k)) || 0) + 1)
  }
  const ES_URL = /^https?:\/\/\S+$/i
  const ES_PAGINA = /^\s*\d+\s*(\/\s*\d+\s*)?$/
  return lineas
    .filter((l) => {
      const k = l.trim()
      if (!k) return true
      if (ES_URL.test(k) || ES_PAGINA.test(k)) return false
      return (veces.get(clave(k)) || 0) < 3
    })
    .join('\n')
    .replace(/\f/g, '')  // el salto de página que emite pdftotext
}

/**
 * Aplana un texto hasta lo que sobrevive a la extracción de un PDF: sin espacios, sin saltos,
 * sin guiones de corte y en minúsculas. Los acentos SE CONSERVAN — quitarlos aflojaría la
 * comparación sin necesidad, y en textos largos no hacen falsos negativos.
 */
function aplanar(s) {
  return String(s == null ? '' : s)
    .normalize('NFC')
    .replace(/-\s*\n/g, '')       // palabra cortada al final de línea
    .replace(/[\s\-–—]+/g, '')    // espacios, saltos y cualquier guion
    .replace(/[«»""]/g, '"')
    .replace(/['']/g, "'")
    .toLowerCase()
}

/** Una racha de enteros consecutivos a principio de línea así de larga ya es una lista de temas. */
const RACHA_TEMARIO = 10

/**
 * ¿Este documento PARECE un temario?
 *
 * **Sin esto la cola miente en cabeza.** Medido el 04/08 al estrenar el triaje: el primero de la
 * lista era `administrativo-estado` con «45 de 45 fuera de su fuente», y al abrir el documento
 * resultó ser el **Real Decreto de la Oferta de Empleo Público 2026** — un decreto de plazas, sin
 * un solo tema dentro. Nuestros epígrafes no tenían por qué estar ahí, así que ese 0/45 no decía
 * «parafraseamos»: decía «el `programa_url` no apunta a un temario». Son dos defectos distintos y
 * mezclarlos pone los enlaces rotos por delante de las paráfrasis reales, que es justo lo que la
 * cola existe para ordenar.
 *
 * La señal es la **racha de enteros consecutivos** a principio de línea (o «Tema N»): un programa
 * enumera 1, 2, 3… y una norma no. Se cuenta por racha y no por total porque un texto legal está
 * lleno de apartados numerados sueltos que no forman serie.
 */
function pareceTemario(texto) {
  const t = String(texto || '')
  const vistos = new Set()
  for (const m of t.matchAll(/^\s*(\d{1,2})\s*[.\-—)]/gm)) vistos.add(Number(m[1]))
  for (const m of t.matchAll(/\bTema\s+(\d{1,2})\b/gi)) vistos.add(Number(m[1]))
  let mejor = 0
  let racha = 0
  for (let n = 1; n <= 99; n++) {
    racha = vistos.has(n) ? racha + 1 : 0
    if (racha > mejor) mejor = racha
  }
  return { pareceTemario: mejor >= RACHA_TEMARIO, rachaMax: mejor }
}

/**
 * ¿Está este epígrafe dentro del documento?
 * @returns {'contenido'|'ausente'|'no_medible'}
 */
function estadoEpigrafe(epigrafe, fuentePlana) {
  const e = String(epigrafe || '').trim()
  if (e.length < MIN_LONGITUD) return 'no_medible'
  return fuentePlana.includes(aplanar(e)) ? 'contenido' : 'ausente'
}

/**
 * Mide una oposición entera.
 *
 * @param {object} o
 * @param {Array<{tema:(number|string), epigrafe:string}>} o.epigrafes
 * @param {string|null} o.texto  texto extraído del `programa_url` (null si no se pudo bajar)
 * @param {string} [o.motivoSinFuente]  por qué no hay texto ('download_error', 'html'…)
 * @returns {{veredicto:string, contenidos:number, ausentes:number, noMedibles:number,
 *            medibles:number, ratio:(number|null), detalle:Array, motivo:string}}
 */
function medirOposicion({ epigrafes, texto, motivoSinFuente } = {}) {
  const lista = Array.isArray(epigrafes) ? epigrafes : []
  const base = { contenidos: 0, ausentes: 0, noMedibles: 0, medibles: 0, ratio: null, detalle: [] }

  const limpio = texto ? limpiarRuidoDePagina(texto) : ''
  const plano = texto ? aplanar(limpio) : ''
  if (!texto || plano.length < MIN_FUENTE) {
    // Sin fuente utilizable no se afirma NADA de los epígrafes. Cubo propio.
    return {
      ...base,
      veredicto: 'sin_fuente',
      noMedibles: lista.length,
      motivo: motivoSinFuente
        ? `no se pudo leer el programa (${motivoSinFuente})`
        : `el programa_url devuelve ${plano.length} caracteres útiles: no es un temario`,
    }
  }

  // ¿Es siquiera un temario? Si no, no se juzgan los epígrafes: no tenían por qué estar ahí.
  const { pareceTemario: esTemario, rachaMax } = pareceTemario(limpio)
  if (!esTemario) {
    return {
      ...base,
      veredicto: 'fuente_no_es_temario',
      noMedibles: lista.length,
      rachaMax,
      motivo: `el programa_url apunta a un documento SIN lista de temas (racha máxima de enteros consecutivos: ${rachaMax}) — es deuda de ENLACE`,
    }
  }

  const detalle = []
  let contenidos = 0, ausentes = 0, noMedibles = 0
  for (const t of lista) {
    const estado = estadoEpigrafe(t.epigrafe, plano)
    if (estado === 'contenido') contenidos++
    else if (estado === 'ausente') ausentes++
    else noMedibles++
    detalle.push({ tema: t.tema, estado })
  }
  const medibles = contenidos + ausentes
  const ratio = medibles ? contenidos / medibles : null

  let veredicto
  if (!medibles) veredicto = 'sin_fuente'
  else if (ratio === 1) veredicto = 'literal'
  else if (ratio === 0) veredicto = 'parafraseado'
  else veredicto = 'parcial'

  return {
    veredicto, contenidos, ausentes, noMedibles, medibles, ratio, detalle,
    motivo: `${contenidos}/${medibles} epígrafes aparecen en el documento oficial`,
  }
}

/**
 * Ordena la cola: primero lo que MÁS se aleja de su fuente y más temas tiene en juego.
 * Las `sin_fuente` van al final — no son deuda de temario, son deuda de enlace, y mezclarlas
 * enterraría lo accionable debajo de lo que ni siquiera se ha podido mirar.
 */
function ordenarCola(filas) {
  const NO_ACCIONABLE = new Set(['sin_fuente', 'fuente_no_es_temario'])
  const peso = (f) => (NO_ACCIONABLE.has(f.veredicto) ? -1 : (1 - (f.ratio ?? 1)) * (f.medibles || 0))
  return [...(filas || [])].sort((a, b) => peso(b) - peso(a) || (b.medibles || 0) - (a.medibles || 0))
}

module.exports = { aplanar, limpiarRuidoDePagina, pareceTemario, estadoEpigrafe, medirOposicion, ordenarCola, MIN_LONGITUD, MIN_FUENTE, RACHA_TEMARIO }
