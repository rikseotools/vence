// __tests__/hooks/useTopicUnlock.test.js
// Tests unitarios para el hook useTopicUnlock

import { renderHook, waitFor } from '@testing-library/react'
import { useTopicUnlock } from '../../hooks/useTopicUnlock'

// Mock de Auth Context
const mockSupabase = {
  rpc: jest.fn(),
}

const mockUser = {
  id: 'test-user-123',
  email: 'test@example.com'
}

// Mock del contexto de autenticación
jest.mock('../../contexts/AuthContext', () => ({
  useAuth: () => ({
    user: mockUser,
    supabase: mockSupabase,
    loading: false
  })
}))

// Mock de Next.js
jest.mock('next/navigation', () => ({
  useRouter: () => ({
    push: jest.fn(),
    refresh: jest.fn(),
  }),
}))

describe('useTopicUnlock Hook', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('Cálculo de precisión y desbloqueo', () => {
    test('debe calcular correctamente la precisión por tema', async () => {
      // Mock data similar a los datos reales de Mar
      const mockThemeStats = [
        { tema_number: 1, total: 416, correct: 341, accuracy: 82, last_study: '2025-11-15' },
        { tema_number: 2, total: 143, correct: 110, accuracy: 77, last_study: '2025-11-14' },
        { tema_number: 3, total: 122, correct: 89, accuracy: 73, last_study: '2025-11-13' },
        { tema_number: 4, total: 125, correct: 75, accuracy: 60, last_study: '2025-11-12' }
      ]

      mockSupabase.rpc.mockResolvedValue({
        data: mockThemeStats,
        error: null
      })

      const { result } = renderHook(() => useTopicUnlock())

      await waitFor(() => {
        expect(result.current.loading).toBe(false)
      })

      // Verificar que se calculó correctamente el progreso
      const tema1Progress = result.current.getTopicProgress(1)
      expect(tema1Progress.accuracy).toBe(82)
      expect(tema1Progress.questionsAnswered).toBe(416)
      expect(tema1Progress.meetsThreshold).toBe(true)
      expect(tema1Progress.masteryLevel).toBe('good')
    })

    test('debe desbloquear temas secuencialmente según requisitos', async () => {
      const mockThemeStats = [
        { tema_number: 1, total: 50, correct: 45, accuracy: 90, last_study: '2025-11-15' }, // ✅ 90% + 50 preguntas
        { tema_number: 2, total: 30, correct: 24, accuracy: 80, last_study: '2025-11-14' }, // ✅ 80% + 30 preguntas
        { tema_number: 3, total: 5, correct: 4, accuracy: 80, last_study: '2025-11-13' },   // ❌ 80% pero solo 5 preguntas
        { tema_number: 4, total: 50, correct: 30, accuracy: 60, last_study: '2025-11-12' }  // ❌ 60% < 70%
      ]

      mockSupabase.rpc.mockResolvedValue({
        data: mockThemeStats,
        error: null
      })

      const { result } = renderHook(() => useTopicUnlock())

      await waitFor(() => {
        expect(result.current.loading).toBe(false)
      })

      // Verificar desbloqueo secuencial
      expect(result.current.isTopicUnlocked(1)).toBe(true)  // Siempre desbloqueado
      expect(result.current.isTopicUnlocked(2)).toBe(true)  // Tema 1 cumple requisitos
      expect(result.current.isTopicUnlocked(3)).toBe(true)  // Tema 2 cumple requisitos
      expect(result.current.isTopicUnlocked(4)).toBe(false) // Tema 3 no cumple 10+ preguntas
      expect(result.current.isTopicUnlocked(5)).toBe(false) // Tema 4 no está desbloqueado
    })

    test('debe manejar usuario sin estadísticas', async () => {
      mockSupabase.rpc.mockResolvedValue({
        data: [],
        error: null
      })

      const { result } = renderHook(() => useTopicUnlock())

      await waitFor(() => {
        expect(result.current.loading).toBe(false)
      })

      // Solo tema 1 desbloqueado
      expect(result.current.isTopicUnlocked(1)).toBe(true)
      expect(result.current.isTopicUnlocked(2)).toBe(false)
      
      // Sin progreso registrado
      const tema1Progress = result.current.getTopicProgress(1)
      expect(tema1Progress.accuracy).toBe(0)
      expect(tema1Progress.questionsAnswered).toBe(0)
    })

    test('debe manejar errores de API gracefully', async () => {
      mockSupabase.rpc.mockResolvedValue({
        data: null,
        error: { message: 'Database connection failed' }
      })

      const { result } = renderHook(() => useTopicUnlock())

      await waitFor(() => {
        expect(result.current.loading).toBe(false)
      })

      // Solo tema 1 desbloqueado como fallback
      expect(result.current.isTopicUnlocked(1)).toBe(true)
      expect(result.current.isTopicUnlocked(2)).toBe(false)
    })
  })

  describe('Requisitos de desbloqueo', () => {
    test('debe calcular correctamente los requisitos para desbloquear', async () => {
      const mockThemeStats = [
        { tema_number: 1, total: 50, correct: 40, accuracy: 80, last_study: '2025-11-15' }, // ✅ Cumple requisitos
        { tema_number: 2, total: 8, correct: 6, accuracy: 75, last_study: '2025-11-14' },   // ❌ Necesita 2 preguntas más
        { tema_number: 3, total: 20, correct: 12, accuracy: 60, last_study: '2025-11-13' } // ❌ Necesita más precisión
      ]

      mockSupabase.rpc.mockResolvedValue({
        data: mockThemeStats,
        error: null
      })

      const { result } = renderHook(() => useTopicUnlock())

      await waitFor(() => {
        expect(result.current.loading).toBe(false)
      })

      // Test tema que cumple requisitos
      const requirements1 = result.current.getUnlockRequirements(1)
      expect(requirements1.canUnlockNext).toBe(true)
      expect(requirements1.currentAccuracy).toBe(80)
      expect(requirements1.questionsAnswered).toBe(50)

      // Test tema que necesita más preguntas
      const requirements2 = result.current.getUnlockRequirements(2)
      expect(requirements2.canUnlockNext).toBe(false)
      expect(requirements2.questionsNeeded).toBe(2)
      expect(requirements2.currentAccuracy).toBe(75)

      // Test tema que necesita más precisión
      const requirements3 = result.current.getUnlockRequirements(3)
      expect(requirements3.canUnlockNext).toBe(false)
      expect(requirements3.questionsNeeded).toBe(0) // Ya tiene 10+
      expect(requirements3.currentAccuracy).toBe(60)
    })
  })

  describe('Mensajes de desbloqueo', () => {
    test('debe generar mensajes apropiados según el estado', async () => {
      const mockThemeStats = [
        { tema_number: 1, total: 50, correct: 45, accuracy: 90, last_study: '2025-11-15' },
        { tema_number: 2, total: 8, correct: 6, accuracy: 75, last_study: '2025-11-14' }
      ]

      mockSupabase.rpc.mockResolvedValue({
        data: mockThemeStats,
        error: null
      })

      const { result } = renderHook(() => useTopicUnlock())

      await waitFor(() => {
        expect(result.current.loading).toBe(false)
      })

      // Mensaje para tema completado que desbloquea el siguiente
      const message1 = result.current.getUnlockMessage(1)
      expect(message1.type).toBe('success')
      expect(message1.icon).toBe('🎉')

      // Mensaje para tema que necesita más preguntas
      const message2 = result.current.getUnlockMessage(2)
      expect(message2.type).toBe('progress')
      expect(message2.message).toContain('2 preguntas más')
    })
  })

  describe('Casos edge y algoritmos especiales', () => {
    test('debe manejar desbloqueo por progreso propio (self unlock)', async () => {
      // Usuario que saltó temas pero tiene buen progreso en tema avanzado
      const mockThemeStats = [
        { tema_number: 1, total: 50, correct: 35, accuracy: 70, last_study: '2025-11-15' }, // ✅ Justo cumple
        // Tema 2 sin datos (gap)
        { tema_number: 3, total: 25, correct: 19, accuracy: 76, last_study: '2025-11-13' }, // ✅ Buen progreso pero pocos intentos
        { tema_number: 4, total: 30, correct: 23, accuracy: 77, last_study: '2025-11-12' }  // ✅ Buen progreso
      ]

      mockSupabase.rpc.mockResolvedValue({
        data: mockThemeStats,
        error: null
      })

      const { result } = renderHook(() => useTopicUnlock())

      await waitFor(() => {
        expect(result.current.loading).toBe(false)
      })

      // Verificar que el algoritmo maneja gaps inteligentemente
      expect(result.current.isTopicUnlocked(1)).toBe(true)
      expect(result.current.isTopicUnlocked(2)).toBe(true) // Desbloqueado por tema 1
      
      // Tema 3 y 4 pueden estar desbloqueados por algoritmos especiales
      const tema3Unlocked = result.current.isTopicUnlocked(3)
      const tema4Unlocked = result.current.isTopicUnlocked(4)
      
      // Al menos uno debería estar desbloqueado debido a algoritmos flexibles
      expect(tema3Unlocked || tema4Unlocked).toBe(true)
    })

    test('debe aplicar UNLOCK_THRESHOLD correctamente', async () => {
      const mockThemeStats = [
        { tema_number: 1, total: 50, correct: 34, accuracy: 68, last_study: '2025-11-15' }, // ❌ 68% < 70%
        { tema_number: 2, total: 50, correct: 35, accuracy: 70, last_study: '2025-11-14' }, // ✅ Exacto 70%
        { tema_number: 3, total: 50, correct: 36, accuracy: 72, last_study: '2025-11-13' }  // ✅ 72% > 70%
      ]

      mockSupabase.rpc.mockResolvedValue({
        data: mockThemeStats,
        error: null
      })

      const { result } = renderHook(() => useTopicUnlock())

      await waitFor(() => {
        expect(result.current.loading).toBe(false)
      })

      // Verificar threshold exacto
      const progress1 = result.current.getTopicProgress(1)
      const progress2 = result.current.getTopicProgress(2)
      const progress3 = result.current.getTopicProgress(3)

      expect(progress1.meetsThreshold).toBe(false) // 68%
      expect(progress2.meetsThreshold).toBe(true)  // 70%
      expect(progress3.meetsThreshold).toBe(true)  // 72%

      // Verificar constante
      expect(result.current.UNLOCK_THRESHOLD).toBe(70)
    })
  })

  describe('Integración con datos reales', () => {
    test('debe procesar datos con formato de get_user_theme_stats', async () => {
      // Formato exacto que devuelve la función SQL
      const realFormatData = [
        {
          tema_number: 1,
          total: '416',      // String (viene de SQL)
          correct: '341',    // String (viene de SQL)
          accuracy: '82',    // String (viene de SQL)
          last_study: '2025-11-15T10:30:00.000Z'
        },
        {
          tema_number: 2,
          total: '143',
          correct: '110', 
          accuracy: '77',
          last_study: '2025-11-14T15:20:00.000Z'
        }
      ]

      mockSupabase.rpc.mockResolvedValue({
        data: realFormatData,
        error: null
      })

      const { result } = renderHook(() => useTopicUnlock())

      await waitFor(() => {
        expect(result.current.loading).toBe(false)
      })

      // Verificar que convierte strings a números correctamente
      const tema1Progress = result.current.getTopicProgress(1)
      expect(tema1Progress.accuracy).toBe(82)        // parseInt('82')
      expect(tema1Progress.questionsAnswered).toBe(416) // parseInt('416')
      
      // Verificar que parsea fechas correctamente
      expect(tema1Progress.lastStudy).toBeInstanceOf(Date)
    })
  })

  describe('Performance y optimización', () => {
    test('no debe hacer llamadas duplicadas a la API', async () => {
      mockSupabase.rpc.mockResolvedValue({
        data: [],
        error: null
      })

      const { result, rerender } = renderHook(() => useTopicUnlock())

      await waitFor(() => {
        expect(result.current.loading).toBe(false)
      })

      // Primer render debería hacer llamada
      expect(mockSupabase.rpc).toHaveBeenCalledTimes(1)

      // Re-render no debería hacer nueva llamada
      rerender()
      expect(mockSupabase.rpc).toHaveBeenCalledTimes(1)
    })

    test('debe manejar gran cantidad de datos eficientemente', async () => {
      // Simular usuario con datos en muchos temas
      const manyThemesData = Array.from({ length: 28 }, (_, i) => ({
        tema_number: i + 1,
        total: Math.floor(Math.random() * 100) + 10,
        correct: Math.floor(Math.random() * 50) + 5,
        accuracy: Math.floor(Math.random() * 100),
        last_study: new Date().toISOString()
      }))

      mockSupabase.rpc.mockResolvedValue({
        data: manyThemesData,
        error: null
      })

      const startTime = Date.now()
      const { result } = renderHook(() => useTopicUnlock())

      await waitFor(() => {
        expect(result.current.loading).toBe(false)
      })

      const processTime = Date.now() - startTime
      
      // Procesamiento debe ser rápido incluso con muchos datos
      expect(processTime).toBeLessThan(1000) // < 1 segundo
      expect(result.current.topicProgress).toBeDefined()
      expect(Object.keys(result.current.topicProgress).length).toBe(28)
    })
  })
})