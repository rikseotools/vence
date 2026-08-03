// Lógica PURA de parseo de la estructura de una ley del índice del BOE consolidado.
// Separada del script para poder testearla sin red ni BD. Ver
// scripts/poblar-law-sections-boe.cjs y reference_extraccion_boletines_oficiales.

const { spanishTextToNumber } = require('./spanishNumber')

const ROMANO = { preliminar: 'Preliminar', primero: 'I', segundo: 'II', tercero: 'III', cuarto: 'IV', quinto: 'V', sexto: 'VI', septimo: 'VII', octavo: 'VIII', noveno: 'IX', decimo: 'X', undecimo: 'XI', duodecimo: 'XII', decimotercero: 'XIII', decimocuarto: 'XIV', decimoquinto: 'XV' }
// Detección del BLOQUE de sección por su id. Se admite un sufijo "-N" opcional
// porque el BOE consolidado desambigua ids repetidos con él: p.ej. la LOSU usa
// `tp`=Preliminar, `ti`=Título I, `ti-2`=Título II, `ti-3`=Título III… Sin el
// `(-\d+)?` (y sin `p`/`u`) esos títulos NO se reconocían y se colapsaban 11
// títulos en 3 rangos falsos (bug 24/07 LOSU: I:2-13, V:14-94, X:95-100).
const RE_TIT = /^t(p|u|preliminar|primero|segundo|tercero|cuarto|quinto|sexto|septimo|octavo|noveno|decimo|undecimo|duodecimo|decimotercero|decimocuarto|decimoquinto|[ivxlcdm]+)(-\d+)?$/i
const RE_CAP = /^c(p|u|preliminar|primero|segundo|tercero|cuarto|quinto|sexto|septimo|octavo|noveno|decimo|unico|[ivxlcdm]+)(-\d+)?$/i
// NOTA: el nivel LIBRO (leyes-código: CP, LEC, LECrim, Código Civil, con
// "Libro › Título › Capítulo") NO se modela aquí a propósito. Esas leyes se
// parsean por TÍTULO y, como los títulos REINICIAN por libro ("Libro I › Título
// I", "Libro II › Título I"), dan nº duplicados → `valida` las RECHAZA y se
// quedan con su estructura previa (fail-safe, 24/07). Soportar LIBRO exige NO
// solo el parser sino que la app maneje section_type='libro' (lib/api/temario/
// queries.ts bucket + PDF) y tratar el Título Preliminar pre-libro → feature
// acotada, no un tweak. Ver docs/roadmap/tareas-pendientes.md.

// ¿Es este bloque un ARTÍCULO? Se decide por el LABEL, con el id solo como guarda.
//
// GOTCHA (26/07/2026, T-140): el BOE numera los artículos de las leyes ANTIGUAS en LETRA,
// y eso alcanza al id Y al label: `aprimero` → "Artículo primero" (LOTC, Ley 16/1985),
// `auno` → "Artículo uno" (Ley General de Sanidad). Exigir `^a\d` en el id dejaba fuera la
// ley ENTERA: ningún artículo se asignaba a su sección, TODAS las secciones quedaban vacías
// y el poblador la rechazaba como `sin_secciones` — aunque su índice del BOE tuviera los
// títulos y capítulos perfectamente marcados. Medido: LOTC 106 artículos, LGS 127, Ley
// 16/1985 79, y ni uno reconocido.
//
// Es EXACTAMENTE el mismo defecto que T-132 arregló en `mapaBloquesPorArticulo`
// (lib/laws/boeBloqueVigente.js) y que aquí no se había propagado: dos parsers del mismo
// índice del BOE, la misma trampa, arreglada solo en uno.
//
// La guarda por id sigue haciendo falta para no confundir el ANEXO (`an`), que también
// empieza por "a" pero cuyo label no empieza por "Artículo".
const esArticulo = (id, label) => /^(?:a|art)/i.test(id) && /^Art(?:[íi]culo)?\.?\s/i.test(String(label || ''))
// El nº de artículo se saca del LABEL ("Artículo 10"), NUNCA del id: el BOE desambigua
// ids repetidos con sufijo (a1-2 = artículo 10). Fiarse del id da rangos falsos.
const numDeLabel = (label) => {
  const L = String(label || '')
  // Dígitos primero, con el prefijo laxo de siempre para no perder "Artículo 10 bis" → 10.
  const d = L.match(/^Art(?:[íi]culo)?\.?\s+(\d+)/i)
  if (d) return +d[1]
  // En letra: se reutiliza `spanishTextToNumber`, el conversor que ya usa el otro parser.
  const t = L.match(/^Art(?:[íi]culo)?\.?\s+(.+?)\s*\.?$/i)
  if (!t) return null
  const n = spanishTextToNumber(t[1].trim())
  return n && /^\d+$/.test(n) ? +n : null
}
// EXACTAMENTE el mismo principio para el nº de SECCIÓN: sale del LABEL
// ("TÍTULO PRELIMINAR", "TÍTULO II"), NO del id — porque el id `ti-2` daría "I-2".
const numSeccionDeLabel = (label) => {
  const m = String(label || '').match(/^\s*(?:CAP[IÍ]TULO|T[IÍ]TULO|LIBRO|PARTE)\s+([A-Za-zÁÉÍÓÚÑáéíóúñ]+)/)
  if (!m) return null
  const tok = m[1].toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
  if (ROMANO[tok]) return ROMANO[tok]              // preliminar→Preliminar, primero→I…
  if (/^[ivxlcdm]+$/.test(tok)) return tok.toUpperCase()  // romano "II", "IX"…
  if (tok === 'unico') return 'Único'
  return null
}
// Fallback (label ausente/atípico): nº desde el id, ignorando el sufijo "-N".
const numSeccion = (id) => { const suf = id.slice(1).toLowerCase().replace(/-\d+$/, ''); return ROMANO[suf] || suf.toUpperCase() }

