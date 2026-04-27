import { selectProportionallyByArticle } from '@/lib/api/filtered-questions/queries'

// Helper para crear preguntas mock
function makeQuestion(id: string, articleNumber: string, lawShortName: string = 'CE') {
  return { id, articleNumber, lawShortName }
}

function makeQuestions(articleCounts: Record<string, number>, law: string = 'CE') {
  const questions: ReturnType<typeof makeQuestion>[] = []
  let counter = 0
  for (const [art, count] of Object.entries(articleCounts)) {
    for (let i = 0; i < count; i++) {
      questions.push(makeQuestion(`q${counter++}`, art, law))
    }
  }
  return questions
}

describe('selectProportionallyByArticle', () => {
  it('distribución uniforme: 20 preguntas, 20 artículos → 1 por artículo', () => {
    const articles: Record<string, number> = {}
    for (let i = 1; i <= 20; i++) articles[String(i)] = 1
    const pool = makeQuestions(articles)

    const result = selectProportionallyByArticle(pool, pool, 20, { log: false })

    expect(result).toHaveLength(20)
    const articleSet = new Set(result.map(q => q.articleNumber))
    expect(articleSet.size).toBe(20) // cada artículo 1 vez
  })

  it('capping: 20 preguntas, 5 artículos con 10 cada uno → max 4 por artículo', () => {
    const pool = makeQuestions({ '1': 10, '2': 10, '3': 10, '4': 10, '5': 10 })

    const result = selectProportionallyByArticle(pool, pool, 20, { log: false })

    expect(result).toHaveLength(20)
    // Contar por artículo
    const counts: Record<string, number> = {}
    for (const q of result) counts[q.articleNumber] = (counts[q.articleNumber] || 0) + 1
    // maxPerArticle = ceil(20/5) = 4
    for (const count of Object.values(counts)) {
      expect(count).toBeLessThanOrEqual(4)
    }
    // Los 5 artículos deben estar representados
    expect(Object.keys(counts)).toHaveLength(5)
  })

  it('sparse: 20 preguntas necesarias, 30 artículos con 1 cada uno → 20 artículos distintos', () => {
    const articles: Record<string, number> = {}
    for (let i = 1; i <= 30; i++) articles[String(i)] = 1
    const pool = makeQuestions(articles)

    const result = selectProportionallyByArticle(pool, pool, 20, { log: false })

    expect(result).toHaveLength(20)
    const articleSet = new Set(result.map(q => q.articleNumber))
    expect(articleSet.size).toBe(20)
  })

  it('skewed: Art 116 tiene 55 preguntas vs Art 11 con 15 → distribución equilibrada', () => {
    const pool = makeQuestions({
      '116': 55, '53': 48, '55': 44, '9': 41, '1': 35,
      '54': 34, '8': 30, '29': 25, '13': 24, '16': 21,
      '17': 20, '3': 20, '20': 19, '31': 18, '2': 17,
      '10': 17, '28': 16, '24': 15, '27': 15, '11': 15,
    })

    const result = selectProportionallyByArticle(pool, pool, 25, { log: false })

    expect(result).toHaveLength(25)
    const counts: Record<string, number> = {}
    for (const q of result) counts[q.articleNumber] = (counts[q.articleNumber] || 0) + 1
    // maxPerArticle = ceil(25/20) = 2
    for (const [art, count] of Object.entries(counts)) {
      expect(count).toBeLessThanOrEqual(2)
    }
    // Debe haber al menos 13 artículos distintos (25 preguntas / max 2)
    expect(Object.keys(counts).length).toBeGreaterThanOrEqual(13)
  })

  it('degradación graceful: solo 3 artículos para 20 preguntas', () => {
    const pool = makeQuestions({ '1': 10, '2': 8, '3': 5 })

    const result = selectProportionallyByArticle(pool, pool, 20, { log: false })

    expect(result).toHaveLength(20)
    const counts: Record<string, number> = {}
    for (const q of result) counts[q.articleNumber] = (counts[q.articleNumber] || 0) + 1
    // Los 3 artículos deben estar representados
    expect(Object.keys(counts)).toHaveLength(3)
    // Ninguno debe tener todas — debe repartir
    expect(counts['1']).toBeLessThanOrEqual(10)
    expect(counts['3']).toBeGreaterThanOrEqual(4) // el más pequeño (5) casi al completo
  })

  it('vacío: 0 preguntas → devuelve array vacío', () => {
    const result = selectProportionallyByArticle([], [], 0, { log: false })
    expect(result).toHaveLength(0)
  })

  it('single article: todas las preguntas del mismo artículo', () => {
    const pool = makeQuestions({ '42': 30 })

    const result = selectProportionallyByArticle(pool, pool, 15, { log: false })

    expect(result).toHaveLength(15)
    expect(new Set(result.map(q => q.articleNumber)).size).toBe(1)
  })

  it('multi-ley: artículos con mismo número de leyes distintas no se mezclan', () => {
    const poolCE = makeQuestions({ '1': 10, '2': 10 }, 'CE')
    const poolLey39 = makeQuestions({ '1': 10, '2': 10 }, 'Ley 39/2015')
    // IDs únicos
    let counter = 100
    for (const q of poolLey39) q.id = `q${counter++}`
    const pool = [...poolCE, ...poolLey39]

    const result = selectProportionallyByArticle(pool, pool, 10, { log: false })

    expect(result).toHaveLength(10)
    // Debe haber artículos de ambas leyes
    const keys = new Set(result.map(q => `${q.articleNumber}@${q.lawShortName}`))
    // 4 artículos distintos: 1@CE, 2@CE, 1@Ley39, 2@Ley39
    expect(keys.size).toBeGreaterThanOrEqual(3)
  })

  it('pool más grande que candidatos permite diversificar', () => {
    // Candidatos solo de art 1, pero pool tiene más artículos
    const candidates = makeQuestions({ '1': 10 })
    const fullPool = makeQuestions({ '1': 10, '2': 10, '3': 10, '4': 10 })

    const result = selectProportionallyByArticle(candidates, fullPool, 10, { log: false })

    expect(result).toHaveLength(10)
    // Debe diversificar usando el pool
    const articleSet = new Set(result.map(q => q.articleNumber))
    expect(articleSet.size).toBeGreaterThan(1)
  })

  it('no devuelve duplicados', () => {
    const pool = makeQuestions({ '1': 5, '2': 5, '3': 5 })

    const result = selectProportionallyByArticle(pool, pool, 10, { log: false })

    const ids = result.map(q => q.id)
    expect(new Set(ids).size).toBe(ids.length) // sin duplicados
  })
})
