// Lógica PURA para pintar cabeceras de título/capítulo sobre los artículos que agrupan,
// en la teoría (/teoria/[law]). Petición repetida de Nila (feedback 26/05 y 15/07):
// "poner los títulos correspondientes… los artículos hacen referencia a los títulos".
// Separada del componente para poder testearla sin React.

export interface SectionLike {
  title: string
  articleRange: { start: number; end: number } | null
  sectionType: string | null
  sectionNumber: number | null
  orderPosition: number
}

/**
 * Dado el número de artículo (string, p.ej. "10", "10 bis") y las secciones de la ley,
 * devuelve la sección cuyo RANGO contiene ese artículo, o null si ninguna lo cubre
 * (artículos fuera de todo título, disposiciones, etc.).
 * Ante rangos que se solapasen (no debería, el poblador lo impide) gana el de rango
 * más pequeño y luego el de menor orderPosition — determinista.
 */
export function sectionForArticle(articleNumber: string, sections: SectionLike[]): SectionLike | null {
  const n = parseInt(String(articleNumber).match(/^\d+/)?.[0] ?? '', 10)
  if (!Number.isFinite(n)) return null
  const candidatas = sections.filter((s) => s.articleRange && n >= s.articleRange.start && n <= s.articleRange.end)
  if (!candidatas.length) return null
  return candidatas.sort((a, b) => {
    const wa = a.articleRange!.end - a.articleRange!.start
    const wb = b.articleRange!.end - b.articleRange!.start
    return wa - wb || a.orderPosition - b.orderPosition
  })[0]
}

/**
 * Recorre la lista de artículos EN ORDEN y marca cuáles ABREN una sección nueva (el
 * primero de su rango que aparece). El componente pinta la cabecera justo antes de ese
 * artículo. Devuelve un mapa articleId → sección-a-mostrar (o undefined si no abre nada).
 *
 * Robusto ante: artículos filtrados (si el filtro por título deja solo algunos, el
 * primero visible de cada sección sigue abriendo su cabecera), y artículos sin sección.
 */
export function sectionHeadersByArticle<T extends { id: string; article_number: string }>(
  articles: T[],
  sections: SectionLike[],
): Map<string, SectionLike> {
  const out = new Map<string, SectionLike>()
  let vistaSlug: string | null = null
  for (const a of articles) {
    const sec = sectionForArticle(a.article_number, sections)
    const key = sec ? `${sec.orderPosition}:${sec.title}` : null
    if (sec && key !== vistaSlug) { out.set(a.id, sec); vistaSlug = key }
    else if (!sec) { vistaSlug = null }
  }
  return out
}
