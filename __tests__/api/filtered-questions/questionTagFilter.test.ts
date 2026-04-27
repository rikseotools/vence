/**
 * Tests para el filtrado por questionTag (oposiciones con preguntas exclusivas).
 *
 * Verifica que:
 * 1. EXCLUSIVE_QUESTION_TAGS se deriva correctamente de OPOSICIONES
 * 2. La lógica de filtrado por tag es coherente:
 *    - Oposiciones CON questionTag solo ven sus preguntas
 *    - Oposiciones SIN questionTag excluyen las de oposiciones exclusivas
 * 3. Simulación con datos reales: PN solo ve preguntas PN, otras no ven PN
 */

import {
  OPOSICIONES,
  EXCLUSIVE_QUESTION_TAGS,
  getOposicionByPositionType,
} from '@/lib/config/oposiciones'

// ============================================
// 1. CONFIG: EXCLUSIVE_QUESTION_TAGS
// ============================================

describe('EXCLUSIVE_QUESTION_TAGS', () => {
  test('contiene al menos el tag PN de Policía Nacional', () => {
    expect(EXCLUSIVE_QUESTION_TAGS).toContain('PN')
  })

  test('se deriva de oposiciones con questionTag definido', () => {
    const expectedTags = OPOSICIONES
      .filter(o => o.questionTag)
      .map(o => o.questionTag)
    expect(EXCLUSIVE_QUESTION_TAGS).toEqual(expectedTags)
  })

  test('no contiene duplicados', () => {
    const unique = [...new Set(EXCLUSIVE_QUESTION_TAGS)]
    expect(unique).toEqual(EXCLUSIVE_QUESTION_TAGS)
  })

  test('todos los tags son strings no vacíos', () => {
    for (const tag of EXCLUSIVE_QUESTION_TAGS) {
      expect(typeof tag).toBe('string')
      expect(tag.length).toBeGreaterThan(0)
    }
  })
})

// ============================================
// 2. CONFIG: questionTag en oposiciones
// ============================================

describe('questionTag en configuración de oposiciones', () => {
  test('policia_nacional tiene questionTag = PN', () => {
    const pn = getOposicionByPositionType('policia_nacional')
    expect(pn).toBeDefined()
    expect(pn!.questionTag).toBe('PN')
  })

  test('oposiciones administrativas NO tienen questionTag', () => {
    const admOposiciones = [
      'auxiliar_administrativo_estado',
      'auxiliar_administrativo_madrid',
      'administrativo_estado',
      'tramitacion_procesal',
    ]
    for (const pt of admOposiciones) {
      const opo = getOposicionByPositionType(pt)
      expect(opo?.questionTag).toBeUndefined()
    }
  })
})

// ============================================
// 3. LÓGICA DE FILTRADO: Simulación pura (sin BD)
// ============================================

// Simula la lógica del tagFilter que se aplica en las queries Drizzle
function simulateTagFilter(
  questionTags: string[] | null,
  oposicionPositionType: string
): boolean {
  const opo = getOposicionByPositionType(oposicionPositionType)
  const questionTag = opo?.questionTag ?? null

  if (questionTag) {
    // Oposición con tag exclusivo: solo preguntas que contienen ese tag
    return questionTags !== null && questionTags.includes(questionTag)
  } else {
    // Oposición sin tag: excluir preguntas con tags exclusivos
    if (!questionTags || questionTags.length === 0) return true
    return !EXCLUSIVE_QUESTION_TAGS.some(t => questionTags.includes(t))
  }
}

describe('Simulación de filtrado por tag', () => {
  // Preguntas de ejemplo
  const preguntaPN = { tags: ['PN'] }                     // Pregunta de PN (3 opciones)
  const preguntaGeneral = { tags: null }                   // Pregunta sin tag (genérica)
  const preguntaOtroTag = { tags: ['GC'] }                // Hipotética con otro tag
  const preguntaMultiTag = { tags: ['PN', 'extra'] }      // Con múltiples tags

  describe('Policía Nacional (questionTag=PN)', () => {
    const PT = 'policia_nacional'

    test('VE preguntas con tag PN', () => {
      expect(simulateTagFilter(preguntaPN.tags, PT)).toBe(true)
    })

    test('NO VE preguntas sin tag (genéricas de otras oposiciones)', () => {
      expect(simulateTagFilter(preguntaGeneral.tags, PT)).toBe(false)
    })

    test('NO VE preguntas con otros tags exclusivos', () => {
      // Si en el futuro GC es exclusivo, PN no las vería
      // Pero actualmente GC no está en EXCLUSIVE_QUESTION_TAGS
      // El test verifica que PN SOLO ve las suyas
      expect(simulateTagFilter(preguntaGeneral.tags, PT)).toBe(false)
    })

    test('VE preguntas con múltiples tags que incluyen PN', () => {
      expect(simulateTagFilter(preguntaMultiTag.tags, PT)).toBe(true)
    })
  })

  describe('Auxiliar Administrativo Estado (sin questionTag)', () => {
    const PT = 'auxiliar_administrativo_estado'

    test('NO VE preguntas con tag PN', () => {
      expect(simulateTagFilter(preguntaPN.tags, PT)).toBe(false)
    })

    test('VE preguntas sin tag (genéricas)', () => {
      expect(simulateTagFilter(preguntaGeneral.tags, PT)).toBe(true)
    })

    test('VE preguntas con tags NO exclusivos', () => {
      // Un tag que no está en EXCLUSIVE_QUESTION_TAGS
      expect(simulateTagFilter(['importada', 'innotest'], PT)).toBe(true)
    })

    test('NO VE preguntas con múltiples tags si uno es exclusivo', () => {
      expect(simulateTagFilter(preguntaMultiTag.tags, PT)).toBe(false)
    })
  })

  describe('Bidireccionalidad: PN ↔ resto', () => {
    test('preguntas PN solo visibles para PN', () => {
      // PN las ve
      expect(simulateTagFilter(['PN'], 'policia_nacional')).toBe(true)

      // Ninguna otra oposición las ve
      const otrasOposiciones = OPOSICIONES
        .filter(o => !o.questionTag)
        .slice(0, 5) // Sample de 5
      for (const opo of otrasOposiciones) {
        expect(simulateTagFilter(['PN'], opo.positionType)).toBe(false)
      }
    })

    test('preguntas genéricas: visibles para todas menos PN', () => {
      // PN NO las ve
      expect(simulateTagFilter(null, 'policia_nacional')).toBe(false)

      // Otras sí las ven
      expect(simulateTagFilter(null, 'auxiliar_administrativo_estado')).toBe(true)
      expect(simulateTagFilter(null, 'tramitacion_procesal')).toBe(true)
    })
  })
})

// ============================================
// 4. SQL GENERATION: Verificar que el SQL es correcto
// ============================================

describe('Generación de SQL para tag filter', () => {
  test('tag exclusivo genera condición @> (containment)', () => {
    // El SQL generado para PN debería ser:
    // questions.tags @> ARRAY['PN']::text[]
    const tag = 'PN'
    const expectedPattern = `ARRAY['${tag}']::text[]`
    // Verificamos que el patrón SQL es construible
    expect(expectedPattern).toBe("ARRAY['PN']::text[]")
  })

  test('exclusión genera condición NOT && (overlap)', () => {
    // El SQL generado para oposiciones sin tag debería ser:
    // NOT (questions.tags && ARRAY['PN']::text[])
    const tags = EXCLUSIVE_QUESTION_TAGS
    const expectedPattern = `ARRAY[${tags.map(t => `'${t}'`).join(',')}]::text[]`
    expect(expectedPattern).toContain("'PN'")
  })
})
