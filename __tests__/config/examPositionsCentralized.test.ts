// __tests__/config/examPositionsCentralized.test.ts
// Tests para verificar que los mapeos de exam_position y hot_articles
// son consistentes, robustos y escalables.

import {
  EXAM_POSITION_MAP,
  HOT_ARTICLE_TARGET_MAP,
  getValidExamPositions,
  getValidHotArticleTargets,
} from '@/lib/config/exam-positions'

import {
  OPOSICIONES,
  getOposicionByPositionType,
  getOposicionBySlug,
  getOposicion,
} from '@/lib/config/oposiciones'

// ============================================
// 1. EXAM_POSITION_MAP - Completitud y consistencia
// ============================================

describe('EXAM_POSITION_MAP', () => {
  test('cada oposición con preguntas oficiales debe tener entrada', () => {
    // Oposiciones que tienen preguntas oficiales importadas
    const oposicionesConOficiales = [
      'auxiliar_administrativo_estado',
      'auxiliar_administrativo_madrid',
      'administrativo',
      'tramitacion_procesal',
      'auxilio_judicial',
      'gestion_procesal',
    ]

    for (const pt of oposicionesConOficiales) {
      const positions = getValidExamPositions(pt)
      expect(positions.length).toBeGreaterThan(0)
    }
  })

  test('los valores deben ser strings no vacíos en minúsculas', () => {
    for (const [key, values] of Object.entries(EXAM_POSITION_MAP)) {
      expect(key).toBeTruthy()
      for (const v of values) {
        expect(v).toBeTruthy()
        expect(v).toBe(v.toLowerCase())
      }
    }
  })

  test('cada key debe corresponder a un positionType o alias conocido en oposiciones.ts', () => {
    // Algunas keys son alias legacy (ej: gestion_administracion_civil) que no tienen
    // oposición propia pero sí preguntas oficiales con ese exam_position
    const validPTs = new Set(OPOSICIONES.map(o => o.positionType))
    const legacyAliases = new Set(['gestion_administracion_civil', 'gestion_procesal'])

    for (const key of Object.keys(EXAM_POSITION_MAP)) {
      const isValid = validPTs.has(key) || legacyAliases.has(key)
      if (!isValid) {
        console.warn(`EXAM_POSITION_MAP key '${key}' no es positionType ni alias conocido`)
      }
      expect(isValid).toBe(true)
    }
  })

  test('no debe haber positionType ambiguo sin sufijo de ámbito', () => {
    // Verificar que no existe 'auxiliar_administrativo' como key standalone
    // (debe ser auxiliar_administrativo_estado, _madrid, etc.)
    for (const key of Object.keys(EXAM_POSITION_MAP)) {
      if (key.startsWith('auxiliar_administrativo')) {
        expect(key).not.toBe('auxiliar_administrativo')
      }
    }
  })
})

// ============================================
// 2. HOT_ARTICLE_TARGET_MAP - Completitud
// ============================================

describe('HOT_ARTICLE_TARGET_MAP', () => {
  test('cada oposición con hot_articles debe tener entrada', () => {
    const oposicionesConHotArticles = [
      'auxiliar-administrativo-estado',
      'auxiliar_administrativo_estado',
      'auxiliar-administrativo-madrid',
      'auxiliar_administrativo_madrid',
      'administrativo-estado',
      'tramitacion-procesal',
      'tramitacion_procesal',
      'auxilio-judicial',
      'auxilio_judicial',
    ]

    for (const key of oposicionesConHotArticles) {
      const targets = getValidHotArticleTargets(key)
      expect(targets.length).toBeGreaterThan(0)
    }
  })

  test('tanto slug (con guiones) como positionType (con guiones bajos) deben funcionar', () => {
    // Auxiliar Estado
    const targetsSlug = getValidHotArticleTargets('auxiliar-administrativo-estado')
    const targetsPT = getValidHotArticleTargets('auxiliar_administrativo_estado')
    expect(targetsSlug).toEqual(targetsPT)

    // Tramitación
    const targetsSlug2 = getValidHotArticleTargets('tramitacion-procesal')
    const targetsPT2 = getValidHotArticleTargets('tramitacion_procesal')
    expect(targetsSlug2).toEqual(targetsPT2)
  })

  test('Madrid debe tener su propio target separado de Estado', () => {
    const estadoTargets = getValidHotArticleTargets('auxiliar_administrativo_estado')
    const madridTargets = getValidHotArticleTargets('auxiliar_administrativo_madrid')

    // No deben solaparse
    const overlap = estadoTargets.filter(t => madridTargets.includes(t))
    expect(overlap.length).toBe(0)
  })
})

// ============================================
// 3. getValidExamPositions - Funcionalidad
// ============================================

describe('getValidExamPositions', () => {
  test('normaliza guiones a guiones bajos', () => {
    const result = getValidExamPositions('auxiliar-administrativo-estado')
    expect(result.length).toBeGreaterThan(0)
  })

  test('es case-insensitive', () => {
    const lower = getValidExamPositions('auxiliar_administrativo_estado')
    const upper = getValidExamPositions('AUXILIAR_ADMINISTRATIVO_ESTADO')
    expect(lower).toEqual(upper)
  })

  test('devuelve array vacío para positionType desconocido', () => {
    expect(getValidExamPositions('oposicion_inventada')).toEqual([])
  })

  test('devuelve array vacío para string vacío', () => {
    expect(getValidExamPositions('')).toEqual([])
  })
})

