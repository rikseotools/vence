/**
 * Integración a nivel de fetcher: el aviso de relleno (backfilledRecentCount)
 * viaja de la respuesta de /api/questions/filtered → fetcher → array devuelto,
 * y se lee con readTestNotice. Cubre el cableado añadido (caveat 1) sin tocar BD.
 */

const mockAuthFns = (() => {
  const getUser = jest.fn()
  const getSession = jest.fn()
  return { getUser, getSession }
})()

jest.mock('@/lib/supabase', () => ({
  getSupabaseClient: () => ({
    from: jest.fn(),
    auth: {
      getUser: (...args: unknown[]) => mockAuthFns.getUser(...args),
      getSession: (...args: unknown[]) => mockAuthFns.getSession(...args),
    },
  }),
}))

jest.mock('@/lib/lawSlugSync', () => ({ mapSlugToShortName: jest.fn((s: string) => s) }))
jest.mock('@/lib/config/exam-positions', () => ({ getValidExamPositions: jest.fn(() => []), applyExamPositionFilter: jest.fn((q: unknown[]) => q) }))
jest.mock('@/lib/boe-extractor', () => ({ isDisposicionArticle: jest.fn(() => false) }))

import { fetchQuestionsViaAPI, readTestNotice } from '@/lib/testFetchers'

function makeQ(id: string) {
  return { id, question: `Q ${id}`, options: ['A','B','C','D'], explanation: '', correct_option: 1, primary_article_id: 'a1', tema: 1, image_url: null, content_data: null, article: { id: 'a1', number: '1', title: 'T', full_text: 'C', law_name: 'CE', law_short_name: 'CE', display_number: 'Art. 1 CE' }, metadata: { id, difficulty: 'medium', question_type: 'single', tags: null, is_active: true, created_at: '2025-01-01', updated_at: null, is_official_exam: false, exam_source: null, exam_date: null, exam_entity: null, exam_position: null, official_difficulty_level: null } }
}

const originalFetch = global.fetch
beforeEach(() => {
  jest.clearAllMocks()
  mockAuthFns.getUser.mockResolvedValue({ data: { user: { id: 'u1' } }, error: null })
  mockAuthFns.getSession.mockResolvedValue({ data: { session: { access_token: 'tok123' } }, error: null })
})
afterAll(() => { global.fetch = originalFetch })

describe('Propagación del aviso de relleno a través del fetcher', () => {
  test('API con backfilledRecentCount>0 → el array devuelto lleva el aviso', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true, status: 200,
      json: async () => ({ success: true, questions: [makeQ('1'), makeQ('2')], totalAvailable: 1, backfilledRecentCount: 2, requestedCount: 4 }),
    }) as unknown as typeof fetch

    const res = await fetchQuestionsViaAPI(1, { n: '4' }, { positionType: 'auxiliar_administrativo_estado' })
    const notice = readTestNotice(res)
    expect(notice).toEqual({ type: 'backfilled_recent', backfilledRecentCount: 2, requestedCount: 4 })
    // el array sigue siendo usable con normalidad
    expect(Array.isArray(res)).toBe(true)
    expect((res as unknown[]).length).toBe(2)
  })

  test('API sin relleno (backfilledRecentCount=0) → sin aviso', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true, status: 200,
      json: async () => ({ success: true, questions: [makeQ('1')], totalAvailable: 1, backfilledRecentCount: 0, requestedCount: 1 }),
    }) as unknown as typeof fetch

    const res = await fetchQuestionsViaAPI(1, { n: '1' }, { positionType: 'auxiliar_administrativo_estado' })
    expect(readTestNotice(res)).toBeNull()
  })

  test('API antigua sin el campo → sin aviso (retrocompatible)', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true, status: 200,
      json: async () => ({ success: true, questions: [makeQ('1')], totalAvailable: 1 }),
    }) as unknown as typeof fetch

    const res = await fetchQuestionsViaAPI(1, { n: '1' }, { positionType: 'auxiliar_administrativo_estado' })
    expect(readTestNotice(res)).toBeNull()
  })
})
