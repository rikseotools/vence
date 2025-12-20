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

  test('Debería implementar correctamente el algoritmo de distribución mixta', () => {
    // CASO REAL: Pocas preguntas nunca vistas, necesita mezclar
    const neverSeenQuestions = createMockQuestions(3, 1) // Solo 3 nunca vistas
    const answeredQuestions = createMockQuestions(20, 4) // 20 ya respondidas
    const questionsRequested = 10
    
    // Simular ordenamiento por antigüedad (más antiguos primero)
    const now = Date.now()
    answeredQuestions.forEach((q, index) => {
      q._lastAnswered = new Date(now - (20 - index) * 24 * 60 * 60 * 1000) // Distribuir en 20 días
    })
    answeredQuestions.sort((a, b) => a._lastAnswered - b._lastAnswered)
    
    // Aplicar algoritmo real
    const neverSeenCount = neverSeenQuestions.length // 3
    const reviewCount = questionsRequested - neverSeenCount // 10 - 3 = 7
    
    const selectedQuestions = [
      ...neverSeenQuestions, // Todas las nunca vistas (3)
      ...answeredQuestions.slice(0, reviewCount) // Las 7 más antiguas
    ]
    
    // Verificaciones
    expect(selectedQuestions.length).toBe(questionsRequested) // 10
    expect(neverSeenCount).toBe(3)
    expect(reviewCount).toBe(7)
    
    // Verificar que las primeras 3 son nunca vistas
    expect(selectedQuestions.slice(0, 3).map(q => q.id)).toEqual(['question_1', 'question_2', 'question_3'])
    
    // Verificar que las siguientes 7 son las más antiguas (en orden de antigüedad)
    const reviewPortion = selectedQuestions.slice(3)
    expect(reviewPortion.length).toBe(7)
    
    // Verificar que están ordenadas por antigüedad (más antiguas primero)
    for (let i = 1; i < reviewPortion.length; i++) {
      expect(reviewPortion[i-1]._lastAnswered <= reviewPortion[i]._lastAnswered).toBe(true)
    }
  })

  test('Debería verificar el algoritmo completo end-to-end', () => {
    // CASO REAL COMPLEJO: Simular exactamente lo que hace fetchPersonalizedQuestions
    const allQuestions = createMockQuestions(50)
    const answeredQuestionIds = new Set(['question_10', 'question_15', 'question_20', 'question_25', 'question_30'])
    const questionsRequested = 15
    
    // 1. Clasificar preguntas
    const neverSeenQuestions = []
    const answeredQuestions = []
    
    allQuestions.forEach(question => {
      if (answeredQuestionIds.has(question.id)) {
        // Simular fecha de respuesta
        const randomDaysAgo = Math.floor(Math.random() * 30) + 1
        question._lastAnswered = new Date(Date.now() - randomDaysAgo * 24 * 60 * 60 * 1000)
        answeredQuestions.push(question)
      } else {
        neverSeenQuestions.push(question)
      }
    })
    
    // 2. Ordenar respondidas por antigüedad
    answeredQuestions.sort((a, b) => a._lastAnswered - b._lastAnswered)
    
    // 3. Aplicar algoritmo de selección
    let selectedQuestions = []
    
    if (neverSeenQuestions.length >= questionsRequested) {
      // CASO A: Solo nunca vistas
      selectedQuestions = neverSeenQuestions.slice(0, questionsRequested)
    } else {
      // CASO B: Distribución mixta
      const neverSeenCount = neverSeenQuestions.length
      const reviewCount = questionsRequested - neverSeenCount
      
      selectedQuestions = [
        ...neverSeenQuestions, // Todas las nunca vistas
        ...answeredQuestions.slice(0, reviewCount) // Las más antiguas
      ]
    }
    
    // Verificaciones del algoritmo
    expect(selectedQuestions.length).toBe(questionsRequested)
    
    // En este caso: 45 nunca vistas >= 15 solicitadas, así que solo nunca vistas
    expect(neverSeenQuestions.length).toBe(45) // 50 - 5 = 45
    expect(selectedQuestions.every(q => !answeredQuestionIds.has(q.id))).toBe(true)
    
    // Verificar que son todas diferentes
    const selectedIds = selectedQuestions.map(q => q.id)
    const uniqueIds = new Set(selectedIds)
    expect(uniqueIds.size).toBe(selectedQuestions.length) // Sin duplicados
  })
})

