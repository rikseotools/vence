// components/test/hubSorting.ts
//
// Ordenación de temas del hub de tests según el botón pulsado por el usuario
// ("Por Tema", "% Más Bajo", "% Más Alto", "Más Reciente", "Más Antiguo").
//
// Función pura (sin React ni BD) — fácil de testear. Reglas:
//   - Empate → desempate determinista por `topicNumber` ASC.
//   - Temas SIN practicar (sin stats o `total === 0`) van al final, salvo
//     en modo "tema" donde se respeta el orden numérico siempre.
//   - 'last_study_*' usa lastStudy.getTime(); nunca-estudiados (0) al final.

export type SortOption =
  | 'tema'
  | 'accuracy_asc'
  | 'accuracy_desc'
  | 'last_study_new'
  | 'last_study_old'

export interface SortableTopic {
  topicNumber: number
}

export interface SortableStats {
  total: number
  accuracy: number
  lastStudy: Date | null
}

export function sortTopics<T extends SortableTopic>(
  topics: T[],
  sortBy: SortOption,
  stats: Record<number, SortableStats>,
): T[] {
  if (sortBy === 'tema') {
    return [...topics].sort((a, b) => a.topicNumber - b.topicNumber)
  }

  return [...topics].sort((a, b) => {
    const sa = stats[a.topicNumber]
    const sb = stats[b.topicNumber]
    const aHas = !!sa && sa.total > 0
    const bHas = !!sb && sb.total > 0

    if (sortBy === 'accuracy_asc' || sortBy === 'accuracy_desc') {
      if (!aHas && !bHas) return a.topicNumber - b.topicNumber
      if (!aHas) return 1
      if (!bHas) return -1
      const diff =
        sortBy === 'accuracy_asc' ? sa.accuracy - sb.accuracy : sb.accuracy - sa.accuracy
      return diff !== 0 ? diff : a.topicNumber - b.topicNumber
    }

    if (sortBy === 'last_study_new' || sortBy === 'last_study_old') {
      const ta = sa?.lastStudy?.getTime() ?? 0
      const tb = sb?.lastStudy?.getTime() ?? 0
      if (ta === 0 && tb === 0) return a.topicNumber - b.topicNumber
      if (ta === 0) return 1
      if (tb === 0) return -1
      const diff = sortBy === 'last_study_new' ? tb - ta : ta - tb
      return diff !== 0 ? diff : a.topicNumber - b.topicNumber
    }

    return a.topicNumber - b.topicNumber
  })
}
