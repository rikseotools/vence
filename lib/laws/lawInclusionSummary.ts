// lib/laws/lawInclusionSummary.ts
//
// Núcleo PURO (sin React, sin red) que resume, para el configurador multi-ley, CÓMO
// entra cada ley seleccionada en el test: acotada a artículos elegidos, acotada a
// títulos, o ENTERA (todos sus artículos). Nace del feedback de Alfonso (25/07): pidió
// arts 32-36 de Ley 40/2015 y añadió Ley 39/2015 SIN acotar artículos → 39/2015 entró
// completa "en silencio" y percibió "preguntas fuera de lo seleccionado". El motor hacía
// lo correcto; lo que faltaba era HACER VISIBLE que una ley sin acotar entra entera y
// AVISAR del caso mixto (unas leyes acotadas + otras enteras) que inunda el test.
//
// Todo el juicio vive aquí para poder testearlo sin montar la UI (patrón del repo:
// scopeTitleBoundary, structuredExplanation, etc.).

export type LawInclusionMode = 'articles' | 'sections' | 'whole'

export interface LawStatLite {
  law_short_name: string
  display_name?: string | null
  /** Preguntas totales disponibles de la ley entera (pool si entra completa). */
  questions_count?: number | null
  articles_with_questions?: number | null
}

export interface LawInclusion {
  lawShortName: string
  displayName: string
  mode: LawInclusionMode
  /** nº de artículos o títulos elegidos (0 si entra entera). */
  narrowedCount: number
  /** preguntas del pool de la ley entera (referencia; el pool real acotado es menor). */
  wholeQuestionsCount: number
}

export interface LawInclusionSummary {
  perLaw: LawInclusion[]
  wholeLaws: string[]
  narrowedLaws: string[]
  /** ≥2 leyes seleccionadas, al menos una entera Y al menos una acotada → riesgo de
   *  "inundación" (caso Alfonso): la ley entera aporta muchas más preguntas y domina
   *  el muestreo aleatorio, y el usuario cree que "salen preguntas fuera". */
  mixedWholeAndNarrowed: boolean
  /** suma de preguntas de las leyes que entran ENTERAS (magnitud del flood potencial). */
  wholeQuestionsTotal: number
}

export interface SummarizeInput {
  /** law_short_name de las leyes seleccionadas. */
  selectedLaws: Iterable<string>
  /** law_short_name → set de artículos elegidos para esa ley. */
  selectedArticlesByLaw: Map<string, Set<string | number>> | Record<string, Array<string | number>>
  /** filtros de título/sección (solo aplican cuando hay UNA sola ley seleccionada). */
  selectedSectionFiltersCount: number
  /** catálogo de leyes (para nombre y pool de preguntas). */
  lawsData: LawStatLite[]
}

function articlesSetFor(
  src: SummarizeInput['selectedArticlesByLaw'],
  lawShortName: string,
): number {
  if (src instanceof Map) return src.get(lawShortName)?.size ?? 0
  const arr = (src as Record<string, Array<string | number>>)[lawShortName]
  return Array.isArray(arr) ? arr.length : 0
}

/**
 * Resume la inclusión por-ley de forma determinista. No muta las entradas.
 * Reglas (calcadas al comportamiento real de lib/api/filtered-questions/queries.ts):
 *  - Si la ley tiene artículos elegidos → mode='articles'.
 *  - Si NO tiene artículos, es la ÚNICA ley seleccionada y hay filtros de título → 'sections'.
 *    (los títulos solo se aplican con una única ley — ver TestConfigurator isOnlySelected.)
 *  - En cualquier otro caso → 'whole' (entra la ley completa).
 */
export function summarizeLawInclusion(input: SummarizeInput): LawInclusionSummary {
  const { selectedArticlesByLaw, selectedSectionFiltersCount, lawsData } = input
  const selected = Array.from(new Set(Array.from(input.selectedLaws)))
  const byName = new Map(lawsData.map(l => [l.law_short_name, l]))
  const isSingle = selected.length === 1

  const perLaw: LawInclusion[] = selected.map(name => {
    const law = byName.get(name)
    const nArticles = articlesSetFor(selectedArticlesByLaw, name)
    let mode: LawInclusionMode
    let narrowedCount: number
    if (nArticles > 0) {
      mode = 'articles'
      narrowedCount = nArticles
    } else if (isSingle && selectedSectionFiltersCount > 0) {
      mode = 'sections'
      narrowedCount = selectedSectionFiltersCount
    } else {
      mode = 'whole'
      narrowedCount = 0
    }
    return {
      lawShortName: name,
      displayName: law?.display_name || name,
      mode,
      narrowedCount,
      wholeQuestionsCount: Math.max(0, law?.questions_count ?? 0),
    }
  })

  const wholeLaws = perLaw.filter(l => l.mode === 'whole').map(l => l.lawShortName)
  const narrowedLaws = perLaw.filter(l => l.mode !== 'whole').map(l => l.lawShortName)
  const wholeQuestionsTotal = perLaw
    .filter(l => l.mode === 'whole')
    .reduce((s, l) => s + l.wholeQuestionsCount, 0)

  return {
    perLaw,
    wholeLaws,
    narrowedLaws,
    mixedWholeAndNarrowed:
      selected.length >= 2 && wholeLaws.length > 0 && narrowedLaws.length > 0,
    wholeQuestionsTotal,
  }
}

/** Etiqueta corta para el badge de cada ley (ES, incisos entre paréntesis). */
export function inclusionBadgeLabel(l: LawInclusion): string {
  if (l.mode === 'articles') {
    return `${l.narrowedCount} artículo${l.narrowedCount === 1 ? '' : 's'}`
  }
  if (l.mode === 'sections') {
    return `${l.narrowedCount} título${l.narrowedCount === 1 ? '' : 's'}`
  }
  return l.wholeQuestionsCount > 0
    ? `toda la ley (${l.wholeQuestionsCount} preg.)`
    : 'toda la ley'
}