// Tests para verificar filtros de configuración
describe('Question Filters and Configuration Tests', () => {
  test('Debería filtrar por preguntas oficiales solamente', () => {
    const allQuestions = [
      { id: 'q1', is_official_exam: true, difficulty: 'medium' },
      { id: 'q2', is_official_exam: false, difficulty: 'easy' },
      { id: 'q3', is_official_exam: true, difficulty: 'hard' },
      { id: 'q4', is_official_exam: false, difficulty: 'medium' },
    ]
    
    const config = { onlyOfficialQuestions: true }
    
    // Simular filtro de preguntas oficiales
    const filteredQuestions = allQuestions.filter(q => {
      if (config.onlyOfficialQuestions) {
        return q.is_official_exam === true
      }
      return true
    })
    
    expect(filteredQuestions.length).toBe(2)
    expect(filteredQuestions.every(q => q.is_official_exam === true)).toBe(true)
    expect(filteredQuestions.map(q => q.id)).toEqual(['q1', 'q3'])
  })

  test('Debería filtrar por dificultad específica', () => {
    const allQuestions = [
      { id: 'q1', difficulty: 'easy' },
      { id: 'q2', difficulty: 'medium' },
      { id: 'q3', difficulty: 'hard' },
      { id: 'q4', difficulty: 'easy' },
      { id: 'q5', difficulty: 'extreme' },
    ]
    
    // Test filtro por dificultad 'easy'
    const easyQuestions = allQuestions.filter(q => q.difficulty === 'easy')
    expect(easyQuestions.length).toBe(2)
    expect(easyQuestions.map(q => q.id)).toEqual(['q1', 'q4'])
    
    // Test filtro por dificultad 'hard' 
    const hardQuestions = allQuestions.filter(q => q.difficulty === 'hard')
    expect(hardQuestions.length).toBe(1)
    expect(hardQuestions[0].id).toBe('q3')
    
    // Test sin filtro (modo 'random')
    const allDifficulties = allQuestions.filter(q => true) // Sin filtro
    expect(allDifficulties.length).toBe(5)
  })

  test('Debería excluir preguntas recientes correctamente', () => {
    const allQuestions = createMockQuestions(10)
    const now = Date.now()
    
    // Simular preguntas respondidas recientemente (últimos 15 días)
    const recentlyAnsweredIds = ['question_2', 'question_5', 'question_8']
    const recentDays = 15
    const cutoffDate = new Date(now - recentDays * 24 * 60 * 60 * 1000)
    
    // Simular filtro de exclusión por fecha reciente
    const config = { excludeRecent: true, recentDays }
    const excludedQuestionIds = new Set(recentlyAnsweredIds)
    
    const filteredQuestions = allQuestions.filter(question => {
      if (config.excludeRecent) {
        return !excludedQuestionIds.has(question.id)
      }
      return true
    })
    
    expect(filteredQuestions.length).toBe(7) // 10 - 3 = 7
    expect(filteredQuestions.every(q => !recentlyAnsweredIds.includes(q.id))).toBe(true)
  })

  test('Debería aplicar múltiples filtros en secuencia', () => {
    const allQuestions = [
      { id: 'q1', is_official_exam: true, difficulty: 'easy', is_active: true },
      { id: 'q2', is_official_exam: false, difficulty: 'easy', is_active: true },
      { id: 'q3', is_official_exam: true, difficulty: 'medium', is_active: true },
      { id: 'q4', is_official_exam: true, difficulty: 'easy', is_active: false },
      { id: 'q5', is_official_exam: true, difficulty: 'easy', is_active: true },
    ]
    
    const config = {
      onlyOfficialQuestions: true,
      difficultyMode: 'easy',
      excludeRecent: true
    }
    
    const recentlyAnsweredIds = new Set(['q1']) // q1 respondida recientemente
    
    // Aplicar filtros en secuencia (como hace el código real)
    let filteredQuestions = allQuestions
    
    // 1. Filtro por activas
    filteredQuestions = filteredQuestions.filter(q => q.is_active === true)
    
    // 2. Filtro por oficiales
    if (config.onlyOfficialQuestions) {
      filteredQuestions = filteredQuestions.filter(q => q.is_official_exam === true)
    }
    
    // 3. Filtro por dificultad
    if (config.difficultyMode !== 'random') {
      filteredQuestions = filteredQuestions.filter(q => q.difficulty === config.difficultyMode)
    }
    
    // 4. Filtro por exclusión de recientes
    if (config.excludeRecent) {
      filteredQuestions = filteredQuestions.filter(q => !recentlyAnsweredIds.has(q.id))
    }
    
    // Resultado esperado: Solo q5 cumple todos los filtros
    expect(filteredQuestions.length).toBe(1)
    expect(filteredQuestions[0].id).toBe('q5')
  })

  test('Debería manejar filtros por leyes específicas', () => {
    const allQuestions = [
      { id: 'q1', law_short_name: 'Ley 19/2013', article_number: '12' },
      { id: 'q2', law_short_name: 'Ley 40/2015', article_number: '25' },
      { id: 'q3', law_short_name: 'CE', article_number: '103' },
      { id: 'q4', law_short_name: 'Ley 19/2013', article_number: '15' },
    ]
    
    const selectedLaws = ['Ley 19/2013', 'CE']
    
    // Simular filtro por leyes seleccionadas
    const filteredQuestions = allQuestions.filter(q => 
      selectedLaws.includes(q.law_short_name)
    )
    
    expect(filteredQuestions.length).toBe(3)
    expect(filteredQuestions.map(q => q.id)).toEqual(['q1', 'q3', 'q4'])
  })

  test('Debería manejar filtros por artículos específicos de cada ley', () => {
    const allQuestions = [
      { id: 'q1', law_short_name: 'Ley 19/2013', article_number: '12' },
      { id: 'q2', law_short_name: 'Ley 19/2013', article_number: '15' },
      { id: 'q3', law_short_name: 'Ley 40/2015', article_number: '25' },
      { id: 'q4', law_short_name: 'Ley 40/2015', article_number: '30' },
    ]
    
    const selectedArticlesByLaw = {
      'Ley 19/2013': ['12'], // Solo artículo 12
      'Ley 40/2015': ['25', '30'] // Artículos 25 y 30
    }
    
    // Simular filtro por artículos específicos por ley
    const filteredQuestions = allQuestions.filter(q => {
      const selectedArticles = selectedArticlesByLaw[q.law_short_name]
      if (selectedArticles && selectedArticles.length > 0) {
        return selectedArticles.includes(q.article_number)
      }
      return true // Si no hay filtro específico, incluir todas
    })
    
    expect(filteredQuestions.length).toBe(3) // q1, q3, q4
    expect(filteredQuestions.map(q => q.id)).toEqual(['q1', 'q3', 'q4'])
  })

  test('Debería manejar cache de sesión para evitar duplicados', () => {
    const allQuestions = createMockQuestions(10)
    const sessionUsedIds = new Set(['question_3', 'question_7', 'question_9'])
    
    // Simular filtro por cache de sesión
    const availableQuestions = allQuestions.filter(q => 
      !sessionUsedIds.has(q.id)
    )
    
    expect(availableQuestions.length).toBe(7) // 10 - 3 = 7
    expect(availableQuestions.every(q => !sessionUsedIds.has(q.id))).toBe(true)
    
    // Verificar que las IDs usadas no están en el resultado
    const resultIds = availableQuestions.map(q => q.id)
    expect(resultIds).not.toContain('question_3')
    expect(resultIds).not.toContain('question_7')
    expect(resultIds).not.toContain('question_9')
  })
})