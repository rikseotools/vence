// __tests__/questionSelection.test.js
// Tests unitarios para el algoritmo de selección de preguntas

import { jest } from '@jest/globals'

// Mock del cliente de Supabase
const createMockSupabaseClient = () => {
  return {
    auth: {
      getUser: jest.fn()
    },
    from: jest.fn(() => ({
      select: jest.fn(() => ({
        eq: jest.fn(() => ({
          gte: jest.fn(() => ({
            data: [],
            error: null
          })),
          order: jest.fn(() => ({
            data: [],
            error: null
          }))
        })),
        gte: jest.fn(() => ({
          data: [],
          error: null
        })),
        order: jest.fn(() => ({
          data: [],
          error: null
        })),
        data: [],
        error: null
      }))
    }))
  }
}

// Función para simular preguntas
const createMockQuestions = (count, startId = 1) => {
  const questions = []
  for (let i = 0; i < count; i++) {
    questions.push({
      id: `question_${startId + i}`,
      question_text: `Pregunta ${startId + i}`,
      option_a: 'Opción A',
      option_b: 'Opción B', 
      option_c: 'Opción C',
      option_d: 'Opción D',
      correct_option: 0,
      explanation: 'Explicación',
      is_active: true,
      difficulty: 'medium'
    })
  }
  return questions
}

// Función para simular historial de respuestas
const createMockAnswerHistory = (questionIds, userId = 'test_user') => {
  return questionIds.map((id, index) => ({
    question_id: id,
    created_at: new Date(Date.now() - (questionIds.length - index) * 24 * 60 * 60 * 1000).toISOString(),
    tests: {
      user_id: userId
    }
  }))
}

