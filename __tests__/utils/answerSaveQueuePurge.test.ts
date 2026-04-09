/**
 * Tests para la purga de cola y límite de tamaño del answerSaveQueue.
 *
 * Bug: usuarios que hacen muchos tests sin recargar la página acumulan
 * respuestas fallidas en localStorage, bloqueando el flush para respuestas nuevas.
 *
 * Fix:
 * 1. purgeSessionAnswers(sessionId) — limpia respuestas de tests completados
 * 2. MAX_QUEUE_SIZE=200 — purga automática de respuestas antiguas si la cola crece
 */

const QUEUE_KEY = 'vence_answer_queue'

// Mock localStorage
const localStorageMock = (() => {
  let store: Record<string, string> = {}
  return {
    getItem: (key: string) => store[key] ?? null,
    setItem: (key: string, value: string) => { store[key] = value },
    removeItem: (key: string) => { delete store[key] },
    clear: () => { store = {} },
  }
})()

Object.defineProperty(global, 'localStorage', { value: localStorageMock })
Object.defineProperty(global, 'window', { value: { addEventListener: jest.fn() } })
Object.defineProperty(global, 'document', {
  value: { addEventListener: jest.fn() },
  writable: true,
})

// Mock crypto.randomUUID
Object.defineProperty(global, 'crypto', {
  value: {
    randomUUID: () => `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`,
  },
})

// Mock dependencies
jest.mock('@/lib/logClientError', () => ({
  logClientError: jest.fn(),
}))

jest.mock('@/lib/api/v2/answer-and-save/schemas', () => ({
  answerAndSaveRequestSchema: {
    safeParse: (data: any) => ({ success: true, data }),
  },
}))

jest.mock('@/lib/supabase', () => ({
  getSupabaseClient: () => ({
    auth: {
      refreshSession: jest.fn().mockResolvedValue({
        data: { session: { access_token: 'test-token' } },
        error: null,
      }),
      getSession: jest.fn().mockResolvedValue({
        data: { session: { access_token: 'test-token' } },
        error: null,
      }),
      onAuthStateChange: jest.fn(),
    },
  }),
}))

// Helper: crear una respuesta de cola
function makeAnswer(sessionId: string, questionId: string, ageMs = 0) {
  return {
    id: `${sessionId}-${questionId}-${Math.random()}`,
    payload: {
      sessionId,
      questionId,
      userId: 'user-test',
      userAnswer: 0,
      questionText: 'Test?',
      options: ['A', 'B', 'C', 'D'],
      currentScore: 0,
      questionIndex: 0,
    },
    retries: 0,
    createdAt: Date.now() - ageMs,
    lastAttempt: null,
  }
}

// Helper: poblar la cola directamente
function setQueue(answers: any[]) {
  localStorageMock.setItem(QUEUE_KEY, JSON.stringify({ answers }))
}

function getQueue() {
  const raw = localStorageMock.getItem(QUEUE_KEY)
  return raw ? JSON.parse(raw) : { answers: [] }
}

// ============================================
// TESTS
// ============================================

