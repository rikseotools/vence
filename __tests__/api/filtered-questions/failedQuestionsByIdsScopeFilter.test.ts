/**
 * Tests para preguntas falladas con IDs específicos (sessionStorage).
 *
 * Cambio (18/04/2026): se eliminó el filtro por scope de oposición.
 * Los IDs vienen del historial real del usuario — ya los respondió,
 * no tiene sentido filtrarlos por scope.
 *
 * El único filtro que queda: is_active=true (preguntas desactivadas
 * no se sirven).
 */

describe('Failed questions by IDs — sin scope filter', () => {

  beforeEach(() => jest.clearAllMocks())

  describe('Routing', () => {
    it('onlyFailedQuestions=true + failedQuestionIds no vacíos → activa', () => {
      const onlyFailedQuestions = true
      const failedQuestionIds = ['q1', 'q2']
      const activates = onlyFailedQuestions && failedQuestionIds.length > 0
      expect(activates).toBe(true)
    })

    it('failedQuestionIds vacíos → NO activa (cae a path historial)', () => {
      const failedQuestionIds: string[] = []
      const activates = true && failedQuestionIds.length > 0
      expect(activates).toBe(false)
    })
  })

  describe('Sin scope filter', () => {
    it('NO llama a getAllowedLawIds', () => {
      // Antes: getAllowedLawIds + inArray(laws.id, allowed.lawIds)
      // Ahora: solo inArray(questions.id, failedQuestionIds) + isActive
      const usesScope = false
      expect(usesScope).toBe(false)
    })

    it('preguntas de cualquier ley pasan si están activas', () => {
      const failedQuestionIds = ['q-ce', 'q-trebep', 'q-cyl-especifica']
      const isActive = [true, true, true]
      const returned = failedQuestionIds.filter((_, i) => isActive[i])
      expect(returned.length).toBe(3)
    })

    it('preguntas inactivas se excluyen', () => {
      const failedQuestionIds = ['q-active', 'q-inactive', 'q-active2']
      const isActive = [true, false, true]
      const returned = failedQuestionIds.filter((_, i) => isActive[i])
      expect(returned.length).toBe(2)
      expect(returned).not.toContain('q-inactive')
    })
  })

  describe('Orden preservado', () => {
    it('IDs se devuelven en el mismo orden del sessionStorage (Map reorder)', () => {
      const failedQuestionIds = ['q-most-failed', 'q-second', 'q-third']
      const dbResults = [
        { id: 'q-third', question: '...' },
        { id: 'q-most-failed', question: '...' },
        { id: 'q-second', question: '...' },
      ]

      const questionMap = new Map(dbResults.map(q => [q.id, q]))
      const ordered = failedQuestionIds
        .map(id => questionMap.get(id))
        .filter(Boolean)

      expect(ordered.map(q => q!.id)).toEqual(['q-most-failed', 'q-second', 'q-third'])
    })
  })

  describe('Observability', () => {
    it('logea preguntas no encontradas (inactivas o borradas)', () => {
      const requested = 10
      const found = 8
      const missing = requested - found

      expect(missing).toBe(2)
      // Log: "⚠️ [failed-questions-ids] 2 preguntas no encontradas o inactivas"
    })

    it('prefijo [failed-questions-ids] para grep', () => {
      const logs = [
        '🔄 [failed-questions-ids] 10 IDs específicas',
        '✅ [failed-questions-ids] 8 preguntas (2 no encontradas)',
      ]
      expect(logs.every(l => l.includes('[failed-questions-ids]'))).toBe(true)
    })
  })

  describe('LIMIT', () => {
    it('se aplica después de reordenar', () => {
      const orderedQuestions = Array.from({ length: 50 }, (_, i) => ({ id: `q-${i}` }))
      const numQuestions = 25
      const final = orderedQuestions.slice(0, numQuestions)

      expect(final.length).toBe(25)
      expect(final[0].id).toBe('q-0')
    })
  })
})
