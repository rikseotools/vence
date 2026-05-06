// __tests__/lib/temario/exceedsCacheLimit.test.ts
// Test del helper que decide si un tema bypassa el unstable_cache por
// exceder el límite hard de 2MB del Vercel Data Cache.

jest.mock('@/db/client', () => ({
  getDb: jest.fn(() => ({})),
}))

jest.mock('@/db/schema', () => ({
  topics: { id: 'id', positionType: 'position_type', topicNumber: 'topic_number', title: 'title', description: 'description' },
  topicScope: { id: 'id', topicId: 'topic_id', lawId: 'law_id', articleNumbers: 'article_numbers', weight: 'weight' },
  articles: { id: 'id', lawId: 'law_id', articleNumber: 'article_number', title: 'title', content: 'content', titleNumber: 'title_number', chapterNumber: 'chapter_number', section: 'section', isActive: 'is_active' },
  laws: { id: 'id', shortName: 'short_name', name: 'name', description: 'description', year: 'year', boeUrl: 'boe_url' },
  questions: { id: 'id', primaryArticleId: 'primary_article_id', isActive: 'is_active', isOfficialExam: 'is_official_exam', examPosition: 'exam_position' },
}))

jest.mock('drizzle-orm', () => ({
  eq: jest.fn(),
  and: jest.fn(),
  inArray: jest.fn(),
  sql: Object.assign(jest.fn(), { join: jest.fn() }),
  count: jest.fn(),
}))

jest.mock('next/cache', () => ({
  unstable_cache: jest.fn((fn: Function) => fn),
}))

jest.mock('@/lib/config/exam-positions', () => ({
  getValidExamPositions: jest.fn(() => []),
}))

import { _exceedsCacheLimitForTests } from '@/lib/api/temario/queries'

const exceedsCacheLimit = _exceedsCacheLimitForTests

describe('exceedsCacheLimit (helper bypass cache temas grandes)', () => {
  test.each([
    ['policia-nacional', 21, true],
    ['auxiliar-administrativo-andalucia', 12, true],
    ['tramitacion-procesal', 23, true],
    ['guardia-civil', 9, true],
  ])('marca %s tema-%i como excediendo (true)', (slug, num, expected) => {
    expect(exceedsCacheLimit(slug, num)).toBe(expected)
  })

  test.each([
    ['policia-nacional', 1, false],          // mismo slug, otro tema
    ['policia-nacional', 22, false],         // mismo slug, tema vecino
    ['guardia-civil', 8, false],             // tema vecino al "9"
    ['guardia-civil', 10, false],            // tema vecino al "9"
    ['auxiliar-administrativo-estado', 21, false], // mismo número, otra opos
    ['auxiliar-administrativo-andalucia', 11, false],
    ['tramitacion-procesal', 22, false],
    ['administrativo-castilla-leon', 12, false],
    ['inventada-no-existe', 21, false],
  ])('NO marca %s tema-%i (false)', (slug, num, expected) => {
    expect(exceedsCacheLimit(slug, num)).toBe(expected)
  })

  test('respuesta determinista — múltiples llamadas con mismos args devuelven igual', () => {
    expect(exceedsCacheLimit('policia-nacional', 21)).toBe(true)
    expect(exceedsCacheLimit('policia-nacional', 21)).toBe(true)
    expect(exceedsCacheLimit('inventada', 99)).toBe(false)
    expect(exceedsCacheLimit('inventada', 99)).toBe(false)
  })
})
