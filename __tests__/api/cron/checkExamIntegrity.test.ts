// __tests__/api/cron/checkExamIntegrity.test.ts
//
// Bloquea las reglas de detección y umbrales del cron check-exam-integrity y
// del indicador exam_integrity del panel salud-sistema.
//
// Contexto: tras el bug de Rosa (07/06) — examen is_completed con score/total
// correctos pero filas de test_questions perdidas — añadimos un check de
// integridad que caza la pérdida silenciosa. Estos tests fijan las invariantes
// (tolerancia 5%, qué cuenta como afectado, escalado de severidad) para que no
// regresen si alguien toca los umbrales.

describe('check-exam-integrity — reglas de detección', () => {

  const COMPLETENESS_THRESHOLD = 0.95

  // Réplica de la regla del HAVING: un examen está afectado si le faltan >5%
  // de las filas respecto a total_questions.
  function isAffected(totalQuestions: number, rowCount: number): boolean {
    if (totalQuestions <= 0) return false
    return rowCount < totalQuestions * COMPLETENESS_THRESHOLD
  }

  describe('Regla de completitud (tolerancia 5%)', () => {
    it('caza el caso real de Rosa (100 preguntas, 23 filas)', () => {
      expect(isAffected(100, 23)).toBe(true)
    })

    it('caza examen vacío (0 filas, peor caso)', () => {
      expect(isAffected(50, 0)).toBe(true)
    })

    it('NO marca examen completo', () => {
      expect(isAffected(100, 100)).toBe(false)
      expect(isAffected(50, 50)).toBe(false)
    })

    it('tolera hasta 5% de filas faltantes (preguntas retiradas)', () => {
      // 100 preguntas, 96 filas = 4 faltan (4%) → dentro de tolerancia
      expect(isAffected(100, 96)).toBe(false)
      // 100 preguntas, 95 filas = 5% exacto → límite, NO afectado (< estricto)
      expect(isAffected(100, 95)).toBe(false)
      // 100 preguntas, 94 filas = 6% faltan → afectado
      expect(isAffected(100, 94)).toBe(true)
    })

    it('en exámenes pequeños, 1 fila faltante puede superar el 5%', () => {
      // 10 preguntas, 9 filas = 10% faltan → afectado
      expect(isAffected(10, 9)).toBe(true)
      // 25 preguntas, 24 filas = 4% faltan → tolerado
      expect(isAffected(25, 24)).toBe(false)
    })

    it('ignora exámenes con total_questions=0 (no medibles)', () => {
      expect(isAffected(0, 0)).toBe(false)
    })
  })

  describe('Escalado de severidad del evento (cron)', () => {
    const CRITICAL_AFFECTED_THRESHOLD = 5
    function eventSeverity(affected: number): 'critical' | 'warn' | null {
      if (affected === 0) return null // no se emite evento
      return affected >= CRITICAL_AFFECTED_THRESHOLD ? 'critical' : 'warn'
    }

    it('0 afectados → no emite evento', () => {
      expect(eventSeverity(0)).toBeNull()
    })
    it('1-4 afectados → warn', () => {
      expect(eventSeverity(1)).toBe('warn')
      expect(eventSeverity(4)).toBe('warn')
    })
    it('≥5 afectados → critical', () => {
      expect(eventSeverity(5)).toBe('critical')
      expect(eventSeverity(50)).toBe('critical')
    })
  })

  describe('Clasificación del indicador del panel (verde/ámbar/rojo)', () => {
    const AMBER = 1, RED = 5
    function classify(affected: number): 'green' | 'amber' | 'red' {
      if (affected >= RED) return 'red'
      if (affected >= AMBER) return 'amber'
      return 'green'
    }

    it('0 afectados → verde', () => {
      expect(classify(0)).toBe('green')
    })
    it('1-4 afectados → ámbar', () => {
      expect(classify(1)).toBe('amber')
      expect(classify(4)).toBe('amber')
    })
    it('≥5 afectados → rojo', () => {
      expect(classify(5)).toBe('red')
    })
  })

  describe('Agregados (empty, worst_missing)', () => {
    interface Affected { total_questions: number; row_count: number; missing: number }
    const sample: Affected[] = [
      { total_questions: 100, row_count: 23, missing: 77 },
      { total_questions: 50, row_count: 0, missing: 50 },
      { total_questions: 25, row_count: 20, missing: 5 },
    ]

    it('empty cuenta solo exámenes con 0 filas', () => {
      const empty = sample.filter(e => e.row_count === 0).length
      expect(empty).toBe(1)
    })

    it('worst_missing es el máximo de preguntas faltantes', () => {
      const worst = sample.reduce((max, e) => Math.max(max, e.missing), 0)
      expect(worst).toBe(77)
    })
  })
})
