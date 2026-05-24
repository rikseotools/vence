// __tests__/api/topic-progress/aggregateStatsByTopic.test.ts
//
// Tests unitarios PUROS (sin DB, sin mocks complejos) para aggregateStatsByTopic.
//
// Esta función es el corazón de la lógica V3 que arregla el bug de colisión
// B2 entre oposiciones: deriva el tema dinámicamente desde article_id +
// topic_scope de UNA oposición, ignorando test_questions.tema_number.
//
// Los tests cubren:
//   1. Aislamiento cross-oposición (mismo user, dos mappings, dos resultados).
//   2. Cálculo de 30d (regression del bug que omitía estos campos).
//   3. averageTimeSeconds (regression — ignora nulls correctamente).
//   4. lastStudy = MAX(createdAt).
//   5. accuracy redondeada.
//   6. Caso "sin respuestas" → {} vacío, sin crash.

import {
  aggregateStatsByTopic,
  type TopicStat,
} from '@/lib/api/topic-progress/stats'
import type { UserAnswer } from '@/lib/api/topic-progress/user-answers'
import type { ArticleTopicMapping } from '@/lib/api/topic-progress/mapping'

// Helpers para datasets sintéticos legibles
const LAW_CE = '00000000-0000-0000-0000-000000000001'
const LAW_TRLGSS = '00000000-0000-0000-0000-000000000002'
const LAW_OFFICE = '00000000-0000-0000-0000-000000000003'

function answer(opts: {
  lawId: string
  articleNumber: string
  isCorrect: boolean
  createdAt: Date
  timeSpentSeconds?: number | null
}): UserAnswer {
  return {
    answerId: `ans-${Math.random()}`,
    questionId: `q-${Math.random()}`,
    isCorrect: opts.isCorrect,
    createdAt: opts.createdAt,
    timeSpentSeconds: opts.timeSpentSeconds ?? null,
    lawId: opts.lawId,
    articleNumber: opts.articleNumber,
    difficulty: null,
    confidenceLevel: null,
    lawName: null,
  }
}

describe('aggregateStatsByTopic — aislamiento cross-oposición', () => {
  // Caso motivador (María, 23/05/2026):
  // - User responde 5 preguntas de CE art 41 + 3 de Office art 1 (durante preparación AAE)
  // - Mapping SS: CE art 41 → T1 (Constitución); Office no aparece (no es scope SS)
  // - Mapping AAE: CE art 41 → T1 (Constitución); Office art 1 → T108 (Word)
  // - Stats SS deben mostrar solo T1; stats AAE deben mostrar T1 + T108
  test('mismo user, dos oposiciones, dos resultados distintos según mapping', () => {
    const fiveDaysAgo = new Date(Date.now() - 5 * 24 * 60 * 60 * 1000)

    const userAnswers: UserAnswer[] = [
      // 5 respuestas a CE art 41 (4 correctas, 1 fallada) — temario común
      answer({ lawId: LAW_CE, articleNumber: '41', isCorrect: true, createdAt: fiveDaysAgo }),
      answer({ lawId: LAW_CE, articleNumber: '41', isCorrect: true, createdAt: fiveDaysAgo }),
      answer({ lawId: LAW_CE, articleNumber: '41', isCorrect: true, createdAt: fiveDaysAgo }),
      answer({ lawId: LAW_CE, articleNumber: '41', isCorrect: true, createdAt: fiveDaysAgo }),
      answer({ lawId: LAW_CE, articleNumber: '41', isCorrect: false, createdAt: fiveDaysAgo }),
      // 3 respuestas a Office art 1 (1 correcta) — exclusivo AAE
      answer({ lawId: LAW_OFFICE, articleNumber: '1', isCorrect: true, createdAt: fiveDaysAgo }),
      answer({ lawId: LAW_OFFICE, articleNumber: '1', isCorrect: false, createdAt: fiveDaysAgo }),
      answer({ lawId: LAW_OFFICE, articleNumber: '1', isCorrect: false, createdAt: fiveDaysAgo }),
    ]

    const mappingSS: ArticleTopicMapping = {
      [`${LAW_CE}_41`]: 1, // T1 "Constitución" en SS
      // Office NO está en scope SS → ausente del mapping
    }

    const mappingAAE: ArticleTopicMapping = {
      [`${LAW_CE}_41`]: 1, // T1 "Constitución" en AAE
      [`${LAW_OFFICE}_1`]: 108, // T108 "Word" en AAE
    }

    const statsSS = aggregateStatsByTopic(userAnswers, mappingSS)
    const statsAAE = aggregateStatsByTopic(userAnswers, mappingAAE)

    // SS: solo T1 con 5 respuestas (4 correctas). T108 ausente.
    expect(Object.keys(statsSS)).toEqual(['1'])
    expect(statsSS['1'].total).toBe(5)
    expect(statsSS['1'].correct).toBe(4)
    expect(statsSS['1'].accuracy).toBe(80)

    // AAE: T1 con 5 + T108 con 3.
    expect(Object.keys(statsAAE).sort()).toEqual(['1', '108'])
    expect(statsAAE['1'].total).toBe(5)
    expect(statsAAE['108'].total).toBe(3)
    expect(statsAAE['108'].correct).toBe(1)
    expect(statsAAE['108'].accuracy).toBe(33)
  })

  // Caso B2 colisión real:
  // - TRLGSS art 41 → T101 SS ("SS en la CE")
  // - Si el mismo art_number aparece en mapping AAE, sería en otro topic
  //   (pero con OTRO law_id en realidad — para el test simulamos misma law)
  // - El punto clave: la clave del mapping es law_id+article_number, no
  //   article_number suelto. Aún con misma article_number, leyes distintas
  //   = topics distintos. Esto previene la colisión sistémica.
  test('mapping usa law_id como parte de la clave, no solo article_number', () => {
    const today = new Date()
    const userAnswers: UserAnswer[] = [
      answer({ lawId: LAW_CE, articleNumber: '1', isCorrect: true, createdAt: today }),
      answer({ lawId: LAW_TRLGSS, articleNumber: '1', isCorrect: false, createdAt: today }),
    ]

    // Mapping que distingue por law_id: art 1 CE → T1; art 1 TRLGSS → T101
    const mapping: ArticleTopicMapping = {
      [`${LAW_CE}_1`]: 1,
      [`${LAW_TRLGSS}_1`]: 101,
    }

    const stats = aggregateStatsByTopic(userAnswers, mapping)
    expect(Object.keys(stats).sort()).toEqual(['1', '101'])
    expect(stats['1'].total).toBe(1)
    expect(stats['1'].correct).toBe(1)
    expect(stats['101'].total).toBe(1)
    expect(stats['101'].correct).toBe(0)
  })

  test('respuestas a artículos sin entrada en mapping se ignoran (no crashea)', () => {
    const today = new Date()
    const userAnswers: UserAnswer[] = [
      answer({ lawId: LAW_CE, articleNumber: '41', isCorrect: true, createdAt: today }),
      answer({ lawId: 'law-desconocida', articleNumber: '999', isCorrect: true, createdAt: today }),
    ]
    const mapping: ArticleTopicMapping = { [`${LAW_CE}_41`]: 1 }

    const stats = aggregateStatsByTopic(userAnswers, mapping)
    expect(Object.keys(stats)).toEqual(['1'])
    expect(stats['1'].total).toBe(1)
  })

  test('sin respuestas → resultado vacío sin crash', () => {
    const stats = aggregateStatsByTopic([], { [`${LAW_CE}_41`]: 1 })
    expect(stats).toEqual({})
  })
})

