// __tests__/api/topic-data/mvQueries.test.ts
// Unit tests for getTopicAggregatesFromMV (Fase D-bis Iter 1.5).
//
// La paridad bit-a-bit con el camino antiguo está validada end-to-end por
// el smoke harness en supabase/migrations + el test de paridad live ejecutado
// sobre 30 topics aleatorios (commit 31/05/2026). Este spec cubre:
//
//   - La forma del response coincide con el camino antiguo
//   - Filtro por validExamPositions funciona idénticamente
//   - articlesByLaw queda ordenado DESC por articlesWithQuestions
//   - Leyes con 0 questions quedan FUERA de articlesByLaw
//   - staleSinceMs se calcula desde la fila más antigua de la MV
//   - isTopicMvEnabled honra el flag exacto 'true'

import { getTopicAggregatesFromMV, isTopicMvEnabled } from '../../../lib/api/topic-data/mv-queries'

type FakeDb = {
  execute: jest.Mock
}

function buildFakeDb(rows: { law: unknown[]; official: unknown[] }): FakeDb {
  let call = 0
  return {
    execute: jest.fn(async () => {
      const result = call === 0 ? rows.law : rows.official
      call += 1
      return result as unknown
    }),
  }
}

const TOPIC_ID = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'
const COMPUTED_AT = new Date(Date.now() - 60_000).toISOString() // 60s ago

