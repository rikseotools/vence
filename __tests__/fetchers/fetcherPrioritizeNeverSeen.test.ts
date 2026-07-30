/**
 * Tests para `fetchAleatorioMultiTema` — verifica que el flag
 * `prioritize_never_seen` de la URL se propaga al body de
 * `/api/questions/filtered` (antes era hardcoded a true, lo que impedía
 * que el toggle UI "incluir preguntas vistas" funcionara).
 *
 * Contexto: bug reportado por mbelen177 + pilarmartagui (06-may-2026).
 */

// Mock del supabase client que importa testFetchers
// La AUTENTICACIÓN se simula por el PUERTO (`@/lib/auth`), no por el proveedor: es a quien
// llama el código bajo prueba. Este mock de `@/lib/supabase` conserva solo el acceso a DATOS
// legacy. (30/07/2026 — mockear el proveedor ataba el test a Supabase: al poner el default
// en Auth.js, que es lo que corre en producción, 60 tests se cayeron sin que el código
// cambiara.)
jest.mock('@/lib/auth', () => require('../helpers/authPortHarness').mockDelPuerto())

jest.mock('@/lib/supabase', () => ({
  getSupabaseClient: () => ({
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