// ============================================
// 4. Seguridad: NO usar .or() para filtros de exam_position
// ============================================

describe('Prevención de bug .or() en exam_position', () => {
  test('buildExamPositionFilter NO debe existir (eliminado por generar .or() que rompe AND)', () => {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const examPositions = require('@/lib/config/exam-positions')
    expect(examPositions.buildExamPositionFilter).toBeUndefined()
  })

  test('getValidExamPositions devuelve array para usar con .in(), no string para .or()', () => {
    const result = getValidExamPositions('auxiliar_administrativo_estado')
    expect(Array.isArray(result)).toBe(true)
    expect(typeof result[0]).toBe('string')
  })

  test('testFetchers usa applyExamPositionFilter (no .or ni buildExamPositionFilter)', () => {
    const fs = require('fs')
    const code = fs.readFileSync('lib/testFetchers.ts', 'utf-8')
    expect(code).not.toContain('.or(examPosition')
    expect(code).not.toContain('buildExamPositionFilter')
    expect(code).toContain('applyExamPositionFilter')
  })

  test('lawFetchers usa applyExamPositionFilter (no .or ni buildExamPositionFilter)', () => {
    const fs = require('fs')
    const code = fs.readFileSync('lib/lawFetchers.ts', 'utf-8')
    expect(code).not.toContain('.or(examPosition')
    expect(code).not.toContain('buildExamPositionFilter')
    expect(code).toContain('applyExamPositionFilter')
  })

  test('applyExamPositionFilter existe y es una función', () => {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { applyExamPositionFilter } = require('@/lib/config/exam-positions')
    expect(typeof applyExamPositionFilter).toBe('function')
  })
})

// ============================================
// 5. Consistencia entre configs
// ============================================

describe('Consistencia oposiciones.ts ↔ exam-positions.ts', () => {
  test('todos los positionTypes de OPOSICIONES deben ser únicos', () => {
    const types = OPOSICIONES.map(o => o.positionType)
    const unique = new Set(types)
    expect(unique.size).toBe(types.length)
  })

  test('ningún positionType debe ser ambiguo (sin sufijo de ámbito)', () => {
    for (const o of OPOSICIONES) {
      // Si empieza con 'auxiliar_administrativo', debe tener sufijo
      if (o.positionType.startsWith('auxiliar_administrativo')) {
        const parts = o.positionType.split('_')
        expect(parts.length).toBeGreaterThanOrEqual(3)
      }
    }
  })

  test('getOposicion() encuentra por id, slug Y positionType', () => {
    for (const o of OPOSICIONES) {
      expect(getOposicion(o.id)).toBeDefined()
      expect(getOposicion(o.slug)).toBeDefined()
      expect(getOposicion(o.positionType)).toBeDefined()
    }
  })

  test('getOposicionByPositionType devuelve nombre no vacío', () => {
    for (const o of OPOSICIONES) {
      const found = getOposicionByPositionType(o.positionType)
      expect(found).toBeDefined()
      expect(found!.name.length).toBeGreaterThan(0)
      expect(found!.shortName.length).toBeGreaterThan(0)
    }
  })
})

// ============================================
// 6. Escalabilidad - Nuevas oposiciones
// ============================================

describe('Escalabilidad', () => {
  test('EXAM_POSITION_MAP keys deben ser positionTypes o aliases conocidos', () => {
    const validPTs = new Set(OPOSICIONES.map(o => o.positionType))
    // Aliases: oposiciones sin page propia o variantes legacy
    const legacyAliases = new Set(['gestion_administracion_civil', 'gestion_procesal'])

    for (const key of Object.keys(EXAM_POSITION_MAP)) {
      const isValid = validPTs.has(key) || legacyAliases.has(key)
      if (!isValid) console.error(`Unknown EXAM_POSITION_MAP key: '${key}'`)
      expect(isValid).toBe(true)
    }
  })

  test('HOT_ARTICLE_TARGET_MAP keys deben ser slugs, positionTypes o variantes legacy', () => {
    const validSlugs = new Set(OPOSICIONES.map(o => o.slug))
    const validPTs = new Set(OPOSICIONES.map(o => o.positionType))
    // Variantes legacy que existen en BD
    const legacyKeys = new Set([
      'auxiliar_administrativo', // legacy sin _estado
      'administrativo_estado', 'administrativo-estado', // variante con _estado
      'cuerpo-general-administrativo', 'cuerpo_general_administrativo',
      'gestion-procesal', 'gestion_procesal',
      'gestion-estado', 'gestion_estado',
    ])
    const allValid = new Set([...validSlugs, ...validPTs, ...legacyKeys])

    for (const key of Object.keys(HOT_ARTICLE_TARGET_MAP)) {
      if (!allValid.has(key)) console.error(`Unknown HOT_ARTICLE_TARGET_MAP key: '${key}'`)
      expect(allValid.has(key)).toBe(true)
    }
  })
})
