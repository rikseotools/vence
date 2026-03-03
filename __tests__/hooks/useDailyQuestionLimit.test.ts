// __tests__/hooks/useDailyQuestionLimit.test.js
// Tests unitarios para el hook useDailyQuestionLimit y sistema de tracking

import { renderHook, act } from '@testing-library/react'

// Mock de localStorage
const localStorageMock = (() => {
  let store = {}
  return {
    getItem: jest.fn(key => store[key] || null),
    setItem: jest.fn((key, value) => { store[key] = value }),
    removeItem: jest.fn(key => { delete store[key] }),
    clear: jest.fn(() => { store = {} })
  }
})()

Object.defineProperty(window, 'localStorage', { value: localStorageMock })

// Mock de trackLimitReached
const mockTrackLimitReached = jest.fn().mockResolvedValue({ id: 'event-123' })

jest.mock('../../lib/services/conversionTracker', () => ({
  trackLimitReached: (...args) => mockTrackLimitReached(...args)
}))

// Mock de Supabase
const mockRpc = jest.fn()
const mockSupabase = { rpc: mockRpc }

const mockUser = {
  id: 'test-user-abc123',
  email: 'test@example.com'
}

const mockUserProfile = {
  id: 'test-user-abc123',
  plan_type: 'free'
}

// Mock del contexto de autenticación
jest.mock('../../contexts/AuthContext', () => ({
  useAuth: () => ({
    user: mockUser,
    userProfile: mockUserProfile,
    supabase: mockSupabase,
    isPremium: false,
    isLegacy: false,
    loading: false
  })
}))

// Importar el hook después de los mocks
import { useDailyQuestionLimit } from '../../hooks/useDailyQuestionLimit'

