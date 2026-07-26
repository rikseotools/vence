// Núcleo PURO: árbol LIBRO › TÍTULO › CAPÍTULO › artículos de una ley del BOE consolidado.
//
// POR QUÉ EXISTE, Y POR QUÉ NO ESTÁ EN parseBoeSections
// -----------------------------------------------------
// `parseBoeSections` aplana la ley a UNA lista de secciones (títulos o capítulos) porque es lo
// que necesita `law_sections`, que es la estructura que se sirve en /leyes/<slug>. En las
// leyes-código —Código Civil, CP, LECrim, LOPJ, TFUE— los títulos REINICIAN por libro ("Libro I
// › Título I", "Libro II › Título I"), así que esa lista sale con números duplicados y la
// validación las RECHAZA a propósito (fail-safe). Modelar el libro allí obligaría a que la app
// maneje `section_type='libro'` (bucket del temario, PDF) → es la feature T-104, no un tweak.
//
// Pero para ADJUDICAR sobre-inclusión de scope hace falta justo lo contrario: saber a qué
// (libro, título, capítulo) pertenece cada artículo, sin tocar nada de la app. Eso es esto.
// Solo LEE. No escribe en BD ni en `law_sections`.
//
// LO QUE ESTE MÓDULO DA POR SENTADO, APRENDIDO A GOLPES (26/07/2026)
// ------------------------------------------------------------------
// 1. **Los ids del BOE mienten.** En la LECrim el artículo 1 tiene id `co` (no `a1`), y el id
//    `tx-3` corresponde al TÍTULO XIV. Por eso aquí se clasifica por LABEL, nunca por id.
// 2. **El índice REPITE secciones.** La Ley 42/2007 trae el Título II y el III dos veces (por
//    modificaciones sucesivas). Sin fusionar, los artículos de una misma sección quedan
//    repartidos entre nodos y el mapeo epígrafe→artículos sale corto.
// 3. **Las leyes antiguas numeran en LETRA** ("Artículo primero"): la conversión la hace
//    `numDeLabel` del núcleo compartido (T-140), no una regex propia.
// 4. Hay leyes con capítulos y sin títulos (RD 806/2014): se cuelgan de un título sintético
//    `'—'` para que el árbol tenga siempre la misma forma.

const { numDeLabel } = require('./parseBoeSections')

// Detección de ARTÍCULO **solo por label**, y esto diverge del núcleo compartido a propósito.
// `esArticulo(id,label)` exige además que el id empiece por "a"/"art" para no confundir el
// ANEXO (`an`), que también empieza por "a". Aquí esa guarda estorba: en la LECrim el artículo
// 1 tiene id `co` y se perdería —y con él su título entero—. El label es guarda suficiente
// porque el anexo se rotula "ANEXO", nunca "Artículo N".
const pareceArticulo = (label) => /^Art(?:[íi]culo)?\.?\s/i.test(String(label || ''))

const ORD = {
  primero: 'I', segundo: 'II', tercero: 'III', cuarto: 'IV', quinto: 'V', sexto: 'VI',
  septimo: 'VII', octavo: 'VIII', noveno: 'IX', decimo: 'X', undecimo: 'XI', duodecimo: 'XII',
  unico: 'Único', preliminar: 'Preliminar',
}
const norm = (s) => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')

/**
 * Clasifica el LABEL de un bloque como sección estructural.
 * @param {string} label  p.ej. "LIBRO II", "TÍTULO PRIMERO", "CAPÍTULO II BIS"
 * @returns {{tipo:'libro'|'titulo'|'capitulo'|'seccion', num:string}|null}
 */
function seccionDeLabel(label) {
  const m = /^(LIBRO|T[IÍ]TULO|CAP[IÍ]TULO|SECCI[OÓ]N)\s+([A-Za-zÁÉÍÓÚÑáéíóúñ]+)(\s+(?:bis|ter|qu[aá]ter))?\s*$/i
    .exec(String(label || '').trim())
  if (!m) return null
  const tok = norm(m[2])
  const num = ORD[tok] || (/^[ivxlcdm]+$/.test(tok) ? tok.toUpperCase() : null)
  if (!num) return null
  const t = norm(m[1])
  const tipo = t.startsWith('libro') ? 'libro' : t.startsWith('t') ? 'titulo' : t.startsWith('c') ? 'capitulo' : 'seccion'
  return { tipo, num: num + (m[3] ? ' ' + norm(m[3].trim()) : '') }
}

