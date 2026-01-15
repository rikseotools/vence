// __tests__/api/topic-progress/weakArticles.test.js
// Tests para el sistema de artículos débiles con colores por nivel

describe('Weak Articles Schema', () => {
  // Import schemas
  const {
    getWeakArticlesRequestSchema,
    weakArticleSchema
  } = require('@/lib/api/topic-progress/schemas')

  describe('getWeakArticlesRequestSchema', () => {
    test('debe tener maxSuccessRate por defecto de 80%', () => {
      const result = getWeakArticlesRequestSchema.parse({
        userId: '123e4567-e89b-12d3-a456-426614174000'
      })

      expect(result.maxSuccessRate).toBe(80)
    })

    test('debe tener minAttempts por defecto de 2', () => {
      const result = getWeakArticlesRequestSchema.parse({
        userId: '123e4567-e89b-12d3-a456-426614174000'
      })

      expect(result.minAttempts).toBe(2)
    })

    test('debe tener maxPerTopic por defecto de 5', () => {
      const result = getWeakArticlesRequestSchema.parse({
        userId: '123e4567-e89b-12d3-a456-426614174000'
      })

      expect(result.maxPerTopic).toBe(5)
    })

    test('debe permitir valores personalizados', () => {
      const result = getWeakArticlesRequestSchema.parse({
        userId: '123e4567-e89b-12d3-a456-426614174000',
        maxSuccessRate: 70,
        minAttempts: 3,
        maxPerTopic: 10,
        positionType: 'auxiliar_administrativo'
      })

      expect(result.maxSuccessRate).toBe(70)
      expect(result.minAttempts).toBe(3)
      expect(result.maxPerTopic).toBe(10)
      expect(result.positionType).toBe('auxiliar_administrativo')
    })

    test('debe rechazar userId inválido', () => {
      expect(() => {
        getWeakArticlesRequestSchema.parse({
          userId: 'not-a-uuid'
        })
      }).toThrow()
    })

    test('debe rechazar maxSuccessRate fuera de rango', () => {
      expect(() => {
        getWeakArticlesRequestSchema.parse({
          userId: '123e4567-e89b-12d3-a456-426614174000',
          maxSuccessRate: 101
        })
      }).toThrow()

      expect(() => {
        getWeakArticlesRequestSchema.parse({
          userId: '123e4567-e89b-12d3-a456-426614174000',
          maxSuccessRate: -1
        })
      }).toThrow()
    })
  })

  describe('weakArticleSchema', () => {
    test('debe validar un artículo débil completo', () => {
      const weakArticle = {
        lawName: 'CE',
        articleNumber: '14',
        failedCount: 3,
        totalAttempts: 10,
        correctCount: 7,
        avgSuccessRate: 70
      }

      const result = weakArticleSchema.parse(weakArticle)

      expect(result.lawName).toBe('CE')
      expect(result.articleNumber).toBe('14')
      expect(result.failedCount).toBe(3)
      expect(result.totalAttempts).toBe(10)
      expect(result.correctCount).toBe(7)
      expect(result.avgSuccessRate).toBe(70)
    })

    test('debe rechazar avgSuccessRate fuera de rango 0-100', () => {
      expect(() => {
        weakArticleSchema.parse({
          lawName: 'CE',
          articleNumber: '14',
          failedCount: 1,
          totalAttempts: 1,
          correctCount: 0,
          avgSuccessRate: 150
        })
      }).toThrow()
    })

    test('debe rechazar failedCount menor a 1', () => {
      expect(() => {
        weakArticleSchema.parse({
          lawName: 'CE',
          articleNumber: '14',
          failedCount: 0,
          totalAttempts: 1,
          correctCount: 1,
          avgSuccessRate: 100
        })
      }).toThrow()
    })

    test('debe permitir correctCount de 0', () => {
      const result = weakArticleSchema.parse({
        lawName: 'CE',
        articleNumber: '14',
        failedCount: 5,
        totalAttempts: 5,
        correctCount: 0,
        avgSuccessRate: 0
      })

      expect(result.correctCount).toBe(0)
    })
  })
})

