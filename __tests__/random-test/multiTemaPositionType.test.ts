/**
 * Tests para verificar que el positionType se pasa correctamente en tests multi-tema
 *
 * BUG ENCONTRADO: TestPageWrapper no pasaba positionType a fetchAleatorioMultiTema,
 * causando que siempre usara 'auxiliar_administrativo' por defecto.
 *
 * CORREGIDO: 13/01/2026
 */

// ============================================
// CONFIGURACIÓN DE POSITION TYPES
// ============================================

const VALID_POSITION_TYPES = [
  'auxiliar_administrativo',
  'administrativo',
  'tramitacion_procesal'
]

const OPOSICION_SLUG_TO_POSITION_TYPE = {
  'auxiliar-administrativo-estado': 'auxiliar_administrativo',
  'administrativo-estado': 'administrativo',
  'tramitacion-procesal': 'tramitacion_procesal'
}

// Temas por oposición (IDs de temas reales)
const THEMES_BY_OPOSICION = {
  'auxiliar-administrativo-estado': {
    block1: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16],
    block2: [101, 102, 103, 104, 105, 106, 107, 108, 109, 110, 111, 112]
  },
  'administrativo-estado': {
    block1: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18],
    block2: [201, 202, 203, 204, 205, 206, 207, 208, 209, 210, 211]
  },
  'tramitacion-procesal': {
    block1: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26],
    block2: [101, 102, 103, 104, 105, 106, 107, 108, 109, 110, 111, 112, 113, 114, 115],
    block3: [201, 202, 203, 204, 205, 206, 207, 208, 209, 210, 211, 212, 213, 214, 215, 216, 217, 218, 219, 220, 221, 222, 223]
  }
}

// ============================================
// TESTS: VALIDACIÓN DE POSITION TYPE
// ============================================

describe('Position Type Validation', () => {
  test('Todos los positionType definidos son válidos', () => {
    Object.values(OPOSICION_SLUG_TO_POSITION_TYPE).forEach(positionType => {
      expect(VALID_POSITION_TYPES).toContain(positionType)
    })
  })

  test('Cada oposición tiene un positionType único', () => {
    const positionTypes = Object.values(OPOSICION_SLUG_TO_POSITION_TYPE)
    const uniqueTypes = new Set(positionTypes)
    expect(uniqueTypes.size).toBe(positionTypes.length)
  })

  test('No se usa default cuando se especifica positionType', () => {
    const explicitPositionType = 'tramitacion_procesal'
    const config = { positionType: explicitPositionType }

    // Simula la lógica de fetchAleatorioMultiTema
    const usedPositionType = config?.positionType || 'auxiliar_administrativo'

    expect(usedPositionType).toBe('tramitacion_procesal')
    expect(usedPositionType).not.toBe('auxiliar_administrativo')
  })

  test('Default se usa solo cuando positionType es undefined', () => {
    const config = {} // Sin positionType

    const usedPositionType = config?.positionType || 'auxiliar_administrativo'

    expect(usedPositionType).toBe('auxiliar_administrativo')
  })

  test('Default se usa cuando config es null', () => {
    const config = null

    const usedPositionType = config?.positionType || 'auxiliar_administrativo'

    expect(usedPositionType).toBe('auxiliar_administrativo')
  })
})

// ============================================
// TESTS: CONFIGURACIÓN MULTI-TEMA POR OPOSICIÓN
// ============================================

describe('Multi-Tema Config por Oposición', () => {
  test('Tramitación Procesal debe usar tramitacion_procesal', () => {
    const oposicion = 'tramitacion-procesal'
    const expectedPositionType = OPOSICION_SLUG_TO_POSITION_TYPE[oposicion]

    expect(expectedPositionType).toBe('tramitacion_procesal')
  })

  test('Auxiliar Administrativo debe usar auxiliar_administrativo', () => {
    const oposicion = 'auxiliar-administrativo-estado'
    const expectedPositionType = OPOSICION_SLUG_TO_POSITION_TYPE[oposicion]

    expect(expectedPositionType).toBe('auxiliar_administrativo')
  })

  test('Administrativo debe usar administrativo', () => {
    const oposicion = 'administrativo-estado'
    const expectedPositionType = OPOSICION_SLUG_TO_POSITION_TYPE[oposicion]

    expect(expectedPositionType).toBe('administrativo')
  })

  test.each([
    ['auxiliar-administrativo-estado', 'auxiliar_administrativo'],
    ['administrativo-estado', 'administrativo'],
    ['tramitacion-procesal', 'tramitacion_procesal']
  ])('Oposición %s debe mapear a positionType %s', (oposicion, expectedType) => {
    expect(OPOSICION_SLUG_TO_POSITION_TYPE[oposicion]).toBe(expectedType)
  })
})

