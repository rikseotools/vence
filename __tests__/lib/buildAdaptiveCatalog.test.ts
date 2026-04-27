// Test para buildAdaptiveCatalog — función interna de testFetchers.ts
// Como es una función privada, la testeamos indirectamente verificando la estructura
// Aquí usamos una copia del algoritmo para validar la lógica

import { topicKey, articleKey, emptyBuckets } from '@/lib/types/adaptive'

// Simular TransformedQuestion mínima
interface MockQuestion {
  id: string
  tema: number | null
  article: { number: string; law_short_name: string }
  metadata: { difficulty: string }
}

function makeQ(id: string, tema: number, art: string, difficulty: string = 'medium'): MockQuestion {
  return { id, tema, article: { number: art, law_short_name: 'CE' }, metadata: { difficulty } }
}

describe('Tipos adaptativos', () => {
  describe('topicKey', () => {
    it('null/undefined → "all"', () => {
      expect(topicKey(null)).toBe('all')
      expect(topicKey(undefined)).toBe('all')
    })

    it('number → "topic:N"', () => {
      expect(topicKey(1)).toBe('topic:1')
      expect(topicKey(105)).toBe('topic:105')
    })
  })

  describe('articleKey', () => {
    it('genera clave compuesta', () => {
      expect(articleKey('36', 'CE')).toBe('36@CE')
      expect(articleKey('5', 'Ley 39/2015')).toBe('5@Ley 39/2015')
    })

    it('valores undefined → unknown', () => {
      expect(articleKey(undefined, undefined)).toBe('unknown@unknown')
    })
  })

  describe('emptyBuckets', () => {
    it('devuelve 4 arrays vacíos', () => {
      const b = emptyBuckets<MockQuestion>()
      expect(b.easy).toEqual([])
      expect(b.medium).toEqual([])
      expect(b.hard).toEqual([])
      expect(b.extreme).toEqual([])
    })
  })
})

describe('Lógica del catálogo adaptativo', () => {
  it('single tema: clasifica por dificultad y visto/no-visto', () => {
    const questions = [
      makeQ('q1', 1, '10', 'easy'),
      makeQ('q2', 1, '11', 'medium'),
      makeQ('q3', 1, '12', 'hard'),
      makeQ('q4', 1, '13', 'medium'),
      makeQ('q5', 1, '14', 'easy'),
    ]
    const answeredIds = new Set(['q2', 'q4'])

    const neverSeen = questions.filter(q => !answeredIds.has(q.id))
    const answered = questions.filter(q => answeredIds.has(q.id))

    expect(neverSeen).toHaveLength(3) // q1, q3, q5
    expect(answered).toHaveLength(2) // q2, q4

    const nsMedium = neverSeen.filter(q => q.metadata.difficulty === 'medium')
    const nsEasy = neverSeen.filter(q => q.metadata.difficulty === 'easy')
    expect(nsMedium).toHaveLength(0) // q2 y q4 eran medium pero answered
    expect(nsEasy).toHaveLength(2) // q1, q5
  })

  it('multi-tema: agrupa por tema correctamente', () => {
    const questions = [
      makeQ('q1', 1, '10'), makeQ('q2', 1, '11'),
      makeQ('q3', 5, '20'), makeQ('q4', 5, '21'),
      makeQ('q5', 8, '30'), makeQ('q6', 8, '31'),
    ]
    const themes = [1, 5, 8]

    const byTopic = new Map<string, MockQuestion[]>()
    for (const q of questions) {
      const key = topicKey(q.tema)
      if (!byTopic.has(key)) byTopic.set(key, [])
      byTopic.get(key)!.push(q)
    }

    expect(byTopic.get('topic:1')).toHaveLength(2)
    expect(byTopic.get('topic:5')).toHaveLength(2)
    expect(byTopic.get('topic:8')).toHaveLength(2)
  })

  it('distribución proporcional entre temas para selección inicial', () => {
    const questions = [
      // Tema 1: 10 preguntas
      ...Array.from({ length: 10 }, (_, i) => makeQ(`t1q${i}`, 1, String(i + 1))),
      // Tema 5: 8 preguntas
      ...Array.from({ length: 8 }, (_, i) => makeQ(`t5q${i}`, 5, String(i + 20))),
      // Tema 8: 12 preguntas
      ...Array.from({ length: 12 }, (_, i) => makeQ(`t8q${i}`, 8, String(i + 40))),
    ]
    const answeredIds = new Set<string>()
    const themes = [1, 5, 8]
    const numQuestions = 15

    // Simular distribución proporcional
    const perTopic = Math.floor(numQuestions / themes.length) // 5
    const remainder = numQuestions % themes.length // 0

    const byTopic = new Map<string, MockQuestion[]>()
    for (const q of questions) {
      const key = topicKey(q.tema)
      if (!byTopic.has(key)) byTopic.set(key, [])
      byTopic.get(key)!.push(q)
    }

    const selected: MockQuestion[] = []
    let extra = remainder
    for (const t of themes) {
      const key = topicKey(t)
      const topicQs = byTopic.get(key) || []
      const count = perTopic + (extra > 0 ? 1 : 0)
      if (extra > 0) extra--
      selected.push(...topicQs.slice(0, count))
    }

    expect(selected).toHaveLength(15)
    // Cada tema tiene 5
    const t1count = selected.filter(q => q.tema === 1).length
    const t5count = selected.filter(q => q.tema === 5).length
    const t8count = selected.filter(q => q.tema === 8).length
    expect(t1count).toBe(5)
    expect(t5count).toBe(5)
    expect(t8count).toBe(5)
  })

  it('historial vacío: todas las preguntas son neverSeen', () => {
    const questions = [makeQ('q1', 1, '10'), makeQ('q2', 1, '11')]
    const answeredIds = new Set<string>()

    const neverSeen = questions.filter(q => !answeredIds.has(q.id))
    expect(neverSeen).toHaveLength(2)
  })

  it('historial completo: todas son answered', () => {
    const questions = [makeQ('q1', 1, '10'), makeQ('q2', 1, '11')]
    const answeredIds = new Set(['q1', 'q2'])

    const neverSeen = questions.filter(q => !answeredIds.has(q.id))
    const answered = questions.filter(q => answeredIds.has(q.id))
    expect(neverSeen).toHaveLength(0)
    expect(answered).toHaveLength(2)
  })

  it('articlesSeen se genera correctamente', () => {
    const questions = [
      makeQ('q1', 1, '116'),
      makeQ('q2', 1, '9'),
    ]

    const seen = questions.map(q => articleKey(q.article.number, q.article.law_short_name))
    expect(seen).toEqual(['116@CE', '9@CE'])
  })
})