/**
 * @param {{id:string,label:string}[]} bloques  índice del BOE en orden
 * @returns {{tipo:'titulo'|'capitulo', secciones:{num,from,to,blockId}[]}}
 * Usa TÍTULO si la ley tiene títulos, si no CAPÍTULO. Cada artículo se asigna a la
 * sección precedente más cercana (maneja anidamiento). Secciones sin artículos se caen.
 */
function parseBoeSections(bloques) {
  const { niveles } = parseBoeSectionsMultinivel(bloques)
  // Back-compat EXACTA: el nivel más externo que exista (título si lo hay, si no capítulo),
  // y `capitulo` vacío cuando la ley no tiene ninguno de los dos.
  const n = niveles[0] || { tipo: 'capitulo', secciones: [] }
  return { tipo: n.tipo, secciones: n.secciones }
}

/** Extrae UN nivel (el que marque `RE`) recorriendo el índice una vez. */
function parseNivel(bloques, RE) {
  const secs = []
  let cur = null
  for (const b of bloques) {
    if (RE.test(b.id)) { cur = { blockId: b.id, num: numSeccionDeLabel(b.label) || numSeccion(b.id), arts: [] }; secs.push(cur) }
    else if (esArticulo(b.id, b.label) && cur) { const n = numDeLabel(b.label); if (n != null) cur.arts.push(n) }
  }
  return secs.filter((s) => s.arts.length)
    .map((s) => ({ num: s.num, blockId: s.blockId, from: Math.min(...s.arts), to: Math.max(...s.arts) }))
}

/**
 * TODOS los niveles de estructura que tenga la ley, no solo el más externo.
 *
 * ── POR QUÉ EXISTE (T-510, 03/08/2026) ──────────────────────────────────────────────────────
 *
 * `parseBoeSections` decidía con un `hayTit ? 'titulo' : 'capitulo'`: **un solo nivel por ley**.
 * Consecuencia medida sobre el catálogo vivo: **234 leyes con títulos y CERO capítulos**, 89 con
 * capítulos y cero títulos, y **ninguna con los dos**. No era un fallo de leyes raras — era el
 * diseño. Y le tocaba a las más estudiadas: CE (4.607 preguntas servidas), Ley 39/2015 (3.088),
 * LECrim, CP, LOPJ, Código Civil, TREBEP… todas sin un solo capítulo, así que dentro de un título
 * largo el opositor no tiene por dónde orientarse. Lo pidió una usuaria premium (feedback
 * `2f904b99`): *«que leyes como la 39 especifique títulos, capítulos y en general la estructura»*.
 *
 * ── LA TRAMPA, y es la razón de que esto sea una función aparte ──────────────────────────────
 *
 * **El solape se valida POR NIVEL, jamás entre niveles.** Un capítulo vive DENTRO de un título, así
 * que sus rangos se pisan por definición: pasarle a `validarSecciones` los dos niveles juntos haría
 * saltar `motivo: 'solape'` en todas y cada una de las leyes, y el guardarraíl que existe para no
 * meter basura acabaría rechazando precisamente lo correcto. Cada nivel se valida y se inserta
 * como una serie independiente.
 *
 * @param {{id:string,label:string}[]} bloques  índice del BOE en orden
 * @returns {{niveles:{tipo:'titulo'|'capitulo', secciones:{num,from,to,blockId}[]}[]}}
 *   De fuera hacia dentro (título antes que capítulo). Sin niveles → array vacío.
 */
