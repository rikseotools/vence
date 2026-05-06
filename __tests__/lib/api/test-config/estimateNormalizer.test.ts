// __tests__/lib/api/test-config/estimateNormalizer.test.ts
// Tests del key-normalizer de estimateAvailableQuestionsCached (Phase 4f).
//
// Garantiza que dos requests con la misma intención lógica pero distinto
// orden/forma de inputs producen una clave de cache equivalente.

jest.mock('@/db/client', () => ({
  getDb: jest.fn(() => ({})),
}))

jest.mock('@/db/schema', () => ({
  questions: { id: 'id' },
  articles: { id: 'id' },
  laws: { id: 'id' },
  topicScope: { id: 'id' },
  topics: { id: 'id' },
  lawSections: { id: 'id' },
}))

jest.mock('drizzle-orm', () => ({
  eq: jest.fn(),
  and: jest.fn(),
  inArray: jest.fn(),
  sql: Object.assign(jest.fn(), { raw: jest.fn() }),
}))

jest.mock('next/cache', () => ({
  unstable_cache: jest.fn((fn: Function) => fn),
}))

jest.mock('@/lib/config/exam-positions', () => ({
  getValidExamPositions: jest.fn(() => ['auxiliar_administrativo_estado']),
}))

import { _normalizeEstimateParamsForTests } from '@/lib/api/test-config/queries'
import type { EstimateQuestionsRequest } from '@/lib/api/test-config/schemas'

const normalize = _normalizeEstimateParamsForTests

const BASE = {
  topicNumber: 1,
  positionType: 'auxiliar_administrativo_estado',
  selectedLaws: [],
  selectedArticlesByLaw: {},
  selectedSectionFilters: [],
  onlyOfficialQuestions: false,
  difficultyMode: 'random',
  focusEssentialArticles: false,
} as const satisfies EstimateQuestionsRequest

describe('normalizeEstimateParams', () => {
  test('selectedLaws en distinto orden → mismo resultado', () => {
    const a = normalize({ ...BASE, selectedLaws: ['CE', 'LO'] })
    const b = normalize({ ...BASE, selectedLaws: ['LO', 'CE'] })
    expect(JSON.stringify(a)).toBe(JSON.stringify(b))
    expect(a.selectedLaws).toEqual(['CE', 'LO'])
  })

  test('selectedArticlesByLaw con keys reordenadas → mismo resultado', () => {
    const a = normalize({
      ...BASE,
      selectedArticlesByLaw: { CE: [1, 2], LO: [3, 4] },
    })
    const b = normalize({
      ...BASE,
      selectedArticlesByLaw: { LO: [3, 4], CE: [1, 2] },
    })
    expect(JSON.stringify(a)).toBe(JSON.stringify(b))
    // Keys ordenadas alfabéticamente
    expect(Object.keys(a.selectedArticlesByLaw!)).toEqual(['CE', 'LO'])
  })

  test('arrays internos de selectedArticlesByLaw también se sortean', () => {
    const a = normalize({
      ...BASE,
      selectedArticlesByLaw: { CE: [3, 1, 2] },
    })
    const b = normalize({
      ...BASE,
      selectedArticlesByLaw: { CE: [2, 3, 1] },
    })
    expect(JSON.stringify(a)).toBe(JSON.stringify(b))
    // Tras normalizar son strings ordenados
    expect(a.selectedArticlesByLaw!.CE).toEqual(['1', '2', '3'])
  })

  test('arrays mixtos number+string en selectedArticlesByLaw se normalizan', () => {
    const a = normalize({
      ...BASE,
      selectedArticlesByLaw: { CE: [1, '2', 3] },
    })
    const b = normalize({
      ...BASE,
      selectedArticlesByLaw: { CE: ['1', 2, '3'] },
    })
    expect(JSON.stringify(a)).toBe(JSON.stringify(b))
  })

  test('duplicados en selectedArticlesByLaw se deduplican', () => {
    const r = normalize({
      ...BASE,
      selectedArticlesByLaw: { CE: [1, 2, 2, 1, 3] },
    })
    expect(r.selectedArticlesByLaw!.CE).toEqual(['1', '2', '3'])
  })

  test('selectedSectionFilters en distinto orden → mismo resultado', () => {
    const f1 = { title: 'Título B', sectionNumber: '2' }
    const f2 = { title: 'Título A', sectionNumber: '1' }
    const a = normalize({ ...BASE, selectedSectionFilters: [f1, f2] })
    const b = normalize({ ...BASE, selectedSectionFilters: [f2, f1] })
    expect(JSON.stringify(a)).toBe(JSON.stringify(b))
    // Ordenados por title alfabético
    expect(a.selectedSectionFilters![0].title).toBe('Título A')
    expect(a.selectedSectionFilters![1].title).toBe('Título B')
  })

  test('campos primitivos pasan sin tocar', () => {
    const r = normalize({
      ...BASE,
      topicNumber: 5,
      positionType: 'auxiliar_administrativo_estado',
      onlyOfficialQuestions: true,
      difficultyMode: 'hard',
      focusEssentialArticles: true,
    })
    expect(r.topicNumber).toBe(5)
    expect(r.positionType).toBe('auxiliar_administrativo_estado')
    expect(r.onlyOfficialQuestions).toBe(true)
    expect(r.difficultyMode).toBe('hard')
    expect(r.focusEssentialArticles).toBe(true)
  })

  test('inputs vacíos → outputs vacíos consistentes', () => {
    const r = normalize(BASE)
    expect(r.selectedLaws).toEqual([])
    expect(r.selectedArticlesByLaw).toEqual({})
    expect(r.selectedSectionFilters).toEqual([])
  })

  test('orden de keys del objeto resultante es determinista', () => {
    // Doble llamada con mismos inputs → JSON exactamente igual
    const a = normalize({
      ...BASE,
      selectedLaws: ['CE'],
      selectedArticlesByLaw: { CE: [1] },
      selectedSectionFilters: [{ title: 'X' }],
    })
    const b = normalize({
      ...BASE,
      selectedLaws: ['CE'],
      selectedArticlesByLaw: { CE: [1] },
      selectedSectionFilters: [{ title: 'X' }],
    })
    expect(JSON.stringify(a)).toBe(JSON.stringify(b))
  })

  test('selectedSectionFilters con mismo title se desempata por sectionNumber', () => {
    const f1 = { title: 'Mismo', sectionNumber: '2' }
    const f2 = { title: 'Mismo', sectionNumber: '1' }
    const r = normalize({ ...BASE, selectedSectionFilters: [f1, f2] })
    expect(r.selectedSectionFilters![0].sectionNumber).toBe('1')
    expect(r.selectedSectionFilters![1].sectionNumber).toBe('2')
  })
})
