import { buildTestUrl } from '@/lib/test-url/buildTestUrl'
import type { TestStartConfig } from '@/components/TestConfigurator.types'

function makeBaseConfig(overrides: Partial<TestStartConfig> = {}): TestStartConfig {
  return {
    numQuestions: 20,
    difficultyMode: 'random',
    onlyOfficialQuestions: false,
    focusEssentialArticles: false,
    excludeRecent: false,
    recentDays: 15,
    focusWeakAreas: false,
    adaptiveMode: false,
    onlyFailedQuestions: false,
    selectedLaws: [],
    selectedArticlesByLaw: {},
    selectedSectionFilters: [],
    timeLimit: null,
    configSource: 'test',
    configTimestamp: new Date().toISOString(),
    ...overrides,
  }
}

function getParams(url: string): URLSearchParams {
  return new URLSearchParams(url.split('?')[1])
}

describe('buildTestUrl', () => {
  describe('URL path', () => {
    it('genera path correcto para modo practica', () => {
      const url = buildTestUrl({
        basePath: '/auxiliar-administrativo-baleares',
        temaNumber: 5,
        testMode: 'practica',
        config: makeBaseConfig(),
      })
      expect(url).toMatch(/^\/auxiliar-administrativo-baleares\/test\/tema\/5\/test-personalizado\?/)
    })

    it('genera path correcto para modo examen', () => {
      const url = buildTestUrl({
        basePath: '/tramitacion-procesal',
        temaNumber: 13,
        testMode: 'examen',
        config: makeBaseConfig(),
      })
      expect(url).toMatch(/^\/tramitacion-procesal\/test\/tema\/13\/test-examen\?/)
    })

    it.each([
      '/auxiliar-administrativo-estado',
      '/auxiliar-administrativo-madrid',
      '/auxiliar-administrativo-andalucia',
      '/auxiliar-administrativo-aragon',
      '/auxiliar-administrativo-asturias',
      '/auxiliar-administrativo-baleares',
      '/auxiliar-administrativo-canarias',
      '/auxiliar-administrativo-carm',
      '/auxiliar-administrativo-clm',
      '/auxiliar-administrativo-cyl',
      '/auxiliar-administrativo-extremadura',
      '/auxiliar-administrativo-galicia',
      '/auxiliar-administrativo-valencia',
      '/tramitacion-procesal',
      '/auxilio-judicial',
      '/administrativo-estado',
    ])('genera URL correcta para basePath %s', (basePath) => {
      const url = buildTestUrl({
        basePath,
        temaNumber: 1,
        testMode: 'practica',
        config: makeBaseConfig(),
      })
      expect(url).toMatch(new RegExp(`^${basePath.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}/test/tema/1/test-personalizado\\?`))
    })
  })

  describe('parametros basicos', () => {
    it('incluye los 4 parametros obligatorios', () => {
      const url = buildTestUrl({
        basePath: '/test',
        temaNumber: 1,
        testMode: 'practica',
        config: makeBaseConfig({ numQuestions: 30, difficultyMode: 'hard', excludeRecent: true, recentDays: 7 }),
      })
      const params = getParams(url)
      expect(params.get('n')).toBe('30')
      expect(params.get('difficulty_mode')).toBe('hard')
      expect(params.get('exclude_recent')).toBe('true')
      expect(params.get('recent_days')).toBe('7')
    })
  })

  describe('booleanos opcionales', () => {
    it('NO incluye booleanos cuando son false', () => {
      const url = buildTestUrl({
        basePath: '/test',
        temaNumber: 1,
        testMode: 'practica',
        config: makeBaseConfig(),
      })
      expect(url).not.toContain('only_official')
      expect(url).not.toContain('focus_essential')
      expect(url).not.toContain('focus_weak')
      expect(url).not.toContain('adaptive')
      expect(url).not.toContain('only_failed')
      expect(url).not.toContain('time_limit')
    })

    it('incluye booleanos cuando son true', () => {
      const url = buildTestUrl({
        basePath: '/test',
        temaNumber: 1,
        testMode: 'practica',
        config: makeBaseConfig({
          onlyOfficialQuestions: true,
          focusEssentialArticles: true,
          focusWeakAreas: true,
          adaptiveMode: true,
          onlyFailedQuestions: true,
          timeLimit: 30,
        }),
      })
      const params = getParams(url)
      expect(params.get('only_official')).toBe('true')
      expect(params.get('focus_essential')).toBe('true')
      expect(params.get('focus_weak')).toBe('true')
      expect(params.get('adaptive')).toBe('true')
      expect(params.get('only_failed')).toBe('true')
      expect(params.get('time_limit')).toBe('30')
    })
  })

  describe('selectedLaws', () => {
    it('NO incluye selected_laws cuando el array esta vacio', () => {
      const url = buildTestUrl({
        basePath: '/test',
        temaNumber: 1,
        testMode: 'practica',
        config: makeBaseConfig({ selectedLaws: [] }),
      })
      expect(url).not.toContain('selected_laws')
    })

    it('incluye selected_laws como JSON', () => {
      const url = buildTestUrl({
        basePath: '/test',
        temaNumber: 1,
        testMode: 'practica',
        config: makeBaseConfig({ selectedLaws: ['Constitución Española', 'Ley 39/2015'] }),
      })
      const params = getParams(url)
      const parsed = JSON.parse(params.get('selected_laws')!)
      expect(parsed).toEqual(['Constitución Española', 'Ley 39/2015'])
    })
  })

  describe('selectedArticlesByLaw (filtro que estaba roto en 14 paginas)', () => {
    it('NO incluye selected_articles_by_law cuando el objeto esta vacio', () => {
      const url = buildTestUrl({
        basePath: '/test',
        temaNumber: 1,
        testMode: 'practica',
        config: makeBaseConfig({ selectedArticlesByLaw: {} }),
      })
      expect(url).not.toContain('selected_articles_by_law')
    })

    it('incluye selected_articles_by_law como JSON con articulos por ley', () => {
      const selectedArticlesByLaw = {
        'Constitución Española': [1, 14, 23],
        'Ley 39/2015': ['103', '105'],
      }
      const url = buildTestUrl({
        basePath: '/auxiliar-administrativo-galicia',
        temaNumber: 7,
        testMode: 'practica',
        config: makeBaseConfig({
          selectedLaws: ['Constitución Española', 'Ley 39/2015'],
          selectedArticlesByLaw,
        }),
      })
      const params = getParams(url)
      const parsed = JSON.parse(params.get('selected_articles_by_law')!)
      expect(parsed['Constitución Española']).toEqual([1, 14, 23])
      expect(parsed['Ley 39/2015']).toEqual(['103', '105'])
    })
  })

  describe('selectedSectionFilters (filtro que estaba roto en 14 paginas)', () => {
    it('NO incluye selected_section_filters cuando el array esta vacio', () => {
      const url = buildTestUrl({
        basePath: '/test',
        temaNumber: 1,
        testMode: 'practica',
        config: makeBaseConfig({ selectedSectionFilters: [] }),
      })
      expect(url).not.toContain('selected_section_filters')
    })

    it('incluye selected_section_filters como JSON', () => {
      const selectedSectionFilters = [
        { law_id: 'uuid-1', section_type: 'titulo' as const, section_value: 'I' },
        { law_id: 'uuid-2', section_type: 'capitulo' as const, section_value: 'II' },
      ]
      const url = buildTestUrl({
        basePath: '/auxiliar-administrativo-carm',
        temaNumber: 10,
        testMode: 'examen',
        config: makeBaseConfig({ selectedSectionFilters }),
      })
      const params = getParams(url)
      const parsed = JSON.parse(params.get('selected_section_filters')!)
      expect(parsed).toHaveLength(2)
      expect(parsed[0]).toEqual({ law_id: 'uuid-1', section_type: 'titulo', section_value: 'I' })
      expect(parsed[1]).toEqual({ law_id: 'uuid-2', section_type: 'capitulo', section_value: 'II' })
    })
  })

  describe('failedQuestionIds y failedQuestionsOrder', () => {
    it('NO incluye failed_question_ids cuando no hay IDs', () => {
      const url = buildTestUrl({
        basePath: '/test',
        temaNumber: 1,
        testMode: 'practica',
        config: makeBaseConfig({ failedQuestionIds: [] }),
      })
      expect(url).not.toContain('failed_question_ids')
    })

    it('incluye failed_question_ids y failed_questions_order', () => {
      const url = buildTestUrl({
        basePath: '/administrativo-estado',
        temaNumber: 2,
        testMode: 'practica',
        config: makeBaseConfig({
          onlyFailedQuestions: true,
          failedQuestionIds: ['id-1', 'id-2', 'id-3'],
          failedQuestionsOrder: 'most_failed',
        }),
      })
      const params = getParams(url)
      const parsed = JSON.parse(params.get('failed_question_ids')!)
      expect(parsed).toEqual(['id-1', 'id-2', 'id-3'])
      expect(params.get('failed_questions_order')).toBe('most_failed')
    })
  })

  describe('combinacion completa de filtros', () => {
    it('incluye todos los parametros simultaneamente', () => {
      const url = buildTestUrl({
        basePath: '/auxiliar-administrativo-madrid',
        temaNumber: 15,
        testMode: 'examen',
        config: makeBaseConfig({
          numQuestions: 50,
          difficultyMode: 'hard',
          onlyOfficialQuestions: true,
          excludeRecent: true,
          recentDays: 7,
          focusWeakAreas: true,
          timeLimit: 60,
          selectedLaws: ['TREBEP'],
          selectedArticlesByLaw: { 'TREBEP': [14, 15, 16] },
          selectedSectionFilters: [
            { law_id: 'trebep-id', section_type: 'titulo' as const, section_value: 'III' },
          ],
        }),
      })

      const params = getParams(url)
      expect(url).toContain('/test-examen?')
      expect(params.get('n')).toBe('50')
      expect(params.get('difficulty_mode')).toBe('hard')
      expect(params.get('only_official')).toBe('true')
      expect(params.get('exclude_recent')).toBe('true')
      expect(params.get('recent_days')).toBe('7')
      expect(params.get('focus_weak')).toBe('true')
      expect(params.get('time_limit')).toBe('60')

      expect(JSON.parse(params.get('selected_laws')!)).toEqual(['TREBEP'])
      expect(JSON.parse(params.get('selected_articles_by_law')!)).toEqual({ 'TREBEP': [14, 15, 16] })
      expect(JSON.parse(params.get('selected_section_filters')!)).toHaveLength(1)
    })
  })
})