function parseBoeSectionsMultinivel(bloques) {
  const niveles = []
  for (const [tipo, RE] of [['titulo', RE_TIT], ['capitulo', RE_CAP]]) {
    const secciones = parseNivel(bloques, RE)
    if (secciones.length) niveles.push({ tipo, secciones })
  }
  return { niveles }
}

/** ¿Los rangos solapan entre sí? (invariante que debe cumplir toda ley aceptada) */
function haySolape(secciones) {
  for (let i = 0; i < secciones.length; i++) for (let j = i + 1; j < secciones.length; j++) if (secciones[i].from <= secciones[j].to && secciones[j].from <= secciones[i].to) return true
  return false
}


/**
 * Valida las secciones de una ley contra el número REAL de artículos que hay en cada rango.
 *
 * @param {{num:string,from:number,to:number,blockId?:string,arts:number}[]} secs
 *   `arts` = cuántos artículos existen de verdad en ese rango (lo cuenta el llamante).
 * @param {{umbralVacias?:number}} [opts]
 * @returns {{ok:boolean, motivo?:string, secs:object[], vacias:object[]}}
 *
 * POR QUÉ UNA SECCIÓN VACÍA YA NO TUMBA LA LEY (26/07/2026, T-064). El criterio original
 * rechazaba la ley entera si UNA sola sección no tenía artículos. La causa habitual no es
 * un parser desalineado: es que **esos artículos están derogados**. El Código Civil se
 * rechazaba por `rango_vacio(XI:314-324)` —arts. suprimidos por la Ley 8/2021, la reforma
 * de la discapacidad— y por esa única sección se perdían las **otras 45**, dejando la ley
 * más navegada del corpus (1.911 artículos) como una lista plana.
 *
 * Ahora la sección vacía se DESCARTA y la ley se acepta con el resto. Pero se conserva la
 * intención protectora del criterio original con un umbral: si más del 30 % de las
 * secciones salen vacías, eso ya no es derogación, es desalineación → se rechaza la ley
 * entera, que es justo lo que evita meter basura.
 */
function validarSecciones(secs, opts) {
  const umbral = (opts && opts.umbralVacias) != null ? opts.umbralVacias : 0.3
  if (!secs.length) return { ok: false, motivo: 'sin_secciones', secs: [], vacias: [] }

  const vacias = secs.filter((s) => !s.arts)
  const vivas = secs.filter((s) => s.arts > 0)
  if (!vivas.length) return { ok: false, motivo: 'ninguna_seccion_con_articulos', secs: [], vacias }
  // UNA sección vacía se tolera siempre, aunque supere el porcentaje (30/07/2026).
  //
  // El umbral relativo es demasiado sensible cuando la ley tiene pocas secciones: con 3,
  // una sola vacía ya da 33 % y tumba la ley entera. Y una vacía suele ser una derogación,
  // que es exactamente lo que este criterio nació para tolerar. Caso real: el RD 208/1996
  // (servicios de información administrativa y atención al ciudadano, en 12 oposiciones)
  // se rechazaba por `demasiadas_vacias(1/3)` porque su capítulo III —el Libro de Quejas y
  // Sugerencias— está DEROGADO entero; con él se perdían los capítulos I y II, que están
  // perfectos.
  //
  // Simulado antes de tocarlo sobre las 60 leyes candidatas más servidas: cambia el
  // veredicto de UNA (ese RD, que pasa a aceptar sus 2 capítulos sin solape) y deja las
  // otras 59 igual. Se conservan intactas las demás guardas —en especial el solape, que es
  // lo que de verdad mete basura— porque una versión anterior de esa simulación se lo dejó
  // fuera y "aceptaba" leyes con rangos pisándose.
  if (vacias.length > 1 && vacias.length / secs.length > umbral) {
    return { ok: false, motivo: `demasiadas_vacias(${vacias.length}/${secs.length})`, secs: [], vacias }
  }
  // Con una sola sección viva no hay nada que filtrar: el configurador exige >=2 para
  // enseñar el botón de títulos, así que insertarla sería ruido en la base de datos.
  if (vivas.length < 2) return { ok: false, motivo: 'menos_de_2_secciones_vivas', secs: [], vacias }
  // El solape se mide SOLO entre las que se van a insertar.
  if (haySolape(vivas)) return { ok: false, motivo: 'solape', secs: [], vacias }
  return { ok: true, secs: vivas, vacias }
}

