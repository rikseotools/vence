// __tests__/api/subscription/submitCancellationFeedback.test.ts
//
// Test unitario de submitCancellationFeedback (lib/api/subscription/queries.ts).
// Valida el UPDATE con subquery + detección de rowCount + manejo de fallos
// del admin notification sin romper el flujo. Mocks: db (getDb) y el
// módulo interno de notification.
//
// Bug base: sin tests, refactorizar la SQL rompería silenciosamente la
// actualización de feedback post-cancelación del flujo 1-clic.

// Mock de db/client autocontenido (factory hoisted)
jest.mock('@/db/client', () => {
  const execute = jest.fn()
  const selectLimit = jest.fn().mockResolvedValue([])
  const selectWhereMock = jest.fn(() => ({ limit: selectLimit }))
  const selectFromMock = jest.fn(() => ({ where: selectWhereMock }))
  const selectMock = jest.fn(() => ({ from: selectFromMock }))
  return {
    __mockSpies: { execute, selectLimit },
    getDb: () => ({
      execute,
      select: selectMock,
    }),
  }
})

// Mock de Resend (usado por sendAdminNotification — que está en el mismo
// archivo queries.ts y que llama a Resend/sendEmail según implementación).
// Silenciamos fetch para evitar efectos de red.
;(global as unknown as { fetch: jest.Mock }).fetch = jest.fn().mockResolvedValue({
  ok: true,
  json: async () => ({}),
})

import { submitCancellationFeedback } from '@/lib/api/subscription/queries'

// Recuperar los spies del factory
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { __mockSpies } = require('@/db/client') as {
  __mockSpies: { execute: jest.Mock; selectLimit: jest.Mock }
}
const executeSpy = __mockSpies.execute
const selectLimitSpy = __mockSpies.selectLimit

const validUserId = '00000000-0000-0000-0000-000000000001'

describe('submitCancellationFeedback — UPDATE de cancelación pendiente', () => {
  let errorSpy: jest.SpyInstance

  beforeEach(() => {
    executeSpy.mockReset()
    selectLimitSpy.mockReset()
    selectLimitSpy.mockResolvedValue([])
    errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {})
  })
  afterEach(() => {
    errorSpy.mockRestore()
  })

  test('actualiza registro pending y devuelve success:true (rowCount via array length)', async () => {
    // Drizzle devuelve array con filas RETURNING
    executeSpy.mockResolvedValueOnce([{ id: 'row-uuid-1' }])

    const r = await submitCancellationFeedback({
      userId: validUserId,
      feedback: { reason: 'exam_done', reasonDetails: 'Aprobé el examen' },
    })

    expect(r.success).toBe(true)
    expect(executeSpy).toHaveBeenCalledTimes(1)
  })

  test('actualiza registro pending y devuelve success:true (rowCount via objeto)', async () => {
    // Algunos drivers devuelven {rowCount: N} en vez de array
    executeSpy.mockResolvedValueOnce({ rowCount: 1 })

    const r = await submitCancellationFeedback({
      userId: validUserId,
      feedback: { reason: 'too_expensive' },
    })

    expect(r.success).toBe(true)
  })

  test('si no hay registro pending (rowCount=0), devuelve success:false con mensaje claro', async () => {
    executeSpy.mockResolvedValueOnce([]) // array vacío

    const r = await submitCancellationFeedback({
      userId: validUserId,
      feedback: { reason: 'other' },
    })

    expect(r.success).toBe(false)
    expect(r.error).toMatch(/No hay cancelación pendiente/i)
  })

  test('si no hay registro pending (rowCount undefined), también falla con mensaje claro', async () => {
    executeSpy.mockResolvedValueOnce({ rowCount: undefined })

    const r = await submitCancellationFeedback({
      userId: validUserId,
      feedback: { reason: 'other' },
    })

    expect(r.success).toBe(false)
    expect(r.error).toMatch(/No hay cancelación pendiente/i)
  })

  test('error de BD en el UPDATE se devuelve como success:false con error.message', async () => {
    executeSpy.mockRejectedValueOnce(new Error('connection timeout'))

    const r = await submitCancellationFeedback({
      userId: validUserId,
      feedback: { reason: 'exam_done' },
    })

    expect(r.success).toBe(false)
    expect(r.error).toContain('connection timeout')
  })

  test('fallo de la notificación admin NO revierte el success (best-effort)', async () => {
    // UPDATE va bien
    executeSpy.mockResolvedValueOnce([{ id: 'row-uuid-2' }])
    // SELECT de user_profiles falla (simula RLS o red)
    selectLimitSpy.mockRejectedValueOnce(new Error('user_profiles unavailable'))

    const r = await submitCancellationFeedback({
      userId: validUserId,
      feedback: { reason: 'exam_done' },
    })

    // La llamada principal triunfó, fallo de email no afecta
    expect(r.success).toBe(true)
    // Se loggeó internamente pero no rompió
    expect(errorSpy).toHaveBeenCalledWith(
      expect.stringContaining('Error sending admin notification (post-feedback)'),
      expect.any(Error),
    )
  })

  test('se aceptan reasons con valores de exam_done y textarea opcional', async () => {
    executeSpy.mockResolvedValueOnce([{ id: 'x' }])

    const r = await submitCancellationFeedback({
      userId: validUserId,
      feedback: { reason: 'exam_done' }, // sin reasonDetails
    })

    expect(r.success).toBe(true)
  })
})