describe('answerSaveQueue — purga y límites', () => {
  beforeEach(() => {
    localStorageMock.clear()
    jest.resetModules()
  })

  describe('purgeSessionAnswers', () => {
    it('elimina todas las respuestas de un sessionId específico', () => {
      setQueue([
        makeAnswer('session-A', 'q1'),
        makeAnswer('session-A', 'q2'),
        makeAnswer('session-A', 'q3'),
        makeAnswer('session-B', 'q1'),
        makeAnswer('session-B', 'q2'),
      ])

      const { purgeSessionAnswers } = require('@/utils/answerSaveQueue')
      purgeSessionAnswers('session-A')

      const queue = getQueue()
      expect(queue.answers).toHaveLength(2)
      expect(queue.answers.every((a: any) => a.payload.sessionId === 'session-B')).toBe(true)
    })

    it('no hace nada si el sessionId no existe en la cola', () => {
      setQueue([
        makeAnswer('session-A', 'q1'),
        makeAnswer('session-A', 'q2'),
      ])

      const { purgeSessionAnswers } = require('@/utils/answerSaveQueue')
      purgeSessionAnswers('session-inexistente')

      const queue = getQueue()
      expect(queue.answers).toHaveLength(2)
    })

    it('no hace nada con sessionId vacío', () => {
      setQueue([
        makeAnswer('session-A', 'q1'),
      ])

      const { purgeSessionAnswers } = require('@/utils/answerSaveQueue')
      purgeSessionAnswers('')

      const queue = getQueue()
      expect(queue.answers).toHaveLength(1)
    })

    it('deja la cola vacía si todas las respuestas son del mismo test', () => {
      setQueue([
        makeAnswer('session-A', 'q1'),
        makeAnswer('session-A', 'q2'),
        makeAnswer('session-A', 'q3'),
      ])

      const { purgeSessionAnswers } = require('@/utils/answerSaveQueue')
      purgeSessionAnswers('session-A')

      const queue = getQueue()
      expect(queue.answers).toHaveLength(0)
    })

    it('funciona con cola de muchos tests diferentes', () => {
      const answers = []
      for (let i = 0; i < 10; i++) {
        for (let j = 0; j < 20; j++) {
          answers.push(makeAnswer(`session-${i}`, `q${j}`))
        }
      }
      setQueue(answers) // 200 respuestas, 10 tests

      const { purgeSessionAnswers } = require('@/utils/answerSaveQueue')
      purgeSessionAnswers('session-5')

      const queue = getQueue()
      expect(queue.answers).toHaveLength(180)
      expect(queue.answers.some((a: any) => a.payload.sessionId === 'session-5')).toBe(false)
    })
  })

  describe('getPendingCount tras purga', () => {
    it('refleja el count correcto después de purgar', () => {
      setQueue([
        makeAnswer('session-A', 'q1'),
        makeAnswer('session-A', 'q2'),
        makeAnswer('session-B', 'q1'),
      ])

      const { purgeSessionAnswers, getPendingCount } = require('@/utils/answerSaveQueue')

      expect(getPendingCount()).toBe(3)
      purgeSessionAnswers('session-A')
      expect(getPendingCount()).toBe(1)
    })
  })

  describe('purgeSessionAnswers está exportada', () => {
    it('se puede importar desde el módulo', () => {
      const mod = require('@/utils/answerSaveQueue')
      expect(typeof mod.purgeSessionAnswers).toBe('function')
    })
  })

  describe('Integración: enqueue + purge', () => {
    it('enqueue añade y purge limpia correctamente', () => {
      const { enqueueAnswer, purgeSessionAnswers, getPendingCount } = require('@/utils/answerSaveQueue')

      // Mock fetch para que flush no falle
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ success: true, saveAction: 'saved_new' }),
      })

      // Encolar respuestas de dos tests diferentes
      enqueueAnswer({
        sessionId: 'test-1',
        questionId: 'q1',
        userId: 'user-1',
        userAnswer: 0,
        questionText: 'Q?',
        options: ['A', 'B', 'C', 'D'],
        currentScore: 0,
        questionIndex: 0,
      })
      enqueueAnswer({
        sessionId: 'test-2',
        questionId: 'q2',
        userId: 'user-1',
        userAnswer: 1,
        questionText: 'Q2?',
        options: ['A', 'B', 'C', 'D'],
        currentScore: 1,
        questionIndex: 1,
      })

      expect(getPendingCount()).toBeGreaterThanOrEqual(2)

      // Purgar test-1
      purgeSessionAnswers('test-1')

      // Solo queda test-2
      const queue = getQueue()
      const remaining = queue.answers.filter((a: any) => a.payload.sessionId === 'test-1')
      expect(remaining).toHaveLength(0)
    })
  })
})
