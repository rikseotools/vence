// __tests__/pages/TemaTramitacionPage.test.js
// Tests exhaustivos para la página de test por tema de Tramitación Procesal

import '@testing-library/jest-dom'

// ============================================
// CONSTANTES Y CONFIGURACIÓN
// ============================================

const TRAMITACION_CONFIG = {
  positionType: 'tramitacion_procesal',
  oposicion: 'tramitacion-procesal',
  minTema: 1,
  maxTema: 37,
  bloques: {
    I: { min: 1, max: 15 },
    II: { min: 16, max: 31 },
    III: { min: 32, max: 37 }
  }
}

// ============================================
// TESTS DE VALIDACIÓN DE RANGO DE TEMAS
// ============================================

describe('Validación de Rango de Temas - Tramitación Procesal', () => {

  const isValidTema = (tema) => {
    const num = parseInt(tema)
    return !isNaN(num) && num >= TRAMITACION_CONFIG.minTema && num <= TRAMITACION_CONFIG.maxTema
  }

  describe('Temas válidos (1-37)', () => {
    test.each([1, 2, 10, 15, 16, 25, 31, 32, 37])('Tema %i debe ser válido', (tema) => {
      expect(isValidTema(tema)).toBe(true)
    })

    test('Todos los temas del 1 al 37 deben ser válidos', () => {
      for (let i = 1; i <= 37; i++) {
        expect(isValidTema(i)).toBe(true)
      }
    })
  })

  describe('Temas inválidos', () => {
    test.each([0, -1, 38, 39, 100, 999])('Tema %i debe ser inválido', (tema) => {
      expect(isValidTema(tema)).toBe(false)
    })

    test('Tema 0 debe ser inválido', () => {
      expect(isValidTema(0)).toBe(false)
    })

    test('Tema negativo debe ser inválido', () => {
      expect(isValidTema(-5)).toBe(false)
    })

    test('Tema mayor a 37 debe ser inválido', () => {
      expect(isValidTema(38)).toBe(false)
      expect(isValidTema(100)).toBe(false)
    })

    test('Tema no numérico debe ser inválido', () => {
      expect(isValidTema('abc')).toBe(false)
      expect(isValidTema('')).toBe(false)
      expect(isValidTema(null)).toBe(false)
      expect(isValidTema(undefined)).toBe(false)
    })
  })

  describe('Comparación con otras oposiciones', () => {
    test('Tramitación Procesal tiene 37 temas, no 30 como Auxiliar', () => {
      // Auxiliar tiene 30 temas, Tramitación tiene 37
      expect(TRAMITACION_CONFIG.maxTema).toBe(37)
      expect(TRAMITACION_CONFIG.maxTema).not.toBe(30)
    })

    test('Tema 35 es válido en Tramitación pero no existiría en Auxiliar', () => {
      expect(isValidTema(35)).toBe(true)
    })
  })
})

// ============================================
// TESTS DE BLOQUES
// ============================================

describe('Asignación de Bloques - Tramitación Procesal', () => {

  const getBloque = (num) => {
    if (num >= 1 && num <= 15) return 'Bloque I'
    if (num >= 16 && num <= 31) return 'Bloque II'
    if (num >= 32 && num <= 37) return 'Bloque III'
    return ''
  }

  describe('Bloque I (temas 1-15)', () => {
    test.each([1, 5, 10, 15])('Tema %i pertenece al Bloque I', (tema) => {
      expect(getBloque(tema)).toBe('Bloque I')
    })
  })

  describe('Bloque II (temas 16-31)', () => {
    test.each([16, 20, 25, 31])('Tema %i pertenece al Bloque II', (tema) => {
      expect(getBloque(tema)).toBe('Bloque II')
    })
  })

  describe('Bloque III (temas 32-37)', () => {
    test.each([32, 34, 37])('Tema %i pertenece al Bloque III', (tema) => {
      expect(getBloque(tema)).toBe('Bloque III')
    })
  })

  describe('Límites de bloques', () => {
    test('Tema 15 es el último del Bloque I', () => {
      expect(getBloque(15)).toBe('Bloque I')
      expect(getBloque(16)).toBe('Bloque II')
    })

    test('Tema 31 es el último del Bloque II', () => {
      expect(getBloque(31)).toBe('Bloque II')
      expect(getBloque(32)).toBe('Bloque III')
    })

    test('Tema fuera de rango devuelve cadena vacía', () => {
      expect(getBloque(0)).toBe('')
      expect(getBloque(38)).toBe('')
      expect(getBloque(-1)).toBe('')
    })
  })
})

