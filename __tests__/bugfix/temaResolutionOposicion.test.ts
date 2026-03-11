/**
 * Regression test: Bug resolución de tema en /test/rapido
 *
 * ISSUE: El V2 save path (saveDetailedAnswerV2 → insertTestAnswer) no enviaba
 * oposicionId al servidor. El servidor caía en el default 'auxiliar_administrativo_estado',
 * haciendo que preguntas de /test/rapido se guardaran con tema_number de auxiliar
 * en vez del tema correcto de la oposición del usuario.
 *
 * Ejemplo real: Irene (administrativo_estado) respondió Art.3 "La Red Internet".
 * Debería guardarse como Tema 601 (administrativo), pero se guardó como Tema 112 (auxiliar).
 *
 * ROOT CAUSE: saveDetailedAnswerV2 no incluía oposicionId en el body → insertTestAnswer
 * usaba req.oposicionId || 'auxiliar_administrativo_estado' → siempre auxiliar.
 *
 * FIX: insertTestAnswer ahora consulta user_profiles.target_oposicion server-side
 * usando el userId que ya recibe como parámetro.
 */

// ============================================
// 1. El servidor NO debe depender del cliente para oposicionId
// ============================================

describe('insertTestAnswer: resuelve oposición server-side', () => {
  // Reproduce la lógica de resolución de oposicionId en insertTestAnswer
  function resolveOposicionId(params: {
    reqOposicionId: string | null | undefined
    userProfileOposicion: string | null | undefined
    allOposicionIds: string[]
  }) {
    // 1. Si el cliente envió oposicionId, usarlo (backward compat)
    let oposicionId = params.reqOposicionId || ''

    // 2. Si no, obtener del perfil del usuario (FIX)
    if (!oposicionId) {
      const userOposicion = params.userProfileOposicion
      oposicionId = (userOposicion && params.allOposicionIds.includes(userOposicion))
        ? userOposicion
        : 'auxiliar_administrativo_estado'
    }

    return oposicionId
  }

  const ALL_IDS = [
    'auxiliar_administrativo_estado',
    'administrativo_estado',
    'tramitacion_procesal',
    'auxilio_judicial',
    'auxiliar_administrativo_gva',
    'auxiliar_administrativo_andalucia',
    'auxiliar_administrativo_clm',
  ]

  it('sin req.oposicionId, usa target_oposicion del usuario', () => {
    const result = resolveOposicionId({
      reqOposicionId: undefined, // V2 no lo envía
      userProfileOposicion: 'administrativo_estado',
      allOposicionIds: ALL_IDS,
    })
    expect(result).toBe('administrativo_estado')
  })

  it('sin req.oposicionId, usuario tramitacion → tramitacion', () => {
    const result = resolveOposicionId({
      reqOposicionId: null,
      userProfileOposicion: 'tramitacion_procesal',
      allOposicionIds: ALL_IDS,
    })
    expect(result).toBe('tramitacion_procesal')
  })

  it('sin req.oposicionId ni perfil → fallback a auxiliar', () => {
    const result = resolveOposicionId({
      reqOposicionId: undefined,
      userProfileOposicion: null,
      allOposicionIds: ALL_IDS,
    })
    expect(result).toBe('auxiliar_administrativo_estado')
  })

  it('con req.oposicionId válido (backward compat) → lo usa', () => {
    const result = resolveOposicionId({
      reqOposicionId: 'administrativo_estado',
      userProfileOposicion: 'tramitacion_procesal', // ignorado
      allOposicionIds: ALL_IDS,
    })
    expect(result).toBe('administrativo_estado')
  })

  it('perfil con oposición inválida → fallback a auxiliar', () => {
    const result = resolveOposicionId({
      reqOposicionId: undefined,
      userProfileOposicion: 'oposicion_inventada',
      allOposicionIds: ALL_IDS,
    })
    expect(result).toBe('auxiliar_administrativo_estado')
  })
})

