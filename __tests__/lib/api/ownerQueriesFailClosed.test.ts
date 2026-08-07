/**
 * [T-565, hallazgo de revisión 07/08] `getTestOwnerId` y `getSessionOwnerId` son la
 * fuente única de la que `requireDuenoDelRecurso` lee "¿quién es el dueño real?". Un
 * `null` de estas dos funciones significa "el recurso es anónimo, pasa cualquiera" —
 * así que si la consulta a BD LANZA (fallo transitorio de conexión) y la función lo
 * atrapa devolviendo `null`, un fallo de infraestructura se confunde con "anónimo
 * legítimo" y abre el recurso a cualquiera durante ese fallo. Antes del arreglo, las
 * dos funciones tenían exactamente ese catch. Ahora dejan propagar: el try/catch que
 * YA envuelve a cada llamante (`app/api/exam/*`, `app/api/psychometric/*`) lo convierte
 * en 500 — fail-closed. Este test fija esa propagación directamente sobre las dos
 * funciones, sin pasar por el mock de ruta (que solo puede simular el efecto, no
 * demostrar que la función real ya no traga el error).
 */

const mockLimit = jest.fn()
const mockWhere = jest.fn(() => ({ limit: mockLimit }))
const mockFrom = jest.fn(() => ({ where: mockWhere }))
const mockSelect = jest.fn(() => ({ from: mockFrom }))

jest.mock('@/db/client', () => ({
  getDb: jest.fn(() => ({ select: mockSelect })),
  getPoolerDb: jest.fn(() => ({ select: mockSelect })),
}))

jest.mock('@/db/schema', () => ({
  tests: { id: 'id', userId: 'user_id' },
  testQuestions: { id: 'id' },
  questions: { id: 'id' },
  userProfiles: { id: 'id' },
  psychometricTestSessions: { id: 'id', userId: 'user_id' },
  psychometricTestAnswers: { id: 'id' },
  psychometricQuestions: { id: 'id' },
  psychometricCategories: { id: 'id' },
  psychometricSections: { id: 'id' },
}))

jest.mock('drizzle-orm', () => ({
  eq: jest.fn((...args: unknown[]) => ({ type: 'eq', args })),
  and: jest.fn((...args: unknown[]) => ({ type: 'and', args })),
  desc: jest.fn(),
  isNull: jest.fn(),
  inArray: jest.fn(),
  gt: jest.fn(),
  count: jest.fn(),
  sql: Object.assign(jest.fn(), { raw: jest.fn() }),
}))

import { getTestOwnerId } from '@/lib/api/exam/queries'
import { getSessionOwnerId } from '@/lib/api/psychometric-session/queries'

describe('getTestOwnerId / getSessionOwnerId — null solo significa "no existe/anónimo", nunca "la consulta falló"', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockWhere.mockImplementation(() => ({ limit: mockLimit }))
    mockFrom.mockImplementation(() => ({ where: mockWhere }))
    mockSelect.mockImplementation(() => ({ from: mockFrom }))
  })

  describe('getTestOwnerId', () => {
    it('devuelve el userId cuando el test existe', async () => {
      mockLimit.mockResolvedValue([{ userId: 'user-1' }])
      await expect(getTestOwnerId('test-1')).resolves.toBe('user-1')
    })

    it('devuelve null cuando el test no existe (anónimo/inexistente legítimo)', async () => {
      mockLimit.mockResolvedValue([])
      await expect(getTestOwnerId('test-1')).resolves.toBeNull()
    })

    it('PROPAGA si la consulta LANZA — nunca lo convierte en null', async () => {
      mockLimit.mockRejectedValue(new Error('connection reset'))
      await expect(getTestOwnerId('test-1')).rejects.toThrow('connection reset')
    })
  })

  describe('getSessionOwnerId', () => {
    it('devuelve el userId cuando la sesión existe', async () => {
      mockLimit.mockResolvedValue([{ userId: 'user-1' }])
      await expect(getSessionOwnerId('session-1')).resolves.toBe('user-1')
    })

    it('devuelve null cuando la sesión no existe', async () => {
      mockLimit.mockResolvedValue([])
      await expect(getSessionOwnerId('session-1')).resolves.toBeNull()
    })

    it('PROPAGA si la consulta LANZA — nunca lo convierte en null', async () => {
      mockLimit.mockRejectedValue(new Error('connection reset'))
      await expect(getSessionOwnerId('session-1')).rejects.toThrow('connection reset')
    })
  })
})