describe('aggregateStatsByTopic — métricas 30 días (regression bug propagación)', () => {
  // El bug original (descubierto en sesión de verificación): el endpoint
  // serializaba el resultado de aggregateStatsByTopic OMITIENDO los campos
  // 30d → llegaban undefined al cliente → t30d=0 siempre. Este test
  // verifica que aggregateStatsByTopic SÍ los calcula.

  test('total30d cuenta solo respuestas dentro de los últimos 30 días', () => {
    const today = new Date()
    const tenDaysAgo = new Date(today.getTime() - 10 * 24 * 60 * 60 * 1000)
    const fortyDaysAgo = new Date(today.getTime() - 40 * 24 * 60 * 60 * 1000)
    const ninetyDaysAgo = new Date(today.getTime() - 90 * 24 * 60 * 60 * 1000)

    const userAnswers: UserAnswer[] = [
      answer({ lawId: LAW_CE, articleNumber: '41', isCorrect: true, createdAt: today }),
      answer({ lawId: LAW_CE, articleNumber: '41', isCorrect: true, createdAt: tenDaysAgo }),
      answer({ lawId: LAW_CE, articleNumber: '41', isCorrect: false, createdAt: fortyDaysAgo }),
      answer({ lawId: LAW_CE, articleNumber: '41', isCorrect: false, createdAt: ninetyDaysAgo }),
    ]
    const mapping: ArticleTopicMapping = { [`${LAW_CE}_41`]: 1 }

    const stats = aggregateStatsByTopic(userAnswers, mapping)
    expect(stats['1'].total).toBe(4)
    expect(stats['1'].correct).toBe(2)
    expect(stats['1'].total30d).toBe(2)   // hoy + tenDaysAgo
    expect(stats['1'].correct30d).toBe(2) // ambas correctas
    expect(stats['1'].accuracy30d).toBe(100)
  })

  test('accuracy30d es null cuando no hay respuestas en los últimos 30 días', () => {
    const today = new Date()
    const sixtyDaysAgo = new Date(today.getTime() - 60 * 24 * 60 * 60 * 1000)

    const userAnswers: UserAnswer[] = [
      answer({ lawId: LAW_CE, articleNumber: '41', isCorrect: true, createdAt: sixtyDaysAgo }),
    ]
    const mapping: ArticleTopicMapping = { [`${LAW_CE}_41`]: 1 }

    const stats = aggregateStatsByTopic(userAnswers, mapping)
    expect(stats['1'].total).toBe(1)
    expect(stats['1'].total30d).toBe(0)
    expect(stats['1'].correct30d).toBe(0)
    expect(stats['1'].accuracy30d).toBeNull()
  })

  test('campos 30d están SIEMPRE presentes en cada TopicStat (regression bug propagación)', () => {
    const today = new Date()
    const userAnswers: UserAnswer[] = [
      answer({ lawId: LAW_CE, articleNumber: '41', isCorrect: true, createdAt: today }),
    ]
    const mapping: ArticleTopicMapping = { [`${LAW_CE}_41`]: 1 }

    const stats = aggregateStatsByTopic(userAnswers, mapping)
    const stat: TopicStat = stats['1']
    expect(stat).toHaveProperty('total30d')
    expect(stat).toHaveProperty('correct30d')
    expect(stat).toHaveProperty('accuracy30d')
    expect(stat).toHaveProperty('averageTimeSeconds')
  })
})

