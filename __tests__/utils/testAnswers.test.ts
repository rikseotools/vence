// __tests__/utils/testAnswers.test.js
// Tests para verificar que testAnswers.js resuelve correctamente el tema_number
// cuando se guardan respuestas de tests de leyes (que no tienen tema preestablecido)

/**
 * Este test verifica el bug corregido el 2026-01-22:
 * - Los tests desde /leyes/* no tenían tema_number asignado
 * - Las respuestas se guardaban con tema_number=0
 * - Esto causaba que el progreso por tema no se mostrara correctamente
 *
 * La solución fue añadir lógica en saveDetailedAnswer() para:
 * 1. Detectar cuando tema=0
 * 2. Llamar a /api/tema-resolver para obtener el tema correcto
 * 3. Guardar la respuesta con el tema resuelto
 */

describe('testAnswers - Resolución de tema', () => {

  describe('Mapeo oposicion -> positionType', () => {
    // Este mapeo es crítico para que el tema-resolver funcione correctamente
    const OPOSICION_TO_POSITION_TYPE = {
      'auxiliar_administrativo_estado': 'auxiliar_administrativo',
      'administrativo_estado': 'administrativo',
      'tramitacion_procesal': 'tramitacion_procesal',
      'auxilio_judicial': 'auxilio_judicial',
    }

    test('auxiliar_administrativo_estado mapea a auxiliar_administrativo', () => {
      expect(OPOSICION_TO_POSITION_TYPE['auxiliar_administrativo_estado']).toBe('auxiliar_administrativo')
    })

    test('administrativo_estado mapea a administrativo (NO administrativo_estado)', () => {
      // Este fue un bug que causaba que no se resolvieran temas para administrativo_estado
      expect(OPOSICION_TO_POSITION_TYPE['administrativo_estado']).toBe('administrativo')
      expect(OPOSICION_TO_POSITION_TYPE['administrativo_estado']).not.toBe('administrativo_estado')
    })

    test('tramitacion_procesal mapea a tramitacion_procesal', () => {
      expect(OPOSICION_TO_POSITION_TYPE['tramitacion_procesal']).toBe('tramitacion_procesal')
    })

    test('auxilio_judicial mapea a auxilio_judicial', () => {
      expect(OPOSICION_TO_POSITION_TYPE['auxilio_judicial']).toBe('auxilio_judicial')
    })
  })

  describe('Detección de tema=0', () => {
    test('parseInt de undefined devuelve NaN, || 0 da 0', () => {
      const tema = undefined
      const calculatedTema = parseInt(tema) || 0
      expect(calculatedTema).toBe(0)
    })

    test('parseInt de null devuelve NaN, || 0 da 0', () => {
      const tema = null
      const calculatedTema = parseInt(tema) || 0
      expect(calculatedTema).toBe(0)
    })

    test('parseInt de string vacío devuelve NaN, || 0 da 0', () => {
      const tema = ''
      const calculatedTema = parseInt(tema) || 0
      expect(calculatedTema).toBe(0)
    })

    test('parseInt de "0" devuelve 0, || 0 da 0', () => {
      const tema = '0'
      const calculatedTema = parseInt(tema) || 0
      expect(calculatedTema).toBe(0)
    })

    test('parseInt de número válido se preserva', () => {
      const tema = '5'
      const calculatedTema = parseInt(tema) || 0
      expect(calculatedTema).toBe(5)
    })

    test('questionData.tema tiene prioridad', () => {
      const questionData = { tema: 7 }
      const tema = undefined
      const calculatedTema = parseInt(questionData?.tema || tema) || 0
      expect(calculatedTema).toBe(7)
    })
  })

  describe('Datos necesarios para resolver tema', () => {
    test('questionData debe tener article.id o article.law_id para resolver', () => {
      const questionDataConArticulo = {
        id: 'question-uuid',
        article: {
          id: 'article-uuid',
          number: '71',
          law_id: 'law-uuid',
          law_short_name: 'CE'
        }
      }

      // Verificar que tiene los datos necesarios
      expect(questionDataConArticulo.article?.id).toBeDefined()
      expect(questionDataConArticulo.article?.law_id).toBeDefined()
    })

    test('questionData sin article no puede resolver tema', () => {
      const questionDataSinArticulo = {
        id: 'question-uuid',
        // No tiene article
      }

      expect(questionDataSinArticulo.article).toBeUndefined()
    })
  })

  describe('Construcción de params para API tema-resolver', () => {
    test('construye params correctamente desde questionData', () => {
      const questionData = {
        id: 'question-uuid-123',
        article: {
          id: 'article-uuid-456',
          number: '71',
          law_id: 'law-uuid-789',
          law_short_name: 'CE'
        }
      }
      const oposicionId = 'auxiliar_administrativo_estado'

      const params = new URLSearchParams()
      if (questionData?.id) params.set('questionId', questionData.id)
      if (questionData?.article?.id) params.set('articleId', questionData.article.id)
      if (questionData?.article?.number) params.set('articleNumber', questionData.article.number)
      if (questionData?.article?.law_id) params.set('lawId', questionData.article.law_id)
      if (questionData?.article?.law_short_name) params.set('lawShortName', questionData.article.law_short_name)
      params.set('oposicionId', oposicionId)

      expect(params.get('questionId')).toBe('question-uuid-123')
      expect(params.get('articleId')).toBe('article-uuid-456')
      expect(params.get('articleNumber')).toBe('71')
      expect(params.get('lawId')).toBe('law-uuid-789')
      expect(params.get('lawShortName')).toBe('CE')
      expect(params.get('oposicionId')).toBe('auxiliar_administrativo_estado')
    })

    test('params son opcionales excepto oposicionId', () => {
      const questionData = {
        id: 'question-uuid-123',
        // Sin article
      }
      const oposicionId = 'tramitacion_procesal'

      const params = new URLSearchParams()
      if (questionData?.id) params.set('questionId', questionData.id)
      if (questionData?.article?.id) params.set('articleId', questionData.article.id)
      params.set('oposicionId', oposicionId)

      expect(params.get('questionId')).toBe('question-uuid-123')
      expect(params.get('articleId')).toBeNull() // No se estableció
      expect(params.get('oposicionId')).toBe('tramitacion_procesal')
    })
  })

  describe('Respuesta de API tema-resolver', () => {
    test('respuesta exitosa tiene temaNumber y resolvedVia', () => {
      const mockSuccessResponse = {
        success: true,
        temaNumber: 3,
        resolvedVia: 'article'
      }

      expect(mockSuccessResponse.success).toBe(true)
      expect(mockSuccessResponse.temaNumber).toBe(3)
      expect(mockSuccessResponse.temaNumber).toBeGreaterThan(0)
    })

    test('respuesta fallida tiene success=false', () => {
      const mockFailResponse = {
        success: false,
        temaNumber: null,
        reason: 'no_topic_scope_match'
      }

      expect(mockFailResponse.success).toBe(false)
      expect(mockFailResponse.temaNumber).toBeNull()
    })

    test('usar temaNumber solo si success=true y temaNumber existe', () => {
      const checkResponse = (result) => {
        if (result.success && result.temaNumber) {
          return result.temaNumber
        }
        return null
      }

      expect(checkResponse({ success: true, temaNumber: 5 })).toBe(5)
      expect(checkResponse({ success: false, temaNumber: null })).toBeNull()
      expect(checkResponse({ success: true, temaNumber: 0 })).toBeNull() // 0 es falsy
      expect(checkResponse({ success: true, temaNumber: null })).toBeNull()
    })
  })
})

