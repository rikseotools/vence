/**
 * Tests para logica pura de asignacion de medallas (sin DB)
 */
import { assignMedalsForPeriod, getMedalPeriods } from '../../../lib/api/medals/queries'

// Helper para crear ranking
function makeRanking(users: Array<{ id: string; total: number; correct: number }>): Array<{
  userId: string
  totalQuestions: number
  correctAnswers: number
  accuracy: number
}> {
  return users
    .map(u => ({
      userId: u.id,
      totalQuestions: u.total,
      correctAnswers: u.correct,
      accuracy: Math.round((u.correct / u.total) * 100),
    }))
    .sort((a, b) => b.accuracy - a.accuracy || b.totalQuestions - a.totalQuestions)
}

describe('assignMedalsForPeriod', () => {
  describe('Posicion en ranking', () => {
    test('#1 en ranking -> FIRST_PLACE', () => {
      const ranking = makeRanking([
        { id: 'u1', total: 50, correct: 45 },
        { id: 'u2', total: 30, correct: 21 },
      ])

      const medals = assignMedalsForPeriod('today', ranking, 'u1')
      expect(medals).toHaveLength(1)
      expect(medals[0].id).toBe('first_place_today')
      expect(medals[0].rank).toBe(1)
    })

    test('#2 en ranking -> TOP_3', () => {
      const ranking = makeRanking([
        { id: 'u1', total: 50, correct: 45 },
        { id: 'u2', total: 30, correct: 24 },
        { id: 'u3', total: 20, correct: 10 },
      ])

      const medals = assignMedalsForPeriod('today', ranking, 'u2')
      expect(medals).toHaveLength(1)
      expect(medals[0].id).toBe('top_3_today')
      expect(medals[0].rank).toBe(2)
    })

    test('#3 en ranking -> TOP_3', () => {
      const ranking = makeRanking([
        { id: 'u1', total: 50, correct: 45 },
        { id: 'u2', total: 30, correct: 24 },
        { id: 'u3', total: 20, correct: 14 },
      ])

      const medals = assignMedalsForPeriod('today', ranking, 'u3')
      expect(medals).toHaveLength(1)
      expect(medals[0].id).toBe('top_3_today')
    })

    test('#4 en ranking -> sin medalla de posicion', () => {
      const ranking = makeRanking([
        { id: 'u1', total: 50, correct: 45 },
        { id: 'u2', total: 30, correct: 24 },
        { id: 'u3', total: 20, correct: 14 },
        { id: 'u4', total: 10, correct: 5 },
      ])

      const medals = assignMedalsForPeriod('today', ranking, 'u4')
      expect(medals).toHaveLength(0)
    })

    test('usuario no en ranking -> sin medallas', () => {
      const ranking = makeRanking([
        { id: 'u1', total: 50, correct: 45 },
      ])

      const medals = assignMedalsForPeriod('today', ranking, 'u999')
      expect(medals).toHaveLength(0)
    })

    test('#1 con un solo usuario -> recibe FIRST_PLACE', () => {
      const ranking = makeRanking([
        { id: 'u1', total: 50, correct: 45 },
      ])

      const medals = assignMedalsForPeriod('today', ranking, 'u1')
      expect(medals).toHaveLength(1)
      expect(medals[0].id).toBe('first_place_today')
    })

    test('TOP_3 requiere al menos 2 usuarios', () => {
      // Con un solo usuario, posicion 2 no existe
      const ranking = makeRanking([
        { id: 'u1', total: 50, correct: 45 },
      ])

      // u1 es #1, no #2-3
      const medals = assignMedalsForPeriod('today', ranking, 'u1')
      expect(medals.some(m => m.id.startsWith('top_3'))).toBe(false)
    })
  })

  describe('Medallas de periodo', () => {
    test('periodo week -> usa medalla semanal', () => {
      const ranking = makeRanking([
        { id: 'u1', total: 50, correct: 45 },
        { id: 'u2', total: 30, correct: 21 },
      ])

      const medals = assignMedalsForPeriod('week', ranking, 'u1')
      expect(medals[0].id).toBe('first_place_week')
    })

    test('periodo month -> usa medalla mensual', () => {
      const ranking = makeRanking([
        { id: 'u1', total: 50, correct: 45 },
        { id: 'u2', total: 30, correct: 21 },
      ])

      const medals = assignMedalsForPeriod('month', ranking, 'u1')
      expect(medals[0].id).toBe('first_place_month')
    })
  })

  describe('HIGH_ACCURACY', () => {
    test('92% accuracy + 20 pregs en week -> HIGH_ACCURACY', () => {
      const ranking = makeRanking([
        { id: 'u1', total: 25, correct: 23 }, // 92%
      ])

      const medals = assignMedalsForPeriod('week', ranking, 'u1')
      const hasMedal = medals.some(m => m.id === 'high_accuracy')
      expect(hasMedal).toBe(true)
    })

    test('89% accuracy -> sin HIGH_ACCURACY', () => {
      const ranking = makeRanking([
        { id: 'u1', total: 100, correct: 89 }, // 89%
      ])

      const medals = assignMedalsForPeriod('week', ranking, 'u1')
      const hasMedal = medals.some(m => m.id === 'high_accuracy')
      expect(hasMedal).toBe(false)
    })

    test('90% accuracy + 19 pregs -> sin HIGH_ACCURACY (minimo 20)', () => {
      const ranking = makeRanking([
        { id: 'u1', total: 19, correct: 17 }, // ~89%, y ademas < 20 pregs
      ])

      const medals = assignMedalsForPeriod('week', ranking, 'u1')
      const hasMedal = medals.some(m => m.id === 'high_accuracy')
      expect(hasMedal).toBe(false)
    })

    test('HIGH_ACCURACY solo en week, no en today', () => {
      const ranking = makeRanking([
        { id: 'u1', total: 25, correct: 23 }, // 92%
      ])

      const todayMedals = assignMedalsForPeriod('today', ranking, 'u1')
      const hasMedal = todayMedals.some(m => m.id === 'high_accuracy')
      expect(hasMedal).toBe(false)
    })
  })

  describe('VOLUME_LEADER', () => {
    test('100 preguntas en week -> VOLUME_LEADER', () => {
      const ranking = makeRanking([
        { id: 'u1', total: 100, correct: 70 },
      ])

      const medals = assignMedalsForPeriod('week', ranking, 'u1')
      const hasMedal = medals.some(m => m.id === 'volume_leader')
      expect(hasMedal).toBe(true)
    })

    test('99 preguntas -> sin VOLUME_LEADER', () => {
      const ranking = makeRanking([
        { id: 'u1', total: 99, correct: 70 },
      ])

      const medals = assignMedalsForPeriod('week', ranking, 'u1')
      const hasMedal = medals.some(m => m.id === 'volume_leader')
      expect(hasMedal).toBe(false)
    })

    test('VOLUME_LEADER solo en week, no en today', () => {
      const ranking = makeRanking([
        { id: 'u1', total: 150, correct: 100 },
      ])

      const todayMedals = assignMedalsForPeriod('today', ranking, 'u1')
      const hasMedal = todayMedals.some(m => m.id === 'volume_leader')
      expect(hasMedal).toBe(false)
    })
  })

  describe('Combinaciones de medallas', () => {
    test('#1 + HIGH_ACCURACY + VOLUME_LEADER en week', () => {
      const ranking = makeRanking([
        { id: 'u1', total: 120, correct: 110 }, // 92%, >100
        { id: 'u2', total: 30, correct: 21 },
      ])

      const medals = assignMedalsForPeriod('week', ranking, 'u1')
      const medalIds = medals.map(m => m.id)
      expect(medalIds).toContain('first_place_week')
      expect(medalIds).toContain('high_accuracy')
      expect(medalIds).toContain('volume_leader')
      expect(medals).toHaveLength(3)
    })
  })
})

