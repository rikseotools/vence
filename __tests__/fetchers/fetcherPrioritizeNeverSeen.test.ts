/**
 * Tests para `fetchAleatorioMultiTema` — verifica que el flag
 * `prioritize_never_seen` de la URL se propaga al body de
 * `/api/questions/filtered` (antes era hardcoded a true, lo que impedía
 * que el toggle UI "incluir preguntas vistas" funcionara).
 *
 * Contexto: bug reportado por mbelen177 + pilarmartagui (06-may-2026).
 */

// Mock del supabase client que importa testFetchers
jest.mock('@/lib/supabase', () => ({
  getSupabaseClient: () => ({
    auth: {
      getUser: async () => ({ data: { user: { id: 'user-test' } }, error: null }),
      getSession: async () => ({ data: { session: { access_token: 'token-test' } }, error: null }),
    },
  }),
}))

// El fetcher importa estos módulos pero no los necesitamos para esta ruta
jest.mock('@/lib/lawSlugSync', () => ({ mapSlugToShortName: (s: string) => s }))
jest.mock('@/lib/config/exam-positions', () => ({
  getValidExamPositions: () => [],
  applyExamPositionFilter: (_q: unknown) => _q,
}))
jest.mock('@/lib/boe-extractor', () => ({ isDisposicionArticle: () => false }))

import { fetchAleatorioMultiTema } from '@/lib/testFetchers'

describe('fetchAleatorioMultiTema — prioritize_never_seen passthrough', () => {
  let fetchSpy: jest.SpyInstance
  let lastBody: Record<string, unknown> | null = null

  beforeEach(() => {
    lastBody = null
    fetchSpy = jest.spyOn(global, 'fetch').mockImplementation(async (_url, init) => {
      if (init?.body) {
        lastBody = JSON.parse(init.body as string)
      }
      return {
        ok: true,
        status: 200,
        json: async () => ({ success: true, questions: [] }),
      } as Response
    })
  })

  afterEach(() => {
    fetchSpy.mockRestore()
  })

  test('default: si no se pasa prioritize_never_seen en URL, body lo envía true (compat)', async () => {
    const params = new URLSearchParams({ n: '50' })
    await fetchAleatorioMultiTema([1, 2], params, { positionType: 'auxiliar_administrativo_carm' })
    expect(lastBody?.prioritizeNeverSeen).toBe(true)
  })

  test('explícito true: prioritize_never_seen=true en URL → body envía true', async () => {
    const params = new URLSearchParams({ n: '50', prioritize_never_seen: 'true' })
    await fetchAleatorioMultiTema([1, 2], params, { positionType: 'auxiliar_administrativo_carm' })
    expect(lastBody?.prioritizeNeverSeen).toBe(true)
  })

  test('explícito false: prioritize_never_seen=false en URL → body envía false', async () => {
    // Caso clave: usuario activó el toggle "incluir preguntas vistas".
    const params = new URLSearchParams({ n: '50', prioritize_never_seen: 'false' })
    await fetchAleatorioMultiTema([1, 2], params, { positionType: 'auxiliar_administrativo_carm' })
    expect(lastBody?.prioritizeNeverSeen).toBe(false)
  })

  test('numQuestions del URL se propaga sin truncar', async () => {
    const params = new URLSearchParams({ n: '100' })
    await fetchAleatorioMultiTema([1, 2], params, { positionType: 'auxiliar_administrativo_carm' })
    expect(lastBody?.numQuestions).toBe(100)
  })
})
