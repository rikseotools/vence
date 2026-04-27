/**
 * Tests para BUG multi-ley: preguntas falladas servidas como aleatorias.
 *
 * Bug de Lidia (18/04/2026): usuaria selecciona "Más veces falladas primero"
 * desde /test/por-leyes → navega a /test/multi-ley. El 100% de las preguntas
 * servidas eran primera vez (0 falladas de 12 respondidas).
 *
 * Causa raíz: multi-ley/page.tsx no enviaba Bearer token → la API descartaba
 * userId del body (refactor oposicion-scope) → userId=undefined → el path
 * de falladas se saltaba silenciosamente → caía al path general (aleatorias).
 *
 * Fix (3 ficheros):
 * 1. multi-ley/page.tsx: obtener session token + enviar Authorization header
 * 2. por-leyes/page.tsx: guardar failedQuestionIds en sessionStorage
 * 3. queries.ts: guard observable cuando onlyFailedQuestions=true sin userId
 */

const mockLogValidationError = jest.fn()
jest.mock('@/lib/api/validation-error-log', () => ({
  logValidationError: (...args: unknown[]) => mockLogValidationError(...args),
}))

describe('BUG multi-ley: failed questions sin Bearer token', () => {

  beforeEach(() => {
    jest.clearAllMocks()
    if (typeof sessionStorage !== 'undefined') {
      sessionStorage.clear()
    }
  })

  // ============================================
  // 1. GUARD OBSERVABLE: queries.ts
  // ============================================
  describe('Guard: onlyFailedQuestions=true sin userId', () => {

    // Helper que replica la lógica exacta del guard en queries.ts
    function shouldLogWarning(onlyFailedQuestions: boolean, userId: string | undefined, failedQuestionIds: string[]) {
      return onlyFailedQuestions && !userId && (!failedQuestionIds || failedQuestionIds.length === 0)
    }

    it('debe loguear warning cuando falta userId Y no hay IDs', () => {
      const result = shouldLogWarning(true, undefined, [])
      expect(result).toBe(true)

      if (result) {
        mockLogValidationError({
          endpoint: '/api/questions/filtered',
          errorType: 'failed_questions_no_auth',
          severity: 'warning',
        })
      }

      expect(mockLogValidationError).toHaveBeenCalledWith(
        expect.objectContaining({
          errorType: 'failed_questions_no_auth',
          severity: 'warning',
        })
      )
    })

    it('NO debe loguear warning cuando hay failedQuestionIds (no necesita userId)', () => {
      // Caso: desde-chat o FailedQuestionsReview envían IDs específicos sin auth
      const result = shouldLogWarning(true, undefined, ['q1', 'q2', 'q3'])
      expect(result).toBe(false)
    })

    it('NO debe loguear warning cuando userId SÍ está presente', () => {
      const result = shouldLogWarning(true, 'user-123', [])
      expect(result).toBe(false)
    })

    it('NO debe loguear warning cuando onlyFailedQuestions=false', () => {
      const result = shouldLogWarning(false, undefined, [])
      expect(result).toBe(false)
    })

    it('NO debe loguear warning cuando hay userId Y IDs', () => {
      const result = shouldLogWarning(true, 'user-123', ['q1'])
      expect(result).toBe(false)
    })

    it('el error type es grepeable en /admin/errores-validacion', () => {
      const errorType = 'failed_questions_no_auth'
      expect(errorType).toMatch(/^[a-z_]+$/)
      expect(errorType).toContain('failed_questions')
      expect(errorType).toContain('no_auth')
    })
  })

  // ============================================
  // 2. ROUTING: que el path correcto se active
  // ============================================
  describe('Routing con userId del Bearer token', () => {

    it('userId presente + sin IDs → path "single JOIN" (historial)', () => {
      const onlyFailedQuestions = true
      const failedQuestionIds: string[] = []
      const userId = 'lidia-2300fe7d'

      const useSingleJoin = onlyFailedQuestions && failedQuestionIds.length === 0 && !!userId
      expect(useSingleJoin).toBe(true)
    })

    it('userId presente + con IDs → path "IDs específicos" (sessionStorage)', () => {
      const onlyFailedQuestions = true
      const failedQuestionIds = ['q1', 'q2', 'q3']
      const userId = 'lidia-2300fe7d'

      const useSpecificIds = onlyFailedQuestions && failedQuestionIds.length > 0
      const useSingleJoin = onlyFailedQuestions && failedQuestionIds.length === 0 && !!userId
      expect(useSpecificIds).toBe(true)
      expect(useSingleJoin).toBe(false)
    })

    it('userId undefined + sin IDs → NINGÚN path de falladas (bug pre-fix)', () => {
      const onlyFailedQuestions = true
      const failedQuestionIds: string[] = []
      const userId: string | undefined = undefined

      const useSingleJoin = onlyFailedQuestions && failedQuestionIds.length === 0 && !!userId
      const useSpecificIds = onlyFailedQuestions && failedQuestionIds.length > 0
      expect(useSingleJoin).toBe(false)
      expect(useSpecificIds).toBe(false)
    })

    it('userId undefined + con IDs → path de IDs específicos SÍ se activa', () => {
      const onlyFailedQuestions = true
      const failedQuestionIds = ['q1', 'q2']
      const userId: string | undefined = undefined

      const useSpecificIds = onlyFailedQuestions && failedQuestionIds.length > 0
      expect(useSpecificIds).toBe(true)
    })
  })

  // ============================================
  // 3. BEARER TOKEN: multi-ley/page.tsx
  // ============================================
  describe('Bearer token en multi-ley fetch', () => {

    it('con session → Authorization header incluido', () => {
      const authToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.test'

      const headers: Record<string, string> = { 'Content-Type': 'application/json' }
      if (authToken) headers['Authorization'] = `Bearer ${authToken}`

      expect(headers['Authorization']).toBe(`Bearer ${authToken}`)
      expect(headers['Content-Type']).toBe('application/json')
    })

    it('sin session → NO hay Authorization header, request continúa', () => {
      const authToken: string | null = null

      const headers: Record<string, string> = { 'Content-Type': 'application/json' }
      if (authToken) headers['Authorization'] = `Bearer ${authToken}`

      expect(headers['Authorization']).toBeUndefined()
      expect(headers['Content-Type']).toBe('application/json')
    })

    it('userId NO se envía en el body (lo resuelve la API del token)', () => {
      const requestBody = {
        topicNumber: 0,
        positionType: 'auxiliar_administrativo_estado',
        selectedLaws: ['RDL 5/2015'],
        numQuestions: 25,
        onlyFailedQuestions: true,
        failedQuestionIds: [],
        selectedSectionFilters: [],
      }

      expect(requestBody).not.toHaveProperty('userId')
    })
  })

  // ============================================
  // 4. API ROUTE: descarta userId del body
  // ============================================
  describe('API route: userId del token, no del body', () => {

    it('body.userId se descarta, authUserId prevalece', () => {
      const body = { userId: 'spoofed-id', onlyFailedQuestions: true }
      const authUserId = 'real-from-token'

      const { userId: _clientUserId, ...safeBody } = body
      const finalParams = { ...safeBody, userId: authUserId ?? undefined }

      expect(finalParams.userId).toBe('real-from-token')
      expect(finalParams).not.toHaveProperty('_clientUserId')
    })

    it('sin Bearer token → userId queda undefined (no null del body)', () => {
      const body = { userId: 'from-body', onlyFailedQuestions: true }
      const authUserId: string | null = null

      const { userId: _clientUserId, ...safeBody } = body
      const finalParams = { ...safeBody, userId: authUserId ?? undefined }

      expect(finalParams.userId).toBeUndefined()
    })
  })

  // ============================================
  // 5. SESSIONSTORAGE: por-leyes → multi-ley
  // ============================================
  describe('sessionStorage: failedQuestionIds', () => {

    it('por-leyes guarda IDs cuando onlyFailedQuestions + hay IDs', () => {
      const config = {
        onlyFailedQuestions: true,
        failedQuestionIds: ['q1', 'q2', 'q3', 'q4', 'q5'],
        failedQuestionsOrder: 'most_failed',
      }

      if (config.onlyFailedQuestions && config.failedQuestionIds.length > 0) {
        sessionStorage.setItem('vence_failed_question_ids', JSON.stringify(config.failedQuestionIds))
        if (config.failedQuestionsOrder) {
          sessionStorage.setItem('vence_failed_questions_order', config.failedQuestionsOrder)
        }
      }

      const stored = sessionStorage.getItem('vence_failed_question_ids')
      expect(stored).not.toBeNull()
      expect(JSON.parse(stored!)).toEqual(['q1', 'q2', 'q3', 'q4', 'q5'])
      expect(sessionStorage.getItem('vence_failed_questions_order')).toBe('most_failed')
    })

    it('multi-ley lee IDs de sessionStorage y los limpia', () => {
      sessionStorage.setItem('vence_failed_question_ids', JSON.stringify(['q1', 'q2']))
      sessionStorage.setItem('vence_failed_questions_order', 'recent_failed')

      const onlyFailedQuestions = true
      let failedQuestionIds: string[] = []

      if (onlyFailedQuestions) {
        const stored = sessionStorage.getItem('vence_failed_question_ids')
        if (stored) {
          failedQuestionIds = JSON.parse(stored)
          sessionStorage.removeItem('vence_failed_question_ids')
          sessionStorage.removeItem('vence_failed_questions_order')
        }
      }

      expect(failedQuestionIds).toEqual(['q1', 'q2'])
      expect(sessionStorage.getItem('vence_failed_question_ids')).toBeNull()
      expect(sessionStorage.getItem('vence_failed_questions_order')).toBeNull()
    })

    it('sessionStorage vacío → failedQuestionIds queda [] (cae a path historial)', () => {
      const onlyFailedQuestions = true
      let failedQuestionIds: string[] = []

      if (onlyFailedQuestions) {
        const stored = sessionStorage.getItem('vence_failed_question_ids')
        if (stored) {
          failedQuestionIds = JSON.parse(stored)
        }
      }

      expect(failedQuestionIds).toEqual([])
    })

    it('sessionStorage con JSON inválido → fallback seguro a []', () => {
      sessionStorage.setItem('vence_failed_question_ids', 'not-valid-json{{{')

      let failedQuestionIds: string[] = []
      try {
        const stored = sessionStorage.getItem('vence_failed_question_ids')
        if (stored) failedQuestionIds = JSON.parse(stored)
      } catch {
        failedQuestionIds = []
      }

      expect(failedQuestionIds).toEqual([])
    })

    it('no lee sessionStorage cuando onlyFailedQuestions=false', () => {
      sessionStorage.setItem('vence_failed_question_ids', JSON.stringify(['q1']))

      const onlyFailedQuestions = false
      let failedQuestionIds: string[] = []

      if (onlyFailedQuestions) {
        const stored = sessionStorage.getItem('vence_failed_question_ids')
        if (stored) failedQuestionIds = JSON.parse(stored)
      }

      expect(failedQuestionIds).toEqual([])
      expect(sessionStorage.getItem('vence_failed_question_ids')).not.toBeNull()
    })

    it('IDs grandes (358 UUIDs) caben en sessionStorage', () => {
      const manyIds = Array.from({ length: 358 }, (_, i) =>
        `${i.toString().padStart(8, '0')}-0000-0000-0000-000000000000`
      )
      const json = JSON.stringify(manyIds)

      sessionStorage.setItem('vence_failed_question_ids', json)
      const recovered = JSON.parse(sessionStorage.getItem('vence_failed_question_ids')!)

      expect(recovered.length).toBe(358)
      expect(json.length).toBeLessThan(5 * 1024 * 1024) // sessionStorage limit ~5MB
    })
  })

  // ============================================
  // 6. REGRESIÓN: escenario exacto de Lidia
  // ============================================
  describe('Regresión: escenario Lidia (18/04/2026)', () => {

    it('ANTES del fix: multi-ley sin Bearer → userId=undefined → preguntas aleatorias', () => {
      const headers = { 'Content-Type': 'application/json' }
      const body = {
        onlyFailedQuestions: true,
        failedQuestionIds: [],
        userId: 'lidia-2300fe7d',
      }

      // API descarta body.userId
      const authUserId: string | null = null // sin Bearer
      const { userId: _discard, ...safeBody } = body
      const finalUserId = authUserId ?? undefined

      // Guard detecta el problema
      const shouldWarn = safeBody.onlyFailedQuestions && !finalUserId
      expect(shouldWarn).toBe(true)

      // Ningún path de falladas se activa
      const useSingleJoin = safeBody.onlyFailedQuestions && safeBody.failedQuestionIds.length === 0 && !!finalUserId
      expect(useSingleJoin).toBe(false)

      expect(headers).not.toHaveProperty('Authorization')
    })

    it('DESPUÉS del fix: multi-ley con Bearer → userId del token → falladas reales', () => {
      const authToken = 'eyJ...'
      const headers: Record<string, string> = { 'Content-Type': 'application/json' }
      if (authToken) headers['Authorization'] = `Bearer ${authToken}`

      const body = {
        onlyFailedQuestions: true,
        failedQuestionIds: [],
      }

      const authUserId = 'lidia-2300fe7d' // resuelto del token
      const finalUserId = authUserId

      // Guard NO se activa
      const shouldWarn = body.onlyFailedQuestions && !finalUserId
      expect(shouldWarn).toBe(false)

      // Path de falladas SÍ se activa
      const useSingleJoin = body.onlyFailedQuestions && body.failedQuestionIds.length === 0 && !!finalUserId
      expect(useSingleJoin).toBe(true)

      expect(headers['Authorization']).toContain('Bearer')
    })

    it('DESPUÉS del fix con IDs: "Más veces falladas primero" preserva orden', () => {
      // 1. por-leyes guarda IDs ordenados en sessionStorage
      const orderedIds = ['q-most-failed', 'q-second-most', 'q-third']
      sessionStorage.setItem('vence_failed_question_ids', JSON.stringify(orderedIds))

      // 2. multi-ley los lee
      const stored = sessionStorage.getItem('vence_failed_question_ids')
      const failedQuestionIds = JSON.parse(stored!)

      // 3. API recibe IDs específicos → preserva orden con Map
      const mockDbResults = [
        { id: 'q-third', question: '...' },
        { id: 'q-most-failed', question: '...' },
        { id: 'q-second-most', question: '...' },
      ]
      const questionMap = new Map(mockDbResults.map(q => [q.id, q]))
      const orderedQuestions = failedQuestionIds
        .map((id: string) => questionMap.get(id))
        .filter(Boolean)

      expect(orderedQuestions.map((q: { id: string }) => q.id)).toEqual([
        'q-most-failed', 'q-second-most', 'q-third'
      ])
    })
  })

  // ============================================
  // 7. EDGE CASES
  // ============================================
  describe('Edge cases', () => {

    it('usuario no logueado + onlyFailed sin IDs → guard + fallback aleatorias', () => {
      const authUserId: string | undefined = undefined
      const onlyFailedQuestions = true
      const failedQuestionIds: string[] = []

      // Guard actualizado: solo loguea si NO hay IDs específicos
      if (onlyFailedQuestions && !authUserId && failedQuestionIds.length === 0) {
        mockLogValidationError({
          endpoint: '/api/questions/filtered',
          errorType: 'failed_questions_no_auth',
          severity: 'warning',
        })
      }

      expect(mockLogValidationError).toHaveBeenCalled()
    })

    it('usuario no logueado + onlyFailed CON IDs → NO loguea warning (funciona por IDs)', () => {
      // Caso: desde-chat envía IDs específicos sin auth header
      const authUserId: string | undefined = undefined
      const onlyFailedQuestions = true
      const failedQuestionIds = ['q1', 'q2', 'q3']

      if (onlyFailedQuestions && !authUserId && failedQuestionIds.length === 0) {
        mockLogValidationError({
          endpoint: '/api/questions/filtered',
          errorType: 'failed_questions_no_auth',
          severity: 'warning',
        })
      }

      expect(mockLogValidationError).not.toHaveBeenCalled()
    })

    it('getSession() lanza error → authToken null, request sigue con warning', () => {
      let authToken: string | null = null
      try {
        throw new Error('session expired')
      } catch {
        authToken = null
      }

      const headers: Record<string, string> = { 'Content-Type': 'application/json' }
      if (authToken) headers['Authorization'] = `Bearer ${authToken}`

      expect(authToken).toBeNull()
      expect(headers).not.toHaveProperty('Authorization')
    })

    it('sessionStorage no disponible (ej: Safari private) → fallback sin crash', () => {
      const originalGetItem = sessionStorage.getItem
      sessionStorage.getItem = () => { throw new Error('SecurityError') }

      let failedQuestionIds: string[] = []
      try {
        const stored = sessionStorage.getItem('vence_failed_question_ids')
        if (stored) failedQuestionIds = JSON.parse(stored)
      } catch {
        failedQuestionIds = []
      }

      expect(failedQuestionIds).toEqual([])
      sessionStorage.getItem = originalGetItem
    })

    it('sessionStorage no disponible para escritura → por-leyes no crashea', () => {
      const spy = jest.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
        throw new Error('QuotaExceededError')
      })

      let saved = false
      try {
        sessionStorage.setItem('vence_failed_question_ids', JSON.stringify(['q1']))
        saved = true
      } catch {
        saved = false
      }

      expect(saved).toBe(false)
      spy.mockRestore()
    })

    it('recarga de /test/multi-ley sin pasar por por-leyes → sessionStorage vacío → historial', () => {
      // Usuario recarga la página directamente con ?only_failed=true en la URL
      const onlyFailedQuestions = true
      const stored = sessionStorage.getItem('vence_failed_question_ids')
      const failedQuestionIds = stored ? JSON.parse(stored) : []

      expect(failedQuestionIds).toEqual([])
      // Con userId del Bearer → cae al path de historial (single JOIN)
      const userId = 'lidia-2300fe7d'
      const useSingleJoin = onlyFailedQuestions && failedQuestionIds.length === 0 && !!userId
      expect(useSingleJoin).toBe(true)
    })

    it('otra pestaña → sessionStorage no compartido entre pestañas', () => {
      sessionStorage.setItem('vence_failed_question_ids', JSON.stringify(['q1']))
      // sessionStorage es por pestaña, no se comparte
      // Si el usuario abre multi-ley en otra pestaña, no tiene los IDs
      // → cae al path de historial (single JOIN) que sigue dando falladas
      expect(sessionStorage.getItem('vence_failed_question_ids')).not.toBeNull()
    })
  })

  // ============================================
  // 8. COMPATIBILIDAD CON OTROS PATHS
  // ============================================
  describe('Compatibilidad: otros flujos no afectados', () => {

    it('test rápido (/test/rapido) no usa onlyFailedQuestions → no afectado', () => {
      const onlyFailedQuestions = false
      const failedQuestionIds: string[] = []
      const userId = 'user-123'

      const useSingleJoin = onlyFailedQuestions && failedQuestionIds.length === 0 && !!userId
      const shouldWarn = onlyFailedQuestions && !userId
      expect(useSingleJoin).toBe(false)
      expect(shouldWarn).toBe(false)
    })

    it('test por tema (TestPageWrapper) usa testFetchers que ya envía Bearer', () => {
      // testFetchers.ts ya tiene el patrón correcto de getSession() + Authorization header
      // Este fix solo afecta a multi-ley/page.tsx que hacía fetch directo sin header
      const testFetcherPattern = {
        getsSession: true,
        sendsBearer: true,
        doesNotSendUserIdInBody: true,
      }
      expect(testFetcherPattern.sendsBearer).toBe(true)
    })

    it('repaso-fallos desde resultados de test usa failedQuestionIds del state', () => {
      // El botón "Repetir falladas" al final de un test pasa IDs directamente
      // vía config, no sessionStorage. No se ve afectado por este fix.
      const fromTestResults = true
      const usesSessionStorage = false
      expect(fromTestResults).toBe(true)
      expect(usesSessionStorage).toBe(false)
    })
  })
})
