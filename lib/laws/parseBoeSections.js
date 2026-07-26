// Lógica PURA de parseo de la estructura de una ley del índice del BOE consolidado.
// Separada del script para poder testearla sin red ni BD. Ver
// scripts/poblar-law-sections-boe.cjs y reference_extraccion_boletines_oficiales.

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

const esArticulo = (id) => /^(?:a|art)\d/i.test(id)
// El nº de artículo se saca del LABEL ("Artículo 10"), NUNCA del id: el BOE desambigua
// ids repetidos con sufijo (a1-2 = artículo 10). Fiarse del id da rangos falsos.
const numDeLabel = (label) => { const m = String(label || '').match(/^Art(?:[íi]culo)?\.?\s+(\d+)/i); return m ? +m[1] : null }
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
  const hayTit = bloques.some((b) => RE_TIT.test(b.id))
  const tipo = hayTit ? 'titulo' : 'capitulo'
  const RE = hayTit ? RE_TIT : RE_CAP
  const secs = []
  let cur = null
  for (const b of bloques) {
    if (RE.test(b.id)) { cur = { blockId: b.id, num: numSeccionDeLabel(b.label) || numSeccion(b.id), arts: [] }; secs.push(cur) }
    else if (esArticulo(b.id) && cur) { const n = numDeLabel(b.label); if (n != null) cur.arts.push(n) }
  }
  const secciones = secs.filter((s) => s.arts.length).map((s) => ({ num: s.num, blockId: s.blockId, from: Math.min(...s.arts), to: Math.max(...s.arts) }))
  return { tipo, secciones }
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
  if (vacias.length / secs.length > umbral) {
    return { ok: false, motivo: `demasiadas_vacias(${vacias.length}/${secs.length})`, secs: [], vacias }
  }
  // El solape se mide SOLO entre las que se van a insertar.
  if (haySolape(vivas)) return { ok: false, motivo: 'solape', secs: [], vacias }
  return { ok: true, secs: vivas, vacias }
}

module.exports = { parseBoeSections, haySolape, validarSecciones, numDeLabel, numSeccion, RE_TIT, RE_CAP, esArticulo }