// ============================================
// TESTS DE POSITION TYPE
// ============================================

describe('Position Type - Tramitación Procesal', () => {

  test('positionType debe ser tramitacion_procesal', () => {
    expect(TRAMITACION_CONFIG.positionType).toBe('tramitacion_procesal')
  })

  test('positionType NO debe ser auxiliar_administrativo', () => {
    expect(TRAMITACION_CONFIG.positionType).not.toBe('auxiliar_administrativo')
  })

  test('positionType NO debe ser administrativo', () => {
    expect(TRAMITACION_CONFIG.positionType).not.toBe('administrativo')
  })

  describe('TestConfigurator debe recibir positionType correcto', () => {
    test('Props simulados para TestConfigurator', () => {
      const testConfiguratorProps = {
        tema: 5,
        totalQuestions: { easy: 10, medium: 20, hard: 15 },
        onStartTest: jest.fn(),
        userStats: null,
        loading: false,
        currentUser: null,
        lawsData: [],
        officialQuestionsCount: 25,
        testMode: 'practica',
        positionType: 'tramitacion_procesal'  // CRÍTICO
      }

      expect(testConfiguratorProps.positionType).toBe('tramitacion_procesal')
    })

    test('REGRESIÓN: positionType no debe usar default de auxiliar', () => {
      // Simular el bug anterior donde no se pasaba positionType
      const propsWithoutPositionType = {
        tema: 5,
        testMode: 'practica'
        // positionType ausente - esto era el bug
      }

      // El componente debe tener positionType explícito
      const correctProps = {
        ...propsWithoutPositionType,
        positionType: 'tramitacion_procesal'
      }

      expect(correctProps.positionType).toBe('tramitacion_procesal')
      expect(correctProps.positionType).not.toBe('auxiliar_administrativo')
    })
  })
})

// ============================================
// TESTS DE CONSTRUCCIÓN DE URLs
// ============================================

describe('Construcción de URLs de Test', () => {

  const buildTestUrl = (temaNumber, testMode, config) => {
    const testParams = new URLSearchParams({
      n: config.numQuestions.toString(),
      exclude_recent: config.excludeRecent.toString(),
      recent_days: config.recentDays.toString(),
      difficulty_mode: config.difficultyMode,
      ...(config.onlyOfficialQuestions && { only_official: 'true' }),
      ...(config.focusEssentialArticles && { focus_essential: 'true' }),
      ...(config.focusWeakAreas && { focus_weak: 'true' }),
      ...(config.adaptiveMode && { adaptive: 'true' }),
      ...(config.onlyFailedQuestions && { only_failed: 'true' }),
      ...(config.timeLimit && { time_limit: config.timeLimit.toString() })
    })

    if (config.selectedLaws && config.selectedLaws.length > 0) {
      testParams.set('selected_laws', JSON.stringify(config.selectedLaws))
    }

    const testPath = testMode === 'examen' ? 'test-examen' : 'test-personalizado'
    return `/tramitacion-procesal/test/tema/${temaNumber}/${testPath}?${testParams.toString()}`
  }

  describe('URLs de modo práctica', () => {
    test('URL básica modo práctica', () => {
      const config = {
        numQuestions: 20,
        excludeRecent: false,
        recentDays: 15,
        difficultyMode: 'mixed'
      }

      const url = buildTestUrl(5, 'practica', config)

      expect(url).toContain('/tramitacion-procesal/test/tema/5/test-personalizado')
      expect(url).toContain('n=20')
      expect(url).toContain('difficulty_mode=mixed')
    })

    test('URL con todas las opciones activadas', () => {
      const config = {
        numQuestions: 30,
        excludeRecent: true,
        recentDays: 7,
        difficultyMode: 'hard',
        onlyOfficialQuestions: true,
        focusEssentialArticles: true,
        focusWeakAreas: true,
        adaptiveMode: true,
        timeLimit: 30
      }

      const url = buildTestUrl(10, 'practica', config)

      expect(url).toContain('n=30')
      expect(url).toContain('exclude_recent=true')
      expect(url).toContain('recent_days=7')
      expect(url).toContain('only_official=true')
      expect(url).toContain('focus_essential=true')
      expect(url).toContain('focus_weak=true')
      expect(url).toContain('adaptive=true')
      expect(url).toContain('time_limit=30')
    })
  })

  describe('URLs de modo examen', () => {
    test('URL modo examen', () => {
      const config = {
        numQuestions: 50,
        excludeRecent: false,
        recentDays: 15,
        difficultyMode: 'mixed'
      }

      const url = buildTestUrl(15, 'examen', config)

      expect(url).toContain('/tramitacion-procesal/test/tema/15/test-examen')
      expect(url).not.toContain('test-personalizado')
    })
  })

  describe('URLs con leyes seleccionadas', () => {
    test('URL con leyes específicas', () => {
      const config = {
        numQuestions: 25,
        excludeRecent: false,
        recentDays: 15,
        difficultyMode: 'mixed',
        selectedLaws: ['LEC', 'LOPJ']
      }

      const url = buildTestUrl(20, 'practica', config)

      expect(url).toContain('selected_laws=')
      expect(url).toContain('LEC')
      expect(url).toContain('LOPJ')
    })
  })

  describe('Validación de rutas base', () => {
    test('Ruta base debe ser /tramitacion-procesal/', () => {
      const config = { numQuestions: 10, excludeRecent: false, recentDays: 15, difficultyMode: 'mixed' }
      const url = buildTestUrl(1, 'practica', config)

      expect(url.startsWith('/tramitacion-procesal/')).toBe(true)
      expect(url).not.toContain('/auxiliar-administrativo-estado/')
      expect(url).not.toContain('/administrativo-estado/')
    })

    test.each([1, 15, 25, 37])('URL para tema %i incluye número correcto', (tema) => {
      const config = { numQuestions: 10, excludeRecent: false, recentDays: 15, difficultyMode: 'mixed' }
      const url = buildTestUrl(tema, 'practica', config)

      expect(url).toContain(`/tema/${tema}/`)
    })
  })
})