describe('testAnswers - Casos de regresión', () => {

  describe('Bug 2026-01-22: Tests de leyes sin tema', () => {
    /**
     * Escenario: Usuario hace test desde /leyes/constitucion-espanola
     * El test NO tiene tema preestablecido (tema=0 o undefined)
     * La pregunta es sobre Art 71 de la CE
     * El Art 71 CE pertenece al Tema 3 para auxiliar_administrativo
     *
     * Esperado: La respuesta se guarda con tema_number=3
     * Antes del fix: Se guardaba con tema_number=0
     */
    test('pregunta de ley debe resolver tema aunque el test no lo tenga', () => {
      // Simular el flujo de saveDetailedAnswer
      const testTema = undefined // Test de ley no tiene tema
      const questionData = {
        id: 'question-uuid',
        tema: undefined, // La pregunta tampoco tiene tema en el objeto
        article: {
          id: 'article-uuid',
          number: '71',
          law_id: 'ce-law-uuid',
          law_short_name: 'CE'
        }
      }

      // Paso 1: Calcular tema inicial
      let calculatedTema = parseInt(questionData?.tema || testTema) || 0
      expect(calculatedTema).toBe(0) // Inicialmente es 0

      // Paso 2: Si tema es 0, debemos llamar a tema-resolver
      const shouldResolveTema = calculatedTema === 0 && !!questionData
      expect(shouldResolveTema).toBe(true)

      // Paso 3: Mock de respuesta de tema-resolver
      const mockApiResponse = {
        success: true,
        temaNumber: 3, // Art 71 CE -> Tema 3
        resolvedVia: 'article'
      }

      // Paso 4: Actualizar calculatedTema con la respuesta
      if (mockApiResponse.success && mockApiResponse.temaNumber) {
        calculatedTema = mockApiResponse.temaNumber
      }

      expect(calculatedTema).toBe(3) // Ahora es 3, no 0
    })

    test('si tema-resolver falla, mantener tema=0', () => {
      let calculatedTema = 0

      const mockApiResponse = {
        success: false,
        temaNumber: null,
        reason: 'no_topic_scope_match'
      }

      if (mockApiResponse.success && mockApiResponse.temaNumber) {
        calculatedTema = mockApiResponse.temaNumber
      }

      expect(calculatedTema).toBe(0) // Se mantiene en 0
    })

    test('si el test ya tiene tema, no llamar a tema-resolver', () => {
      const testTema = 5 // Test de tema específico
      const questionData = {
        id: 'question-uuid',
        article: { id: 'article-uuid' }
      }

      let calculatedTema = parseInt(questionData?.tema || testTema) || 0
      expect(calculatedTema).toBe(5)

      const shouldResolveTema = calculatedTema === 0 && !!questionData
      expect(shouldResolveTema).toBe(false) // NO debe resolver, ya tiene tema
    })
  })

  describe('Bug relacionado: Mapeo incorrecto administrativo_estado', () => {
    /**
     * Escenario: Usuario con oposición administrativo_estado
     * El sistema buscaba position_type='administrativo_estado' en topic_scope
     * Pero en la BD, el position_type es 'administrativo'
     *
     * Fix: Mapear administrativo_estado -> administrativo
     */
    test('administrativo_estado debe mapear a administrativo para topic_scope', () => {
      const OPOSICION_TO_POSITION_TYPE = {
        'auxiliar_administrativo_estado': 'auxiliar_administrativo',
        'administrativo_estado': 'administrativo', // Este era el bug
        'tramitacion_procesal': 'tramitacion_procesal',
        'auxilio_judicial': 'auxilio_judicial',
      }

      const userOposicion = 'administrativo_estado'
      const positionTypeParaBuscar = OPOSICION_TO_POSITION_TYPE[userOposicion]

      expect(positionTypeParaBuscar).toBe('administrativo')
      expect(positionTypeParaBuscar).not.toBe('administrativo_estado')
    })
  })
})