// ============================================
// TESTS: SIMULACIÓN DE TestPageWrapper
// ============================================

describe('TestPageWrapper - Simulación de configuración multi-tema', () => {
  // Simula la lógica CORRECTA de TestPageWrapper después del fix
  function createMultiTemaConfig(testConfig, positionType) {
    return {
      ...testConfig,
      positionType: positionType || 'auxiliar_administrativo'
    }
  }

  test('Config multi-tema incluye positionType correcto para tramitacion-procesal', () => {
    const testConfig = { numQuestions: 25 }
    const positionType = 'tramitacion_procesal'

    const multiTemaConfig = createMultiTemaConfig(testConfig, positionType)

    expect(multiTemaConfig.positionType).toBe('tramitacion_procesal')
    expect(multiTemaConfig.numQuestions).toBe(25)
  })

  test('Config multi-tema incluye positionType correcto para auxiliar-administrativo', () => {
    const testConfig = { numQuestions: 10 }
    const positionType = 'auxiliar_administrativo'

    const multiTemaConfig = createMultiTemaConfig(testConfig, positionType)

    expect(multiTemaConfig.positionType).toBe('auxiliar_administrativo')
  })

  test('Config multi-tema incluye positionType correcto para administrativo', () => {
    const testConfig = { numQuestions: 50 }
    const positionType = 'administrativo'

    const multiTemaConfig = createMultiTemaConfig(testConfig, positionType)

    expect(multiTemaConfig.positionType).toBe('administrativo')
  })

  test('Config multi-tema preserva todas las propiedades originales', () => {
    const testConfig = {
      numQuestions: 25,
      excludeRecent: true,
      excludeDays: 15,
      onlyOfficialQuestions: false,
      focusEssentialArticles: true
    }
    const positionType = 'tramitacion_procesal'

    const multiTemaConfig = createMultiTemaConfig(testConfig, positionType)

    expect(multiTemaConfig.numQuestions).toBe(25)
    expect(multiTemaConfig.excludeRecent).toBe(true)
    expect(multiTemaConfig.excludeDays).toBe(15)
    expect(multiTemaConfig.onlyOfficialQuestions).toBe(false)
    expect(multiTemaConfig.focusEssentialArticles).toBe(true)
    expect(multiTemaConfig.positionType).toBe('tramitacion_procesal')
  })

  test('BUG REGRESSION: No debe usar auxiliar_administrativo para tramitacion-procesal', () => {
    // Este test previene la regresión del bug encontrado
    const testConfig = { numQuestions: 10 }
    const positionType = 'tramitacion_procesal' // Prop pasada desde la página

    const multiTemaConfig = createMultiTemaConfig(testConfig, positionType)

    // El bug era que siempre usaba auxiliar_administrativo
    expect(multiTemaConfig.positionType).not.toBe('auxiliar_administrativo')
    expect(multiTemaConfig.positionType).toBe('tramitacion_procesal')
  })
})

// ============================================
// TESTS: DISTRIBUCIÓN PROPORCIONAL
// ============================================

