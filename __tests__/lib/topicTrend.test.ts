// __tests__/lib/topicTrend.test.ts
//
// Tests de los helpers puros de la métrica de tendencia del temario:
//   - isTopicTrendVisible:   visibilidad efectiva de las flechitas ▲/▼ (default visible)
//   - nextTopicTrendVisible: valor al pulsar el toggle
//   - summarizeTopicProgress: agregado de datos reales para el modal informativo

import {
  isTopicTrendVisible,
  nextTopicTrendVisible,
  summarizeTopicProgress,
  type TopicProgressEntry,
} from '@/lib/utils/topicTrend'

describe('isTopicTrendVisible', () => {
  it('default visible: null/undefined → true', () => {
    expect(isTopicTrendVisible(null)).toBe(true)
    expect(isTopicTrendVisible(undefined)).toBe(true)
  })
  it('sólo se oculta si es explícitamente false', () => {
    expect(isTopicTrendVisible(false)).toBe(false)
    expect(isTopicTrendVisible(true)).toBe(true)
  })
})

describe('nextTopicTrendVisible', () => {
  it('invierte el estado efectivo', () => {
    expect(nextTopicTrendVisible(true)).toBe(false)
    expect(nextTopicTrendVisible(false)).toBe(true)
  })
})

describe('summarizeTopicProgress', () => {
  it('ignora temas sin preguntas respondidas', () => {
    const entries: TopicProgressEntry[] = [
      { titulo: 'A', accuracy: 80, accuracy30d: null, questionsAnswered: 0 },
      { titulo: 'B', accuracy: 50, accuracy30d: null, questionsAnswered: 10 },
    ]
    const s = summarizeTopicProgress(entries)
    expect(s.temasPracticados).toBe(1)
    expect(s.totalRespondidas).toBe(10)
  })

  it('media de acierto ponderada por preguntas respondidas', () => {
    const entries: TopicProgressEntry[] = [
      { titulo: 'A', accuracy: 100, accuracy30d: null, questionsAnswered: 10 },
      { titulo: 'B', accuracy: 50, accuracy30d: null, questionsAnswered: 30 },
    ]
    // (100*10 + 50*30) / 40 = 2500/40 = 62.5 → 63
    expect(summarizeTopicProgress(entries).mediaAciertos).toBe(63)
  })

  it('identifica mejor tema y tema a reforzar', () => {
    const entries: TopicProgressEntry[] = [
      { titulo: 'Bajo', accuracy: 40, accuracy30d: null, questionsAnswered: 5 },
      { titulo: 'Alto', accuracy: 90, accuracy30d: null, questionsAnswered: 5 },
      { titulo: 'Medio', accuracy: 65, accuracy30d: null, questionsAnswered: 5 },
    ]
    const s = summarizeTopicProgress(entries)
    expect(s.mejorTema).toEqual({ titulo: 'Alto', accuracy: 90 })
    expect(s.temaReforzar).toEqual({ titulo: 'Bajo', accuracy: 40 })
  })

  it('reparte tendencia 30d e ignora los temas sin dato 30d', () => {
    const entries: TopicProgressEntry[] = [
      { titulo: 'Sube', accuracy: 50, accuracy30d: 70, questionsAnswered: 5 },
      { titulo: 'Baja', accuracy: 80, accuracy30d: 60, questionsAnswered: 5 },
      { titulo: 'Igual', accuracy: 60, accuracy30d: 60, questionsAnswered: 5 },
      { titulo: 'SinDato', accuracy: 60, accuracy30d: null, questionsAnswered: 5 },
    ]
    const s = summarizeTopicProgress(entries)
    expect(s.tendencia).toEqual({ mejorando: 1, empeorando: 1, estable: 1 })
  })

  it('sin datos → valores neutros', () => {
    const s = summarizeTopicProgress([])
    expect(s.temasPracticados).toBe(0)
    expect(s.mediaAciertos).toBe(0)
    expect(s.mejorTema).toBeNull()
    expect(s.temaReforzar).toBeNull()
  })
})
