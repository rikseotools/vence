/**
 * Tests de integración para verificar el filtrado de preguntas oficiales por oposición
 *
 * Estos tests simulan el comportamiento del filtrado sin conexión a BD real
 * (los tests manuales contra BD se realizan con scripts separados)
 */

// Mapeo de exam_position (debe coincidir con el código real)
const EXAM_POSITION_MAP = {
  'auxiliar_administrativo': [
    'auxiliar administrativo del estado',
    'auxiliar administrativo',
    'auxiliar_administrativo',
    'auxiliar_administrativo_estado',
  ],
  'administrativo': [
    'administrativo',
    'cuerpo_general_administrativo',
    'cuerpo general administrativo de la administración del estado',
  ],
  'tramitacion_procesal': ['tramitacion_procesal', 'tramitación procesal'],
  'auxilio_judicial': ['auxilio_judicial', 'auxilio judicial'],
  'gestion_procesal': ['gestion_procesal', 'gestión procesal'],
}

// Simulación de datos de BD
const mockDatabaseQuestions = [
  // Auxiliar Administrativo Estado
  { id: 'aux-1', exam_position: 'auxiliar_administrativo_estado', is_official_exam: true, is_active: true },
  { id: 'aux-2', exam_position: 'auxiliar administrativo del estado', is_official_exam: true, is_active: true },
  { id: 'aux-3', exam_position: 'auxiliar_administrativo_estado', is_official_exam: true, is_active: true },

  // Administrativo
  { id: 'adm-1', exam_position: 'administrativo', is_official_exam: true, is_active: true },
  { id: 'adm-2', exam_position: 'cuerpo_general_administrativo', is_official_exam: true, is_active: true },

  // Tramitación Procesal
  { id: 'tra-1', exam_position: 'tramitacion_procesal', is_official_exam: true, is_active: true },
  { id: 'tra-2', exam_position: 'tramitación procesal', is_official_exam: true, is_active: true },
  { id: 'tra-3', exam_position: 'tramitacion_procesal', is_official_exam: true, is_active: true },

  // Auxilio Judicial
  { id: 'jud-1', exam_position: 'auxilio_judicial', is_official_exam: true, is_active: true },
  { id: 'jud-2', exam_position: 'auxilio judicial', is_official_exam: true, is_active: true },
  { id: 'jud-3', exam_position: 'auxilio_judicial', is_official_exam: true, is_active: true },
  { id: 'jud-4', exam_position: 'auxilio_judicial', is_official_exam: true, is_active: true },

  // Gestión Procesal
  { id: 'ges-1', exam_position: 'gestion_procesal', is_official_exam: true, is_active: true },

  // Legacy (NULL)
  { id: 'leg-1', exam_position: null, is_official_exam: true, is_active: true },
  { id: 'leg-2', exam_position: null, is_official_exam: true, is_active: true },
  { id: 'leg-3', exam_position: null, is_official_exam: true, is_active: true },

  // No oficial (no debe incluirse)
  { id: 'no-of-1', exam_position: 'auxiliar_administrativo_estado', is_official_exam: false, is_active: true },

  // Inactiva (no debe incluirse)
  { id: 'inact-1', exam_position: 'tramitacion_procesal', is_official_exam: true, is_active: false },
]

// Simulación del comportamiento de la query de Supabase
function simulateSupabaseQuery(questions, filters) {
  return questions.filter(q => {
    // Filtro base: is_official_exam y is_active
    if (filters.is_official_exam && q.is_official_exam !== true) return false
    if (filters.is_active && q.is_active !== true) return false

    // Filtro de exam_position con OR NULL
    if (filters.examPositionFilter) {
      const validPositions = filters.examPositionFilter
      const includesNull = q.exam_position === null
      const includesPosition = validPositions.includes(q.exam_position)
      if (!includesNull && !includesPosition) return false
    }

    return true
  })
}

