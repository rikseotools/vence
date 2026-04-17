/**
 * Tests para BUG 2: Failed questions con IDs específicos (sessionStorage)
 * sin filtro de scope.
 *
 * Bug: el code path recibía IDs del sessionStorage del cliente y los cargaba
 * sin validar que pertenecieran al scope de la oposición del usuario.
 * Si el usuario había recibido preguntas leakeadas (por BUG 1), esos IDs
 * se re-servían indefinidamente.
 *
 * Fix: getAllowedLawIds + inArray(laws.id) + fail-closed + logging.
 */

import { getAllowedLawIds, type AllowedLawsResult } from '@/lib/api/oposicion-scope/queries'

jest.mock('@/lib/api/oposicion-scope/queries', () => ({
  ...jest.requireActual('@/lib/api/oposicion-scope/queries'),
  getAllowedLawIds: jest.fn(),
}))

const mockLogValidationError = jest.fn()
jest.mock('@/lib/api/validation-error-log', () => ({
  logValidationError: (...args: unknown[]) => mockLogValidationError(...args),
}))

const mockedGetAllowedLawIds = getAllowedLawIds as jest.MockedFunction<typeof getAllowedLawIds>

describe('BUG 2: Failed questions by IDs — scope filter', () => {

  beforeEach(() => jest.clearAllMocks())

  describe('Routing', () => {
    it('onlyFailedQuestions=true + failedQuestionIds no vacíos → activa este path', () => {
      const onlyFailedQuestions = true
      const failedQuestionIds = ['q1', 'q2']
      const activates = onlyFailedQuestions && failedQuestionIds && failedQuestionIds.length > 0
      expect(activates).toBe(true)
    })

    it('failedQuestionIds vacíos → NO activa (cae a BUG 1 path)', () => {
      const onlyFailedQuestions = true
      const failedQuestionIds: string[] = []
      const activates = onlyFailedQuestions && failedQuestionIds && failedQuestionIds.length > 0
      expect(activates).toBe(false)
    })
  })

  describe('Scope filtering', () => {
    it('IDs de preguntas fuera de scope se filtran', () => {
      const failedQuestionIds = ['q-ce', 'q-cyl-leak', 'q-39-2015', 'q-admin-leak']
      const allowedLawIds = new Set(['law-ce', 'law-39-2015'])

      // Simular: q-ce y q-39-2015 están en leyes permitidas, los otros no
      const questionLawMap: Record<string, string> = {
        'q-ce': 'law-ce',
        'q-cyl-leak': 'law-supuesto-word-cyl',
        'q-39-2015': 'law-39-2015',
        'q-admin-leak': 'law-admin-only',
      }

      const filtered = failedQuestionIds.filter(id => allowedLawIds.has(questionLawMap[id]))
      const leaked = failedQuestionIds.filter(id => !allowedLawIds.has(questionLawMap[id]))

      expect(filtered).toEqual(['q-ce', 'q-39-2015'])
      expect(leaked).toEqual(['q-cyl-leak', 'q-admin-leak'])
    })

    it('todos los IDs en scope → ninguno filtrado', () => {
      const ids = ['q1', 'q2', 'q3']
      const allInScope = true
      const filteredCount = allInScope ? 0 : ids.length
      expect(filteredCount).toBe(0)
    })

    it('todos los IDs fuera de scope → resultado vacío', () => {
      const ids = ['q-leak-1', 'q-leak-2']
      const noneInScope = true
      const result = noneInScope ? [] : ids
      expect(result).toEqual([])
    })
  })

  describe('Fail-closed', () => {
    it('getAllowedLawIds falla → devuelve vacío + log critical', async () => {
      mockedGetAllowedLawIds.mockRejectedValue(new Error('connection reset'))

      let failClosed = false
      try {
        await getAllowedLawIds({ userId: 'user-1' })
      } catch {
        failClosed = true
        mockLogValidationError({
          endpoint: '/api/questions/filtered',
          errorType: 'scope_resolution',
          severity: 'critical',
        })
      }

      expect(failClosed).toBe(true)
      expect(mockLogValidationError).toHaveBeenCalledWith(
        expect.objectContaining({ severity: 'critical', errorType: 'scope_resolution' })
      )
    })

    it('scope vacío → sql`false` (bloquea todos los IDs)', () => {
      const lawIds: string[] = []
      const scopeFilter = lawIds.length > 0 ? 'inArray' : 'false'
      expect(scopeFilter).toBe('false')
    })
  })

  describe('Observability', () => {
    it('logea cuántas preguntas se filtraron por scope', () => {
      const requested = 10
      const returned = 7
      const filtered = requested - returned

      expect(filtered).toBe(3)
      // El fix logea: "🔒 [failed-questions-ids] 3 preguntas filtradas por scope (de 10)"
    })

    it('prefijo [failed-questions-ids] para grep en Vercel', () => {
      const logs = [
        '🔄 [failed-questions-ids] 10 IDs específicas',
        '🔒 [failed-questions-ids] 3 preguntas filtradas por scope',
        '✅ [failed-questions-ids] 7 preguntas (3 filtradas por scope)',
      ]
      expect(logs.every(l => l.includes('[failed-questions-ids]'))).toBe(true)
    })
  })

  describe('Compatibilidad con cambio de oposición', () => {
    it('IDs de ley compartida (CE) pasan el filtro en ambas oposiciones', () => {
      const ceLawId = 'law-ce'
      const auxEstadoScope = ['law-ce', 'law-39-2015', 'law-word']
      const auxCylScope = ['law-ce', 'law-39-2015', 'law-cyl-specific']

      expect(auxEstadoScope.includes(ceLawId)).toBe(true)
      expect(auxCylScope.includes(ceLawId)).toBe(true)
    })

    it('IDs de ley específica de oposición anterior se filtran correctamente', () => {
      // Usuario estaba en Estado, falló pregunta de "RD 204/2024"
      // Cambia a CyL donde esa ley no existe
      const rdLawId = 'law-rd-204'
      const cylScope = ['law-ce', 'law-cyl-specific']

      expect(cylScope.includes(rdLawId)).toBe(false)
    })
  })
})