describe('Review Level Logic', () => {
  // Simular la lógica de getReviewLevel del componente TopicContentView
  const getReviewLevel = (avgSuccessRate) => {
    if (avgSuccessRate === null || avgSuccessRate === undefined) return null
    if (avgSuccessRate < 40) return 'critical'
    if (avgSuccessRate < 60) return 'bad'
    if (avgSuccessRate < 80) return 'improvable'
    return null // >= 80% no debería aparecer como weak article
  }

  describe('getReviewLevel', () => {
    test('debe retornar "critical" para 0-39% de aciertos', () => {
      expect(getReviewLevel(0)).toBe('critical')
      expect(getReviewLevel(10)).toBe('critical')
      expect(getReviewLevel(20)).toBe('critical')
      expect(getReviewLevel(30)).toBe('critical')
      expect(getReviewLevel(39)).toBe('critical')
    })

    test('debe retornar "bad" para 40-59% de aciertos', () => {
      expect(getReviewLevel(40)).toBe('bad')
      expect(getReviewLevel(45)).toBe('bad')
      expect(getReviewLevel(50)).toBe('bad')
      expect(getReviewLevel(55)).toBe('bad')
      expect(getReviewLevel(59)).toBe('bad')
    })

    test('debe retornar "improvable" para 60-79% de aciertos', () => {
      expect(getReviewLevel(60)).toBe('improvable')
      expect(getReviewLevel(65)).toBe('improvable')
      expect(getReviewLevel(70)).toBe('improvable')
      expect(getReviewLevel(75)).toBe('improvable')
      expect(getReviewLevel(79)).toBe('improvable')
    })

    test('debe retornar null para 80%+ de aciertos', () => {
      expect(getReviewLevel(80)).toBeNull()
      expect(getReviewLevel(85)).toBeNull()
      expect(getReviewLevel(90)).toBeNull()
      expect(getReviewLevel(100)).toBeNull()
    })

    test('debe retornar null para valores indefinidos', () => {
      expect(getReviewLevel(null)).toBeNull()
      expect(getReviewLevel(undefined)).toBeNull()
    })
  })

  describe('Review Level Messages', () => {
    const getReviewMessage = (level) => {
      if (level === 'critical') return 'Repasar urgente'
      if (level === 'bad') return 'Repasar'
      if (level === 'improvable') return 'Practicar más'
      return null
    }

    test('debe mostrar "Repasar urgente" para nivel critical', () => {
      expect(getReviewMessage('critical')).toBe('Repasar urgente')
    })

    test('debe mostrar "Repasar" para nivel bad', () => {
      expect(getReviewMessage('bad')).toBe('Repasar')
    })

    test('debe mostrar "Practicar más" para nivel improvable', () => {
      expect(getReviewMessage('improvable')).toBe('Practicar más')
    })
  })
})

describe('Weak Article Stats Calculation', () => {
  // Simular el cálculo de estadísticas como en queries.ts
  const calculateStats = (totalAttempts, avgSuccessRate) => {
    const correctCount = Math.round(totalAttempts * (avgSuccessRate / 100))
    const failedCount = totalAttempts - correctCount
    return { correctCount, failedCount }
  }

  test('debe calcular correctamente los aciertos y fallos', () => {
    // 10 intentos, 70% aciertos = 7 correctos, 3 fallos
    expect(calculateStats(10, 70)).toEqual({ correctCount: 7, failedCount: 3 })
  })

  test('debe manejar 0% de aciertos', () => {
    // 5 intentos, 0% aciertos = 0 correctos, 5 fallos
    expect(calculateStats(5, 0)).toEqual({ correctCount: 0, failedCount: 5 })
  })

  test('debe manejar 100% de aciertos', () => {
    // 8 intentos, 100% aciertos = 8 correctos, 0 fallos
    expect(calculateStats(8, 100)).toEqual({ correctCount: 8, failedCount: 0 })
  })

  test('debe redondear correctamente', () => {
    // 3 intentos, 33% aciertos = ~1 correcto, 2 fallos
    const result = calculateStats(3, 33)
    expect(result.correctCount).toBe(1) // Math.round(0.99) = 1
    expect(result.failedCount).toBe(2)
  })

  test('debe manejar porcentajes que producen decimales', () => {
    // 7 intentos, 45% aciertos = ~3 correctos, 4 fallos
    const result = calculateStats(7, 45)
    expect(result.correctCount).toBe(3) // Math.round(3.15) = 3
    expect(result.failedCount).toBe(4)
  })
})