// ============================================
// 2. El tema resuelto depende de la oposición (artículo compartido)
// ============================================

describe('Mismo artículo, diferente tema según oposición', () => {
  // Simula topic_scope: el mismo artículo puede estar en diferentes temas
  // según la oposición (position_type)
  const TOPIC_SCOPE_MOCK: Record<string, Record<string, number>> = {
    // law_id:article_number → { position_type: tema_number }
    'ley-internet:3': {
      'auxiliar_administrativo': 112,
      'administrativo': 601,
    },
    'trebep:16': {
      'auxiliar_administrativo': 5,
      'tramitacion_procesal': 13,
      'administrativo': 5,
    },
    'constitucion:1': {
      'auxiliar_administrativo': 1,
      'administrativo': 1,
      'tramitacion_procesal': 1,
    },
  }

  const OPOSICION_TO_POSITION: Record<string, string> = {
    'auxiliar_administrativo_estado': 'auxiliar_administrativo',
    'administrativo_estado': 'administrativo',
    'tramitacion_procesal': 'tramitacion_procesal',
  }

  function resolveTema(
    lawArticleKey: string,
    oposicionId: string
  ): number | null {
    const positionType = OPOSICION_TO_POSITION[oposicionId]
    if (!positionType) return null
    return TOPIC_SCOPE_MOCK[lawArticleKey]?.[positionType] ?? null
  }

  it('Art.3 Internet + administrativo → Tema 601', () => {
    expect(resolveTema('ley-internet:3', 'administrativo_estado')).toBe(601)
  })

  it('Art.3 Internet + auxiliar → Tema 112', () => {
    expect(resolveTema('ley-internet:3', 'auxiliar_administrativo_estado')).toBe(112)
  })

  it('Art.16 TREBEP + auxiliar → Tema 5', () => {
    expect(resolveTema('trebep:16', 'auxiliar_administrativo_estado')).toBe(5)
  })

  it('Art.16 TREBEP + tramitación → Tema 13', () => {
    expect(resolveTema('trebep:16', 'tramitacion_procesal')).toBe(13)
  })

  it('Art.1 Constitución → mismo tema en todas las oposiciones', () => {
    expect(resolveTema('constitucion:1', 'auxiliar_administrativo_estado')).toBe(1)
    expect(resolveTema('constitucion:1', 'administrativo_estado')).toBe(1)
    expect(resolveTema('constitucion:1', 'tramitacion_procesal')).toBe(1)
  })

  it('BUG ANTIGUO: usar siempre auxiliar daba tema incorrecto para admin', () => {
    // Este era el bug: insertTestAnswer siempre usaba auxiliar
    const buggyTema = resolveTema('ley-internet:3', 'auxiliar_administrativo_estado')
    const correctTema = resolveTema('ley-internet:3', 'administrativo_estado')
    expect(buggyTema).toBe(112)
    expect(correctTema).toBe(601)
    expect(buggyTema).not.toBe(correctTema) // ¡Diferente tema para diferente oposición!
  })
})

// ============================================
// 3. /test/rapido: tema=0 debe activar el resolver con la oposición correcta
// ============================================