/**
 * Rúbrica (materia) VIGENTE de un bloque de sección del BOE consolidado.
 *
 * @param {string} xml  respuesta completa de .../texto/bloque/<id>
 * @param {string|number} [hoy]  fecha de corte YYYYMMDD (por defecto, hoy)
 * @returns {{rubrica:string, fechaVigencia:string|null}|null}
 *
 * POR QUÉ ESTO NO ES UN `match` DE UNA LÍNEA (26/07/2026). Un bloque del BOE trae
 * TODAS sus versiones históricas, **de la más antigua a la vigente**, cada una en su
 * `<version fecha_vigencia="YYYYMMDD">`. Coger el primer match devuelve la rúbrica
 * DEROGADA. Caso real, LECrim Libro II Título VIII:
 *   1997 → "De la entrada y registro en lugar cerrado, del de libros y papeles…"
 *   2015 → "De las medidas de investigación limitativas de los derechos
 *           reconocidos en el artículo 18 de la Constitución"   ← la vigente
 * El epígrafe de `guardia_civil` T9 cita la de 2015. Comparar contra la de 1997 hace
 * que la exención por materia NO salte y el título salga como falso positivo — o
 * peor, que se recorte del scope un bloque que el epígrafe sí pide.
 *
 * Se lee del `<p class="…_tit">`, NO del cuerpo aplanado: buscar "TÍTULO X." sobre el
 * texto plano puede engancharse a una cita cruzada dentro de un artículo.
 * Si la versión vigente no lleva rúbrica (p.ej. una modificación que solo toca el
 * cuerpo), se cae a la más reciente que sí la tenga.
 */
function rubricaVigente(xml, hoy) {
  const corte = String(hoy || new Date().toISOString().slice(0, 10).replace(/-/g, ''))
  const versiones = [...String(xml || '').matchAll(/<version\b([^>]*)>([\s\S]*?)<\/version>/g)].map((m) => ({
    fecha: (/fecha_vigencia="(\d{8})"/.exec(m[1]) || [])[1] || null,
    cuerpo: m[2],
  }))
  // Sin <version> (XML atípico o ya recortado): se trata el todo como una sola versión.
  const cand = (versiones.length ? versiones : [{ fecha: null, cuerpo: String(xml || '') }])
    .filter((v) => !v.fecha || v.fecha <= corte)
    .sort((a, b) => String(a.fecha || '').localeCompare(String(b.fecha || '')))
  for (let i = cand.length - 1; i >= 0; i--) {
    const m = /<p class="(?:titulo_tit|capitulo_tit|libro_tit|parte_tit|seccion_tit)">([\s\S]*?)<\/p>/.exec(cand[i].cuerpo)
    if (!m) continue
    const rubrica = m[1].replace(/<[^>]+>/g, ' ').replace(/&[a-z]+;/gi, ' ').replace(/\s+/g, ' ').trim().replace(/\.$/, '')
    if (rubrica) return { rubrica, fechaVigencia: cand[i].fecha }
  }
  return null
}

module.exports = {
  parseBoeSectionsMultinivel, parseBoeSections, haySolape, validarSecciones, numDeLabel, numSeccion, rubricaVigente, RE_TIT, RE_CAP, esArticulo }
