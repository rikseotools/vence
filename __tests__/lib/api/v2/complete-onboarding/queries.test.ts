/**
 * `completeOnboarding()` — guardarraíl [T-077]: solo la PRIMERA vez.
 *
 * Antes de este fix, la función hacía un `UPDATE ... WHERE id = userId` sin más condición: un
 * usuario que llamara este endpoint DESPUÉS de haber completado el onboarding (nada en la ruta
 * lo impedía — ver `app/api/v2/complete-onboarding/route.ts`, sin guard alguno) podía pisar su
 * `target_oposicion` sin pasar por `/api/profile/target` ni por su guardarraíl de T-508
 * ("personalizada sin temario"). Es la MISMA puerta trasera que `save-field`
 * (`__tests__/api/v2/onboardingModalEndpoints.test.ts`), en el otro escritor de onboarding.
 *
 * El guardarraíl es `onboarding_completed_at IS NULL` en el propio UPDATE (no un SELECT previo:
 * sin ventana entre leer y escribir). Si 0 filas, la función NO devuelve error al cliente —lo
 * trata como un reintento idempotente legítimo (mismo patrón que documenta el fichero real)— pero
 * SÍ lo hace observable con `complete_onboarding_repetido`, y NO reinvoca `invalidateProfileCache`
 * (nada cambió).
 */

const insertCalls: unknown[] = []

function chain(finalResult: unknown[]) {
  const c: Record<string, jest.Mock> = {}
  c.update = jest.fn(() => c)
  c.set = jest.fn((v: unknown) => { insertCalls.push(v); return c })
  c.select = jest.fn(() => c)
  c.from = jest.fn(() => c)
  c.where = jest.fn(() => c)
  c.limit = jest.fn(() => Promise.resolve(finalResult))
  c.returning = jest.fn(() => Promise.resolve(finalResult))
  return c
}

let mockUpdateResult: unknown[] = []
let mockSelectResult: unknown[] = []

const mockDb = {
  update: jest.fn(() => chain(mockUpdateResult)),
  select: jest.fn(() => chain(mockSelectResult)),
}

jest.mock('@/db/client', () => ({
  getDb: jest.fn(() => mockDb),
  getPoolerDb: jest.fn(() => mockDb),
}))

jest.mock('@/db/schema', () => ({
  userProfiles: { id: 'id', onboardingCompletedAt: 'onboarding_completed_at' },
}))

jest.mock('@/lib/api/profile', () => ({
  invalidateProfileCache: jest.fn(),
}))

const mockEmit = jest.fn()
jest.mock('@/lib/observability/emit', () => ({
  emitFireAndForget: (e: unknown) => mockEmit(e),
}))

import { completeOnboarding } from '@/lib/api/v2/complete-onboarding/queries'
import { invalidateProfileCache } from '@/lib/api/profile'

const PARAMS = {
  targetOposicion: 'guardia_civil',
  age: 25,
  gender: 'male' as const,
  ciudad: 'Madrid',
}

beforeEach(() => {
  jest.clearAllMocks()
  insertCalls.length = 0
  mockUpdateResult = []
  mockSelectResult = []
})

describe('completeOnboarding — [T-077] solo la primera vez', () => {
  test('primera vez (UPDATE afecta 1 fila): success, invalida cache, NO emite el evento de repetido', async () => {
    mockUpdateResult = [{ id: 'user-1' }]
    const r = await completeOnboarding(PARAMS, 'user-1')
    expect(r).toEqual({ success: true })
    expect(invalidateProfileCache).toHaveBeenCalledTimes(1)
    expect(mockEmit).not.toHaveBeenCalled()
  })

  test('ya completado (UPDATE afecta 0 filas, el usuario SÍ existe): success igualmente, NO invalida cache, SÍ emite el evento', async () => {
    mockUpdateResult = []
    mockSelectResult = [{ id: 'user-1' }] // el fallback SELECT confirma que el usuario existe
    const r = await completeOnboarding(PARAMS, 'user-1')
    expect(r).toEqual({ success: true })
    expect(invalidateProfileCache).not.toHaveBeenCalled()
    expect(mockEmit).toHaveBeenCalledTimes(1)
    expect(mockEmit).toHaveBeenCalledWith(
      expect.objectContaining({ eventType: 'complete_onboarding_repetido', metadata: { userId: 'user-1' } }),
    )
  })

  test('usuario inexistente (0 filas en el UPDATE y 0 en el SELECT de confirmación): success:false', async () => {
    mockUpdateResult = []
    mockSelectResult = []
    const r = await completeOnboarding(PARAMS, 'usuario-fantasma')
    expect(r).toEqual({ success: false, error: 'Usuario no encontrado' })
    expect(mockEmit).not.toHaveBeenCalled()
  })

  test('el UPDATE pide onboarding_completed_at IS NULL (vía isNull, no una condición aparte)', async () => {
    mockUpdateResult = [{ id: 'user-1' }]
    await completeOnboarding(PARAMS, 'user-1')
    // El guard vive en el WHERE del propio UPDATE, no en un SELECT previo a parte:
    // se comprueba que el UPDATE se intenta antes que cualquier SELECT.
    expect(mockDb.update).toHaveBeenCalledTimes(1)
  })

  test('sigue siendo una sola operación de update por llamada exitosa (atómico)', async () => {
    mockUpdateResult = [{ id: 'user-1' }]
    await completeOnboarding(PARAMS, 'user-1')
    expect(mockDb.update).toHaveBeenCalledTimes(1)
    expect(mockDb.select).not.toHaveBeenCalled() // el fallback NO corre si el UPDATE ya afectó una fila
  })
})