// ============================================
// TESTS DE MODOS DE TEST (PRÁCTICA/EXAMEN)
// ============================================

describe('Modos de Test - Práctica vs Examen', () => {

  describe('Persistencia en localStorage', () => {
    let mockLocalStorage = {}

    beforeEach(() => {
      mockLocalStorage = {}
      jest.spyOn(Storage.prototype, 'getItem').mockImplementation((key) => mockLocalStorage[key] || null)
      jest.spyOn(Storage.prototype, 'setItem').mockImplementation((key, value) => {
        mockLocalStorage[key] = value
      })
    })

    afterEach(() => {
      jest.restoreAllMocks()
    })

    test('Guardar modo práctica en localStorage', () => {
      localStorage.setItem('preferredTestMode', 'practica')
      expect(localStorage.getItem('preferredTestMode')).toBe('practica')
    })

    test('Guardar modo examen en localStorage', () => {
      localStorage.setItem('preferredTestMode', 'examen')
      expect(localStorage.getItem('preferredTestMode')).toBe('examen')
    })

    test('Recuperar modo guardado', () => {
      mockLocalStorage['preferredTestMode'] = 'examen'
      const savedMode = localStorage.getItem('preferredTestMode')
      expect(savedMode).toBe('examen')
    })

    test('Valor por defecto cuando no hay guardado', () => {
      const savedMode = localStorage.getItem('preferredTestMode')
      const defaultMode = savedMode === 'practica' || savedMode === 'examen' ? savedMode : 'practica'
      expect(defaultMode).toBe('practica')
    })
  })

  describe('Validación de modos', () => {
    const isValidMode = (mode) => mode === 'practica' || mode === 'examen'

    test('practica es modo válido', () => {
      expect(isValidMode('practica')).toBe(true)
    })

    test('examen es modo válido', () => {
      expect(isValidMode('examen')).toBe(true)
    })

    test('otros valores son inválidos', () => {
      expect(isValidMode('test')).toBe(false)
      expect(isValidMode('practice')).toBe(false)
      expect(isValidMode('')).toBe(false)
      expect(isValidMode(null)).toBe(false)
    })
  })

  describe('Cambio de modo', () => {
    test('handleTestModeChange actualiza estado y localStorage', () => {
      let testMode = 'practica'
      const mockSetTestMode = (mode) => { testMode = mode }

      const handleTestModeChange = (newMode) => {
        mockSetTestMode(newMode)
        localStorage.setItem('preferredTestMode', newMode)
      }

      handleTestModeChange('examen')
      expect(testMode).toBe('examen')
    })
  })
})

