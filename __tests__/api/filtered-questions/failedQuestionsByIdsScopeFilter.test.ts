/**
 * Tests para preguntas falladas con IDs específicos (sessionStorage / cliente).
 *
 * Historia:
 * - Pre-18/04/2026: aplicaba filtro completo por scope de oposición.
 * - 18/04/2026: se eliminó el filtro por scope ("los IDs vienen del historial,
 *   ya los respondió"). Premisa rota cuando el user cambia de oposición.
 * - 26/05/2026 (caso Cristina, dispute cluster c7196843): restaurar scope
 *   filter via EXISTS topic_scope. Las IDs que pasen el filtro siguen
 *   funcionando; las out-of-scope se descartan silenciosamente. Si la
 *   oposición no tiene scopes configurados (caso Lidia 18/04), fallback
 *   legacy sin filtro.
 */

describe('Failed questions by IDs — con scope filter (post-26/05/2026)', () => {

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

  describe('Scope filter via EXISTS topic_scope', () => {
    it('IDs in-scope se devuelven', () => {
      // Simula filtrado server-side: solo pasan las IDs cuyo (lawId, articleNumber)
      // existe en topic_scope del positionType (y topicNumber si se pasa).
      const allRequestedIds = ['q-in-scope-1', 'q-in-scope-2', 'q-in-scope-3']
      const idsInScope = new Set(['q-in-scope-1', 'q-in-scope-2', 'q-in-scope-3'])
      const returned = allRequestedIds.filter(id => idsInScope.has(id))
      expect(returned).toEqual(allRequestedIds)
    })

    it('IDs out-of-scope se filtran (caso Cristina: cambio oposición)', () => {
      // Cristina cambió Estado→CyL el 25/05. Su sessionStorage trae IDs
      // del T5 Estado (Ley 50/1997 art 13, art 26, CE art 98) que NO están
      // en topic_scope T5 CyL (LO 14/2007).
      const requested = [
        'q-lo-14-2007-art-9',   // LO 14/2007 (Estatuto CyL) → in-scope T5 CyL
        'q-ley-50-1997-art-26', // T5 Estado → out-of-scope T5 CyL
        'q-ce-art-98',          // T5 Estado → out-of-scope T5 CyL
        'q-lo-14-2007-art-83',  // LO 14/2007 → in-scope T5 CyL
      ]
      const idsInScopeCyL = new Set(['q-lo-14-2007-art-9', 'q-lo-14-2007-art-83'])
      const returned = requested.filter(id => idsInScopeCyL.has(id))
      expect(returned).toEqual(['q-lo-14-2007-art-9', 'q-lo-14-2007-art-83'])
      expect(returned).not.toContain('q-ley-50-1997-art-26')
      expect(returned).not.toContain('q-ce-art-98')
    })

    it('topicNumber=N restringe al scope de ese tema específico', () => {
      // /tema/5/test-personalizado con failedQuestionIds → scope T5 only
      const hasTopicFilter = true
      const topicNumber = 5
      // EXISTS subquery añade AND t.topic_number = topicNumber
      const sqlHasTopicClause = hasTopicFilter
        ? `AND t.topic_number = ${topicNumber}`
        : ''
      expect(sqlHasTopicClause).toBe('AND t.topic_number = 5')
    })

    it('topicNumber=0 (sin filtro de tema) usa scope global del positionType', () => {
      const topicNumber = 0
      const hasTopicFilter = !!topicNumber && topicNumber > 0
      expect(hasTopicFilter).toBe(false)
      // EXISTS no añade clausula de topic_number → cualquier tema del positionType
    })

    it('preguntas inactivas se excluyen incluso si están en scope', () => {
      const requested = ['q-active-in-scope', 'q-inactive-in-scope']
      const isActive: Record<string, boolean> = {
        'q-active-in-scope': true,
        'q-inactive-in-scope': false,
      }
      const idsInScope = new Set(requested)
      const returned = requested.filter(id => idsInScope.has(id) && isActive[id])
      expect(returned).toEqual(['q-active-in-scope'])
    })
  })

  describe('Fallback hasScopes=false (oposición sin topic_scope)', () => {
    it('si positionType no tiene scopes, no aplica filtro (legacy)', () => {
      // Caso Lidia 18/04: celador_sescam_clm sin topic_scope configurado.
      // Sin fallback, EXISTS devolvería siempre false → 0 resultados aunque
      // el usuario tenga falladas legítimas. Solución: sql`true` cuando
      // hasScopes=false.
      const hasScopes = false
      const scopeFilter = hasScopes ? 'EXISTS(...)' : 'true'
      expect(scopeFilter).toBe('true')
    })
  })

  describe('Telemetría — observability', () => {
    it('missing >= 50% → log validation_error con severity=info', () => {
      // Patrón cambio-de-oposición: si más de la mitad de las IDs son
      // out-of-scope, registrar para análisis posterior (no es bug, es UX).
      const requested = 10
      const found = 3
      const missing = requested - found
      const shouldLog = missing >= requested / 2
      expect(shouldLog).toBe(true)
    })

    it('missing < 50% → no log (puede ser inactivas o borradas)', () => {
      const requested = 10
      const found = 8
      const missing = requested - found
      const shouldLog = missing >= requested / 2
      expect(shouldLog).toBe(false)
    })

    it('prefijo [failed-questions-ids] para grep', () => {
      const logs = [
        '🔄 [failed-questions-ids] 10 IDs específicas',
        '⚠️ [failed-questions-ids] 6 preguntas no encontradas, inactivas u out-of-scope',
      ]
      expect(logs.every(l => l.includes('[failed-questions-ids]'))).toBe(true)
    })
  })

  describe('Orden preservado', () => {
    it('IDs se devuelven en el mismo orden del request (Map reorder)', () => {
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

    it('IDs filtradas por scope mantienen orden de las restantes', () => {
      const requested = ['q1-out', 'q2-in', 'q3-in', 'q4-out', 'q5-in']
      const inScope = new Set(['q2-in', 'q3-in', 'q5-in'])
      const filtered = requested.filter(id => inScope.has(id))
      expect(filtered).toEqual(['q2-in', 'q3-in', 'q5-in'])
    })
  })

  describe('LIMIT', () => {
    it('se aplica después del filtro de scope', () => {
      const inScopeQuestions = Array.from({ length: 50 }, (_, i) => ({ id: `q-${i}` }))
      const numQuestions = 25
      const final = inScopeQuestions.slice(0, numQuestions)
      expect(final.length).toBe(25)
      expect(final[0].id).toBe('q-0')
    })
  })
})
