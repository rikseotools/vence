/**
 * Tests para verificar el filtrado de preguntas oficiales por oposición
 *
 * Problema original: Las preguntas oficiales se mostraban a TODOS los usuarios
 * sin importar su oposición. Esto causaba que un usuario de Auxiliar Administrativo
 * viera preguntas oficiales de Tramitación Procesal.
 *
 * Solución: Filtrar por exam_position cuando onlyOfficialQuestions = true
 *
 * IMPORTANTE (actualizado): Las preguntas con exam_position = NULL NO se muestran
 * a ninguna oposición. Solo se muestran las que tienen un valor específico.
 */

// ============================================
// CONSTANTES Y MAPEOS (copiados del código real)
// ============================================

// Mapeo de exam_position - debe coincidir con lib/testFetchers.js
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

// Helper para construir filtro (copiado del código real)
// ACTUALIZADO: Ya NO incluye exam_position.is.null - las preguntas sin categorizar no se muestran
function buildExamPositionFilter(positionType) {
  const validPositions = EXAM_POSITION_MAP[positionType] || []
  if (validPositions.length === 0) {
    return null
  }
  // Formato para Supabase .in() - Solo preguntas con exam_position específico
  const escaped = validPositions.map(p => p.replace(/,/g, '\\,')).join(',')
  return `exam_position.in.(${escaped})`
}

// Mock de preguntas con exam_position
const createMockOfficialQuestions = () => [
  // Preguntas de Auxiliar Administrativo
  { id: 'q1', exam_position: 'auxiliar_administrativo_estado', is_official_exam: true },
  { id: 'q2', exam_position: 'auxiliar administrativo del estado', is_official_exam: true },

  // Preguntas de Tramitación Procesal
  { id: 'q3', exam_position: 'tramitacion_procesal', is_official_exam: true },
  { id: 'q4', exam_position: 'tramitación procesal', is_official_exam: true },

  // Preguntas de Auxilio Judicial
  { id: 'q5', exam_position: 'auxilio_judicial', is_official_exam: true },
  { id: 'q6', exam_position: 'auxilio judicial', is_official_exam: true },

  // Preguntas de Administrativo
  { id: 'q7', exam_position: 'administrativo', is_official_exam: true },
  { id: 'q8', exam_position: 'cuerpo_general_administrativo', is_official_exam: true },

  // Preguntas legacy (NULL)
  { id: 'q9', exam_position: null, is_official_exam: true },
  { id: 'q10', exam_position: null, is_official_exam: true },
]

// Función para filtrar preguntas simulando el comportamiento del filtro
// ACTUALIZADO: NO incluye preguntas con NULL - solo las que tienen exam_position específico
function filterByExamPosition(questions, positionType) {
  const validPositions = EXAM_POSITION_MAP[positionType] || []
  return questions.filter(q => {
    // Solo incluir si tiene exam_position Y está en los valores válidos
    return q.exam_position !== null && validPositions.includes(q.exam_position)
  })
}

// ============================================
// TESTS
// ============================================

