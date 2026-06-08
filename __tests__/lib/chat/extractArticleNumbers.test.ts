import { extractArticleNumbers } from '@/lib/chat/domains/search/queries'

// Regresión negativo #2 del chat IA (log cbe5313b, 05/06/2026):
// "test de 20 preguntas sobre la ley 39/2015 los tres primeros artículos" no
// extraía los arts 1-3 → la búsqueda traía artículos arbitrarios y el LLM
// punteaba. Fix: parser general de ordinales/cardinales/rangos en lenguaje
// natural (escalable, no hardcode por caso).

const sorted = (xs: string[]) => [...xs].sort((a, b) => Number(a) - Number(b))

describe('extractArticleNumbers', () => {
  describe('formatos numéricos y ordinales existentes (regresión)', () => {
    it('"artículo 9" → [9]', () => {
      expect(extractArticleNumbers('artículo 9')).toEqual(['9'])
    })
    it('"art. 22" → [22]', () => {
      expect(extractArticleNumbers('art. 22')).toEqual(['22'])
    })
    it('"artículo primero" (ordinal) → [1]', () => {
      expect(extractArticleNumbers('artículo primero')).toEqual(['1'])
    })
    it('"131 de la ley" → [131]', () => {
      expect(extractArticleNumbers('131 de la ley')).toEqual(['131'])
    })
    it('respeta "art. 9 bis"', () => {
      expect(extractArticleNumbers('art. 9 bis')).toEqual(['9 bis'])
    })
  })

  describe('"los N primeros artículos" (cardinal o dígito)', () => {
    it('caso real del negativo #2: "los tres primeros artículos" → [1,2,3]', () => {
      expect(sorted(extractArticleNumbers('test de 20 preguntas sobre la ley 39/2015 los tres primeros artículos')))
        .toEqual(['1', '2', '3'])
    })
    it('"los primeros 3 artículos" → [1,2,3]', () => {
      expect(sorted(extractArticleNumbers('los primeros 3 artículos'))).toEqual(['1', '2', '3'])
    })
    it('"los 2 primeros artículos" → [1,2]', () => {
      expect(sorted(extractArticleNumbers('los 2 primeros artículos'))).toEqual(['1', '2'])
    })
    it('"dame los dos primeros artículos" → [1,2]', () => {
      expect(sorted(extractArticleNumbers('dame los dos primeros artículos'))).toEqual(['1', '2'])
    })
    it('singular "el primer artículo" → [1]', () => {
      expect(extractArticleNumbers('el primer artículo')).toEqual(['1'])
    })
  })

  describe('rangos "artículos X a Y"', () => {
    it('"artículos 1 a 3" → [1,2,3]', () => {
      expect(sorted(extractArticleNumbers('artículos 1 a 3'))).toEqual(['1', '2', '3'])
    })
    it('"del artículo 5 al 7" → [5,6,7]', () => {
      expect(sorted(extractArticleNumbers('del artículo 5 al 7'))).toEqual(['5', '6', '7'])
    })
    it('"artículo 10 hasta 12" → [10,11,12]', () => {
      expect(sorted(extractArticleNumbers('artículo 10 hasta 12'))).toEqual(['10', '11', '12'])
    })
  })

  describe('robustez: no inventar ni explotar', () => {
    it('"qué dice la ley 39/2015" → [] (no confunde el año con artículos)', () => {
      expect(extractArticleNumbers('qué dice la ley 39/2015')).toEqual([])
    })
    it('"los primeros pasos del procedimiento" → [] (primeros sin "artículos")', () => {
      expect(extractArticleNumbers('los primeros pasos del procedimiento')).toEqual([])
    })
    it('cap: "los primeros 500 artículos" no expande (>30)', () => {
      expect(extractArticleNumbers('los primeros 500 artículos')).toEqual([])
    })
    it('cap: rango absurdo "artículos 1 a 200" no expande (>30)', () => {
      expect(extractArticleNumbers('artículos 1 a 200')).toEqual([])
    })
    it('rango invertido "artículos 7 a 3" no expande', () => {
      expect(extractArticleNumbers('artículos 7 a 3')).toEqual([])
    })
    it('texto vacío → []', () => {
      expect(extractArticleNumbers('')).toEqual([])
    })
  })
})