describe('Integración: Simulación de filtrado exam_position', () => {
  describe('Filtro para Tramitación Procesal', () => {
    const tramitacionFilter = EXAM_POSITION_MAP['tramitacion_procesal']

    test('debe incluir solo preguntas de tramitación + legacy', () => {
      const result = simulateSupabaseQuery(mockDatabaseQuestions, {
        is_official_exam: true,
        is_active: true,
        examPositionFilter: tramitacionFilter,
      })

      // Debe incluir 3 de tramitación + 3 legacy = 6
      expect(result.length).toBe(6)

      // Verificar que incluye las de tramitación
      expect(result.some(q => q.id === 'tra-1')).toBe(true)
      expect(result.some(q => q.id === 'tra-2')).toBe(true)
      expect(result.some(q => q.id === 'tra-3')).toBe(true)

      // Verificar que incluye las legacy
      expect(result.some(q => q.id === 'leg-1')).toBe(true)
      expect(result.some(q => q.id === 'leg-2')).toBe(true)
      expect(result.some(q => q.id === 'leg-3')).toBe(true)
    })

    test('NO debe incluir preguntas de otras oposiciones', () => {
      const result = simulateSupabaseQuery(mockDatabaseQuestions, {
        is_official_exam: true,
        is_active: true,
        examPositionFilter: tramitacionFilter,
      })

      // NO debe incluir auxiliar
      expect(result.some(q => q.id === 'aux-1')).toBe(false)
      expect(result.some(q => q.id === 'aux-2')).toBe(false)

      // NO debe incluir auxilio judicial
      expect(result.some(q => q.id === 'jud-1')).toBe(false)
      expect(result.some(q => q.id === 'jud-2')).toBe(false)

      // NO debe incluir administrativo
      expect(result.some(q => q.id === 'adm-1')).toBe(false)
    })
  })

  describe('Filtro para Auxiliar Administrativo', () => {
    const auxiliarFilter = EXAM_POSITION_MAP['auxiliar_administrativo']

    test('debe incluir solo preguntas de auxiliar + legacy', () => {
      const result = simulateSupabaseQuery(mockDatabaseQuestions, {
        is_official_exam: true,
        is_active: true,
        examPositionFilter: auxiliarFilter,
      })

      // Debe incluir 3 de auxiliar + 3 legacy = 6
      expect(result.length).toBe(6)

      // Verificar que incluye las de auxiliar
      expect(result.some(q => q.id === 'aux-1')).toBe(true)
      expect(result.some(q => q.id === 'aux-2')).toBe(true)
      expect(result.some(q => q.id === 'aux-3')).toBe(true)
    })

    test('NO debe incluir preguntas de otras oposiciones', () => {
      const result = simulateSupabaseQuery(mockDatabaseQuestions, {
        is_official_exam: true,
        is_active: true,
        examPositionFilter: auxiliarFilter,
      })

      // NO debe incluir tramitación
      expect(result.some(q => q.id === 'tra-1')).toBe(false)

      // NO debe incluir auxilio judicial
      expect(result.some(q => q.id === 'jud-1')).toBe(false)
    })
  })

  describe('Filtro para Auxilio Judicial', () => {
    const auxilioFilter = EXAM_POSITION_MAP['auxilio_judicial']

    test('debe incluir solo preguntas de auxilio + legacy', () => {
      const result = simulateSupabaseQuery(mockDatabaseQuestions, {
        is_official_exam: true,
        is_active: true,
        examPositionFilter: auxilioFilter,
      })

      // Debe incluir 4 de auxilio + 3 legacy = 7
      expect(result.length).toBe(7)
    })

    test('NO debe incluir preguntas de tramitación ni auxiliar', () => {
      const result = simulateSupabaseQuery(mockDatabaseQuestions, {
        is_official_exam: true,
        is_active: true,
        examPositionFilter: auxilioFilter,
      })

      expect(result.some(q => q.id === 'tra-1')).toBe(false)
      expect(result.some(q => q.id === 'aux-1')).toBe(false)
    })
  })

  describe('Sin filtro de oposición', () => {
    test('debe incluir TODAS las preguntas oficiales activas', () => {
      const result = simulateSupabaseQuery(mockDatabaseQuestions, {
        is_official_exam: true,
        is_active: true,
        examPositionFilter: null, // Sin filtro de oposición
      })

      // Total: 3 aux + 2 adm + 3 tra + 4 jud + 1 ges + 3 legacy = 16
      expect(result.length).toBe(16)
    })
  })

  describe('Exclusión de preguntas no oficiales e inactivas', () => {
    test('NO debe incluir preguntas con is_official_exam = false', () => {
      const result = simulateSupabaseQuery(mockDatabaseQuestions, {
        is_official_exam: true,
        is_active: true,
        examPositionFilter: EXAM_POSITION_MAP['auxiliar_administrativo'],
      })

      expect(result.some(q => q.id === 'no-of-1')).toBe(false)
    })

    test('NO debe incluir preguntas con is_active = false', () => {
      const result = simulateSupabaseQuery(mockDatabaseQuestions, {
        is_official_exam: true,
        is_active: true,
        examPositionFilter: EXAM_POSITION_MAP['tramitacion_procesal'],
      })

      expect(result.some(q => q.id === 'inact-1')).toBe(false)
    })
  })
})