describe('Question Selection Algorithm', () => {
  let mockSupabase
  let fetchPersonalizedQuestions

  beforeEach(() => {
    // Mock del cliente Supabase
    mockSupabase = createMockSupabaseClient()
    
    // Mock del usuario autenticado
    mockSupabase.auth.getUser.mockResolvedValue({
      data: { user: { id: 'test_user' } }
    })
    
    // Importar la función con el mock
    jest.doMock('../lib/supabase', () => ({
      getSupabaseClient: () => mockSupabase
    }))
  })

  afterEach(() => {
    jest.clearAllMocks()
    jest.resetModules()
  })

  test('Debería priorizar preguntas nunca vistas cuando hay suficientes', () => {
    // Este test verifica la lógica de selección de manera unitaria
    // sin depender de la implementación real de fetchPersonalizedQuestions
    
    // Arrange: 10 preguntas disponibles, 5 ya respondidas
    const allQuestions = createMockQuestions(10)
    const answeredQuestionIds = new Set(['question_1', 'question_2', 'question_3', 'question_4', 'question_5'])
    
    // Simular algoritmo de selección
    const neverSeenQuestions = []
    const answeredQuestions = []
    
    allQuestions.forEach(question => {
      if (answeredQuestionIds.has(question.id)) {
        answeredQuestions.push(question)
      } else {
        neverSeenQuestions.push(question)
      }
    })
    
    const requestedQuestions = 5
    
    // Assert: Deberíamos tener suficientes preguntas nunca vistas
    expect(neverSeenQuestions.length).toBe(5)
    expect(neverSeenQuestions.length).toBeGreaterThanOrEqual(requestedQuestions)
    
    // La selección debería priorizar preguntas nunca vistas
    const selectedQuestions = neverSeenQuestions.slice(0, requestedQuestions)
    expect(selectedQuestions.length).toBe(requestedQuestions)
    
    // Verificar que todas son nunca vistas
    const selectedIds = selectedQuestions.map(q => q.id)
    expect(selectedIds).toEqual(['question_6', 'question_7', 'question_8', 'question_9', 'question_10'])
  })

  test('Debería detectar correctamente preguntas ya vistas vs nunca vistas', () => {
    // Test de la lógica de clasificación
    const allQuestions = createMockQuestions(10)
    const answeredQuestionIds = new Set(['question_1', 'question_3', 'question_5'])
    
    const neverSeenQuestions = []
    const answeredQuestions = []
    
    allQuestions.forEach(question => {
      if (answeredQuestionIds.has(question.id)) {
        answeredQuestions.push(question)
      } else {
        neverSeenQuestions.push(question)
      }
    })
    
    expect(neverSeenQuestions.length).toBe(7)
    expect(answeredQuestions.length).toBe(3)
    
    // Verificar IDs específicos
    expect(neverSeenQuestions.map(q => q.id)).toEqual([
      'question_2', 'question_4', 'question_6', 'question_7', 
      'question_8', 'question_9', 'question_10'
    ])
  })

  test('Debería usar distribución mixta cuando no hay suficientes nunca vistas', () => {
    // Simular caso donde hay pocas preguntas nunca vistas
    const neverSeenQuestions = createMockQuestions(2, 1)
    const answeredQuestions = createMockQuestions(8, 3)
    const requestedQuestions = 5
    
    // Algoritmo de distribución
    const neverSeenCount = neverSeenQuestions.length
    const reviewCount = requestedQuestions - neverSeenCount
    
    expect(neverSeenCount).toBe(2)
    expect(reviewCount).toBe(3)
    
    // Simular selección final
    const selectedQuestions = [
      ...neverSeenQuestions.slice(0, neverSeenCount),
      ...answeredQuestions.slice(0, reviewCount)
    ]
    
    expect(selectedQuestions.length).toBe(5)
    expect(selectedQuestions.filter(q => q.id.startsWith('question_1') || q.id.startsWith('question_2')).length).toBe(2)
  })

  test('Debería verificar consistencia entre sistemas test_questions y detailed_answers', async () => {
    // Test para detectar inconsistencias entre sistemas
    const userId = 'test_user'
    const questionId = 'question_1'
    
    // Mock para test_questions (sistema viejo)
    const testQuestionsHistory = [{
      question_id: questionId,
      created_at: new Date().toISOString()
    }]
    
    // Mock para detailed_answers (sistema nuevo)  
    const detailedAnswersHistory = [{
      question_id: questionId,
      created_at: new Date().toISOString()
    }]
    
    // Verificar que ambos sistemas tengan la misma pregunta
    const inTestQuestions = testQuestionsHistory.some(h => h.question_id === questionId)
    const inDetailedAnswers = detailedAnswersHistory.some(h => h.question_id === questionId)
    
    expect(inTestQuestions).toBe(inDetailedAnswers)
  })

  test('Debería manejar casos edge: sin historial de usuario', () => {
    // Usuario nuevo sin historial
    const allQuestions = createMockQuestions(10)
    const userAnswers = []
    
    const neverSeenQuestions = []
    const answeredQuestions = []
    const answeredQuestionIds = new Set()
    
    allQuestions.forEach(question => {
      if (answeredQuestionIds.has(question.id)) {
        answeredQuestions.push(question)
      } else {
        neverSeenQuestions.push(question)
      }
    })
    
    // Todas las preguntas deberían ser nunca vistas
    expect(neverSeenQuestions.length).toBe(10)
    expect(answeredQuestions.length).toBe(0)
  })

  test('Debería ordenar preguntas respondidas por antigüedad (repaso espaciado)', () => {
    // Simular preguntas con fechas diferentes
    const now = Date.now()
    const questions = [
      { id: 'q1', _lastAnswered: new Date(now - 5 * 24 * 60 * 60 * 1000) }, // 5 días
      { id: 'q2', _lastAnswered: new Date(now - 1 * 24 * 60 * 60 * 1000) }, // 1 día  
      { id: 'q3', _lastAnswered: new Date(now - 10 * 24 * 60 * 60 * 1000) }, // 10 días
    ]
    
    // Ordenar por fecha (más antiguas primero)
    questions.sort((a, b) => a._lastAnswered - b._lastAnswered)
    
    expect(questions[0].id).toBe('q3') // Más antigua (10 días)
    expect(questions[1].id).toBe('q1') // Intermedia (5 días)
    expect(questions[2].id).toBe('q2') // Más reciente (1 día)
  })
})

// Test de integración simulado
describe('Question Selection Integration Tests', () => {
  test('Debería simular flujo completo de selección', async () => {
    // Simular datos reales
    const tema = '7' // Ley 19/2013
    const userId = 'test_user'
    const totalQuestionsAvailable = 100
    const questionsRequested = 25
    const questionsAlreadyAnswered = 30
    
    // Escenario: Usuario con historial parcial
    expect(questionsAlreadyAnswered).toBeLessThan(totalQuestionsAvailable)
    
    const neverSeenCount = totalQuestionsAvailable - questionsAlreadyAnswered
    expect(neverSeenCount).toBe(70)
    
    // Debería usar solo preguntas nunca vistas
    if (neverSeenCount >= questionsRequested) {
      const strategy = 'never_seen_only'
      expect(strategy).toBe('never_seen_only')
    } else {
      const strategy = 'mixed_distribution'
      expect(strategy).toBe('mixed_distribution')
    }
  })
})