describe('useDailyQuestionLimit Hook', () => {
  const TODAY = new Date().toISOString().split('T')[0]

  beforeEach(() => {
    jest.clearAllMocks()
    localStorageMock.clear()

    // Mock por defecto: usuario con 20 preguntas
    mockRpc.mockResolvedValue({
      data: {
        questions_today: 20,
        questions_remaining: 5,
        is_limit_reached: false,
        is_premium: false,
        reset_time: new Date().toISOString()
      },
      error: null
    })
  })

  describe('Tracking de limit_reached', () => {
    test('debe trackear cuando usuario llega EXACTAMENTE a 25', async () => {
      // Limpiar localStorage antes del test
      localStorageMock.clear()

      // Configurar mock: siempre retorna 25 preguntas (límite alcanzado)
      mockRpc.mockResolvedValue({
        data: {
          questions_today: 25,
          questions_remaining: 0,
          is_limit_reached: true,
          is_premium: false
        },
        error: null
      })

      const { result } = renderHook(() => useDailyQuestionLimit())

      // Esperar carga inicial
      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 100))
      })

      // Llamar recordAnswer (simula responder pregunta 25)
      await act(async () => {
        await result.current.recordAnswer()
      })

      // Verificar que se llamó trackLimitReached
      expect(mockTrackLimitReached).toHaveBeenCalledTimes(1)
      expect(mockTrackLimitReached).toHaveBeenCalledWith(
        mockSupabase,
        mockUser.id,
        25
      )
    })

    test('NO debe trackear cuando questions_today > 25', async () => {
      // Simular que el usuario ya tiene más de 25 (edge case)
      mockRpc.mockResolvedValueOnce({
        data: { questions_today: 20, questions_remaining: 5, is_limit_reached: false },
        error: null
      }).mockResolvedValueOnce({
        data: {
          questions_today: 26, // Más de 25
          questions_remaining: 0,
          is_limit_reached: true,
          is_premium: false
        },
        error: null
      })

      const { result } = renderHook(() => useDailyQuestionLimit())

      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 50))
      })

      await act(async () => {
        await result.current.recordAnswer()
      })

      // NO debe trackear porque questions_today !== 25
      expect(mockTrackLimitReached).not.toHaveBeenCalled()
    })

    test('NO debe trackear duplicados en la misma sesión (ref)', async () => {
      // Primera llamada: llega a 25
      mockRpc.mockResolvedValue({
        data: {
          questions_today: 25,
          questions_remaining: 0,
          is_limit_reached: true,
          is_premium: false
        },
        error: null
      })

      const { result } = renderHook(() => useDailyQuestionLimit())

      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 50))
      })

      // Primera llamada - debe trackear
      await act(async () => {
        await result.current.recordAnswer()
      })

      expect(mockTrackLimitReached).toHaveBeenCalledTimes(1)

      // Segunda llamada - NO debe trackear (ref bloquea)
      await act(async () => {
        await result.current.recordAnswer()
      })

      expect(mockTrackLimitReached).toHaveBeenCalledTimes(1) // Sigue siendo 1

      // Tercera llamada - NO debe trackear
      await act(async () => {
        await result.current.recordAnswer()
      })

      expect(mockTrackLimitReached).toHaveBeenCalledTimes(1) // Sigue siendo 1
    })

    test('NO debe trackear si localStorage ya tiene el flag', async () => {
      // Simular que localStorage ya tiene el flag (recarga de página)
      const storageKey = `limit_tracked_${mockUser.id}_${TODAY}`
      localStorageMock.setItem(storageKey, 'true')

      mockRpc.mockResolvedValue({
        data: {
          questions_today: 25,
          questions_remaining: 0,
          is_limit_reached: true,
          is_premium: false
        },
        error: null
      })

      const { result } = renderHook(() => useDailyQuestionLimit())

      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 50))
      })

      await act(async () => {
        await result.current.recordAnswer()
      })

      // NO debe trackear porque localStorage ya tiene el flag
      expect(mockTrackLimitReached).not.toHaveBeenCalled()
    })

    test('debe guardar flag en localStorage después de trackear', async () => {
      mockRpc.mockResolvedValue({
        data: {
          questions_today: 25,
          questions_remaining: 0,
          is_limit_reached: true,
          is_premium: false
        },
        error: null
      })

      const { result } = renderHook(() => useDailyQuestionLimit())

      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 50))
      })

      await act(async () => {
        await result.current.recordAnswer()
      })

      const storageKey = `limit_tracked_${mockUser.id}_${TODAY}`
      expect(localStorageMock.setItem).toHaveBeenCalledWith(storageKey, 'true')
    })
  })

  describe('Modal de upgrade', () => {
    test('debe mostrar modal cuando is_limit_reached es true', async () => {
      mockRpc.mockResolvedValue({
        data: {
          questions_today: 25,
          questions_remaining: 0,
          is_limit_reached: true,
          is_premium: false
        },
        error: null
      })

      const { result } = renderHook(() => useDailyQuestionLimit())

      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 50))
      })

      await act(async () => {
        await result.current.recordAnswer()
      })

      expect(result.current.showUpgradeModal).toBe(true)
    })

    test('NO debe mostrar modal si no alcanza límite', async () => {
      mockRpc.mockResolvedValue({
        data: {
          questions_today: 20,
          questions_remaining: 5,
          is_limit_reached: false,
          is_premium: false
        },
        error: null
      })

      const { result } = renderHook(() => useDailyQuestionLimit())

      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 50))
      })

      await act(async () => {
        await result.current.recordAnswer()
      })

      expect(result.current.showUpgradeModal).toBe(false)
    })
  })

  describe('recordAnswer respuestas', () => {
    test('debe retornar canContinue: true si no alcanza límite', async () => {
      mockRpc.mockResolvedValue({
        data: {
          questions_today: 20,
          questions_remaining: 5,
          is_limit_reached: false,
          is_premium: false
        },
        error: null
      })

      const { result } = renderHook(() => useDailyQuestionLimit())

      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 50))
      })

      let response
      await act(async () => {
        response = await result.current.recordAnswer()
      })

      expect(response.success).toBe(true)
      expect(response.canContinue).toBe(true)
      expect(response.questionsRemaining).toBe(5)
    })

    test('debe retornar canContinue: false si alcanza límite', async () => {
      mockRpc.mockResolvedValue({
        data: {
          questions_today: 25,
          questions_remaining: 0,
          is_limit_reached: true,
          is_premium: false
        },
        error: null
      })

      const { result } = renderHook(() => useDailyQuestionLimit())

      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 50))
      })

      let response
      await act(async () => {
        response = await result.current.recordAnswer()
      })

      expect(response.success).toBe(true)
      expect(response.canContinue).toBe(false)
      expect(response.isLimitReached).toBe(true)
    })
  })
})