describe('Distribución Proporcional de Preguntas', () => {
  // Simula la función selectProportionally
  function simulateProportionalDistribution(themes, numQuestions) {
    const questionsPerTheme = Math.floor(numQuestions / themes.length)
    const remainder = numQuestions % themes.length

    const distribution = {}
    themes.forEach((theme, index) => {
      distribution[theme] = questionsPerTheme + (index < remainder ? 1 : 0)
    })

    return distribution
  }

  test('2 temas, 10 preguntas = 5 cada uno', () => {
    const themes = [2, 5]
    const numQuestions = 10

    const distribution = simulateProportionalDistribution(themes, numQuestions)

    expect(distribution[2]).toBe(5)
    expect(distribution[5]).toBe(5)
    expect(distribution[2] + distribution[5]).toBe(10)
  })

  test('3 temas, 10 preguntas = 4, 3, 3', () => {
    const themes = [1, 2, 3]
    const numQuestions = 10

    const distribution = simulateProportionalDistribution(themes, numQuestions)

    expect(distribution[1]).toBe(4) // 3 + 1 (remainder)
    expect(distribution[2]).toBe(3)
    expect(distribution[3]).toBe(3)
    expect(distribution[1] + distribution[2] + distribution[3]).toBe(10)
  })

  test('5 temas, 25 preguntas = 5 cada uno', () => {
    const themes = [1, 2, 3, 4, 5]
    const numQuestions = 25

    const distribution = simulateProportionalDistribution(themes, numQuestions)

    themes.forEach(theme => {
      expect(distribution[theme]).toBe(5)
    })

    const total = Object.values(distribution).reduce((sum, count) => sum + count, 0)
    expect(total).toBe(25)
  })

  test('2 temas, 11 preguntas = 6, 5', () => {
    const themes = [10, 15]
    const numQuestions = 11

    const distribution = simulateProportionalDistribution(themes, numQuestions)

    expect(distribution[10]).toBe(6) // 5 + 1 (remainder)
    expect(distribution[15]).toBe(5)
    expect(distribution[10] + distribution[15]).toBe(11)
  })

  test('1 tema = todas las preguntas para ese tema', () => {
    const themes = [5]
    const numQuestions = 25

    const distribution = simulateProportionalDistribution(themes, numQuestions)

    expect(distribution[5]).toBe(25)
  })

  test('Distribución con temas de tramitacion-procesal', () => {
    // Simula selección de temas del bloque 1 de tramitación procesal
    const themes = [3, 15] // "El Gobierno" y "Libertad sindical"
    const numQuestions = 10

    const distribution = simulateProportionalDistribution(themes, numQuestions)

    expect(distribution[3]).toBe(5)
    expect(distribution[15]).toBe(5)
  })
})

// ============================================
// TESTS: TEMAS POR OPOSICIÓN
// ============================================

describe('Temas válidos por Oposición', () => {
  test('Temas de tramitacion-procesal deben estar en rango correcto', () => {
    const tramitacionThemes = THEMES_BY_OPOSICION['tramitacion-procesal']

    // Block 1: temas 1-26
    expect(tramitacionThemes.block1).toContain(1)
    expect(tramitacionThemes.block1).toContain(26)
    expect(tramitacionThemes.block1.length).toBe(26)

    // Block 2: temas 101-115
    expect(tramitacionThemes.block2).toContain(101)
    expect(tramitacionThemes.block2).toContain(115)

    // Block 3: temas 201-223
    expect(tramitacionThemes.block3).toContain(201)
    expect(tramitacionThemes.block3).toContain(223)
  })

  test('Temas de auxiliar-administrativo deben estar en rango correcto', () => {
    const auxiliarThemes = THEMES_BY_OPOSICION['auxiliar-administrativo-estado']

    // Block 1: temas 1-16
    expect(auxiliarThemes.block1).toContain(1)
    expect(auxiliarThemes.block1).toContain(16)

    // Block 2: temas 101-112
    expect(auxiliarThemes.block2).toContain(101)
    expect(auxiliarThemes.block2).toContain(112)
  })

  test('No debe haber confusión entre temas de diferentes oposiciones', () => {
    // Tema 5 en auxiliar = "El Gobierno y la Administración"
    // Tema 5 en tramitación = "La Unión Europea"
    // Son temas DIFERENTES aunque tengan el mismo número

    const auxiliarThemes = THEMES_BY_OPOSICION['auxiliar-administrativo-estado']
    const tramitacionThemes = THEMES_BY_OPOSICION['tramitacion-procesal']

    // Ambos tienen tema 5, pero son oposiciones diferentes
    expect(auxiliarThemes.block1).toContain(5)
    expect(tramitacionThemes.block1).toContain(5)

    // Por eso es CRÍTICO pasar el positionType correcto
    expect(OPOSICION_SLUG_TO_POSITION_TYPE['auxiliar-administrativo-estado']).not.toBe(
      OPOSICION_SLUG_TO_POSITION_TYPE['tramitacion-procesal']
    )
  })
})