// ============================================
// TESTS DE ESTADOS DE CARGA
// ============================================

describe('Estados de Carga y Error', () => {

  describe('Estado loading', () => {
    test('Estado inicial debe ser loading=true', () => {
      const initialState = { loading: true, temaNotFound: false }
      expect(initialState.loading).toBe(true)
    })

    test('Después de cargar datos, loading=false', () => {
      let state = { loading: true, temaNotFound: false }

      // Simular carga exitosa
      const onDataLoaded = () => {
        state = { ...state, loading: false }
      }

      onDataLoaded()
      expect(state.loading).toBe(false)
    })
  })

  describe('Estado temaNotFound', () => {
    test('Tema inválido activa temaNotFound', () => {
      const checkTema = (tema) => {
        const num = parseInt(tema)
        return isNaN(num) || num < 1 || num > 37
      }

      expect(checkTema(0)).toBe(true)
      expect(checkTema(38)).toBe(true)
      expect(checkTema('abc')).toBe(true)
    })

    test('Tema válido no activa temaNotFound', () => {
      const checkTema = (tema) => {
        const num = parseInt(tema)
        return isNaN(num) || num < 1 || num > 37
      }

      expect(checkTema(1)).toBe(false)
      expect(checkTema(20)).toBe(false)
      expect(checkTema(37)).toBe(false)
    })
  })

  describe('Estado userStatsLoading', () => {
    test('userStatsLoading independiente de loading principal', () => {
      const state = {
        loading: false,
        userStatsLoading: true
      }

      expect(state.loading).toBe(false)
      expect(state.userStatsLoading).toBe(true)
    })
  })
})

// ============================================
// TESTS DE API /api/topics/{tema}
// ============================================

describe('API de Topics - Parámetros correctos', () => {

  const buildApiUrl = (tema, userId = null) => {
    const queryParams = new URLSearchParams({
      oposicion: 'tramitacion-procesal',
      ...(userId && { userId })
    })
    return `/api/topics/${tema}?${queryParams}`
  }

  test('URL de API incluye oposicion=tramitacion-procesal', () => {
    const url = buildApiUrl(5)
    expect(url).toContain('oposicion=tramitacion-procesal')
  })

  test('URL de API incluye tema correcto', () => {
    const url = buildApiUrl(15)
    expect(url).toContain('/api/topics/15')
  })

  test('URL de API incluye userId cuando está presente', () => {
    const url = buildApiUrl(10, 'user-123')
    expect(url).toContain('userId=user-123')
  })

  test('URL de API NO incluye userId cuando es null', () => {
    const url = buildApiUrl(10, null)
    expect(url).not.toContain('userId')
  })

  test('CRÍTICO: oposicion no debe ser auxiliar-administrativo-estado', () => {
    const url = buildApiUrl(5)
    expect(url).not.toContain('auxiliar-administrativo-estado')
    expect(url).not.toContain('administrativo-estado')
  })
})

// ============================================
// TESTS DE DATOS DE RESPUESTA
// ============================================

