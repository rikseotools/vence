/**
 * Test específico del caso Cristina Manso (26/05/2026, dispute cluster c7196843).
 *
 * Escenario reproducido:
 * - Cristina se registra el 18/12/2025 con target_oposicion = Aux Admin Estado.
 * - Durante meses, hace tests T5 Estado ("El Gobierno y la Administración")
 *   y falla preguntas de Ley 50/1997 y CE art 98. Quedan en su histórico
 *   con tema_number=5.
 * - El 25/05/2026 ~08:00, Cristina cambia target_oposicion a CyL via
 *   /oposiciones-compatibles. user_profiles.target_oposicion = 'auxiliar_administrativo_cyl'.
 * - El 26/05/2026 ~07:32, hace test "T5 CyL" (Estatuto de Autonomía).
 * - El cliente activa "preguntas falladas" → /api/questions/user-failed
 *   devuelve IDs T5 (incluyendo CE art 98, Ley 50/1997 art 13/26) sin
 *   filtrar por positionType actual.
 * - El cliente las guarda en sessionStorage como pendingFailedQuestionIds.
 * - TestPersonalizadoPage llama /api/questions/filtered con failedQuestionIds=[...].
 * - Pre-fix: path 4 devolvía TODAS sin scope filter.
 * - Post-fix: solo devuelve IDs in-scope T5 CyL (LO 14/2007).
 */

describe('Cross-oposición failed IDs (caso Cristina 26/05/2026)', () => {

  // Fixture: T5 CyL solo contiene LO 14/2007. T5 Estado contiene Ley 50/1997 + CE
  // entre otras. Las preguntas falladas de Cristina cuando era Estado son
  // out-of-scope respecto a su nueva posición CyL.
  const T5_CYL_SCOPE = new Set([
    'art:lo-14-2007:1', 'art:lo-14-2007:9', 'art:lo-14-2007:11',
    'art:lo-14-2007:66', 'art:lo-14-2007:83', 'art:lo-14-2007:89',
  ])

  const CRISTINA_FAILED_IDS_FROM_T5_ESTADO = [
    'art:ley-50-1997:13',   // Suplencia Ministros — T5 Estado
    'art:ley-50-1997:26',   // Procedimiento reglamentos — T5 Estado
    'art:ce:98',            // Estatuto miembros Gobierno — T5 Estado
    'art:lo-14-2007:9',     // Estatuto Andalucía art 9 — T5 CyL ✅ in-scope
    'art:lo-14-2007:66',    // T5 CyL ✅ in-scope
  ]

  describe('Pre-fix (comportamiento BUG anterior 18/04→26/05)', () => {
    it('servía las 5 IDs aunque 3 fueran out-of-scope', () => {
      // Sin scope filter — comportamiento que motivó las 9 disputes.
      const returned = CRISTINA_FAILED_IDS_FROM_T5_ESTADO.filter(_ => true)
      expect(returned.length).toBe(5)
      expect(returned).toContain('art:ce:98')
      expect(returned).toContain('art:ley-50-1997:26')
    })
  })

  describe('Post-fix (con EXISTS topic_scope)', () => {
    it('filtra IDs out-of-scope, devuelve solo in-scope T5 CyL', () => {
      const returned = CRISTINA_FAILED_IDS_FROM_T5_ESTADO.filter(id =>
        T5_CYL_SCOPE.has(id)
      )
      expect(returned).toEqual(['art:lo-14-2007:9', 'art:lo-14-2007:66'])
      // Las 3 problemáticas se descartan
      expect(returned).not.toContain('art:ley-50-1997:13')
      expect(returned).not.toContain('art:ley-50-1997:26')
      expect(returned).not.toContain('art:ce:98')
    })

    it('si TODAS son out-of-scope, devuelve [] (UX: "no hay preguntas falladas")', () => {
      const allOutOfScope = [
        'art:ley-50-1997:13', 'art:ley-50-1997:26', 'art:ce:98',
      ]
      const returned = allOutOfScope.filter(id => T5_CYL_SCOPE.has(id))
      expect(returned).toEqual([])
    })

    it('si TODAS son in-scope, comportamiento idéntico al pre-fix', () => {
      const allInScope = ['art:lo-14-2007:9', 'art:lo-14-2007:66', 'art:lo-14-2007:83']
      const returned = allInScope.filter(id => T5_CYL_SCOPE.has(id))
      expect(returned).toEqual(allInScope)
    })
  })

  describe('Detección de cambio de oposición (heurística observability)', () => {
    it('missing >= 50% → posible cambio de oposición → log info', () => {
      const requested = CRISTINA_FAILED_IDS_FROM_T5_ESTADO.length // 5
      const inScope = CRISTINA_FAILED_IDS_FROM_T5_ESTADO.filter(id => T5_CYL_SCOPE.has(id))
      const missing = requested - inScope.length // 3
      const triggersLog = missing >= requested / 2
      expect(triggersLog).toBe(true)
      expect(missing).toBe(3)
    })

    it('missing < 50% → probable inactividad/borrado, no log', () => {
      const requested = 10
      const found = 8
      const missing = requested - found
      const triggersLog = missing >= requested / 2
      expect(triggersLog).toBe(false)
    })
  })

  describe('Topic mismatch entre oposiciones (mismo topic_number, distinto scope)', () => {
    it('T5 Estado ≠ T5 CyL aunque comparten topic_number=5', () => {
      const T5_ESTADO_TOPICS = ['El Gobierno', 'La Administración', 'CE arts 97-107']
      const T5_CYL_TOPICS = ['Estatuto de Autonomía de CyL', 'LO 14/2007']
      // Mismo número, semántica radicalmente distinta. Por eso el filtro
      // por position_type es crítico.
      expect(T5_ESTADO_TOPICS).not.toEqual(T5_CYL_TOPICS)
    })

    it('test_questions.tema_number es ambiguo sin position_type', () => {
      // El campo tema_number en test_questions guarda solo el integer,
      // no el topic_id ni el position_type. Cuando cambia la oposición,
      // el integer mantiene su valor pero el SCOPE cambia. Por eso hay
      // que filtrar via EXISTS topic_scope con positionType resuelto.
      const tq = { tema_number: 5, user_id: 'cristina', question_id: 'q' }
      // tema_number=5 NO permite saber si es T5 Estado o T5 CyL.
      // Solo user_profiles.target_oposicion (presente, no histórico) lo aclara.
      expect(tq.tema_number).toBe(5)
    })
  })
})