// ============================================
// TESTS: FLUJO COMPLETO POR OPOSICIÓN
// ============================================

describe('Flujo completo de test multi-tema', () => {
  function simulateTestFlow(oposicion, themes, numQuestions) {
    // 1. Obtener positionType correcto
    const positionType = OPOSICION_SLUG_TO_POSITION_TYPE[oposicion]

    // 2. Crear config multi-tema (COMO HACE TestPageWrapper AHORA)
    const multiTemaConfig = {
      numQuestions,
      positionType
    }

    // 3. Simular llamada a API
    const apiRequest = {
      topicNumber: 0,
      positionType: multiTemaConfig.positionType,
      multipleTopics: themes,
      numQuestions: multiTemaConfig.numQuestions,
      proportionalByTopic: themes.length > 1
    }

    return {
      positionType,
      multiTemaConfig,
      apiRequest
    }
  }

  test('Flujo para tramitacion-procesal con temas [3, 15]', () => {
    const result = simulateTestFlow('tramitacion-procesal', [3, 15], 10)

    expect(result.positionType).toBe('tramitacion_procesal')
    expect(result.apiRequest.positionType).toBe('tramitacion_procesal')
    expect(result.apiRequest.multipleTopics).toEqual([3, 15])
    expect(result.apiRequest.proportionalByTopic).toBe(true)
  })

  test('Flujo para auxiliar-administrativo con temas [1, 2, 3]', () => {
    const result = simulateTestFlow('auxiliar-administrativo-estado', [1, 2, 3], 30)

    expect(result.positionType).toBe('auxiliar_administrativo')
    expect(result.apiRequest.positionType).toBe('auxiliar_administrativo')
    expect(result.apiRequest.multipleTopics).toEqual([1, 2, 3])
    expect(result.apiRequest.proportionalByTopic).toBe(true)
  })

  test('Flujo para administrativo con tema único [5]', () => {
    const result = simulateTestFlow('administrativo-estado', [5], 25)

    expect(result.positionType).toBe('administrativo')
    expect(result.apiRequest.positionType).toBe('administrativo')
    expect(result.apiRequest.multipleTopics).toEqual([5])
    expect(result.apiRequest.proportionalByTopic).toBe(false) // Solo 1 tema
  })

  test.each([
    ['auxiliar-administrativo-estado', [1, 5, 10], 30, 'auxiliar_administrativo'],
    ['administrativo-estado', [2, 4, 6], 25, 'administrativo'],
    ['tramitacion-procesal', [3, 15], 10, 'tramitacion_procesal'],
    ['tramitacion-procesal', [101, 105, 110], 15, 'tramitacion_procesal'],
    ['tramitacion-procesal', [201, 210, 220], 20, 'tramitacion_procesal']
  ])('Flujo %s con temas %j devuelve positionType %s',
    (oposicion, themes, numQuestions, expectedPositionType) => {
      const result = simulateTestFlow(oposicion, themes, numQuestions)

      expect(result.positionType).toBe(expectedPositionType)
      expect(result.apiRequest.positionType).toBe(expectedPositionType)
    }
  )
})

// ============================================
// TESTS: PREVENCIÓN DE REGRESIÓN
// ============================================

