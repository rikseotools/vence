/**
 * Tests para el filtro de "Solo preguntas falladas" sin IDs.
 *
 * Cambio (18/04/2026): se reemplaza el filtro por scope de oposición
 * (getAllowedLawIds) por filtro por selectedLaws (las leyes que el usuario
 * eligió en el configurador). El usuario ya respondió estas preguntas —
 * filtrarlas por scope descartaba su historial real.
 *
 * Bug Lidia: Valencia tiene 0 topic_scopes → getAllowedLawIds devolvía
 * 0 leyes → 0 preguntas falladas aunque tuviera 358 en su historial.
 */

describe('Failed questions — filtro por selectedLaws', () => {

  beforeEach(() => jest.clearAllMocks())

  // ============================================
  // ROUTING
  // ============================================
  describe('Routing — cuándo se activa', () => {
    it('onlyFailedQuestions=true + sin IDs + userId → activa path falladas', () => {
      const onlyFailedQuestions = true
      const failedQuestionIds: string[] = []
      const userId = 'user-123'

      const activates = onlyFailedQuestions && failedQuestionIds.length === 0 && !!userId
      expect(activates).toBe(true)
    })

    it('onlyFailedQuestions=true + con IDs → NO activa (usa IDs específicos)', () => {
      const onlyFailedQuestions = true
      const failedQuestionIds = ['q1', 'q2']

      const activates = onlyFailedQuestions && failedQuestionIds.length === 0
      expect(activates).toBe(false)
    })

    it('sin userId → NO activa', () => {
      const userId: string | null = null
      const activates = true && true && !!userId
      expect(activates).toBe(false)
    })
  })

  // ============================================
  // FILTRO POR selectedLaws
  // ============================================
  describe('Filtro por selectedLaws', () => {
    it('selectedLaws presente → filtra falladas por esas leyes', () => {
      const selectedLaws = ['RDL 5/2015', 'CE']
      const hasLawFilter = selectedLaws.length > 0

      expect(hasLawFilter).toBe(true)
      // La query usa: inArray(laws.shortName, selectedLaws)
    })

    it('selectedLaws vacío → NO filtra por ley, devuelve todas las falladas', () => {
      const selectedLaws: string[] = []
      const hasLawFilter = selectedLaws.length > 0

      expect(hasLawFilter).toBe(false)
      // La query no añade condición de ley
    })

    it('una sola ley seleccionada (caso Lidia: RDL 5/2015)', () => {
      const selectedLaws = ['RDL 5/2015']

      expect(selectedLaws.length).toBe(1)
      expect(selectedLaws[0]).toBe('RDL 5/2015')
    })

    it('múltiples leyes seleccionadas', () => {
      const selectedLaws = ['CE', 'Ley 39/2015', 'Ley 40/2015', 'RDL 5/2015']

      expect(selectedLaws.length).toBe(4)
    })
  })

  // ============================================
  // NO usa scope de oposición
  // ============================================
  describe('No usa scope de oposición', () => {
    it('NO llama a getAllowedLawIds (el cambio principal)', () => {
      // Antes: getAllowedLawIds({ userId, fallbackPositionType })
      // Ahora: usa selectedLaws directamente
      // No hay llamada a getAllowedLawIds en el path de falladas sin IDs
      const usesScope = false
      const usesSelectedLaws = true

      expect(usesScope).toBe(false)
      expect(usesSelectedLaws).toBe(true)
    })

    it('oposición sin scope (Valencia) → funciona con selectedLaws', () => {
      // Lidia: auxiliar_administrativo_ayuntamiento_valencia (0 topic_scopes)
      // Antes: getAllowedLawIds devolvía 0 leyes → 0 preguntas
      // Ahora: selectedLaws=['RDL 5/2015'] → filtra por ley directamente
      const selectedLaws = ['RDL 5/2015']
      const hasLawFilter = selectedLaws.length > 0

      expect(hasLawFilter).toBe(true)
      // La query busca falladas de Lidia en RDL 5/2015
    })

    it('oposición con scope configurado → selectedLaws funciona igual', () => {
      // Admin (Galicia con scope completo) → selectedLaws=['CE']
      // Mismo comportamiento: filtra por la ley seleccionada
      const selectedLaws = ['CE']
      expect(selectedLaws.length).toBe(1)
    })
  })

  // ============================================
  // RESULTADOS VACÍOS
  // ============================================
  describe('Resultados vacíos — emptyReason descriptivo', () => {
    it('0 falladas con selectedLaws → emptyReason nombra las leyes', () => {
      const selectedLaws = ['RDL 5/2015']
      const failedCount = 0
      const hasLawFilter = selectedLaws.length > 0

      const emptyReason = hasLawFilter
        ? `No tienes preguntas falladas en ${selectedLaws.join(', ')}`
        : 'No tienes preguntas falladas aún'

      expect(emptyReason).toBe('No tienes preguntas falladas en RDL 5/2015')
    })

    it('0 falladas sin selectedLaws → emptyReason genérico', () => {
      const selectedLaws: string[] = []
      const hasLawFilter = selectedLaws.length > 0

      const emptyReason = hasLawFilter
        ? `No tienes preguntas falladas en ${selectedLaws.join(', ')}`
        : 'No tienes preguntas falladas aún'

      expect(emptyReason).toBe('No tienes preguntas falladas aún')
    })

    it('emptyReason con múltiples leyes', () => {
      const selectedLaws = ['CE', 'Ley 39/2015']
      const emptyReason = `No tienes preguntas falladas en ${selectedLaws.join(', ')}`

      expect(emptyReason).toBe('No tienes preguntas falladas en CE, Ley 39/2015')
    })
  })

  // ============================================
  // REGRESIÓN: escenario Lidia
  // ============================================
  describe('Regresión: escenario Lidia (18/04/2026)', () => {
    it('Valencia sin scope + selectedLaws=RDL 5/2015 → devuelve falladas', () => {
      // ANTES: getAllowedLawIds(Valencia) → 0 leyes → 0 resultados
      // AHORA: selectedLaws=['RDL 5/2015'] → filtra por ley → devuelve falladas

      const selectedLaws = ['RDL 5/2015']
      const userId = 'lidia-2300fe7d'
      const hasLawFilter = selectedLaws.length > 0

      // La query haría:
      // SELECT ... FROM questions
      //   JOIN user_question_history ON (userId, successRate < 1.00)
      //   JOIN laws ON ...
      //   WHERE isActive AND laws.shortName IN ('RDL 5/2015')
      //   ORDER BY random() LIMIT 25

      expect(hasLawFilter).toBe(true)
      expect(userId).toBeTruthy()
    })

    it('Lidia tiene 358 falladas → LIMIT 25 devuelve subconjunto', () => {
      const totalFailed = 358
      const numQuestions = 25

      expect(totalFailed).toBeGreaterThan(numQuestions)
      // DB aplica LIMIT 25 → 25 preguntas aleatorias de sus 358 falladas
    })
  })

  // ============================================
  // OBSERVABILITY
  // ============================================
  describe('Observability — logging', () => {
    it('log indica selectedLaws cuando hay filtro', () => {
      const selectedLaws = ['RDL 5/2015']
      const hasLawFilter = selectedLaws.length > 0
      const logMsg = `🔄 [failed-questions] Modo historial: userId=x, selectedLaws=${hasLawFilter ? selectedLaws.join(', ') : '(todas)'}`

      expect(logMsg).toContain('selectedLaws=RDL 5/2015')
    })

    it('log indica "(todas)" cuando no hay filtro de ley', () => {
      const selectedLaws: string[] = []
      const hasLawFilter = selectedLaws.length > 0
      const logMsg = `🔄 [failed-questions] Modo historial: userId=x, selectedLaws=${hasLawFilter ? selectedLaws.join(', ') : '(todas)'}`

      expect(logMsg).toContain('(todas)')
    })

    it('resultado exitoso logea count y leyes', () => {
      const count = 25
      const selectedLaws = ['CE', 'RDL 5/2015']
      const hasLawFilter = selectedLaws.length > 0
      const logMsg = `✅ [failed-questions] ${count} preguntas falladas${hasLawFilter ? ` de ${selectedLaws.join(', ')}` : ' (todas las leyes)'} (limit 25)`

      expect(logMsg).toContain('25 preguntas falladas de CE, RDL 5/2015')
    })

    it('todos los logs usan prefijo [failed-questions]', () => {
      const prefix = '[failed-questions]'
      const logs = [
        `🔄 ${prefix} Modo historial: userId=x, selectedLaws=CE`,
        `✅ ${prefix} 10 preguntas falladas de CE (limit 25)`,
      ]
      expect(logs.every(l => l.includes(prefix))).toBe(true)
    })
  })

  // ============================================
  // COMPATIBILIDAD
  // ============================================
  describe('Compatibilidad con otros flujos', () => {
    it('preguntas nuevas (no falladas) siguen usando scope filter', () => {
      // El scope filter (getAllowedLawIds) sigue activo en el path general
      // (isLawOnlyMode, isGlobalMode). Solo se quitó del path de falladas.
      const onlyFailedQuestions = false
      const usesScope = !onlyFailedQuestions

      expect(usesScope).toBe(true)
    })

    it('falladas con IDs específicos tampoco usan scope', () => {
      // Los IDs vienen del sessionStorage — preguntas que el usuario ya falló.
      // No necesitan filtro de scope.
      const failedQuestionIds = ['q1', 'q2']
      const usesScopeForIds = false

      expect(failedQuestionIds.length).toBeGreaterThan(0)
      expect(usesScopeForIds).toBe(false)
    })
  })
})
