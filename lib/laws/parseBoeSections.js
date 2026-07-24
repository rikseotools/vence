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

module.exports = { parseBoeSections, haySolape, numDeLabel, numSeccion, RE_TIT, RE_CAP, esArticulo }
