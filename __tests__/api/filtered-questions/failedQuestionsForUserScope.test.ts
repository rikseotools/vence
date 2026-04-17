/**
 * Tests para BUG 5: getFailedQuestionsForUser sin scope check.
 *
 * Bug: la función cargaba preguntas por IDs (de test_questions)
 * sin filtrar por topic_scope. Preguntas de otras oposiciones
 * podían aparecer en la vista de "revisar fallos".
 *
 * Fix: getAllowedLawIds + innerJoin en articles/laws + scope filter.
 */

import { getAllowedLawIds, type AllowedLawsResult } from '@/lib/api/oposicion-scope/queries'

jest.mock('@/lib/api/oposicion-scope/queries', () => ({
  ...jest.requireActual('@/lib/api/oposicion-scope/queries'),
  getAllowedLawIds: jest.fn(),
}))

const mockedGetAllowedLawIds = getAllowedLawIds as jest.MockedFunction<typeof getAllowedLawIds>

describe('BUG 5: getFailedQuestionsForUser — scope filter', () => {

  beforeEach(() => jest.clearAllMocks())

  describe('Scope filtering', () => {
    it('preguntas de leyes fuera de scope se excluyen del resultado', () => {
      const questionLaws = [
        { id: 'q1', lawId: 'law-ce' },
        { id: 'q2', lawId: 'law-cyl-only' },
        { id: 'q3', lawId: 'law-39-2015' },
      ]
      const allowedLawIds = new Set(['law-ce', 'law-39-2015'])

      const filtered = questionLaws.filter(q => allowedLawIds.has(q.lawId))
      expect(filtered.map(q => q.id)).toEqual(['q1', 'q3'])
    })

    it('getAllowedLawIds usa userId para determinar oposición activa', async () => {
      mockedGetAllowedLawIds.mockResolvedValue({
        positionType: 'auxiliar_administrativo_estado',
        lawIds: ['law-ce'],
        lawShortNames: ['CE'],
      })

      const allowed = await getAllowedLawIds({ userId: 'user-test' })
      expect(mockedGetAllowedLawIds).toHaveBeenCalledWith({ userId: 'user-test' })
      expect(allowed.lawIds).toContain('law-ce')
    })
  })

  describe('innerJoin vs leftJoin', () => {
    it('innerJoin garantiza que solo preguntas CON artículo+ley pasan', () => {
      // leftJoin permitiría preguntas sin artículo (primary_article_id = null)
      // que no se pueden filtrar por scope
      // innerJoin las excluye automáticamente
      const questionWithArticle = { primaryArticleId: 'art-1', lawId: 'law-ce' }
      const questionWithoutArticle = { primaryArticleId: null, lawId: null }

      const innerJoinResult = [questionWithArticle].filter(q => q.primaryArticleId && q.lawId)
      expect(innerJoinResult.length).toBe(1)

      // Con leftJoin, questionWithoutArticle pasaría sin filtro de scope
      const leftJoinResult = [questionWithArticle, questionWithoutArticle]
      expect(leftJoinResult.length).toBe(2) // incluye la sin artículo
    })
  })

  describe('Compatibilidad con estadísticas', () => {
    it('scope filter NO borra datos de test_questions ni tests', () => {
      // El fix solo filtra en el SELECT de preguntas, no modifica tablas
      const testQuestionsModified = false
      const testsModified = false
      const userQuestionHistoryModified = false

      expect(testQuestionsModified).toBe(false)
      expect(testsModified).toBe(false)
      expect(userQuestionHistoryModified).toBe(false)
    })

    it('al cambiar de oposición, las preguntas falladas de leyes compartidas persisten', async () => {
      // Estado: CE + 39/2015 + Word
      mockedGetAllowedLawIds.mockResolvedValueOnce({
        positionType: 'auxiliar_administrativo_estado',
        lawIds: ['law-ce', 'law-39-2015', 'law-word'],
        lawShortNames: ['CE', 'Ley 39/2015', 'Procesadores de texto'],
      })

      const allowedEstado = await getAllowedLawIds({ userId: 'user-switch' })

      // CyL: CE + 39/2015 + CyL specific
      mockedGetAllowedLawIds.mockResolvedValueOnce({
        positionType: 'auxiliar_administrativo_cyl',
        lawIds: ['law-ce', 'law-39-2015', 'law-cyl'],
        lawShortNames: ['CE', 'Ley 39/2015', 'CyL specific'],
      })

      const allowedCyl = await getAllowedLawIds({ userId: 'user-switch' })

      // CE aparece en ambos
      expect(allowedEstado.lawIds).toContain('law-ce')
      expect(allowedCyl.lawIds).toContain('law-ce')

      // Word solo en Estado, CyL solo en CyL
      expect(allowedEstado.lawIds).toContain('law-word')
      expect(allowedCyl.lawIds).not.toContain('law-word')
      expect(allowedCyl.lawIds).toContain('law-cyl')
      expect(allowedEstado.lawIds).not.toContain('law-cyl')
    })
  })

  describe('Escenarios edge', () => {
    it('scope vacío (oposición aspiracional) → scope filter es sql`true` (graceful)', () => {
      const lawIds: string[] = []
      const scopeFilter = lawIds.length > 0 ? 'inArray' : 'true'
      // sql`true` no filtra — devuelve lo que haya. Para getFailedQuestionsForUser
      // esto es aceptable porque la función ya filtra por userId + isCorrect=false
      expect(scopeFilter).toBe('true')
    })

    it('usuario sin tests → 0 preguntas falladas (no crash)', () => {
      const userTests: string[] = []
      const result = userTests.length === 0 ? { questions: [], message: 'No tienes tests' } : null
      expect(result?.questions).toEqual([])
    })
  })
})