describe('Threshold Behavior', () => {
  // Simular el filtro de artículos débiles
  const isWeakArticle = (successRate, minAttempts, actualAttempts, maxSuccessRate = 80) => {
    if (actualAttempts < minAttempts) return false
    return successRate < maxSuccessRate
  }

  test('1 fallo de 10 intentos (90%) NO debe aparecer con umbral 80%', () => {
    // 9/10 = 90% > 80%
    expect(isWeakArticle(90, 2, 10, 80)).toBe(false)
  })

  test('2 fallos de 10 intentos (80%) NO debe aparecer con umbral 80%', () => {
    // 8/10 = 80% = umbral, no es menor
    expect(isWeakArticle(80, 2, 10, 80)).toBe(false)
  })

  test('3 fallos de 10 intentos (70%) SÍ debe aparecer con umbral 80%', () => {
    // 7/10 = 70% < 80%
    expect(isWeakArticle(70, 2, 10, 80)).toBe(true)
  })

  test('NO debe aparecer si no tiene suficientes intentos', () => {
    // Solo 1 intento, minAttempts = 2
    expect(isWeakArticle(0, 2, 1, 80)).toBe(false)
  })

  test('SÍ debe aparecer con exactamente minAttempts', () => {
    // 2 intentos = minAttempts, 50% < 80%
    expect(isWeakArticle(50, 2, 2, 80)).toBe(true)
  })

  test('debe funcionar con umbral personalizado de 60%', () => {
    // 70% > 60% umbral antiguo
    expect(isWeakArticle(70, 2, 5, 60)).toBe(false)
    // 50% < 60%
    expect(isWeakArticle(50, 2, 5, 60)).toBe(true)
  })
})

describe('Color Assignment Integration', () => {
  // Test completo de integración: dado un artículo débil, verificar color correcto
  const getArticleDisplay = (weakArticle) => {
    if (!weakArticle) return null

    const { avgSuccessRate, totalAttempts, correctCount } = weakArticle
    const failedCount = totalAttempts - correctCount

    let level, message, color
    if (avgSuccessRate < 40) {
      level = 'critical'
      message = 'Repasar urgente'
      color = 'red'
    } else if (avgSuccessRate < 60) {
      level = 'bad'
      message = 'Repasar'
      color = 'orange'
    } else {
      level = 'improvable'
      message = 'Practicar más'
      color = 'yellow'
    }

    return {
      level,
      message,
      color,
      displayText: `${message} - ${totalAttempts} ${totalAttempts === 1 ? 'intento' : 'intentos'}, ${failedCount} ${failedCount === 1 ? 'fallo' : 'fallos'} (${avgSuccessRate}%)`
    }
  }

  test('artículo con 30% aciertos debe ser rojo con mensaje urgente', () => {
    const article = {
      lawName: 'CE',
      articleNumber: '14',
      totalAttempts: 10,
      correctCount: 3,
      avgSuccessRate: 30
    }

    const display = getArticleDisplay(article)

    expect(display.level).toBe('critical')
    expect(display.color).toBe('red')
    expect(display.message).toBe('Repasar urgente')
    expect(display.displayText).toBe('Repasar urgente - 10 intentos, 7 fallos (30%)')
  })

  test('artículo con 50% aciertos debe ser naranja', () => {
    const article = {
      lawName: 'LOPJ',
      articleNumber: '122',
      totalAttempts: 8,
      correctCount: 4,
      avgSuccessRate: 50
    }

    const display = getArticleDisplay(article)

    expect(display.level).toBe('bad')
    expect(display.color).toBe('orange')
    expect(display.message).toBe('Repasar')
    expect(display.displayText).toBe('Repasar - 8 intentos, 4 fallos (50%)')
  })

  test('artículo con 75% aciertos debe ser amarillo', () => {
    const article = {
      lawName: 'LEC',
      articleNumber: '45',
      totalAttempts: 4,
      correctCount: 3,
      avgSuccessRate: 75
    }

    const display = getArticleDisplay(article)

    expect(display.level).toBe('improvable')
    expect(display.color).toBe('yellow')
    expect(display.message).toBe('Practicar más')
    expect(display.displayText).toBe('Practicar más - 4 intentos, 1 fallo (75%)')
  })

  test('debe manejar singular correctamente (1 intento, 1 fallo)', () => {
    const article = {
      lawName: 'CE',
      articleNumber: '1',
      totalAttempts: 1,
      correctCount: 0,
      avgSuccessRate: 0
    }

    const display = getArticleDisplay(article)

    expect(display.displayText).toBe('Repasar urgente - 1 intento, 1 fallo (0%)')
  })

  test('debe retornar null para artículo no débil', () => {
    expect(getArticleDisplay(null)).toBeNull()
    expect(getArticleDisplay(undefined)).toBeNull()
  })
})
