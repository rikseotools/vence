// __tests__/lib/questionFavorites.test.ts
//
// UNIT del dominio de preguntas favoritas (T-261) — contratos + criterio de orden.
// Petición de Laura Zurdo (feedback 46372450, 28/07/2026).
import {
  safeParseToggleFavorite,
  safeParseFavoriteQuestionsTest,
  MAX_FAVORITAS_POR_TEST,
} from '@/lib/api/question-favorites/schemas'
import { ordenarFavoritas } from '@/lib/api/question-favorites/queries'

describe('contratos (Zod)', () => {
  describe('marcar / desmarcar', () => {
    it('acepta un questionId UUID', () => {
      const r = safeParseToggleFavorite({ questionId: '3bdd3565-1111-4222-8333-444444444444' })
      expect(r.success).toBe(true)
    })

    it('rechaza un questionId que no es UUID (no se marca "cualquier cosa")', () => {
      expect(safeParseToggleFavorite({ questionId: 'abc' }).success).toBe(false)
      expect(safeParseToggleFavorite({ questionId: '' }).success).toBe(false)
      expect(safeParseToggleFavorite({}).success).toBe(false)
      expect(safeParseToggleFavorite(null).success).toBe(false)
    })

    it('ignora un userId enviado por el cliente — el usuario sale del token', () => {
      const r = safeParseToggleFavorite({
        questionId: '3bdd3565-1111-4222-8333-444444444444',
        userId: 'otro-usuario',
      })
      expect(r.success).toBe(true)
      expect(Object.keys(r.success ? r.data : {})).toEqual(['questionId'])
    })
  })

  describe('test de repaso', () => {
    it('aplica valores por defecto (20 preguntas, las últimas guardadas primero)', () => {
      const r = safeParseFavoriteQuestionsTest({})
      expect(r.success && r.data).toEqual({ numQuestions: 20, orderBy: 'recent' })
    })

    it('acepta el orden aleatorio', () => {
      const r = safeParseFavoriteQuestionsTest({ orderBy: 'random' })
      expect(r.success && r.data.orderBy).toBe('random')
    })

    it('rechaza un orden inventado', () => {
      expect(safeParseFavoriteQuestionsTest({ orderBy: 'lo-que-sea' }).success).toBe(false)
    })

    it('pone techo al número de preguntas (nadie pide 10.000 de golpe)', () => {
      expect(safeParseFavoriteQuestionsTest({ numQuestions: MAX_FAVORITAS_POR_TEST }).success).toBe(true)
      expect(safeParseFavoriteQuestionsTest({ numQuestions: MAX_FAVORITAS_POR_TEST + 1 }).success).toBe(false)
      expect(safeParseFavoriteQuestionsTest({ numQuestions: 0 }).success).toBe(false)
      expect(safeParseFavoriteQuestionsTest({ numQuestions: -5 }).success).toBe(false)
    })
  })
})

describe('ordenarFavoritas', () => {
  const filas = [
    { questionId: 'a', createdAt: '2026-07-01T10:00:00Z' },
    { questionId: 'b', createdAt: '2026-07-28T10:00:00Z' },
    { questionId: 'c', createdAt: '2026-07-15T10:00:00Z' },
  ]

  it('recent: las últimas guardadas primero', () => {
    expect(ordenarFavoritas(filas, 'recent').map((f) => f.questionId)).toEqual(['b', 'c', 'a'])
  })

  it('random: baraja de verdad (con azar controlado) sin perder ni duplicar', () => {
    const secuencia = [0.99, 0.01, 0.5]
    let i = 0
    const rnd = () => secuencia[i++ % secuencia.length]

    const salida = ordenarFavoritas(filas, 'random', rnd)
    expect(salida).toHaveLength(filas.length)
    expect([...salida.map((f) => f.questionId)].sort()).toEqual(['a', 'b', 'c'])
  })

  it('no muta la entrada (el caller puede reusar su array)', () => {
    const copia = [...filas]
    ordenarFavoritas(filas, 'random', () => 0.5)
    ordenarFavoritas(filas, 'recent')
    expect(filas).toEqual(copia)
  })

  it('aguanta lista vacía y de un solo elemento', () => {
    expect(ordenarFavoritas([], 'recent')).toEqual([])
    expect(ordenarFavoritas([filas[0]], 'random', () => 0)).toEqual([filas[0]])
  })
})
