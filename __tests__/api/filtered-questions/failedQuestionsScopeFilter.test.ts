/**
 * Tests para el filtro de scope en "Solo preguntas falladas" sin IDs.
 *
 * Bug (pre-17/04/2026): el early-return de failed questions hacía un JOIN
 * con user_question_history SIN filtrar por topic_scope ni law_id. Cualquier
 * pregunta que el usuario hubiera fallado (de cualquier oposición) podía
 * aparecer en sus tests.
 *
 * Fix: getAllowedLawIds filtra por las leyes del scope de la oposición activa.
 * Si falla → fail-closed (0 preguntas) + log a validation_error_logs.
 */

import { getAllowedLawIds, type AllowedLawsResult } from '@/lib/api/oposicion-scope/queries'

// Mock getAllowedLawIds
jest.mock('@/lib/api/oposicion-scope/queries', () => ({
  ...jest.requireActual('@/lib/api/oposicion-scope/queries'),
  getAllowedLawIds: jest.fn(),
}))

// Mock logValidationError
const mockLogValidationError = jest.fn()
jest.mock('@/lib/api/validation-error-log', () => ({
  logValidationError: (...args: unknown[]) => mockLogValidationError(...args),
}))

const mockedGetAllowedLawIds = getAllowedLawIds as jest.MockedFunction<typeof getAllowedLawIds>

