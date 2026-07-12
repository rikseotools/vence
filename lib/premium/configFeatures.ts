// lib/premium/configFeatures.ts — qué features AVANZADAS del configurador están activas
// en una config de test. Sirve para MEDIR el uso real por feature × plan (free vs premium)
// y así decidir con datos qué gatear: "los free usan mucho X" = candidata a premium.
//
// El conjunto medido es SUPERSET del registro de premium (lib/premium/features.ts): incluye
// features AÚN NO gateadas que estamos evaluando. Ids estables (clave de analítica).
// Función PURA (testeable, sin React/IO). Se emite 1 vez al crear el test (client-side, tiene
// el plan sin coste de BD). Ver docs/runbooks/premium-gating.md + vista v_config_feature_usage.

export interface TestConfigFlags {
  excludeRecent?: boolean
  onlyOfficialQuestions?: boolean
  focusEssentialArticles?: boolean
  onlyFailedQuestions?: boolean
  adaptiveMode?: boolean
  difficultyMode?: string | null
  selectedLaws?: unknown[]
  selectedArticlesByLaw?: Record<string, unknown[]> | null
  selectedSectionFilters?: unknown[]
}

/** Ids de features avanzadas del configurador que medimos (estables). */
export const MEASURED_CONFIG_FEATURES = [
  'exclude_recent',
  'only_official',
  'essential_articles',
  'only_failed',
  'adaptive_weak_areas',
  'difficulty_custom',
  'law_filter',
  'article_filter',
  'section_filter',
] as const

export type MeasuredConfigFeature = (typeof MEASURED_CONFIG_FEATURES)[number]

/** Lista las features avanzadas ACTIVAS en una config (para medir uso real). */
export function activeConfigFeatures(c: TestConfigFlags): MeasuredConfigFeature[] {
  const out: MeasuredConfigFeature[] = []
  if (c.excludeRecent) out.push('exclude_recent')
  if (c.onlyOfficialQuestions) out.push('only_official')
  if (c.focusEssentialArticles) out.push('essential_articles')
  if (c.onlyFailedQuestions) out.push('only_failed')
  if (c.adaptiveMode) out.push('adaptive_weak_areas')
  // Dificultad distinta de 'random' = el usuario eligió un nivel concreto.
  if (c.difficultyMode && c.difficultyMode !== 'random') out.push('difficulty_custom')
  if (Array.isArray(c.selectedLaws) && c.selectedLaws.length > 0) out.push('law_filter')
  if (c.selectedArticlesByLaw && Object.keys(c.selectedArticlesByLaw).length > 0) out.push('article_filter')
  if (Array.isArray(c.selectedSectionFilters) && c.selectedSectionFilters.length > 0) out.push('section_filter')
  return out
}
