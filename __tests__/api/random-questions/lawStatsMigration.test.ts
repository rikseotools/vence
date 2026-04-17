/**
 * Tests para la migración de getLawStats y validateLawExists
 * de Supabase directo a /api/questions/law-stats.
 *
 * Verifica: formato de respuesta, error handling, compatibilidad
 * con LawTestConfigurator y page.tsx de leyes.
 */

jest.mock('@/lib/supabase', () => ({
  getSupabaseClient: () => ({
    from: jest.fn(),
    auth: { getUser: jest.fn(), getSession: jest.fn() },
  }),
}))

jest.mock('@/lib/lawSlugSync', () => ({
  mapSlugToShortName: jest.fn((s: string) => {
    const map: Record<string, string> = {
      'constitucion-espanola': 'CE',
      'ley-39-2015': 'Ley 39/2015',
    }
    return map[s] || s
  }),
}))

import { getLawStats, validateLawExists, type LawStats } from '@/lib/lawFetchers'

const originalFetch = global.fetch

beforeEach(() => { jest.clearAllMocks() })
afterAll(() => { global.fetch = originalFetch })

// ============================================
// getLawStats
// ============================================

describe('getLawStats — migrado a API', () => {
  test('llama a /api/questions/law-stats con lawShortName correcto', async () => {
    const mockFetch = jest.fn().mockResolvedValue({
      ok: true, status: 200,
      json: async () => ({
        success: true, lawShortName: 'CE',
        totalQuestions: 100, officialQuestions: 25, regularQuestions: 75,
        hasQuestions: true, hasOfficialQuestions: true,
      }),
    })
    global.fetch = mockFetch

    await getLawStats('constitucion-espanola')

    expect(mockFetch).toHaveBeenCalledTimes(1)
    const url = mockFetch.mock.calls[0][0]
    expect(url).toContain('/api/questions/law-stats')
    expect(url).toContain('lawShortName=CE')
  })

  test('devuelve LawStats con todos los campos', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true, status: 200,
      json: async () => ({
        success: true, lawShortName: 'CE',
        totalQuestions: 100, officialQuestions: 25, regularQuestions: 75,
        hasQuestions: true, hasOfficialQuestions: true,
      }),
    })

    const stats = await getLawStats('CE')

    expect(stats.lawShortName).toBe('CE')
    expect(stats.totalQuestions).toBe(100)
    expect(stats.officialQuestions).toBe(25)
    expect(stats.regularQuestions).toBe(75)
    expect(stats.hasQuestions).toBe(true)
    expect(stats.hasOfficialQuestions).toBe(true)
    expect(stats.error).toBeUndefined()
  })

  test('ley sin preguntas devuelve hasQuestions=false', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true, status: 200,
      json: async () => ({
        success: true, lawShortName: 'Ley Inexistente',
        totalQuestions: 0, officialQuestions: 0, regularQuestions: 0,
        hasQuestions: false, hasOfficialQuestions: false,
      }),
    })

    const stats = await getLawStats('ley-inexistente')
    expect(stats.hasQuestions).toBe(false)
    expect(stats.totalQuestions).toBe(0)
  })

  test('HTTP 500 devuelve stats con 0s y error', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: false, status: 500,
      json: async () => ({ success: false, error: 'Error interno del servidor' }),
    })

    const stats = await getLawStats('CE')
    expect(stats.totalQuestions).toBe(0)
    expect(stats.hasQuestions).toBe(false)
    expect(stats.error).toBeDefined()
  })

  test('network error devuelve stats con 0s y error', async () => {
    global.fetch = jest.fn().mockRejectedValue(new TypeError('Failed to fetch'))

    const stats = await getLawStats('CE')
    expect(stats.totalQuestions).toBe(0)
    expect(stats.hasQuestions).toBe(false)
    expect(stats.error).toContain('Failed to fetch')
  })

  test('resuelve slug a short_name antes de llamar API', async () => {
    const mockFetch = jest.fn().mockResolvedValue({
      ok: true, status: 200,
      json: async () => ({
        success: true, lawShortName: 'Ley 39/2015',
        totalQuestions: 50, officialQuestions: 10, regularQuestions: 40,
        hasQuestions: true, hasOfficialQuestions: true,
      }),
    })
    global.fetch = mockFetch

    await getLawStats('ley-39-2015')

    const url = mockFetch.mock.calls[0][0]
    expect(url).toContain('lawShortName=Ley%2039%2F2015')
  })

  test('regularQuestions = total - official (nunca negativo)', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true, status: 200,
      json: async () => ({
        success: true, lawShortName: 'CE',
        totalQuestions: 50, officialQuestions: 50, regularQuestions: 0,
        hasQuestions: true, hasOfficialQuestions: true,
      }),
    })

    const stats = await getLawStats('CE')
    expect(stats.regularQuestions).toBe(0)
    expect(stats.regularQuestions).toBeGreaterThanOrEqual(0)
  })
})

// ============================================
// validateLawExists
// ============================================

describe('validateLawExists — usa getLawStats', () => {
  test('devuelve true cuando hay preguntas', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true, status: 200,
      json: async () => ({
        success: true, lawShortName: 'CE',
        totalQuestions: 100, officialQuestions: 25, regularQuestions: 75,
        hasQuestions: true, hasOfficialQuestions: true,
      }),
    })

    const exists = await validateLawExists('CE')
    expect(exists).toBe(true)
  })

  test('devuelve false cuando no hay preguntas', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true, status: 200,
      json: async () => ({
        success: true, lawShortName: 'X',
        totalQuestions: 0, officialQuestions: 0, regularQuestions: 0,
        hasQuestions: false, hasOfficialQuestions: false,
      }),
    })

    const exists = await validateLawExists('ley-inexistente')
    expect(exists).toBe(false)
  })

  test('devuelve false en caso de error', async () => {
    global.fetch = jest.fn().mockRejectedValue(new TypeError('Network error'))

    const exists = await validateLawExists('CE')
    expect(exists).toBe(false)
  })
})

// ============================================
// VERIFICACIÓN: sin queries directas en funciones activas
// ============================================

describe('Verificación: lawFetchers funciones activas sin Supabase directo', () => {
  test('getLawStats no tiene .from("questions")', () => {
    const fs = require('fs')
    const content = fs.readFileSync('lib/lawFetchers.ts', 'utf-8')

    const getLawStatsBody = content.split('export async function getLawStats')[1]
      ?.split('export')[0] || ''

    expect(getLawStatsBody).not.toContain(".from('questions')")
    expect(getLawStatsBody).toContain('/api/questions/law-stats')
  })

  test('validateLawExists no tiene .from("questions")', () => {
    const fs = require('fs')
    const content = fs.readFileSync('lib/lawFetchers.ts', 'utf-8')

    const validateBody = content.split('export async function validateLawExists')[1]
      ?.split('export')[0] || ''

    expect(validateBody).not.toContain(".from('questions')")
    expect(validateBody).toContain('getLawStats')
  })
})