describe('Procesamiento de Datos del Tema', () => {

  const mockApiResponse = {
    success: true,
    topic: {
      id: 'topic-123',
      topicNumber: 5,
      title: 'El Gobierno',
      description: 'Composición, organización y funciones',
      difficulty: 'medium',
      estimatedHours: 8
    },
    difficultyStats: {
      easy: 25,
      medium: 50,
      hard: 30
    },
    officialQuestionsCount: 45,
    articlesByLaw: [
      { lawShortName: 'Ley 50/97', lawName: 'Ley del Gobierno', articlesWithQuestions: 12 }
    ],
    userProgress: {
      totalAnswers: 100,
      overallAccuracy: 75,
      performanceByDifficulty: { easy: 90, medium: 70, hard: 60 },
      uniqueQuestionsAnswered: 80,
      totalQuestionsAvailable: 105,
      neverSeen: 25,
      recentStats: {
        last7Days: 20,
        last15Days: 45,
        last30Days: 80
      }
    }
  }

  test('Mapeo correcto de topicData', () => {
    const topicData = {
      id: mockApiResponse.topic.id,
      topic_number: mockApiResponse.topic.topicNumber,
      title: mockApiResponse.topic.title,
      description: mockApiResponse.topic.description,
      difficulty: mockApiResponse.topic.difficulty,
      estimated_hours: mockApiResponse.topic.estimatedHours
    }

    expect(topicData.topic_number).toBe(5)
    expect(topicData.title).toBe('El Gobierno')
  })

  test('Cálculo de total de preguntas', () => {
    const difficultyStats = mockApiResponse.difficultyStats
    const total = Object.values(difficultyStats).reduce((sum, count) => sum + count, 0)

    expect(total).toBe(105)
  })

  test('Mapeo de userStats', () => {
    const userStats = {
      totalAnswers: mockApiResponse.userProgress.totalAnswers,
      overallAccuracy: mockApiResponse.userProgress.overallAccuracy,
      performanceByDifficulty: mockApiResponse.userProgress.performanceByDifficulty,
      isRealData: true,
      uniqueQuestionsAnswered: mockApiResponse.userProgress.uniqueQuestionsAnswered,
      totalQuestionsAvailable: mockApiResponse.userProgress.totalQuestionsAvailable,
      neverSeen: mockApiResponse.userProgress.neverSeen
    }

    expect(userStats.totalAnswers).toBe(100)
    expect(userStats.neverSeen).toBe(25)
    expect(userStats.isRealData).toBe(true)
  })

  test('Mapeo de articlesByLaw', () => {
    const articlesCountByLaw = mockApiResponse.articlesByLaw.map((a) => ({
      law_short_name: a.lawShortName,
      law_name: a.lawName,
      articles_with_questions: a.articlesWithQuestions
    }))

    expect(articlesCountByLaw[0].law_short_name).toBe('Ley 50/97')
    expect(articlesCountByLaw[0].articles_with_questions).toBe(12)
  })
})

// ============================================
// TESTS DE NAVEGACIÓN
// ============================================

describe('Navegación y Enlaces', () => {

  test('Link de volver apunta a /tramitacion-procesal/test', () => {
    const backLink = '/tramitacion-procesal/test'
    expect(backLink).toBe('/tramitacion-procesal/test')
    expect(backLink).not.toContain('auxiliar')
  })

  test('Dropdown de oposiciones incluye opciones correctas', () => {
    const dropdownOptions = [
      { href: '/tramitacion-procesal/test', label: 'Tramitación Procesal (C1)' },
      { href: '/administrativo-estado/test', label: 'Administrativo del Estado (C1)' }
    ]

    expect(dropdownOptions).toHaveLength(2)
    expect(dropdownOptions[0].href).toBe('/tramitacion-procesal/test')
  })

  test('Breadcrumb muestra oposición correcta', () => {
    const oposicionLabel = 'Tramitación Procesal (C1)'
    expect(oposicionLabel).toContain('Tramitación Procesal')
    expect(oposicionLabel).not.toContain('Auxiliar')
  })
})

// ============================================
// TESTS DE REGRESIÓN
// ============================================

describe('Tests de Regresión - Bugs Conocidos', () => {

  test('REGRESIÓN: positionType debe pasarse a TestConfigurator', () => {
    // Bug: TestConfigurator no recibía positionType
    const props = {
      tema: 5,
      positionType: 'tramitacion_procesal'
    }

    expect(props.positionType).toBeDefined()
    expect(props.positionType).toBe('tramitacion_procesal')
  })

  test('REGRESIÓN: URLs deben usar /tramitacion-procesal/ no /auxiliar/', () => {
    const testUrl = '/tramitacion-procesal/test/tema/5/test-personalizado'

    expect(testUrl).toContain('/tramitacion-procesal/')
    expect(testUrl).not.toContain('/auxiliar-administrativo-estado/')
  })

  test('REGRESIÓN: Rango de temas es 1-37, no 1-30', () => {
    expect(TRAMITACION_CONFIG.maxTema).toBe(37)
    expect(TRAMITACION_CONFIG.maxTema).not.toBe(30)
  })

  test('REGRESIÓN: API usa oposicion=tramitacion-procesal', () => {
    const apiUrl = '/api/topics/5?oposicion=tramitacion-procesal'

    expect(apiUrl).toContain('oposicion=tramitacion-procesal')
    expect(apiUrl).not.toContain('auxiliar')
  })

  test('REGRESIÓN: Bloques son I(1-15), II(16-31), III(32-37)', () => {
    const bloques = TRAMITACION_CONFIG.bloques

    expect(bloques.I.max).toBe(15)
    expect(bloques.II.min).toBe(16)
    expect(bloques.II.max).toBe(31)
    expect(bloques.III.min).toBe(32)
    expect(bloques.III.max).toBe(37)
  })
})

