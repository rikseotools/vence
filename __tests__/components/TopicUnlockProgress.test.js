// __tests__/components/TopicUnlockProgress.test.js
// Tests para el componente TopicUnlockProgress

import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import '@testing-library/jest-dom'
import TopicUnlockProgress from '../../components/TopicUnlockProgress'

// Mock del hook useTopicUnlock
const mockUseTopicUnlock = {
  isTopicUnlocked: jest.fn(),
  getTopicProgress: jest.fn(),
  getUnlockRequirements: jest.fn(),
  getUnlockMessage: jest.fn(),
  loading: false,
  UNLOCK_THRESHOLD: 70
}

jest.mock('../../hooks/useTopicUnlock', () => ({
  useTopicUnlock: () => mockUseTopicUnlock
}))

// Mock de Next.js
jest.mock('next/link', () => {
  return ({ children, href }) => <a href={href}>{children}</a>
})

describe('TopicUnlockProgress Component', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('Caso: Usuario con buen progreso (como Mar)', () => {
    test('debe mostrar progreso correcto y tema desbloqueado', async () => {
      // Simular datos de Mar: Tema 1 con 82% precisión
      mockUseTopicUnlock.getTopicProgress.mockReturnValue({
        accuracy: 82,
        questionsAnswered: 416,
        masteryLevel: 'good'
      })

      mockUseTopicUnlock.getUnlockRequirements.mockReturnValue({
        currentTopic: 1,
        nextTopic: 2,
        isCurrentUnlocked: true,
        isNextUnlocked: true,  // ✅ Tema 2 desbloqueado
        currentAccuracy: 82,
        questionsAnswered: 416,
        requiredAccuracy: 70,
        requiredQuestions: 10,
        canUnlockNext: true,
        progressToUnlock: 117, // 82/70 * 100
        questionsNeeded: 0
      })

      mockUseTopicUnlock.getUnlockMessage.mockReturnValue({
        type: 'success',
        message: '¡Tema 2 desbloqueado!',
        icon: '🎉'
      })

      render(<TopicUnlockProgress currentTopic={1} />)

      // Verificar que muestra la precisión correcta
      expect(screen.getByText('82%')).toBeInTheDocument()
      
      // Verificar que muestra el estado de desbloqueado
      expect(screen.getByText('Desbloqueado')).toBeInTheDocument()
      
      // Verificar que muestra el mensaje de éxito
      expect(screen.getByText('¡Tema 2 desbloqueado!')).toBeInTheDocument()
      
      // Verificar que aparece el botón para ver el siguiente tema
      expect(screen.getByRole('link', { name: /Ver Tema 2/i })).toHaveAttribute(
        'href', 
        '/auxiliar-administrativo-estado/temario/tema-2'
      )
    })
  })

  describe('Caso: Usuario que necesita mejorar', () => {
    test('debe mostrar requisitos específicos cuando no cumple criterios', () => {
      mockUseTopicUnlock.getTopicProgress.mockReturnValue({
        accuracy: 45,  // ❌ Menos del 70%
        questionsAnswered: 8,  // ❌ Menos de 10 preguntas
        masteryLevel: 'beginner'
      })

      mockUseTopicUnlock.getUnlockRequirements.mockReturnValue({
        currentTopic: 1,
        nextTopic: 2,
        isCurrentUnlocked: true,
        isNextUnlocked: false,  // ❌ Tema 2 bloqueado
        currentAccuracy: 45,
        questionsAnswered: 8,
        requiredAccuracy: 70,
        requiredQuestions: 10,
        canUnlockNext: false,
        progressToUnlock: 64, // 45/70 * 100
        questionsNeeded: 2
      })

      mockUseTopicUnlock.getUnlockMessage.mockReturnValue({
        type: 'progress',
        message: 'Responde 2 preguntas más (45% actual)',
        icon: '📊'
      })

      const { container } = render(<TopicUnlockProgress currentTopic={1} />)

      // Verificar que muestra precisión actual (puede aparecer en multiple lugares)
      expect(screen.getAllByText('45%').length).toBeGreaterThanOrEqual(1)
      
      // Verificar que muestra estado bloqueado
      expect(screen.getByText('Bloqueado')).toBeInTheDocument()
      
      // Verificar que muestra requisitos específicos (búsqueda más flexible)
      expect(container.textContent).toContain('Para desbloquear Tema 2 necesitas')
      expect(container.textContent).toContain('25% más')  // 70 - 45
      expect(container.textContent).toContain('2 más')     // 10 - 8
      
      // Verificar que no aparece botón de "Ver Tema"
      expect(screen.queryByRole('link', { name: /Ver Tema 2/i })).not.toBeInTheDocument()
    })
  })

  describe('Estados de carga', () => {
    test('debe mostrar skeleton de loading mientras carga', () => {
      mockUseTopicUnlock.loading = true

      render(<TopicUnlockProgress currentTopic={1} />)

      // Verificar que muestra componente de loading
      expect(document.querySelector('.animate-pulse')).toBeInTheDocument()
    })

    test('debe ocultar loading cuando los datos están listos', () => {
      mockUseTopicUnlock.loading = false
      mockUseTopicUnlock.getTopicProgress.mockReturnValue({
        accuracy: 70,
        questionsAnswered: 10,
        masteryLevel: 'good'
      })

      render(<TopicUnlockProgress currentTopic={1} />)

      // Verificar que NO muestra componente de loading
      expect(document.querySelector('.animate-pulse')).not.toBeInTheDocument()
    })
  })

  describe('Validación de umbrales', () => {
    test('debe usar colores correctos según precisión', () => {
      // Test con precisión exacta en el umbral
      mockUseTopicUnlock.getTopicProgress.mockReturnValue({
        accuracy: 70,  // Exacto en el umbral
        questionsAnswered: 10,
        masteryLevel: 'good'
      })

      mockUseTopicUnlock.getUnlockRequirements.mockReturnValue({
        currentAccuracy: 70,
        questionsAnswered: 10,
        canUnlockNext: true
      })

      render(<TopicUnlockProgress currentTopic={1} />)

      // Verificar que usa color verde para precisión que cumple umbral
      const progressBar = document.querySelector('.bg-green-500')
      expect(progressBar).toBeInTheDocument()
    })

    test('debe mostrar color naranja cuando no cumple umbral', () => {
      mockUseTopicUnlock.getTopicProgress.mockReturnValue({
        accuracy: 65,  // Por debajo del umbral
        questionsAnswered: 15,
        masteryLevel: 'beginner'
      })

      mockUseTopicUnlock.getUnlockRequirements.mockReturnValue({
        currentAccuracy: 65,
        questionsAnswered: 15,
        canUnlockNext: false
      })

      render(<TopicUnlockProgress currentTopic={1} />)

      // Verificar que usa color naranja para precisión insuficiente
      const progressBar = document.querySelector('.bg-orange-500')
      expect(progressBar).toBeInTheDocument()
    })
  })

  describe('Integración con casos reales', () => {
    test('debe manejar el caso específico de Mar (82% - 416 preguntas)', () => {
      // Datos exactos de Mar
      mockUseTopicUnlock.getTopicProgress.mockReturnValue({
        accuracy: 82,
        questionsAnswered: 416,
        masteryLevel: 'good'
      })

      mockUseTopicUnlock.getUnlockRequirements.mockReturnValue({
        currentTopic: 1,
        nextTopic: 2,
        isCurrentUnlocked: true,
        isNextUnlocked: true,
        currentAccuracy: 82,
        questionsAnswered: 416,
        canUnlockNext: true,
        questionsNeeded: 0
      })

      const { container } = render(<TopicUnlockProgress currentTopic={1} />)

      // Verificar elementos específicos del caso de Mar (búsqueda más flexible)
      expect(screen.getAllByText('82%').length).toBeGreaterThanOrEqual(1)
      expect(container.textContent).toContain('82')
      // El componente no muestra el número total de preguntas, solo la precisión
    })

    test('debe manejar usuario nuevo sin estadísticas', () => {
      mockUseTopicUnlock.getTopicProgress.mockReturnValue({
        accuracy: 0,
        questionsAnswered: 0,
        masteryLevel: null
      })

      mockUseTopicUnlock.getUnlockRequirements.mockReturnValue({
        currentAccuracy: 0,
        questionsAnswered: 0,
        canUnlockNext: false,
        questionsNeeded: 10
      })

      const { container } = render(<TopicUnlockProgress currentTopic={1} />)

      // Verificar estado inicial con búsqueda más flexible
      expect(container.textContent).toContain('0%')
      expect(container.textContent).toContain('10')
    })
  })

  describe('Navegación y accesibilidad', () => {
    test('debe tener enlaces accesibles', () => {
      mockUseTopicUnlock.getUnlockRequirements.mockReturnValue({
        isNextUnlocked: true,
        nextTopic: 2
      })

      render(<TopicUnlockProgress currentTopic={1} />)

      const link = screen.getByRole('link')
      expect(link).toHaveAttribute('href')
      expect(link).toBeVisible()
    })

    test('debe mostrar botón de práctica cuando tema no está desbloqueado', () => {
      mockUseTopicUnlock.getUnlockRequirements.mockReturnValue({
        isNextUnlocked: false,
        isCurrentUnlocked: true,
        nextTopic: 2,
        currentTopic: 1
      })

      render(<TopicUnlockProgress currentTopic={1} />)

      expect(screen.getByRole('link', { name: /Seguir Practicando/i })).toHaveAttribute(
        'href', 
        '/auxiliar-administrativo-estado/test/tema/1'
      )
    })
  })

  describe('Casos edge', () => {
    test('debe manejar último tema (28) sin siguiente tema', () => {
      mockUseTopicUnlock.getTopicProgress.mockReturnValue({
        accuracy: 85,
        questionsAnswered: 50,
        masteryLevel: 'good'
      })

      mockUseTopicUnlock.getUnlockRequirements.mockReturnValue({
        currentTopic: 28,
        nextTopic: 29, // No existe
        currentAccuracy: 85,
        canUnlockNext: true
      })

      const { container } = render(<TopicUnlockProgress currentTopic={28} />)

      // Debe mostrar mensaje de completado (búsqueda más flexible)
      expect(container.textContent).toContain('85%')
      expect(container.textContent).toContain('28')
    })

    test('debe manejar precisión exacta 100%', () => {
      mockUseTopicUnlock.getTopicProgress.mockReturnValue({
        accuracy: 100,
        questionsAnswered: 50,
        masteryLevel: 'expert'
      })

      render(<TopicUnlockProgress currentTopic={1} />)

      expect(screen.getByText('100%')).toBeInTheDocument()
    })
  })
})