// lib/api/admin-contenido/coverageBadge.ts
//
// Helper PURO (sin deps de servidor) para el badge de "cobertura de artículos"
// en /admin/contenido: artículos que están en el topic_scope con contenido real
// pero 0 preguntas activas (al usuario nunca le salen en tests aunque el tema en
// conjunto sí tenga preguntas — caso M/SMS Tema 7, 13/07). Vive aparte de
// queries.ts porque lo consumen query, UI y test.

export type CoverageTone = 'ok' | 'warn'

export interface CoverageCounts {
  arts_sin_preguntas: number
  temas_sin_cobertura: number
}

/**
 * Estado de cobertura de artículos de una oposición.
 *   - ok   (✓): 0 artículos con contenido sin preguntas.
 *   - warn (⚠): N artículos del temario en scope sin ninguna pregunta.
 */
export function coverageBadge(
  row: CoverageCounts,
): { tone: CoverageTone; label: string; title: string } {
  const n = row.arts_sin_preguntas || 0
  if (n === 0) {
    return { tone: 'ok', label: '✓', title: 'Todos los artículos del temario con contenido tienen preguntas' }
  }
  const temas = row.temas_sin_cobertura || 0
  return {
    tone: 'warn',
    label: `${n} ⚠`,
    title: `${n} artículo(s) del temario en ${temas} tema(s) con contenido pero SIN preguntas (invisibles en los tests)`,
  }
}

export const COVERAGE_TONE_CLS: Record<CoverageTone, string> = {
  ok: 'bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-300',
  warn: 'bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300',
}