describe('Escenarios de Deduplicación', () => {
  const TODAY = new Date().toISOString().split('T')[0]

  beforeEach(() => {
    jest.clearAllMocks()
    localStorageMock.clear()
  })

  test('Escenario: Usuario responde 25, recarga, intenta responder', async () => {
    // PASO 1: Usuario responde pregunta 25 (primera vez)
    mockRpc.mockResolvedValue({
      data: {
        questions_today: 25,
        questions_remaining: 0,
        is_limit_reached: true,
        is_premium: false
      },
      error: null
    })

    const { result: result1, unmount } = renderHook(() => useDailyQuestionLimit())

    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 50))
    })

    await act(async () => {
      await result1.current.recordAnswer()
    })

    expect(mockTrackLimitReached).toHaveBeenCalledTimes(1)

    // PASO 2: Usuario recarga página (unmount + nuevo hook)
    unmount()
    mockTrackLimitReached.mockClear()

    const { result: result2 } = renderHook(() => useDailyQuestionLimit())

    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 50))
    })

    // PASO 3: Usuario intenta responder de nuevo
    await act(async () => {
      await result2.current.recordAnswer()
    })

    // NO debe trackear porque localStorage tiene el flag
    expect(mockTrackLimitReached).not.toHaveBeenCalled()
  })

  test('Escenario: Dos usuarios diferentes llegan a 25', async () => {
    mockRpc.mockResolvedValue({
      data: {
        questions_today: 25,
        questions_remaining: 0,
        is_limit_reached: true,
        is_premium: false
      },
      error: null
    })

    // Usuario 1
    const { result: result1 } = renderHook(() => useDailyQuestionLimit())

    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 50))
    })

    await act(async () => {
      await result1.current.recordAnswer()
    })

    expect(mockTrackLimitReached).toHaveBeenCalledTimes(1)

    // Limpiar localStorage para simular otro usuario
    localStorageMock.clear()
    mockTrackLimitReached.mockClear()

    // Usuario 2 (diferente)
    const { result: result2 } = renderHook(() => useDailyQuestionLimit())

    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 50))
    })

    await act(async () => {
      await result2.current.recordAnswer()
    })

    // Debe trackear para el segundo usuario también
    expect(mockTrackLimitReached).toHaveBeenCalledTimes(1)
  })
})