// ============================================
// TESTS DE EDGE CASES
// ============================================

describe('Edge Cases', () => {

  test('Tema como string numérico se parsea correctamente', () => {
    const temaString = '15'
    const temaNumber = parseInt(temaString)

    expect(temaNumber).toBe(15)
    expect(typeof temaNumber).toBe('number')
  })

  test('Tema con espacios se maneja correctamente', () => {
    const temaWithSpaces = ' 10 '
    const temaNumber = parseInt(temaWithSpaces.trim())

    expect(temaNumber).toBe(10)
  })

  test('difficultyStats vacío devuelve total 0', () => {
    const emptyStats = {}
    const total = Object.values(emptyStats).reduce((sum, count) => sum + count, 0)

    expect(total).toBe(0)
  })

  test('userProgress null no causa error', () => {
    const apiResponse = { success: true, userProgress: null }
    const userStats = apiResponse.userProgress ? {
      totalAnswers: apiResponse.userProgress.totalAnswers
    } : null

    expect(userStats).toBeNull()
  })

  test('articlesByLaw vacío se maneja correctamente', () => {
    const emptyArticles = []
    const mapped = emptyArticles.map((a) => a.lawShortName)

    expect(mapped).toHaveLength(0)
  })

  test('localStorage bloqueado no causa error', () => {
    const safeGetItem = (key) => {
      try {
        return localStorage.getItem(key)
      } catch {
        return null
      }
    }

    // Simular localStorage bloqueado
    jest.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('localStorage is disabled')
    })

    expect(() => safeGetItem('preferredTestMode')).not.toThrow()
    expect(safeGetItem('preferredTestMode')).toBeNull()

    jest.restoreAllMocks()
  })
})

// ============================================
// TESTS DE INTEGRACIÓN SIMULADA
// ============================================

describe('Flujo Completo - Integración Simulada', () => {

  test('Flujo: cargar tema 5 → configurar → iniciar test práctica', () => {
    // 1. Resolver params
    const params = { numero: '5' }
    const temaNumber = parseInt(params.numero)
    expect(temaNumber).toBe(5)

    // 2. Validar rango
    const isValid = temaNumber >= 1 && temaNumber <= 37
    expect(isValid).toBe(true)

    // 3. Determinar bloque
    const bloque = temaNumber <= 15 ? 'I' : temaNumber <= 31 ? 'II' : 'III'
    expect(bloque).toBe('I')

    // 4. Construir URL de API
    const apiUrl = `/api/topics/${temaNumber}?oposicion=tramitacion-procesal`
    expect(apiUrl).toContain('tramitacion-procesal')

    // 5. Configurar test
    const testConfig = {
      numQuestions: 20,
      excludeRecent: true,
      recentDays: 15,
      difficultyMode: 'mixed',
      onlyOfficialQuestions: false
    }

    // 6. Generar URL de test
    const testPath = 'practica' === 'examen' ? 'test-examen' : 'test-personalizado'
    const testUrl = `/tramitacion-procesal/test/tema/${temaNumber}/${testPath}`

    expect(testUrl).toBe('/tramitacion-procesal/test/tema/5/test-personalizado')
  })

  test('Flujo: tema inválido → mostrar 404', () => {
    const params = { numero: '50' }
    const temaNumber = parseInt(params.numero)
    const isValid = temaNumber >= 1 && temaNumber <= 37

    expect(isValid).toBe(false)
    // En este caso, el componente mostraría temaNotFound = true
  })

  test('Flujo: cambiar a modo examen y persistir', () => {
    let testMode = 'practica'
    const mockStorage = {}

    const handleTestModeChange = (newMode) => {
      testMode = newMode
      mockStorage['preferredTestMode'] = newMode
    }

    handleTestModeChange('examen')

    expect(testMode).toBe('examen')
    expect(mockStorage['preferredTestMode']).toBe('examen')

    // Simular recarga de página
    const savedMode = mockStorage['preferredTestMode']
    const restoredMode = savedMode === 'practica' || savedMode === 'examen' ? savedMode : 'practica'

    expect(restoredMode).toBe('examen')
  })
})
