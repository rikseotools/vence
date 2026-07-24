/**
 * INTEGRACIÓN de getAllLawsWithStats (fix 24/07 David/Galicia): compila el módulo
 * real (typecheck) y prueba el cableado — caché passthrough, mapeo vía
 * buildLawsResponse, y que un fallo de BD devuelve {success:false} SIN cachear +
 * emite observabilidad de error. Deps de infra mockeadas.
 */
const mockExecute = jest.fn()
const mockEmit = jest.fn()

jest.mock('next/cache', () => ({ unstable_cache: (fn: () => unknown) => fn })) // passthrough
jest.mock('@/lib/db/timeout', () => ({ withDbTimeout: (fn: () => unknown) => fn() })) // passthrough
jest.mock('@/lib/observability/emit', () => ({ emitFireAndForget: (...a: unknown[]) => mockEmit(...a) }))
jest.mock('@/db/client', () => ({
  getDb: () => ({ execute: (...a: unknown[]) => mockExecute(...a) }),
  getPoolerDb: () => ({ execute: (...a: unknown[]) => mockExecute(...a) }),
}))

import { getAllLawsWithStats } from '@/lib/api/laws-configurator/queries'

describe('getAllLawsWithStats — integración', () => {
  beforeEach(() => { mockExecute.mockReset(); mockEmit.mockReset() })

  it('acotado a oposición: mapea las filas de la query al contrato público', async () => {
    mockExecute.mockResolvedValue([
      { lawShortName: 'CE', lawName: 'Constitución', totalQuestions: 300, articlesWithQuestions: 40 },
      { lawShortName: 'Vacía', lawName: null, totalQuestions: 0, articlesWithQuestions: 0 },
    ])
    const r = await getAllLawsWithStats('auxiliar_administrativo_galicia')
    expect(r.success).toBe(true)
    expect(r.data.map((l) => l.lawShortName)).toEqual(['CE']) // la de 0 se filtra
    expect(r.totalQuestions).toBe(300)
    // observabilidad de timing emitida
    expect(mockEmit).toHaveBeenCalledWith(expect.objectContaining({ eventType: 'laws_configurator_stats' }))
  })

  it('0 leyes acotado → emite laws_configurator_empty_scope', async () => {
    mockExecute.mockResolvedValue([])
    const r = await getAllLawsWithStats('oposicion_sin_contenido')
    expect(r).toEqual({ success: true, data: [], totalLaws: 0, totalQuestions: 0 })
    expect(mockEmit).toHaveBeenCalledWith(expect.objectContaining({ eventType: 'laws_configurator_empty_scope' }))
  })

  it('fallo de BD → {success:false} (NO se cachea) + emite laws_configurator_error', async () => {
    mockExecute.mockRejectedValue(new Error('statement timeout'))
    const r = await getAllLawsWithStats('auxiliar_administrativo_galicia')
    expect(r.success).toBe(false)
    expect(mockEmit).toHaveBeenCalledWith(expect.objectContaining({ eventType: 'laws_configurator_error' }))
  })
})