describe('Sincronización por Eventos (Cross-Component)', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    localStorageMock.clear()
  })

  test('debe emitir evento dailyLimitUpdated cuando recordAnswer actualiza estado', async () => {
    const eventListener = jest.fn()
    window.addEventListener('dailyLimitUpdated', eventListener)

    mockRpc.mockResolvedValue({
      data: {
        questions_today: 21,
        questions_remaining: 4,
        is_limit_reached: false,
        is_premium: false,
        reset_time: new Date().toISOString()
      },
      error: null
    })

    const { result } = renderHook(() => useDailyQuestionLimit())

    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 50))
    })

    await act(async () => {
      await result.current.recordAnswer()
    })

    // Verificar que el evento fue emitido
    expect(eventListener).toHaveBeenCalled()

    // Verificar que el evento tiene los datos correctos
    const eventDetail = eventListener.mock.calls[0][0].detail
    expect(eventDetail.questionsToday).toBe(21)
    expect(eventDetail.questionsRemaining).toBe(4)
    expect(eventDetail.isLimitReached).toBe(false)

    window.removeEventListener('dailyLimitUpdated', eventListener)
  })

  test('debe sincronizar estado entre múltiples instancias del hook', async () => {
    // Configurar respuesta inicial
    mockRpc.mockResolvedValue({
      data: {
        questions_today: 10,
        questions_remaining: 15,
        is_limit_reached: false,
        is_premium: false,
        reset_time: new Date().toISOString()
      },
      error: null
    })

    // Crear dos instancias del hook (simula TestLayout y DailyLimitBanner)
    const { result: hook1 } = renderHook(() => useDailyQuestionLimit())
    const { result: hook2 } = renderHook(() => useDailyQuestionLimit())

    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 50))
    })

    // Ambos deben tener el mismo estado inicial
    expect(hook1.current.questionsToday).toBe(10)
    expect(hook2.current.questionsToday).toBe(10)

    // Configurar respuesta para incremento
    mockRpc.mockResolvedValue({
      data: {
        questions_today: 11,
        questions_remaining: 14,
        is_limit_reached: false,
        is_premium: false,
        reset_time: new Date().toISOString()
      },
      error: null
    })

    // Hook 1 llama recordAnswer (simula que TestLayout responde pregunta)
    await act(async () => {
      await hook1.current.recordAnswer()
    })

    // Esperar propagación del evento
    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 50))
    })

    // AMBOS hooks deben tener el estado actualizado
    expect(hook1.current.questionsToday).toBe(11)
    expect(hook2.current.questionsToday).toBe(11)
    expect(hook1.current.questionsRemaining).toBe(14)
    expect(hook2.current.questionsRemaining).toBe(14)
  })

  test('debe sincronizar isLimitReached entre instancias cuando se alcanza límite', async () => {
    // Distinguir por nombre de RPC
    mockRpc.mockImplementation((rpcName) => {
      if (rpcName === 'get_daily_question_status') {
        return Promise.resolve({
          data: {
            questions_today: 24,
            questions_remaining: 1,
            is_limit_reached: false,
            is_premium: false
          },
          error: null
        })
      }
      // increment_daily_questions (recordAnswer)
      return Promise.resolve({
        data: {
          questions_today: 25,
          questions_remaining: 0,
          is_limit_reached: true,
          is_premium: false
        },
        error: null
      })
    })

    const { result: testLayoutHook } = renderHook(() => useDailyQuestionLimit())
    const { result: bannerHook } = renderHook(() => useDailyQuestionLimit())

    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 100))
    })

    // Verificar estado inicial - ambos deben NO haber alcanzado límite
    expect(testLayoutHook.current.isLimitReached).toBe(false)
    expect(bannerHook.current.isLimitReached).toBe(false)
    expect(testLayoutHook.current.questionsToday).toBe(24)

    // TestLayout responde última pregunta
    await act(async () => {
      await testLayoutHook.current.recordAnswer()
    })

    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 50))
    })

    // AMBOS deben saber que se alcanzó el límite (sincronizados por evento)
    expect(testLayoutHook.current.isLimitReached).toBe(true)
    expect(bannerHook.current.isLimitReached).toBe(true)
    expect(testLayoutHook.current.questionsToday).toBe(25)
    expect(bannerHook.current.questionsToday).toBe(25)
  })

  test('evento no debe afectar hooks desmontados', async () => {
    mockRpc.mockResolvedValue({
      data: {
        questions_today: 15,
        questions_remaining: 10,
        is_limit_reached: false,
        is_premium: false,
        reset_time: new Date().toISOString()
      },
      error: null
    })

    const { result: hook1 } = renderHook(() => useDailyQuestionLimit())
    const { result: hook2, unmount: unmountHook2 } = renderHook(() => useDailyQuestionLimit())

    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 50))
    })

    // Desmontar hook2 (simula que DailyLimitBanner se desmonta)
    unmountHook2()

    // Configurar nueva respuesta
    mockRpc.mockResolvedValue({
      data: {
        questions_today: 16,
        questions_remaining: 9,
        is_limit_reached: false,
        is_premium: false
      },
      error: null
    })

    // Hook1 actualiza - no debe causar errores aunque hook2 esté desmontado
    await act(async () => {
      await hook1.current.recordAnswer()
    })

    // Hook1 debe actualizarse correctamente
    expect(hook1.current.questionsToday).toBe(16)
    // No debe haber errores (el test pasaría si no hay crashes)
  })

  test('múltiples recordAnswer secuenciales deben sincronizar correctamente', async () => {
    let callCount = 20
    mockRpc.mockImplementation(() => {
      callCount++
      return Promise.resolve({
        data: {
          questions_today: callCount,
          questions_remaining: 25 - callCount,
          is_limit_reached: callCount >= 25,
          is_premium: false
        },
        error: null
      })
    })

    const { result: hook1 } = renderHook(() => useDailyQuestionLimit())
    const { result: hook2 } = renderHook(() => useDailyQuestionLimit())

    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 50))
    })

    // Responder 3 preguntas seguidas
    for (let i = 0; i < 3; i++) {
      await act(async () => {
        await hook1.current.recordAnswer()
      })
      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 20))
      })
    }

    // Ambos hooks deben estar sincronizados con el último valor
    expect(hook1.current.questionsToday).toBe(hook2.current.questionsToday)
    expect(hook1.current.questionsRemaining).toBe(hook2.current.questionsRemaining)
  })
})
