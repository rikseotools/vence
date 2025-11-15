// __tests__/hooks/useTopicUnlock.test.js
// Tests unitarios para el hook useTopicUnlock con DATOS REALES

import { renderHook, act } from '@testing-library/react'
import { useTopicUnlock } from '../../hooks/useTopicUnlock'

// Mock de Supabase
const mockSupabase = {
  rpc: jest.fn()
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

describe('useTopicUnlock Hook - DATOS REALES', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('Bug crítico: tema_number 0-indexed', () => {
    test('debe procesar correctamente tema_number: 0 como Tema 1', async () => {
      // DATOS REALES: tema_number es 0-indexed (como Mar)
      const realThemeStats = [
        { tema_number: 0, total: 89, correct: 63, accuracy: 71, last_study: '2025-11-14T10:10:37.980615+00:00' }, // Tema 1
        { tema_number: 1, total: 416, correct: 341, accuracy: 82, last_study: '2025-11-13T15:30:00.000000+00:00' } // Tema 2
      ]

      mockSupabase.rpc.mockResolvedValue({
        data: realThemeStats,
        error: null
      })

      const { result } = renderHook(() => useTopicUnlock())

      // Esperar a que se carguen los datos
      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 100))
      })

      // Verificar que tema_number: 0 se mapea correctamente a Tema 1
      const tema1Progress = result.current.getTopicProgress(1)
      expect(tema1Progress.accuracy).toBe(71)
      expect(tema1Progress.questionsAnswered).toBe(89)
      expect(tema1Progress.meetsThreshold).toBe(true) // 71% >= 70%

      // Verificar que tema_number: 1 se mapea correctamente a Tema 2
      const tema2Progress = result.current.getTopicProgress(2)
      expect(tema2Progress.accuracy).toBe(82)
      expect(tema2Progress.questionsAnswered).toBe(416)
      expect(tema2Progress.meetsThreshold).toBe(true) // 82% >= 70%
    })

    test('debe desbloquear Tema 2 cuando Tema 1 cumple requisitos', async () => {
      // Escenario como Mar: Tema 1 con 71% y 89 preguntas
      const marData = [
        { tema_number: 0, total: 89, correct: 63, accuracy: 71, last_study: '2025-11-14' } // Tema 1
      ]

      mockSupabase.rpc.mockResolvedValue({
        data: marData,
        error: null
      })

      const { result } = renderHook(() => useTopicUnlock())

      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 100))
      })

      // Tema 1 siempre desbloqueado
      expect(result.current.isTopicUnlocked(1)).toBe(true)
      
      // Tema 2 debe estar desbloqueado porque Tema 1 cumple: 71% >= 70% y 89 >= 10
      expect(result.current.isTopicUnlocked(2)).toBe(true)
    })
  })

  describe('Cálculo de precisión y desbloqueo', () => {
    test('debe calcular correctamente con datos realistas', async () => {
      // Mock data basado en estructura real de get_user_theme_stats
      const realThemeStats = [
        { tema_number: 0, total: 416, correct: 341, accuracy: 82, last_study: '2025-11-15' }, // Tema 1: Excelente
        { tema_number: 1, total: 143, correct: 110, accuracy: 77, last_study: '2025-11-14' }, // Tema 2: Bueno
        { tema_number: 2, total: 122, correct: 89, accuracy: 73, last_study: '2025-11-13' },  // Tema 3: Bueno
        { tema_number: 3, total: 125, correct: 75, accuracy: 60, last_study: '2025-11-12' }   // Tema 4: Bajo
      ]

      mockSupabase.rpc.mockResolvedValue({
        data: realThemeStats,
        error: null
      })

      const { result } = renderHook(() => useTopicUnlock())

      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 100))
      })

      // Verificar Tema 1 (tema_number: 0)
      const tema1Progress = result.current.getTopicProgress(1)
      expect(tema1Progress.accuracy).toBe(82)
      expect(tema1Progress.questionsAnswered).toBe(416)
      expect(tema1Progress.meetsThreshold).toBe(true)
      expect(tema1Progress.masteryLevel).toBe('good')

      // Verificar desbloqueos secuenciales
      expect(result.current.isTopicUnlocked(1)).toBe(true)  // Siempre
      expect(result.current.isTopicUnlocked(2)).toBe(true)  // 82% >= 70%, 416 >= 10
      expect(result.current.isTopicUnlocked(3)).toBe(true)  // 77% >= 70%, 143 >= 10  
      expect(result.current.isTopicUnlocked(4)).toBe(true)  // 73% >= 70%, 122 >= 10
      expect(result.current.isTopicUnlocked(5)).toBe(false) // Tema 4 solo 60% < 70%
    })

    test('debe manejar usuario sin estadísticas', async () => {
      mockSupabase.rpc.mockResolvedValue({
        data: [],
        error: null
      })

      const { result } = renderHook(() => useTopicUnlock())

      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 100))
      })

      // Solo Tema 1 debe estar desbloqueado
      expect(result.current.isTopicUnlocked(1)).toBe(true)
      expect(result.current.isTopicUnlocked(2)).toBe(false)
      
      // Sin progreso
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

      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 100))
      })

      // Debe mantener estado seguro
      expect(result.current.isTopicUnlocked(1)).toBe(true)
      expect(result.current.isTopicUnlocked(2)).toBe(false)
    })
  })

  describe('Requisitos de desbloqueo', () => {
    test('debe calcular correctamente los requisitos', async () => {
      const mockThemeStats = [
        { tema_number: 0, total: 50, correct: 40, accuracy: 80, last_study: '2025-11-15' }, // Tema 1: ✅ Cumple
        { tema_number: 1, total: 8, correct: 6, accuracy: 75, last_study: '2025-11-14' },   // Tema 2: ❌ Necesita 2 preguntas
        { tema_number: 2, total: 20, correct: 12, accuracy: 60, last_study: '2025-11-13' } // Tema 3: ❌ Necesita precisión
      ]

      mockSupabase.rpc.mockResolvedValue({
        data: mockThemeStats,
        error: null
      })

      const { result } = renderHook(() => useTopicUnlock())

      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 100))
      })

      // Tema 1 cumple requisitos
      const requirements1 = result.current.getUnlockRequirements(1)
      expect(requirements1.canUnlockNext).toBe(true)
      expect(requirements1.currentAccuracy).toBe(80)
      expect(requirements1.questionsAnswered).toBe(50)

      // Tema 2 necesita más preguntas
      const requirements2 = result.current.getUnlockRequirements(2)
      expect(requirements2.canUnlockNext).toBe(false)
      expect(requirements2.questionsNeeded).toBe(2) // 10 - 8 = 2
    })
  })

  describe('Mensajes de desbloqueo', () => {
    test('debe generar mensajes apropiados según el estado', async () => {
      const mockThemeStats = [
        { tema_number: 0, total: 50, correct: 45, accuracy: 90, last_study: '2025-11-15' }, // Tema 1: Excelente
        { tema_number: 1, total: 8, correct: 6, accuracy: 75, last_study: '2025-11-14' }    // Tema 2: Necesita preguntas
      ]

      mockSupabase.rpc.mockResolvedValue({
        data: mockThemeStats,
        error: null
      })

      const { result } = renderHook(() => useTopicUnlock())

      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 100))
      })

      // Mensaje para tema desbloqueado
      const message1 = result.current.getUnlockMessage(1)
      expect(message1.type).toBe('success')
      expect(message1.message).toContain('desbloqueado')

      // Mensaje para tema que necesita más preguntas
      const message2 = result.current.getUnlockMessage(2)
      expect(message2.type).toBe('progress')
      expect(message2.message).toContain('2 preguntas más')
    })
  })

  describe('Casos edge críticos', () => {
    test('debe manejar desbloqueo por progreso propio (self unlock)', async () => {
      // Escenario: Usuario responde directamente en tema 5 sin completar anteriores
      const mockThemeStats = [
        { tema_number: 4, total: 50, correct: 40, accuracy: 80, last_study: '2025-11-15' } // Tema 5 directamente
      ]

      mockSupabase.rpc.mockResolvedValue({
        data: mockThemeStats,
        error: null
      })

      const { result } = renderHook(() => useTopicUnlock())

      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 100))
      })

      // Tema 5 debe estar auto-desbloqueado por progreso propio
      expect(result.current.isTopicUnlocked(5)).toBe(true)
    })

    test('debe aplicar UNLOCK_THRESHOLD=70 correctamente', async () => {
      const mockThemeStats = [
        { tema_number: 0, total: 50, correct: 34, accuracy: 68, last_study: '2025-11-15' }, // 68% < 70%
        { tema_number: 1, total: 50, correct: 35, accuracy: 70, last_study: '2025-11-14' }, // 70% = 70%
        { tema_number: 2, total: 50, correct: 36, accuracy: 72, last_study: '2025-11-13' }  // 72% > 70%
      ]

      mockSupabase.rpc.mockResolvedValue({
        data: mockThemeStats,
        error: null
      })

      const { result } = renderHook(() => useTopicUnlock())

      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 100))
      })

      const progress1 = result.current.getTopicProgress(1)
      const progress2 = result.current.getTopicProgress(2)
      const progress3 = result.current.getTopicProgress(3)

      expect(progress1.meetsThreshold).toBe(false) // 68% < 70%
      expect(progress2.meetsThreshold).toBe(true)  // 70% >= 70%
      expect(progress3.meetsThreshold).toBe(true)  // 72% >= 70%
    })
  })

  describe('Integración con datos reales', () => {
    test('debe procesar datos con formato exact de get_user_theme_stats', async () => {
      // Datos exactos como los devuelve la función SQL
      const exactRealFormat = [
        {
          tema_number: 0,
          total: '416',      // STRING (como viene de BD)
          correct: '341',    // STRING
          accuracy: 82,      // NUMBER
          last_study: '2025-11-15T10:30:00.000000+00:00'
        }
      ]

      mockSupabase.rpc.mockResolvedValue({
        data: exactRealFormat,
        error: null
      })

      const { result } = renderHook(() => useTopicUnlock())

      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 100))
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

      const { result } = renderHook(() => useTopicUnlock())

      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 100))
      })

      // Verificar que solo se llama una vez
      expect(mockSupabase.rpc).toHaveBeenCalledTimes(1)
      expect(mockSupabase.rpc).toHaveBeenCalledWith('get_user_theme_stats', { p_user_id: 'test-user-123' })
    })

    test('debe manejar gran cantidad de datos eficientemente', async () => {
      // Simular usuario con todos los temas
      const allThemesData = Array.from({ length: 28 }, (_, i) => ({
        tema_number: i,
        total: Math.floor(Math.random() * 100) + 10,
        correct: Math.floor(Math.random() * 50) + 10,
        accuracy: Math.floor(Math.random() * 40) + 60, // 60-100%
        last_study: '2025-11-15'
      }))

      mockSupabase.rpc.mockResolvedValue({
        data: allThemesData,
        error: null
      })

      const { result } = renderHook(() => useTopicUnlock())

      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 100))
      })

      // Verificar que procesa todos los temas sin errores
      expect(result.current.getTopicProgress(1)).toBeDefined()
      expect(result.current.getTopicProgress(28)).toBeDefined()
      
      // Performance: debe ejecutarse en tiempo razonable
      const start = performance.now()
      result.current.isTopicUnlocked(15)
      const end = performance.now()
      expect(end - start).toBeLessThan(10) // Menos de 10ms
    })
  })
})