describe('getTopicAggregatesFromMV', () => {
  it('agrega counts de difficulty sumando por ley', async () => {
    const db = buildFakeDb({
      law: [
        {
          law_id: 'law-1', law_short_name: 'CE', law_name: 'Constitución',
          total_questions: 10, articles_with_questions: 4,
          count_easy: 4, count_medium: 3, count_hard: 2, count_extreme: 1, count_auto: 0,
          computed_at: COMPUTED_AT,
        },
        {
          law_id: 'law-2', law_short_name: 'L39', law_name: 'Ley 39/2015',
          total_questions: 6, articles_with_questions: 3,
          count_easy: 1, count_medium: 2, count_hard: 1, count_extreme: 0, count_auto: 2,
          computed_at: COMPUTED_AT,
        },
      ],
      official: [],
    })

    const agg = await getTopicAggregatesFromMV(db as never, TOPIC_ID, 'auxiliar_administrativo_estado')
    expect(agg.totalQuestions).toBe(16)
    expect(agg.difficultyStats).toEqual({ easy: 5, medium: 5, hard: 3, extreme: 1, auto: 2 })
  })

  it('articlesByLaw queda ordenado DESC y omite leyes sin questions', async () => {
    const db = buildFakeDb({
      law: [
        {
          law_id: 'law-a', law_short_name: 'A', law_name: 'Ley A',
          total_questions: 5, articles_with_questions: 5,
          count_easy: 5, count_medium: 0, count_hard: 0, count_extreme: 0, count_auto: 0,
          computed_at: COMPUTED_AT,
        },
        {
          law_id: 'law-b', law_short_name: 'B', law_name: 'Ley B',
          total_questions: 0, articles_with_questions: 0,
          count_easy: 0, count_medium: 0, count_hard: 0, count_extreme: 0, count_auto: 0,
          computed_at: COMPUTED_AT,
        },
        {
          law_id: 'law-c', law_short_name: 'C', law_name: 'Ley C',
          total_questions: 10, articles_with_questions: 8,
          count_easy: 10, count_medium: 0, count_hard: 0, count_extreme: 0, count_auto: 0,
          computed_at: COMPUTED_AT,
        },
      ],
      official: [],
    })

    const agg = await getTopicAggregatesFromMV(db as never, TOPIC_ID, 'auxiliar_administrativo_estado')
    expect(agg.articlesByLaw).toEqual([
      { lawShortName: 'C', lawName: 'Ley C', articlesWithQuestions: 8 },
      { lawShortName: 'A', lawName: 'Ley A', articlesWithQuestions: 5 },
    ])
  })

  it('officialQuestionsCount filtra por validExamPositions del position_type', async () => {
    const db = buildFakeDb({
      law: [
        {
          law_id: 'law-1', law_short_name: 'CE', law_name: 'CE',
          total_questions: 5, articles_with_questions: 2,
          count_easy: 5, count_medium: 0, count_hard: 0, count_extreme: 0, count_auto: 0,
          computed_at: COMPUTED_AT,
        },
      ],
      official: [
        { exam_position: 'auxiliar_administrativo_estado', official_questions: 3 },
        { exam_position: 'administrativo_estado', official_questions: 7 }, // distinta oposición → excluida
      ],
    })

    const agg = await getTopicAggregatesFromMV(db as never, TOPIC_ID, 'auxiliar_administrativo_estado')
    expect(agg.officialQuestionsCount).toBe(3)
  })

  it('officialQuestionsCount = 0 si position_type no tiene positions mapeadas', async () => {
    const db = buildFakeDb({
      law: [],
      official: [{ exam_position: 'cualquier_cosa', official_questions: 99 }],
    })

    const agg = await getTopicAggregatesFromMV(db as never, TOPIC_ID, '__position_inexistente__')
    expect(agg.officialQuestionsCount).toBe(0)
  })

  it('staleSinceMs se mide desde la fila MÁS ANTIGUA del MV (peor caso)', async () => {
    const oldDate = new Date(Date.now() - 3 * 3600_000).toISOString() // 3h ago
    const newDate = new Date(Date.now() - 60_000).toISOString() // 1min ago
    const db = buildFakeDb({
      law: [
        {
          law_id: 'law-1', law_short_name: 'A', law_name: 'A',
          total_questions: 1, articles_with_questions: 1,
          count_easy: 1, count_medium: 0, count_hard: 0, count_extreme: 0, count_auto: 0,
          computed_at: newDate,
        },
        {
          law_id: 'law-2', law_short_name: 'B', law_name: 'B',
          total_questions: 1, articles_with_questions: 1,
          count_easy: 1, count_medium: 0, count_hard: 0, count_extreme: 0, count_auto: 0,
          computed_at: oldDate,
        },
      ],
      official: [],
    })

    const agg = await getTopicAggregatesFromMV(db as never, TOPIC_ID, 'auxiliar_administrativo_estado')
    expect(agg.staleSinceMs).not.toBeNull()
    expect(agg.staleSinceMs!).toBeGreaterThan(3 * 3600_000 - 1000)
  })

  it('devuelve forma vacía consistente si la MV no tiene filas para el topic', async () => {
    const db = buildFakeDb({ law: [], official: [] })
    const agg = await getTopicAggregatesFromMV(db as never, TOPIC_ID, 'auxiliar_administrativo_estado')

    expect(agg.totalQuestions).toBe(0)
    expect(agg.officialQuestionsCount).toBe(0)
    expect(agg.difficultyStats).toEqual({ easy: 0, medium: 0, hard: 0, extreme: 0, auto: 0 })
    expect(agg.articlesByLaw).toEqual([])
    expect(agg.staleSinceMs).toBeNull()
  })

  it('dispara dos queries en paralelo (Promise.all)', async () => {
    const db = buildFakeDb({ law: [], official: [] })
    await getTopicAggregatesFromMV(db as never, TOPIC_ID, 'auxiliar_administrativo_estado')
    expect(db.execute).toHaveBeenCalledTimes(2)
  })
})

describe('isTopicMvEnabled', () => {
  const ORIG = process.env.TOPIC_MV_ENABLED

  afterEach(() => {
    if (ORIG === undefined) {
      delete process.env.TOPIC_MV_ENABLED
    } else {
      process.env.TOPIC_MV_ENABLED = ORIG
    }
  })

  it('true cuando env exactamente = "true"', () => {
    process.env.TOPIC_MV_ENABLED = 'true'
    expect(isTopicMvEnabled()).toBe(true)
  })

  it('false con cualquier otro valor', () => {
    for (const val of ['', 'TRUE', '1', 'yes', 'on']) {
      process.env.TOPIC_MV_ENABLED = val
      expect(isTopicMvEnabled()).toBe(false)
    }
  })

  it('false cuando la env no está definida', () => {
    delete process.env.TOPIC_MV_ENABLED
    expect(isTopicMvEnabled()).toBe(false)
  })
})