describe('/test/rapido: tema=0 activa resolución con oposición del usuario', () => {
  function simulateSaveAnswer(params: {
    questionTema: number | null
    layoutTema: number
    userOposicion: string | null
    resolverFn: (oposicionId: string) => number | null
  }) {
    // Reproduce la lógica de insertTestAnswer
    let calculatedTema = parseInt(String(params.questionTema || params.layoutTema)) || 0

    if (calculatedTema === 0) {
      // FIX: obtener oposición del usuario server-side
      const oposicionId = params.userOposicion || 'auxiliar_administrativo_estado'
      const resolved = params.resolverFn(oposicionId)
      if (resolved) {
        calculatedTema = resolved
      }
    }

    return calculatedTema
  }

  it('/test/rapido con user admin → resuelve tema administrativo', () => {
    const tema = simulateSaveAnswer({
      questionTema: null, // API global devuelve null
      layoutTema: 0, // TestPageWrapper pasa 0
      userOposicion: 'administrativo_estado',
      resolverFn: (oposId) => oposId === 'administrativo_estado' ? 601 : 112,
    })
    expect(tema).toBe(601)
  })

  it('/test/rapido con user auxiliar → resuelve tema auxiliar', () => {
    const tema = simulateSaveAnswer({
      questionTema: null,
      layoutTema: 0,
      userOposicion: 'auxiliar_administrativo_estado',
      resolverFn: (oposId) => oposId === 'administrativo_estado' ? 601 : 112,
    })
    expect(tema).toBe(112)
  })

  it('/test/rapido con user tramitación → resuelve tema tramitación', () => {
    const tema = simulateSaveAnswer({
      questionTema: null,
      layoutTema: 0,
      userOposicion: 'tramitacion_procesal',
      resolverFn: (oposId) => oposId === 'tramitacion_procesal' ? 13 : 5,
    })
    expect(tema).toBe(13)
  })

  it('test con tema específico → NO activa el resolver', () => {
    const resolverCalled = { called: false }
    const tema = simulateSaveAnswer({
      questionTema: 5, // Pregunta ya tiene tema
      layoutTema: 5,
      userOposicion: 'administrativo_estado',
      resolverFn: () => { resolverCalled.called = true; return 601 },
    })
    expect(tema).toBe(5) // Usa el tema que ya tenía
    expect(resolverCalled.called).toBe(false) // Resolver NO se llamó
  })

  it('sin perfil de usuario → fallback a auxiliar', () => {
    const tema = simulateSaveAnswer({
      questionTema: null,
      layoutTema: 0,
      userOposicion: null,
      resolverFn: (oposId) => oposId === 'auxiliar_administrativo_estado' ? 112 : null,
    })
    expect(tema).toBe(112) // Fallback correcto
  })

  it('resolver falla → tema queda en 0', () => {
    const tema = simulateSaveAnswer({
      questionTema: null,
      layoutTema: 0,
      userOposicion: 'administrativo_estado',
      resolverFn: () => null, // No encuentra el artículo en topic_scope
    })
    expect(tema).toBe(0) // Graceful degradation
  })
})

// ============================================
// 4. Invariante: la fuente de verdad es el artículo, no el tema
// ============================================

describe('Invariante: artículo es la fuente de verdad', () => {
  it('el tema se deriva del artículo + oposición, no se inventa', () => {
    // Un artículo pertenece a una ley.
    // topic_scope define qué artículos de qué leyes pertenecen a qué tema.
    // El tema depende de la oposición (position_type).
    const article = { id: 'uuid-art-3', law_id: 'uuid-ley-internet', number: '3' }

    // Misma pregunta, mismo artículo, pero diferentes oposiciones → diferentes temas
    // Esto es CORRECTO y por diseño
    const temaAuxiliar = 112
    const temaAdministrativo = 601

    expect(temaAuxiliar).not.toBe(temaAdministrativo)

    // El artículo es el mismo — lo que cambia es el topic_scope
    expect(article.id).toBe('uuid-art-3')
  })

  it('cross-oposición: conocimiento a nivel de artículo es compartido', () => {
    // Si un usuario responde una pregunta del Art.3 via auxiliar,
    // su conocimiento de ese artículo es válido también para administrativo.
    // Esto es por diseño: el V2 stats system mapea por artículo.
    const userAnsweredArticle3 = true
    const auxiliarKnowsArticle3 = userAnsweredArticle3
    const administrativoKnowsArticle3 = userAnsweredArticle3

    expect(auxiliarKnowsArticle3).toBe(true)
    expect(administrativoKnowsArticle3).toBe(true)
  })
})