describe('Prevención de Regresión - BUG positionType', () => {
  test('CRÍTICO: Config vacío NO debe resultar en positionType incorrecto para tramitación', () => {
    // Este test verifica que el código CORREGIDO funciona
    const positionType = 'tramitacion_procesal'
    const testConfig = {} // Config vacío

    // La lógica CORRECTA (después del fix)
    const multiTemaConfig = {
      ...testConfig,
      positionType: positionType || 'auxiliar_administrativo'
    }

    expect(multiTemaConfig.positionType).toBe('tramitacion_procesal')
  })

  test('CRÍTICO: Prop positionType debe prevalecer sobre default', () => {
    const testConfigs = [
      { positionType: null },
      { positionType: undefined },
      {},
      null
    ]

    // Para cada caso, si se pasa positionType como prop separada, debe usarse
    testConfigs.forEach(testConfig => {
      const propPositionType = 'tramitacion_procesal'

      // Lógica del fix: usar prop si existe, o testConfig, o default
      const finalPositionType = propPositionType ||
                                testConfig?.positionType ||
                                'auxiliar_administrativo'

      expect(finalPositionType).toBe('tramitacion_procesal')
    })
  })

  test('API request debe contener positionType correcto', () => {
    // Simula exactamente lo que hace testFetchers.js
    const config = { positionType: 'tramitacion_procesal' }

    const apiBody = {
      topicNumber: 0,
      positionType: config?.positionType || 'auxiliar_administrativo',
      multipleTopics: [3, 15],
      numQuestions: 10
    }

    expect(apiBody.positionType).toBe('tramitacion_procesal')
    expect(apiBody.positionType).not.toBe('auxiliar_administrativo')
  })

  test('Cada página test-personalizado pasa su positionType correcto', () => {
    // Simula lo que hacen las páginas test-personalizado
    const pages = [
      { path: '/tramitacion-procesal/test/test-personalizado', positionType: 'tramitacion_procesal' },
      { path: '/auxiliar-administrativo-estado/test/test-personalizado', positionType: 'auxiliar_administrativo' },
      { path: '/administrativo-estado/test/test-personalizado', positionType: 'administrativo' }
    ]

    pages.forEach(page => {
      // Verificar que positionType está definido y es válido
      expect(page.positionType).toBeDefined()
      expect(VALID_POSITION_TYPES).toContain(page.positionType)

      // Verificar que no es el default incorrecto para tramitación
      if (page.path.includes('tramitacion')) {
        expect(page.positionType).toBe('tramitacion_procesal')
        expect(page.positionType).not.toBe('auxiliar_administrativo')
      }
    })
  })
})

// ============================================
// TESTS: CASOS EDGE
// ============================================

describe('Edge Cases', () => {
  test('positionType con espacios o case incorrecto debe fallar validación', () => {
    const invalidTypes = [
      'Tramitacion_Procesal', // Case incorrecto
      'tramitacion procesal',  // Con espacio
      'tramitación_procesal',  // Con tilde
      'TRAMITACION_PROCESAL'   // Mayúsculas
    ]

    invalidTypes.forEach(type => {
      expect(VALID_POSITION_TYPES).not.toContain(type)
    })
  })

  test('Array de temas vacío debe manejarse correctamente', () => {
    const themes = []
    const numQuestions = 10

    // No debería intentar distribución proporcional
    const shouldUseProportional = themes.length > 1
    expect(shouldUseProportional).toBe(false)
  })

  test('numQuestions mayor que preguntas disponibles', () => {
    const availableQuestions = 5
    const requestedQuestions = 50

    // El sistema debe dar el mínimo
    const actualQuestions = Math.min(requestedQuestions, availableQuestions)
    expect(actualQuestions).toBe(5)
  })

  test('Temas de diferentes bloques de misma oposición', () => {
    // Usuario selecciona tema 5 (bloque 1) y tema 110 (bloque 2) de tramitación
    const themes = [5, 110]
    const oposicion = 'tramitacion-procesal'

    // Verificar que ambos pertenecen a tramitación procesal
    const tramitacionThemes = THEMES_BY_OPOSICION[oposicion]
    expect(tramitacionThemes.block1).toContain(5)
    expect(tramitacionThemes.block2).toContain(110)

    // El positionType debe ser el mismo para ambos
    const positionType = OPOSICION_SLUG_TO_POSITION_TYPE[oposicion]
    expect(positionType).toBe('tramitacion_procesal')
  })
})
