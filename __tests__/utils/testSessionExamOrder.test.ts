/** @jest-environment node */
// __tests__/utils/testSessionExamOrder.test.ts
//
// T-277: `createDetailedTestSession` es donde el examen se sirve por PRIMERA vez, así que
// es el único sitio donde tiene sentido grabar `option_orders` (una vez, no en cada
// respuesta). Este test ejercita el CÓDIGO REAL de `utils/testSession.ts` con
// `createTestSessionOnServer` mockeado, y comprueba qué `questionsMetadata` construye.

const mockCreateTestSessionOnServer = jest.fn()
jest.mock('@/lib/api/v2/tests/client', () => ({
  createTestSessionOnServer: (...a: unknown[]) => mockCreateTestSessionOnServer(...a),
}))
jest.mock('@/lib/api/v2/user-sessions/client', () => ({
  createUserSessionOnServer: jest.fn(),
}))
jest.mock('@/hooks/useVersionCheck', () => ({ getClientVersion: () => 'test' }))
jest.mock('@/lib/logClientError', () => ({ logClientError: jest.fn() }))
jest.mock('../../lib/auth', () => ({ auth: jest.fn() }))

import { createDetailedTestSession } from '@/utils/testSession'

const UUID = '11111111-1111-4111-8111-111111111111'

beforeEach(() => {
  jest.clearAllMocks()
  mockCreateTestSessionOnServer.mockResolvedValue({
    success: true,
    id: 'test-id-1',
    test_type: 'exam',
  })
})

describe('createDetailedTestSession — persiste option_orders SOLO para modo examen (T-277)', () => {
  it('modo examen con preguntas barajadas: questionsMetadata.option_orders lleva el orden de cada una', async () => {
    await createDetailedTestSession(
      UUID,
      1,
      1,
      [
        { id: 'q1', question_text: 'p1', option_a: 'a', option_b: 'b', option_order: [2, 0, 1, 3] },
        { id: 'q2', question_text: 'p2', option_a: 'a', option_b: 'b' }, // sin barajar (natural)
      ],
      {},
      Date.now(),
      Date.now(),
      null,
      'exam'
    )

    expect(mockCreateTestSessionOnServer).toHaveBeenCalledTimes(1)
    const call = mockCreateTestSessionOnServer.mock.calls[0][0]
    expect(call.questionsMetadata.option_orders).toEqual({ q1: [2, 0, 1, 3] })
  })

  it('modo examen SIN ninguna pregunta barajada: no añade la clave option_orders', async () => {
    await createDetailedTestSession(
      UUID, 1, 1,
      [{ id: 'q1', question_text: 'p1', option_a: 'a', option_b: 'b' }],
      {}, Date.now(), Date.now(), null, 'exam'
    )
    const call = mockCreateTestSessionOnServer.mock.calls[0][0]
    expect(call.questionsMetadata).not.toHaveProperty('option_orders')
  })

  it('modo PRÁCTICA: aunque una pregunta traiga option_order, NO se persiste aquí (T-267 ya lo cubre por su propio camino)', async () => {
    await createDetailedTestSession(
      UUID, 1, 1,
      [{ id: 'q1', question_text: 'p1', option_a: 'a', option_b: 'b', option_order: [1, 0] }],
      {}, Date.now(), Date.now(), null, 'practice'
    )
    const call = mockCreateTestSessionOnServer.mock.calls[0][0]
    expect(call.questionsMetadata).not.toHaveProperty('option_orders')
  })

  it('question_ids/article_ids/etc. del resto de la metadata siguen construyéndose igual (no hay regresión)', async () => {
    await createDetailedTestSession(
      UUID, 3, 1,
      [{ id: 'q1', question_text: 'p1', option_a: 'a', option_b: 'b', articles: { id: 'art1', article_number: '5', laws: { short_name: 'CE' } } }],
      {}, Date.now(), Date.now(), null, 'exam'
    )
    const call = mockCreateTestSessionOnServer.mock.calls[0][0]
    expect(call.questionsMetadata.question_ids).toEqual(['q1'])
    expect(call.questionsMetadata.article_ids).toEqual(['art1'])
    expect(call.questionsMetadata.article_numbers).toEqual(['5'])
    expect(call.questionsMetadata.laws).toEqual(['CE'])
  })
})