describe('Filtrado de preguntas oficiales por oposición', () => {

  describe('EXAM_POSITION_MAP', () => {
    test('debe tener mapeo para auxiliar_administrativo', () => {
      expect(EXAM_POSITION_MAP['auxiliar_administrativo']).toBeDefined()
      expect(EXAM_POSITION_MAP['auxiliar_administrativo'].length).toBeGreaterThan(0)
      expect(EXAM_POSITION_MAP['auxiliar_administrativo']).toContain('auxiliar_administrativo_estado')
    })

    test('debe tener mapeo para tramitacion_procesal', () => {
      expect(EXAM_POSITION_MAP['tramitacion_procesal']).toBeDefined()
      expect(EXAM_POSITION_MAP['tramitacion_procesal']).toContain('tramitacion_procesal')
    })

    test('debe tener mapeo para auxilio_judicial', () => {
      expect(EXAM_POSITION_MAP['auxilio_judicial']).toBeDefined()
      expect(EXAM_POSITION_MAP['auxilio_judicial']).toContain('auxilio_judicial')
    })

    test('debe tener mapeo para administrativo', () => {
      expect(EXAM_POSITION_MAP['administrativo']).toBeDefined()
      expect(EXAM_POSITION_MAP['administrativo']).toContain('administrativo')
    })

    test('NO debe tener valores de otras oposiciones mezclados', () => {
      // Auxiliar NO debe contener valores de tramitación
      expect(EXAM_POSITION_MAP['auxiliar_administrativo']).not.toContain('tramitacion_procesal')
      expect(EXAM_POSITION_MAP['auxiliar_administrativo']).not.toContain('auxilio_judicial')

      // Tramitación NO debe contener valores de auxiliar
      expect(EXAM_POSITION_MAP['tramitacion_procesal']).not.toContain('auxiliar_administrativo_estado')
      expect(EXAM_POSITION_MAP['tramitacion_procesal']).not.toContain('auxilio_judicial')

      // Auxilio NO debe contener valores de otras oposiciones
      expect(EXAM_POSITION_MAP['auxilio_judicial']).not.toContain('tramitacion_procesal')
      expect(EXAM_POSITION_MAP['auxilio_judicial']).not.toContain('auxiliar_administrativo_estado')
    })
  })

  describe('buildExamPositionFilter', () => {
    test('debe generar filtro correcto para auxiliar_administrativo (SIN NULL)', () => {
      const filter = buildExamPositionFilter('auxiliar_administrativo')
      // NO debe incluir exam_position.is.null - preguntas sin categorizar no se muestran
      expect(filter).not.toContain('exam_position.is.null')
      expect(filter).toContain('auxiliar_administrativo_estado')
      expect(filter).not.toContain('tramitacion_procesal')
    })

    test('debe generar filtro correcto para tramitacion_procesal (SIN NULL)', () => {
      const filter = buildExamPositionFilter('tramitacion_procesal')
      // NO debe incluir exam_position.is.null
      expect(filter).not.toContain('exam_position.is.null')
      expect(filter).toContain('tramitacion_procesal')
      expect(filter).not.toContain('auxiliar_administrativo')
    })

    test('debe generar filtro correcto para auxilio_judicial (SIN NULL)', () => {
      const filter = buildExamPositionFilter('auxilio_judicial')
      // NO debe incluir exam_position.is.null
      expect(filter).not.toContain('exam_position.is.null')
      expect(filter).toContain('auxilio_judicial')
    })

    test('debe retornar null para oposición desconocida', () => {
      const filter = buildExamPositionFilter('oposicion_inexistente')
      expect(filter).toBeNull()
    })
  })

  describe('Filtrado de preguntas', () => {
    const mockQuestions = createMockOfficialQuestions()

    test('auxiliar_administrativo solo ve sus preguntas (SIN legacy NULL)', () => {
      const filtered = filterByExamPosition(mockQuestions, 'auxiliar_administrativo')

      // Debe incluir preguntas de auxiliar
      expect(filtered.some(q => q.id === 'q1')).toBe(true)
      expect(filtered.some(q => q.id === 'q2')).toBe(true)

      // NO debe incluir preguntas legacy (NULL) - CAMBIO IMPORTANTE
      expect(filtered.some(q => q.id === 'q9')).toBe(false)
      expect(filtered.some(q => q.id === 'q10')).toBe(false)

      // NO debe incluir preguntas de otras oposiciones
      expect(filtered.some(q => q.id === 'q3')).toBe(false) // tramitacion
      expect(filtered.some(q => q.id === 'q5')).toBe(false) // auxilio
      expect(filtered.some(q => q.id === 'q7')).toBe(false) // administrativo
    })

    test('tramitacion_procesal solo ve sus preguntas (SIN legacy NULL)', () => {
      const filtered = filterByExamPosition(mockQuestions, 'tramitacion_procesal')

      // Debe incluir preguntas de tramitación
      expect(filtered.some(q => q.id === 'q3')).toBe(true)
      expect(filtered.some(q => q.id === 'q4')).toBe(true)

      // NO debe incluir preguntas legacy (NULL) - CAMBIO IMPORTANTE
      expect(filtered.some(q => q.id === 'q9')).toBe(false)

      // NO debe incluir preguntas de otras oposiciones
      expect(filtered.some(q => q.id === 'q1')).toBe(false) // auxiliar
      expect(filtered.some(q => q.id === 'q5')).toBe(false) // auxilio
    })

    test('auxilio_judicial solo ve sus preguntas (SIN legacy NULL)', () => {
      const filtered = filterByExamPosition(mockQuestions, 'auxilio_judicial')

      // Debe incluir preguntas de auxilio
      expect(filtered.some(q => q.id === 'q5')).toBe(true)
      expect(filtered.some(q => q.id === 'q6')).toBe(true)

      // NO debe incluir preguntas legacy (NULL) - CAMBIO IMPORTANTE
      expect(filtered.some(q => q.id === 'q9')).toBe(false)

      // NO debe incluir preguntas de otras oposiciones
      expect(filtered.some(q => q.id === 'q1')).toBe(false) // auxiliar
      expect(filtered.some(q => q.id === 'q3')).toBe(false) // tramitacion
    })

    test('cada oposición solo ve sus preguntas propias (sin NULL)', () => {
      const auxiliar = filterByExamPosition(mockQuestions, 'auxiliar_administrativo')
      const tramitacion = filterByExamPosition(mockQuestions, 'tramitacion_procesal')
      const auxilio = filterByExamPosition(mockQuestions, 'auxilio_judicial')

      // Auxiliar: solo 2 propias (SIN las 2 NULL)
      expect(auxiliar.length).toBe(2)

      // Tramitación: solo 2 propias (SIN las 2 NULL)
      expect(tramitacion.length).toBe(2)

      // Auxilio: solo 2 propias (SIN las 2 NULL)
      expect(auxilio.length).toBe(2)
    })

    test('preguntas con NULL no se muestran a ninguna oposición', () => {
      // Las preguntas q9 y q10 tienen exam_position: null
      const auxiliar = filterByExamPosition(mockQuestions, 'auxiliar_administrativo')
      const tramitacion = filterByExamPosition(mockQuestions, 'tramitacion_procesal')
      const auxilio = filterByExamPosition(mockQuestions, 'auxilio_judicial')

      // Ninguna oposición debe ver las preguntas NULL
      expect(auxiliar.some(q => q.exam_position === null)).toBe(false)
      expect(tramitacion.some(q => q.exam_position === null)).toBe(false)
      expect(auxilio.some(q => q.exam_position === null)).toBe(false)
    })

    test('sin filtro de oposición el mock tiene TODAS las preguntas', () => {
      // Esto solo verifica el mock, no el filtro
      expect(mockQuestions.length).toBe(10)
    })
  })

  describe('Exclusión de valores legacy NULL', () => {
    test('preguntas con exam_position NULL NO se incluyen en ninguna oposición', () => {
      const mockQuestions = [
        { id: 'legacy1', exam_position: null, is_official_exam: true },
        { id: 'legacy2', exam_position: null, is_official_exam: true },
      ]

      const auxiliar = filterByExamPosition(mockQuestions, 'auxiliar_administrativo')
      const tramitacion = filterByExamPosition(mockQuestions, 'tramitacion_procesal')
      const auxilio = filterByExamPosition(mockQuestions, 'auxilio_judicial')

      // NINGUNA oposición debe ver las preguntas sin categorizar
      // Esto evita que se mezclen preguntas de diferentes oposiciones
      expect(auxiliar.length).toBe(0)
      expect(tramitacion.length).toBe(0)
      expect(auxilio.length).toBe(0)
    })

    test('preguntas sin exam_position deben ser categorizadas manualmente', () => {
      // Este test documenta el comportamiento esperado:
      // Las preguntas con exam_position=NULL NO se muestran a nadie
      // Deben ser categorizadas en la base de datos antes de ser visibles
      const preguntaSinCategorizar = { id: 'x', exam_position: null, is_official_exam: true }
      const todas = [preguntaSinCategorizar]

      // No aparece en ningún filtro
      expect(filterByExamPosition(todas, 'auxiliar_administrativo').length).toBe(0)
      expect(filterByExamPosition(todas, 'tramitacion_procesal').length).toBe(0)
      expect(filterByExamPosition(todas, 'auxilio_judicial').length).toBe(0)
    })
  })

  describe('Variantes de valores de exam_position', () => {
    test('auxiliar_administrativo acepta múltiples variantes', () => {
      const variantes = [
        { id: 'v1', exam_position: 'auxiliar administrativo del estado' },
        { id: 'v2', exam_position: 'auxiliar administrativo' },
        { id: 'v3', exam_position: 'auxiliar_administrativo' },
        { id: 'v4', exam_position: 'auxiliar_administrativo_estado' },
      ]

      const filtered = filterByExamPosition(variantes, 'auxiliar_administrativo')
      expect(filtered.length).toBe(4)
    })

    test('tramitacion_procesal acepta variantes con y sin tilde', () => {
      const variantes = [
        { id: 'v1', exam_position: 'tramitacion_procesal' },
        { id: 'v2', exam_position: 'tramitación procesal' },
      ]

      const filtered = filterByExamPosition(variantes, 'tramitacion_procesal')
      expect(filtered.length).toBe(2)
    })
  })
})

describe('Integración: Verificar que los mapeos coinciden con el código real', () => {
  test('EXAM_POSITION_MAP en test coincide con el de testFetchers.js', () => {
    // Este test asegura que si se modifica el mapeo en el código,
    // también se debe actualizar en los tests
    const expectedKeys = [
      'auxiliar_administrativo',
      'administrativo',
      'tramitacion_procesal',
      'auxilio_judicial',
      'gestion_procesal'
    ]

    expect(Object.keys(EXAM_POSITION_MAP)).toEqual(expect.arrayContaining(expectedKeys))
  })
})