describe('Integración: Comparación entre oposiciones', () => {
  test('cada oposición ve un conjunto diferente de preguntas específicas', () => {
    const auxiliarResult = simulateSupabaseQuery(mockDatabaseQuestions, {
      is_official_exam: true,
      is_active: true,
      examPositionFilter: EXAM_POSITION_MAP['auxiliar_administrativo'],
    })

    const tramitacionResult = simulateSupabaseQuery(mockDatabaseQuestions, {
      is_official_exam: true,
      is_active: true,
      examPositionFilter: EXAM_POSITION_MAP['tramitacion_procesal'],
    })

    const auxilioResult = simulateSupabaseQuery(mockDatabaseQuestions, {
      is_official_exam: true,
      is_active: true,
      examPositionFilter: EXAM_POSITION_MAP['auxilio_judicial'],
    })

    // Las preguntas específicas (no legacy) no deben solaparse
    const auxiliarSpecific = auxiliarResult.filter(q => q.exam_position !== null)
    const tramitacionSpecific = tramitacionResult.filter(q => q.exam_position !== null)
    const auxilioSpecific = auxilioResult.filter(q => q.exam_position !== null)

    // Verificar que no hay solapamiento
    const auxiliarIds = auxiliarSpecific.map(q => q.id)
    const tramitacionIds = tramitacionSpecific.map(q => q.id)
    const auxilioIds = auxilioSpecific.map(q => q.id)

    // Ningún ID de auxiliar debe estar en tramitación
    auxiliarIds.forEach(id => {
      expect(tramitacionIds).not.toContain(id)
      expect(auxilioIds).not.toContain(id)
    })

    // Ningún ID de tramitación debe estar en auxilio
    tramitacionIds.forEach(id => {
      expect(auxilioIds).not.toContain(id)
    })
  })

  test('las preguntas legacy se comparten entre todas las oposiciones', () => {
    const auxiliarLegacy = simulateSupabaseQuery(mockDatabaseQuestions, {
      is_official_exam: true,
      is_active: true,
      examPositionFilter: EXAM_POSITION_MAP['auxiliar_administrativo'],
    }).filter(q => q.exam_position === null)

    const tramitacionLegacy = simulateSupabaseQuery(mockDatabaseQuestions, {
      is_official_exam: true,
      is_active: true,
      examPositionFilter: EXAM_POSITION_MAP['tramitacion_procesal'],
    }).filter(q => q.exam_position === null)

    // Ambas oposiciones deben ver las mismas preguntas legacy
    expect(auxiliarLegacy.length).toBe(tramitacionLegacy.length)
    expect(auxiliarLegacy.map(q => q.id).sort()).toEqual(tramitacionLegacy.map(q => q.id).sort())
  })
})

describe('Integración: Formato de filtro Supabase', () => {
  // Función que genera el filtro OR para Supabase (copiada del código real)
  function buildSupabaseOrFilter(positionType) {
    const validPositions = EXAM_POSITION_MAP[positionType] || []
    if (validPositions.length === 0) {
      return null
    }
    return `exam_position.is.null,exam_position.in.(${validPositions.map(v => `"${v}"`).join(',')})`
  }

  test('genera filtro correcto para auxiliar_administrativo', () => {
    const filter = buildSupabaseOrFilter('auxiliar_administrativo')

    expect(filter).toContain('exam_position.is.null')
    expect(filter).toContain('exam_position.in.')
    expect(filter).toContain('"auxiliar_administrativo_estado"')
    expect(filter).toContain('"auxiliar administrativo del estado"')
  })

  test('genera filtro correcto para tramitacion_procesal', () => {
    const filter = buildSupabaseOrFilter('tramitacion_procesal')

    expect(filter).toContain('exam_position.is.null')
    expect(filter).toContain('"tramitacion_procesal"')
    expect(filter).toContain('"tramitación procesal"')
  })

  test('genera filtro correcto para auxilio_judicial', () => {
    const filter = buildSupabaseOrFilter('auxilio_judicial')

    expect(filter).toContain('exam_position.is.null')
    expect(filter).toContain('"auxilio_judicial"')
    expect(filter).toContain('"auxilio judicial"')
  })
})
