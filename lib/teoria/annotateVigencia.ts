// lib/teoria/annotateVigencia.ts
//
// CAPA 2 de T-048: mostrar la vigencia como la muestra el BOE.
//
// La capa 1 ya captura en `articles.vigencia_notes` el inciso que el TC anuló y su nota al pie.
// Pero mientras no se pinte, el opositor sigue leyendo el inciso muerto como si estuviera vigente
// — que es exactamente el incidente del art. 126.2 LBRL / STC 103/2013.
//
// Aquí NO se toca el dato: `content` sigue intacto en BD (las explicaciones lo citan verbatim).
// Esto es una transformación de DISPLAY que se aplica al vuelo antes de renderizar.
//
// Además de correcto es pedagógicamente mejor: al opositor le interesa saber que un inciso está
// anulado, porque puede caer en el examen y porque explica por qué la respuesta "obvia" no lo es.

export interface VigenciaNoteLike {
  texto: string
  ref?: string | null
  esAnulacion?: boolean
}

export interface VigenciaData {
  notes?: VigenciaNoteLike[] | null
  annulledFragments?: string[] | null
}

/** Escapa los caracteres especiales de regex de un literal. */
function escapeRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/**
 * Normaliza para BUSCAR: el fragmento capturado del BOE y el texto guardado pueden diferir en
 * espacios o saltos (el import reflowea). Se compara con espacios colapsados.
 */
function flexibleRe(fragment: string): RegExp {
  const parts = fragment.trim().split(/\s+/).map(escapeRe)
  return new RegExp(parts.join('\\s+'), 'i')
}

/**
 * Marca en el texto los incisos anulados (tachado + aviso) y añade las notas de vigencia al final.
 *
 * - Si el fragmento NO se encuentra en el texto (redacción distinta, import reflowado), **no se
 *   inventa nada**: no se tacha, pero la nota SÍ se muestra. Es preferible avisar de más que
 *   tachar el trozo equivocado.
 * - Si no hay datos de vigencia, devuelve el texto tal cual (coste cero en el 99% de artículos).
 */
export function annotateVigencia(
  text: string | null | undefined,
  vigencia: VigenciaData | null | undefined,
): string {
  const base = text ?? ''
  if (!vigencia) return base

  const notes = (vigencia.notes ?? []).filter((n) => n && n.texto)
  const anuladas = notes.filter((n) => n.esAnulacion)
  const fragments = (vigencia.annulledFragments ?? []).filter(Boolean)
  if (!notes.length && !fragments.length) return base

  let out = base

  // 1) Tachar cada inciso anulado, in situ, con un aviso pegado.
  for (const frag of fragments) {
    const re = flexibleRe(frag)
    const m = out.match(re)
    if (!m) continue // no está: no se toca nada (ver doc arriba)
    out = out.replace(
      re,
      `~~${m[0]}~~ **⚠️ [inciso declarado inconstitucional y nulo — sin vigencia]**`,
    )
  }

  // 2) Notas al pie, como en el BOE. Las de anulación primero: son las que cambian la respuesta.
  const orden = [...anuladas, ...notes.filter((n) => !n.esAnulacion)]
  const lineas = orden.map((n) => {
    const ref = n.ref ? ` (${n.ref})` : ''
    return `> ${n.esAnulacion ? '⚠️ ' : ''}${n.texto}${ref}`
  })

  return `${out}\n\n---\n\n**Notas de vigencia (BOE):**\n\n${lineas.join('\n>\n')}`
}

/** ¿Hay que avisar al usuario de que este artículo sirve texto sin vigencia? */
export function tieneIncisoAnulado(vigencia: VigenciaData | null | undefined): boolean {
  return Boolean(vigencia?.notes?.some((n) => n?.esAnulacion))
}