describe('aggregateStatsByTopic — averageTimeSeconds', () => {
  test('promedia time_spent_seconds ignorando nulls', () => {
    const today = new Date()
    const userAnswers: UserAnswer[] = [
      answer({ lawId: LAW_CE, articleNumber: '41', isCorrect: true, createdAt: today, timeSpentSeconds: 10 }),
      answer({ lawId: LAW_CE, articleNumber: '41', isCorrect: true, createdAt: today, timeSpentSeconds: null }),
      answer({ lawId: LAW_CE, articleNumber: '41', isCorrect: true, createdAt: today, timeSpentSeconds: 30 }),
    ]
    const mapping: ArticleTopicMapping = { [`${LAW_CE}_41`]: 1 }

    const stats = aggregateStatsByTopic(userAnswers, mapping)
    expect(stats['1'].total).toBe(3)        // total incluye el null
    expect(stats['1'].averageTimeSeconds).toBe(20) // promedio de [10, 30] = 20, ignora null
  })

  test('averageTimeSeconds = 0 cuando todas las respuestas tienen time null', () => {
    const today = new Date()
    const userAnswers: UserAnswer[] = [
      answer({ lawId: LAW_CE, articleNumber: '41', isCorrect: true, createdAt: today, timeSpentSeconds: null }),
      answer({ lawId: LAW_CE, articleNumber: '41', isCorrect: true, createdAt: today, timeSpentSeconds: null }),
    ]
    const mapping: ArticleTopicMapping = { [`${LAW_CE}_41`]: 1 }

    const stats = aggregateStatsByTopic(userAnswers, mapping)
    expect(stats['1'].averageTimeSeconds).toBe(0)
  })

  test('valores negativos de time_spent_seconds se ignoran (defensivo)', () => {
    const today = new Date()
    const userAnswers: UserAnswer[] = [
      answer({ lawId: LAW_CE, articleNumber: '41', isCorrect: true, createdAt: today, timeSpentSeconds: 20 }),
      answer({ lawId: LAW_CE, articleNumber: '41', isCorrect: true, createdAt: today, timeSpentSeconds: -5 }),
    ]
    const mapping: ArticleTopicMapping = { [`${LAW_CE}_41`]: 1 }

    const stats = aggregateStatsByTopic(userAnswers, mapping)
    expect(stats['1'].averageTimeSeconds).toBe(20) // solo cuenta el 20, ignora -5
  })
})

describe('aggregateStatsByTopic — lastStudy y formato', () => {
  test('lastStudy es la máxima createdAt del topic', () => {
    const today = new Date('2026-05-24T10:00:00Z')
    const yesterday = new Date('2026-05-23T10:00:00Z')
    const lastWeek = new Date('2026-05-17T10:00:00Z')

    const userAnswers: UserAnswer[] = [
      answer({ lawId: LAW_CE, articleNumber: '41', isCorrect: true, createdAt: lastWeek }),
      answer({ lawId: LAW_CE, articleNumber: '41', isCorrect: true, createdAt: today }),
      answer({ lawId: LAW_CE, articleNumber: '41', isCorrect: true, createdAt: yesterday }),
    ]
    const mapping: ArticleTopicMapping = { [`${LAW_CE}_41`]: 1 }

    const stats = aggregateStatsByTopic(userAnswers, mapping)
    expect(stats['1'].lastStudy).toBe(today.toISOString())
  })

  test('accuracy se redondea a entero', () => {
    const today = new Date()
    const userAnswers: UserAnswer[] = [
      answer({ lawId: LAW_CE, articleNumber: '41', isCorrect: true, createdAt: today }),
      answer({ lawId: LAW_CE, articleNumber: '41', isCorrect: true, createdAt: today }),
      answer({ lawId: LAW_CE, articleNumber: '41', isCorrect: false, createdAt: today }),
    ]
    const mapping: ArticleTopicMapping = { [`${LAW_CE}_41`]: 1 }

    const stats = aggregateStatsByTopic(userAnswers, mapping)
    expect(stats['1'].accuracy).toBe(67) // 2/3 = 0.6666... → 67
  })
})