describe('getMedalPeriods', () => {
  test('dia normal (martes) -> solo medallas diarias', () => {
    // Martes 3 marzo 2026
    const tuesday = new Date('2026-03-03T14:30:00.000Z')
    const periods = getMedalPeriods(tuesday)

    expect(periods.today).toBeDefined()
    expect(periods.week).toBeUndefined()
    expect(periods.month).toBeUndefined()
  })

  test('lunes -> medallas diarias + semanales', () => {
    // Lunes 2 marzo 2026
    const monday = new Date('2026-03-02T14:30:00.000Z')
    const periods = getMedalPeriods(monday)

    expect(periods.today).toBeDefined()
    expect(periods.week).toBeDefined()
    expect(periods.month).toBeUndefined()
  })

  test('dia 1 del mes (no lunes) -> medallas diarias + mensuales', () => {
    // 1 abril 2026 es miercoles
    const firstDay = new Date('2026-04-01T14:30:00.000Z')
    const periods = getMedalPeriods(firstDay)

    expect(periods.today).toBeDefined()
    expect(periods.week).toBeUndefined()
    expect(periods.month).toBeDefined()
  })

  test('lunes 1 del mes -> diarias + semanales + mensuales', () => {
    // Lunes 1 junio 2026
    const mondayFirst = new Date('2026-06-01T14:30:00.000Z')
    const periods = getMedalPeriods(mondayFirst)

    expect(periods.today).toBeDefined()
    expect(periods.week).toBeDefined()
    expect(periods.month).toBeDefined()
  })

  test('periodo diario evalua ayer', () => {
    const now = new Date('2026-03-05T14:30:00.000Z')
    const periods = getMedalPeriods(now)

    expect(periods.today!.startDate.toISOString()).toBe('2026-03-04T00:00:00.000Z')
    expect(periods.today!.endDate.toISOString()).toBe('2026-03-04T23:59:59.999Z')
  })

  test('periodo semanal evalua semana pasada', () => {
    // Lunes 9 marzo 2026
    const monday = new Date('2026-03-09T14:30:00.000Z')
    const periods = getMedalPeriods(monday)

    // Debe evaluar lunes 23 feb a domingo 1 marzo
    expect(periods.week!.startDate.toISOString()).toBe('2026-03-01T00:00:00.000Z')
    expect(periods.week!.endDate.toISOString()).toBe('2026-03-07T23:59:59.999Z')
  })

  test('periodo mensual evalua mes pasado', () => {
    // 1 marzo 2026 (domingo)
    const firstDay = new Date('2026-03-01T14:30:00.000Z')
    const periods = getMedalPeriods(firstDay)

    expect(periods.month!.startDate.toISOString()).toBe('2026-02-01T00:00:00.000Z')
    // Febrero 2026 tiene 28 dias
    expect(periods.month!.endDate.toISOString()).toBe('2026-02-28T23:59:59.999Z')
  })
})
