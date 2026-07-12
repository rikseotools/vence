// Guardarrail de activeConfigFeatures — la medición de uso de features del configurador
// (para decidir qué gatear). Función pura: se testea exhaustiva sin React/IO.
import { activeConfigFeatures, MEASURED_CONFIG_FEATURES } from '@/lib/premium/configFeatures'

describe('activeConfigFeatures — features activas por config', () => {
  it('config vacía → ninguna feature (no emite ruido)', () => {
    expect(activeConfigFeatures({})).toEqual([])
    expect(activeConfigFeatures({ difficultyMode: 'random' })).toEqual([])
  })

  it('detecta cada toggle avanzado', () => {
    expect(activeConfigFeatures({ excludeRecent: true })).toContain('exclude_recent')
    expect(activeConfigFeatures({ onlyOfficialQuestions: true })).toContain('only_official')
    expect(activeConfigFeatures({ focusEssentialArticles: true })).toContain('essential_articles')
    expect(activeConfigFeatures({ onlyFailedQuestions: true })).toContain('only_failed')
    expect(activeConfigFeatures({ adaptiveMode: true })).toContain('adaptive_weak_areas')
  })

  it('difficulty_custom solo si la dificultad NO es random', () => {
    expect(activeConfigFeatures({ difficultyMode: 'hard' })).toContain('difficulty_custom')
    expect(activeConfigFeatures({ difficultyMode: 'random' })).not.toContain('difficulty_custom')
  })

  it('filtros de leyes/artículos/secciones solo si tienen elementos', () => {
    expect(activeConfigFeatures({ selectedLaws: ['CE'] })).toContain('law_filter')
    expect(activeConfigFeatures({ selectedLaws: [] })).not.toContain('law_filter')
    expect(activeConfigFeatures({ selectedArticlesByLaw: { CE: [1] } })).toContain('article_filter')
    expect(activeConfigFeatures({ selectedArticlesByLaw: {} })).not.toContain('article_filter')
    expect(activeConfigFeatures({ selectedSectionFilters: [{ title: 'T' }] })).toContain('section_filter')
    expect(activeConfigFeatures({ selectedSectionFilters: [] })).not.toContain('section_filter')
  })

  it('combina varias features a la vez', () => {
    const f = activeConfigFeatures({ excludeRecent: true, onlyFailedQuestions: true, adaptiveMode: true })
    expect(f).toEqual(expect.arrayContaining(['exclude_recent', 'only_failed', 'adaptive_weak_areas']))
    expect(f).toHaveLength(3)
  })

  it('todo id devuelto está en la lista canónica MEASURED_CONFIG_FEATURES', () => {
    const all = activeConfigFeatures({
      excludeRecent: true, onlyOfficialQuestions: true, focusEssentialArticles: true,
      onlyFailedQuestions: true, adaptiveMode: true, difficultyMode: 'hard',
      selectedLaws: ['CE'], selectedArticlesByLaw: { CE: [1] }, selectedSectionFilters: [{ t: 1 }],
    })
    for (const id of all) expect(MEASURED_CONFIG_FEATURES).toContain(id)
    // cubre TODAS las medibles
    expect(all.length).toBe(MEASURED_CONFIG_FEATURES.length)
  })
})