/** Etiqueta del artículo tal y como la nombra el BOE, conservando bis/ter/quáter y la letra final. */
function etiquetaArticulo(label) {
  const n = numDeLabel(label)
  if (n == null) return null
  const suf = (/\b(bis|ter|qu[aá]ter|quinquies|sexies|septies|octies|nonies|decies)\b/i.exec(String(label)) || [])[1]
  const letra = (/\b(?:bis|ter|qu[aá]ter|quinquies|sexies|septies|octies|nonies|decies)\s+([a-z])\b/i.exec(String(label)) || [])[1]
  return `${n}${suf ? ' ' + norm(suf) : ''}${letra ? ' ' + letra.toLowerCase() : ''}`
}

/**
 * Fusiona secciones repetidas (mismo número dentro del mismo padre).
 * El índice del BOE puede traer la misma sección en varios bloques tras sucesivas reformas.
 */
function fusionar(nodos, hijosKey) {
  const porNum = new Map()
  for (const n of nodos) {
    const prev = porNum.get(n.num)
    if (!prev) { porNum.set(n.num, n); continue }
    prev.arts.push(...n.arts)
    if (hijosKey) {
      for (const h of n[hijosKey]) {
        const ph = prev[hijosKey].find((x) => x.num === h.num)
        if (ph) ph.arts.push(...h.arts)
        else prev[hijosKey].push(h)
      }
    }
  }
  return [...porNum.values()]
}

/**
 * @param {{id:string,label:string}[]} bloques  índice del BOE consolidado, EN ORDEN
 * @returns {{num:string,id:string,titulos:{num:string,id:string,arts:object[],caps:object[]}[]}[]}
 *   Los artículos son `{et,n,id}`; `et` es la etiqueta del BOE ("367 bis"), `n` su número entero.
 *   Las leyes sin libros devuelven un único libro sintético con `num:'—'`.
 */
function construirArbol(bloques) {
  const arbol = []
  let libro = null, titulo = null, cap = null
  const nuevoLibro = (num, id) => { libro = { num, id, titulos: [] }; arbol.push(libro); titulo = null; cap = null; return libro }
  for (const b of bloques || []) {
    const s = seccionDeLabel(b.label)
    if (s && s.tipo === 'libro') { nuevoLibro(s.num, b.id); continue }
    if (s && s.tipo === 'titulo') {
      if (!libro) nuevoLibro('—', '-')
      titulo = { num: s.num, id: b.id, arts: [], caps: [] }
      libro.titulos.push(titulo); cap = null
      continue
    }
    if (s && s.tipo === 'capitulo') {
      if (!libro) nuevoLibro('—', '-')
      if (!titulo) { titulo = { num: '—', id: '-', arts: [], caps: [] }; libro.titulos.push(titulo) }
      cap = { num: s.num, id: b.id, arts: [] }
      titulo.caps.push(cap)
      continue
    }
    if (s) continue                                   // SECCIÓN: no cambia de contenedor
    if (!pareceArticulo(b.label)) continue
    const et = etiquetaArticulo(b.label)
    if (et == null) continue
    const art = { et, n: numDeLabel(b.label), id: b.id }
    if (cap) cap.arts.push(art)
    else if (titulo) titulo.arts.push(art)
  }
  for (const L of arbol) {
    L.titulos = fusionar(L.titulos, 'caps')
    for (const T of L.titulos) T.caps = fusionar(T.caps, null)
  }
  return fusionar(arbol, 'titulos')
}

/** Todos los artículos de un nodo (título con sus capítulos, o capítulo suelto). */
function articulosDe(nodo) {
  return [...(nodo.arts || []), ...((nodo.caps || []).flatMap((c) => c.arts || []))]
}

/**
 * ¿Es utilizable este árbol? Un árbol vacío o sin artículos NO significa "ley sin estructura":
 * suele significar que el índice no se descargó o que el parseo se desalineó, y tratarlo como
 * dato bueno haría recortar sobre la nada.
 * @returns {{ok:boolean, motivo:string, libros:number, titulos:number, articulos:number}}
 */
function resumenArbol(arbol) {
  const libros = (arbol || []).length
  const titulos = (arbol || []).reduce((s, L) => s + L.titulos.length, 0)
  const articulos = (arbol || []).reduce((s, L) => s + L.titulos.reduce((t, T) => t + articulosDe(T).length, 0), 0)
  if (!libros) return { ok: false, motivo: 'sin_bloques', libros, titulos, articulos }
  if (!articulos) return { ok: false, motivo: 'ninguna_seccion_con_articulos', libros, titulos, articulos }
  return { ok: true, motivo: 'utilizable', libros, titulos, articulos }
}

module.exports = { construirArbol, seccionDeLabel, etiquetaArticulo, articulosDe, resumenArbol }
