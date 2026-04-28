import { pickDiverseByArticle } from '@/lib/types/adaptive'

interface FakeQuestion {
  id: string
  article: string
}

const mkQ = (id: string, article: string): FakeQuestion => ({ id, article })
const getKey = (q: FakeQuestion) => q.article

describe('pickDiverseByArticle', () => {
  // ─── Casos básicos ───

  test('devuelve todo si hay menos candidatos que count', () => {
    const candidates = [mkQ('1', 'art.5'), mkQ('2', 'art.10')]
    const result = pickDiverseByArticle(candidates, 5, getKey)
    expect(result).toHaveLength(2)
  })

  test('devuelve exactamente count elementos', () => {
    const candidates = Array.from({ length: 20 }, (_, i) => mkQ(`${i}`, `art.${i % 5}`))
    const result = pickDiverseByArticle(candidates, 10, getKey)
    expect(result).toHaveLength(10)
  })

  test('devuelve array vacío si candidatos vacíos', () => {
    const result = pickDiverseByArticle([], 5, getKey)
    expect(result).toHaveLength(0)
  })

  // ─── Diversidad por artículo ───

  test('no repite artículo mientras haya artículos distintos disponibles', () => {
    // 5 artículos con 4 preguntas cada uno = 20 preguntas
    const candidates = Array.from({ length: 20 }, (_, i) => mkQ(`${i}`, `art.${i % 5}`))
    const result = pickDiverseByArticle(candidates, 5, getKey)

    const articles = result.map(q => q.article)
    const uniqueArticles = new Set(articles)
    // Con 5 artículos disponibles y pidiendo 5, debe haber 5 artículos distintos
    expect(uniqueArticles.size).toBe(5)
  })

  test('con 10 artículos pidiendo 10, cada artículo aparece exactamente 1 vez', () => {
    const candidates = Array.from({ length: 30 }, (_, i) => mkQ(`${i}`, `art.${i % 10}`))
    const result = pickDiverseByArticle(candidates, 10, getKey)

    const articleCounts = new Map<string, number>()
    for (const q of result) {
      articleCounts.set(q.article, (articleCounts.get(q.article) || 0) + 1)
    }
    // Cada artículo debe aparecer exactamente 1 vez
    for (const count of articleCounts.values()) {
      expect(count).toBe(1)
    }
  })

  test('con 3 artículos pidiendo 6, cada artículo aparece máximo 2 veces', () => {
    // 3 artículos con 5 preguntas cada uno
    const candidates = Array.from({ length: 15 }, (_, i) => mkQ(`${i}`, `art.${i % 3}`))
    const result = pickDiverseByArticle(candidates, 6, getKey)

    expect(result).toHaveLength(6)
    const articleCounts = new Map<string, number>()
    for (const q of result) {
      articleCounts.set(q.article, (articleCounts.get(q.article) || 0) + 1)
    }
    // Cada artículo debe aparecer máximo 2 veces (6/3 = 2)
    for (const count of articleCounts.values()) {
      expect(count).toBeLessThanOrEqual(2)
    }
  })

  test('con 2 artículos pidiendo 7, distribuye equitativamente (3+4 o 4+3)', () => {
    const candidates = Array.from({ length: 10 }, (_, i) => mkQ(`${i}`, `art.${i % 2}`))
    const result = pickDiverseByArticle(candidates, 7, getKey)

    expect(result).toHaveLength(7)
    const articleCounts = new Map<string, number>()
    for (const q of result) {
      articleCounts.set(q.article, (articleCounts.get(q.article) || 0) + 1)
    }
    const counts = Array.from(articleCounts.values()).sort()
    // Debe ser [3, 4] no [1, 6]
    expect(counts).toEqual([3, 4])
  })

  // ─── No duplica IDs ───

  test('nunca devuelve la misma pregunta dos veces', () => {
    const candidates = Array.from({ length: 20 }, (_, i) => mkQ(`${i}`, `art.${i % 3}`))
    const result = pickDiverseByArticle(candidates, 15, getKey)

    const ids = result.map(q => q.id)
    const uniqueIds = new Set(ids)
    expect(uniqueIds.size).toBe(result.length)
  })

  // ─── Caso extremo: un solo artículo ───

  test('con un solo artículo, devuelve count preguntas de ese artículo', () => {
    const candidates = Array.from({ length: 10 }, (_, i) => mkQ(`${i}`, 'art.1'))
    const result = pickDiverseByArticle(candidates, 5, getKey)

    expect(result).toHaveLength(5)
    expect(result.every(q => q.article === 'art.1')).toBe(true)
  })

  // ─── Simulación del caso real de Cristina ───

  test('simulación: 21 reemplazos con pool desbalanceado no agrupa por artículo', () => {
    // Simular el pool que tenía Cristina: muchas preguntas de pocos artículos
    const candidates = [
      ...Array.from({ length: 8 }, (_, i) => mkQ(`a1-${i}`, 'art.1')),   // 8 del art.1
      ...Array.from({ length: 7 }, (_, i) => mkQ(`a5-${i}`, 'art.5')),   // 7 del art.5
      ...Array.from({ length: 10 }, (_, i) => mkQ(`a17-${i}`, 'art.17')), // 10 del art.17
      ...Array.from({ length: 5 }, (_, i) => mkQ(`a15-${i}`, 'art.15')), // 5 del art.15
      ...Array.from({ length: 3 }, (_, i) => mkQ(`a7-${i}`, 'art.7')),   // 3 del art.7
      ...Array.from({ length: 2 }, (_, i) => mkQ(`a18-${i}`, 'art.18')), // 2 del art.18
    ]

    const result = pickDiverseByArticle(candidates, 21, getKey)
    expect(result).toHaveLength(21)

    // Verificar que NO hay 5+ preguntas consecutivas del mismo artículo
    let maxConsecutive = 1
    let currentConsecutive = 1
    for (let i = 1; i < result.length; i++) {
      if (result[i].article === result[i - 1].article) {
        currentConsecutive++
        maxConsecutive = Math.max(maxConsecutive, currentConsecutive)
      } else {
        currentConsecutive = 1
      }
    }
    // Con 6 artículos y round-robin, max consecutive debería ser 1
    expect(maxConsecutive).toBe(1)

    // Verificar distribución: ningún artículo debe tener más que ceil(21/6) = 4
    const articleCounts = new Map<string, number>()
    for (const q of result) {
      articleCounts.set(q.article, (articleCounts.get(q.article) || 0) + 1)
    }
    for (const [art, count] of articleCounts) {
      expect(count).toBeLessThanOrEqual(4)
    }

    // Verificar que usa los 6 artículos
    expect(articleCounts.size).toBe(6)
  })

  // ─── Artículos con pocas preguntas se agotan correctamente ───

  test('artículos con 1 sola pregunta no se repiten', () => {
    const candidates = [
      mkQ('a1', 'art.1'),
      mkQ('a2', 'art.2'),
      mkQ('a3', 'art.3'),
      ...Array.from({ length: 10 }, (_, i) => mkQ(`ax-${i}`, 'art.99')),
    ]
    const result = pickDiverseByArticle(candidates, 6, getKey)

    expect(result).toHaveLength(6)
    const articleCounts = new Map<string, number>()
    for (const q of result) {
      articleCounts.set(q.article, (articleCounts.get(q.article) || 0) + 1)
    }
    // art.1, art.2, art.3 deben tener 1 cada uno
    expect(articleCounts.get('art.1')).toBe(1)
    expect(articleCounts.get('art.2')).toBe(1)
    expect(articleCounts.get('art.3')).toBe(1)
    // art.99 rellena las 3 restantes
    expect(articleCounts.get('art.99')).toBe(3)
  })
})