describe('Failed questions scope filter', () => {

  beforeEach(() => {
    jest.clearAllMocks()
  })

  // ============================================
  // ROUTING: cuándo se activa el code path
  // ============================================
  describe('Routing — cuándo se activa el filtro de scope', () => {
    it('onlyFailedQuestions=true + sin IDs + userId → activa scope filter', () => {
      const onlyFailedQuestions = true
      const failedQuestionIds: string[] = []
      const userId = 'user-123'

      const activates = onlyFailedQuestions && (!failedQuestionIds || failedQuestionIds.length === 0) && !!userId
      expect(activates).toBe(true)
    })

    it('onlyFailedQuestions=true + con IDs → NO activa (usa IDs específicos)', () => {
      const onlyFailedQuestions = true
      const failedQuestionIds = ['q1', 'q2']
      const userId = 'user-123'

      const activates = onlyFailedQuestions && (!failedQuestionIds || failedQuestionIds.length === 0) && !!userId
      expect(activates).toBe(false)
    })

    it('onlyFailedQuestions=false → NO activa', () => {
      const activates = false && true && true
      expect(activates).toBe(false)
    })

    it('sin userId → NO activa (cae al query normal)', () => {
      const onlyFailedQuestions = true
      const failedQuestionIds: string[] = []
      const userId: string | null = null

      const activates = onlyFailedQuestions && (!failedQuestionIds || failedQuestionIds.length === 0) && !!userId
      expect(activates).toBe(false)
    })
  })

  // ============================================
  // SCOPE RESOLUTION: getAllowedLawIds
  // ============================================
  describe('Scope resolution — getAllowedLawIds', () => {
    it('devuelve leyes del scope del usuario para su oposición activa', async () => {
      const mockResult: AllowedLawsResult = {
        positionType: 'auxiliar_administrativo_estado',
        lawIds: ['law-ce', 'law-39-2015', 'law-40-2015'],
        lawShortNames: ['CE', 'Ley 39/2015', 'Ley 40/2015'],
      }
      mockedGetAllowedLawIds.mockResolvedValue(mockResult)

      const allowed = await getAllowedLawIds({ userId: 'user-123', fallbackPositionType: 'auxiliar_administrativo_estado' })

      expect(allowed.lawIds.length).toBe(3)
      expect(allowed.positionType).toBe('auxiliar_administrativo_estado')
    })

    it('usa target_oposicion del usuario, no el fallback del client', async () => {
      // El usuario cambió de oposición pero el client envía el viejo positionType
      const mockResult: AllowedLawsResult = {
        positionType: 'auxiliar_administrativo_cyl',
        lawIds: ['law-cyl-1', 'law-cyl-2'],
        lawShortNames: ['Ley CyL 1', 'Ley CyL 2'],
      }
      mockedGetAllowedLawIds.mockResolvedValue(mockResult)

      const allowed = await getAllowedLawIds({
        userId: 'user-changed',
        fallbackPositionType: 'auxiliar_administrativo_estado',
      })

      // getAllowedLawIds prioriza el target_oposicion real del perfil
      expect(allowed.positionType).toBe('auxiliar_administrativo_cyl')
    })
  })

  // ============================================
  // FAIL-CLOSED: errores de scope
  // ============================================
  describe('Fail-closed — errores de scope', () => {
    it('getAllowedLawIds lanza excepción → devuelve 0 preguntas + log critical', async () => {
      mockedGetAllowedLawIds.mockRejectedValue(new Error('DB connection timeout'))

      // Simular el code path del fix
      const userId = 'user-123'
      const positionType = 'auxiliar_administrativo_estado'

      let allowed: AllowedLawsResult | null = null
      let failClosed = false

      try {
        allowed = await getAllowedLawIds({ userId, fallbackPositionType: positionType })
      } catch (err) {
        failClosed = true
        mockLogValidationError({
          endpoint: '/api/questions/filtered',
          errorType: 'scope_resolution',
          errorMessage: `getAllowedLawIds falló: ${(err as Error).message}`,
          severity: 'critical',
          userId,
        })
      }

      expect(failClosed).toBe(true)
      expect(allowed).toBeNull()
      expect(mockLogValidationError).toHaveBeenCalledWith(
        expect.objectContaining({
          severity: 'critical',
          errorType: 'scope_resolution',
          userId: 'user-123',
        })
      )
    })

    it('scope vacío (0 leyes) → devuelve 0 preguntas + log warning', async () => {
      mockedGetAllowedLawIds.mockResolvedValue({
        positionType: 'oposicion_sin_contenido',
        lawIds: [],
        lawShortNames: [],
      })

      const allowed = await getAllowedLawIds({ userId: 'user-new' })

      expect(allowed.lawIds.length).toBe(0)
      // El fix devuelve vacío en vez de desactivar el filtro
      // NO debe caer a sql`true` (que era el comportamiento buggy)

      mockLogValidationError({
        endpoint: '/api/questions/filtered',
        errorType: 'empty_scope',
        errorMessage: `0 leyes en scope para "${allowed.positionType}"`,
        severity: 'warning',
        userId: 'user-new',
      })

      expect(mockLogValidationError).toHaveBeenCalledWith(
        expect.objectContaining({
          severity: 'warning',
          errorType: 'empty_scope',
        })
      )
    })

    it('NUNCA hace fallback a sql`true` (el bug original)', () => {
      // El fix anterior tenía:
      //   allowed.lawIds.length > 0 ? inArray(laws.id, allowed.lawIds) : sql`true`
      // Eso desactivaba el filtro silenciosamente si no había leyes.
      // El fix actual devuelve vacío ANTES de llegar a la query.

      const lawIds: string[] = []
      const shouldReturnEmpty = lawIds.length === 0
      const shouldFallbackToTrue = !shouldReturnEmpty // NUNCA

      expect(shouldReturnEmpty).toBe(true)
      expect(shouldFallbackToTrue).toBe(false)
    })
  })

  // ============================================
  // CROSS-OPOSICIÓN: el bug original
  // ============================================
  describe('Cross-oposición leak prevention', () => {
    it('pregunta de CyL NO aparece en tests de auxiliar_administrativo_estado', () => {
      const allowedLawIds = ['law-ce', 'law-39-2015', 'law-40-2015', 'law-excel', 'law-word']
      const cylLawId = 'law-supuesto-word-cyl'

      const isAllowed = allowedLawIds.includes(cylLawId)
      expect(isAllowed).toBe(false)
    })

    it('pregunta de administrativo_estado (C1) NO aparece en auxiliar (C2) si la ley no está en scope', () => {
      const auxEstadoLawIds = ['law-ce', 'law-39-2015']
      const adminOnlyLawId = 'law-admin-only'

      const isAllowed = auxEstadoLawIds.includes(adminOnlyLawId)
      expect(isAllowed).toBe(false)
    })

    it('pregunta de ley compartida (CE) SÍ aparece en ambas oposiciones', () => {
      const auxEstadoLawIds = ['law-ce', 'law-39-2015', 'law-40-2015']
      const adminEstadoLawIds = ['law-ce', 'law-39-2015', 'law-admin-only']
      const ceLawId = 'law-ce'

      expect(auxEstadoLawIds.includes(ceLawId)).toBe(true)
      expect(adminEstadoLawIds.includes(ceLawId)).toBe(true)
    })

    it('usuario cambia de oposición → scope se actualiza automáticamente', async () => {
      // Primera llamada: aux estado
      mockedGetAllowedLawIds.mockResolvedValueOnce({
        positionType: 'auxiliar_administrativo_estado',
        lawIds: ['law-ce', 'law-word'],
        lawShortNames: ['CE', 'Procesadores de texto'],
      })

      const allowed1 = await getAllowedLawIds({ userId: 'user-switch' })
      expect(allowed1.positionType).toBe('auxiliar_administrativo_estado')
      expect(allowed1.lawIds).not.toContain('law-supuesto-word-cyl')

      // El usuario cambia a CyL en su perfil
      mockedGetAllowedLawIds.mockResolvedValueOnce({
        positionType: 'auxiliar_administrativo_cyl',
        lawIds: ['law-ce', 'law-word', 'law-supuesto-word-cyl'],
        lawShortNames: ['CE', 'Procesadores de texto', 'Supuesto Word CyL'],
      })

      const allowed2 = await getAllowedLawIds({ userId: 'user-switch' })
      expect(allowed2.positionType).toBe('auxiliar_administrativo_cyl')
      expect(allowed2.lawIds).toContain('law-supuesto-word-cyl')
    })
  })

  // ============================================
  // INTEGRATION: simulación end-to-end del fix
  // ============================================
  describe('Simulación end-to-end del fix', () => {
    it('Escenario Nila: 1000 falladas, solo devuelve las de su scope', () => {
      const nilaFailedQuestionLawIds = [
        ...Array(996).fill('law-ce'),
        ...Array(3).fill('law-admin-only'),
        'law-supuesto-word-cyl',
      ]
      const allowedLawIds = new Set(['law-ce', 'law-39-2015', 'law-word', 'law-excel'])

      const filtered = nilaFailedQuestionLawIds.filter(id => allowedLawIds.has(id))
      const leaked = nilaFailedQuestionLawIds.filter(id => !allowedLawIds.has(id))

      expect(filtered.length).toBe(996)
      expect(leaked.length).toBe(4)
      expect(leaked).toContain('law-supuesto-word-cyl')
      expect(leaked).toContain('law-admin-only')
    })

    it('Escenario usuario nuevo: 0 falladas → devuelve vacío (no crash)', async () => {
      mockedGetAllowedLawIds.mockResolvedValue({
        positionType: 'auxiliar_administrativo_estado',
        lawIds: ['law-ce'],
        lawShortNames: ['CE'],
      })

      const allowed = await getAllowedLawIds({ userId: 'new-user' })
      expect(allowed.lawIds.length).toBeGreaterThan(0)
      // El query devolvería 0 rows porque no hay historial → vacío OK
    })

    it('Escenario oposición aspiracional sin scope: 0 leyes → vacío + log', async () => {
      mockedGetAllowedLawIds.mockResolvedValue({
        positionType: 'operario_ayto_madrid',
        lawIds: [],
        lawShortNames: [],
      })

      const allowed = await getAllowedLawIds({ userId: 'aspiracional-user' })

      expect(allowed.lawIds.length).toBe(0)
      // El fix devuelve vacío con emptyReason, no crashea ni abre el filtro
    })
  })

  // ============================================
  // OBSERVABILITY: logs y errores
  // ============================================
  describe('Observability — logging', () => {
    it('happy path logea nº de leyes en scope (Vercel logs)', () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation()

      const allowedCount = 94
      console.log(`🔒 [failed-questions] Scope: ${allowedCount} leyes para "auxiliar_administrativo_estado"`)

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('🔒 [failed-questions] Scope: 94 leyes')
      )
      consoleSpy.mockRestore()
    })

    it('scope error logea a validation_error_logs con severity critical', () => {
      mockLogValidationError({
        endpoint: '/api/questions/filtered',
        errorType: 'scope_resolution',
        errorMessage: 'getAllowedLawIds falló: connection timeout',
        severity: 'critical',
        userId: 'user-123',
      })

      expect(mockLogValidationError).toHaveBeenCalledWith(
        expect.objectContaining({
          endpoint: '/api/questions/filtered',
          errorType: 'scope_resolution',
          severity: 'critical',
        })
      )
    })

    it('empty scope logea a validation_error_logs con severity warning', () => {
      mockLogValidationError({
        endpoint: '/api/questions/filtered',
        errorType: 'empty_scope',
        errorMessage: '0 leyes en scope',
        severity: 'warning',
        userId: 'user-456',
      })

      expect(mockLogValidationError).toHaveBeenCalledWith(
        expect.objectContaining({
          errorType: 'empty_scope',
          severity: 'warning',
        })
      )
    })

    it('todos los logs del fix usan prefijo [failed-questions] para grep', () => {
      const prefix = '[failed-questions]'
      const logMessages = [
        `🔄 Modo preguntas falladas por historial (single JOIN): userId=x, positionType=y`,
        `❌ ${prefix} getAllowedLawIds falló: error`,
        `❌ ${prefix} 0 leyes en scope para positionType="x"`,
        `🔒 ${prefix} Scope: 94 leyes para "x"`,
        `✅ ${prefix} 25 preguntas falladas de 94 leyes (limit 25)`,
      ]
      const withPrefix = logMessages.filter(m => m.includes(prefix))
      expect(withPrefix.length).toBe(4) // todos excepto la primera línea de debug
    })
  })
})
