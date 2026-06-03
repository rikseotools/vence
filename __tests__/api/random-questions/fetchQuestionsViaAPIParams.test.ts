/**
 * Tests para verificar que fetchQuestionsViaAPI pasa correctamente
 * TODOS los parámetros a la API, incluyendo los que antes faltaban:
 * focusEssentialArticles, excludeRecentDays, prioritizeNeverSeen, Bearer token.
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

import { fetchQuestionsViaAPI } from '@/lib/testFetchers'

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

describe('fetchQuestionsViaAPI — parámetros completos', () => {
  test('pasa focusEssentialArticles=true cuando focus_essential en URL', async () => {
    const mockFetch = jest.fn().mockResolvedValue({ ok: true, status: 200, json: async () => ({ success: true, questions: [makeQ('1')], totalAvailable: 1 }) })
    global.fetch = mockFetch

    await fetchQuestionsViaAPI(1, { n: '5', focus_essential: 'true' }, { positionType: 'auxiliar_administrativo_estado' })

    const body = JSON.parse(mockFetch.mock.calls[0][1].body)
    expect(body.focusEssentialArticles).toBe(true)
  })

  test('pasa focusEssentialArticles=false cuando NO hay focus_essential en URL', async () => {
    const mockFetch = jest.fn().mockResolvedValue({ ok: true, status: 200, json: async () => ({ success: true, questions: [makeQ('1')], totalAvailable: 1 }) })
    global.fetch = mockFetch

    await fetchQuestionsViaAPI(1, { n: '5' }, { positionType: 'auxiliar_administrativo_estado' })

    const body = JSON.parse(mockFetch.mock.calls[0][1].body)
    expect(body.focusEssentialArticles).toBe(false)
  })

  test('pasa excludeRecentDays cuando exclude_recent=true', async () => {
    const mockFetch = jest.fn().mockResolvedValue({ ok: true, status: 200, json: async () => ({ success: true, questions: [makeQ('1')], totalAvailable: 1 }) })
    global.fetch = mockFetch

    await fetchQuestionsViaAPI(1, { n: '5', exclude_recent: 'true', recent_days: '20' }, { positionType: 'auxiliar_administrativo_estado' })

    const body = JSON.parse(mockFetch.mock.calls[0][1].body)
    expect(body.excludeRecentDays).toBe(20)
  })

  test('excludeRecentDays=0 cuando exclude_recent no está', async () => {
    const mockFetch = jest.fn().mockResolvedValue({ ok: true, status: 200, json: async () => ({ success: true, questions: [makeQ('1')], totalAvailable: 1 }) })
    global.fetch = mockFetch

    await fetchQuestionsViaAPI(1, { n: '5' }, { positionType: 'auxiliar_administrativo_estado' })

    const body = JSON.parse(mockFetch.mock.calls[0][1].body)
    expect(body.excludeRecentDays).toBe(0)
  })

  test('pasa prioritizeNeverSeen=true siempre', async () => {
    const mockFetch = jest.fn().mockResolvedValue({ ok: true, status: 200, json: async () => ({ success: true, questions: [makeQ('1')], totalAvailable: 1 }) })
    global.fetch = mockFetch

    await fetchQuestionsViaAPI(1, { n: '5' }, { positionType: 'auxiliar_administrativo_estado' })

    const body = JSON.parse(mockFetch.mock.calls[0][1].body)
    expect(body.prioritizeNeverSeen).toBe(true)
  })

  test('envía Bearer token SIEMPRE (no solo para failed)', async () => {
    const mockFetch = jest.fn().mockResolvedValue({ ok: true, status: 200, json: async () => ({ success: true, questions: [makeQ('1')], totalAvailable: 1 }) })
    global.fetch = mockFetch

    await fetchQuestionsViaAPI(1, { n: '5' }, { positionType: 'auxiliar_administrativo_estado' })

    const headers = mockFetch.mock.calls[0][1].headers
    expect(new Headers(headers).get('authorization')).toBe('Bearer tok123')
  })

  test('funciona sin token (sesión expirada)', async () => {
    mockAuthFns.getSession.mockResolvedValue({ data: { session: null }, error: null })
    const mockFetch = jest.fn().mockResolvedValue({ ok: true, status: 200, json: async () => ({ success: true, questions: [makeQ('1')], totalAvailable: 1 }) })
    global.fetch = mockFetch

    await fetchQuestionsViaAPI(1, { n: '5' }, { positionType: 'auxiliar_administrativo_estado' })

    const headers = mockFetch.mock.calls[0][1].headers
    expect(new Headers(headers).get('authorization')).toBeNull()
  })

  test('pasa onlyOfficialQuestions + difficultyMode', async () => {
    const mockFetch = jest.fn().mockResolvedValue({ ok: true, status: 200, json: async () => ({ success: true, questions: [makeQ('1')], totalAvailable: 1 }) })
    global.fetch = mockFetch

    await fetchQuestionsViaAPI(1, { n: '5', only_official: 'true', difficulty_mode: 'hard' }, { positionType: 'auxiliar_administrativo_estado' })

    const body = JSON.parse(mockFetch.mock.calls[0][1].body)
    expect(body.onlyOfficialQuestions).toBe(true)
    expect(body.difficultyMode).toBe('hard')
  })

  test('pasa selectedLaws y selectedArticlesByLaw del config', async () => {
    const mockFetch = jest.fn().mockResolvedValue({ ok: true, status: 200, json: async () => ({ success: true, questions: [makeQ('1')], totalAvailable: 1 }) })
    global.fetch = mockFetch

    await fetchQuestionsViaAPI(1, { n: '5' }, {
      positionType: 'auxiliar_administrativo_estado',
      selectedLaws: ['CE'],
      selectedArticlesByLaw: { 'CE': [1, 14] },
    })

    const body = JSON.parse(mockFetch.mock.calls[0][1].body)
    expect(body.selectedLaws).toEqual(['CE'])
    expect(body.selectedArticlesByLaw).toEqual({ CE: [1, 14] })
  })

  test('exclude_recent=true sin recent_days usa default 15', async () => {
    const mockFetch = jest.fn().mockResolvedValue({ ok: true, status: 200, json: async () => ({ success: true, questions: [makeQ('1')], totalAvailable: 1 }) })
    global.fetch = mockFetch

    await fetchQuestionsViaAPI(1, { n: '5', exclude_recent: 'true' }, { positionType: 'auxiliar_administrativo_estado' })

    const body = JSON.parse(mockFetch.mock.calls[0][1].body)
    expect(body.excludeRecentDays).toBe(15)
  })
})
