// Tests de la clasificación PURA de llamadas a /api/exam/validate
// (lib/api/exam/validateShape.ts).
//
// Contexto (auditoría 27/07/2026): el endpoint corrige cualquier lista de
// questionIds que reciba. Cuando la llamada no trae `testId` el servidor no
// persiste nada → la cosecha no dejaba rastro. Estos tests fijan qué forma se
// considera anómala, para que endurecer o relajar el criterio sea una decisión
// explícita y no un efecto colateral.

import {
  classifyValidateCall,
  ORPHAN_BULK_THRESHOLD,
} from '@/lib/api/exam/validateShape'

describe('classifyValidateCall', () => {
  describe('examen normal (con testId)', () => {
    it('un examen contestado es info/exam', () => {
      const r = classifyValidateCall({ batchSize: 25, answeredCount: 25, hasTestId: true })
      expect(r.shape).toBe('exam')
      expect(r.severity).toBe('info')
      expect(r.reasons).toEqual([])
    })

    it('un examen contestado a medias sigue siendo normal', () => {
      const r = classifyValidateCall({ batchSize: 100, answeredCount: 3, hasTestId: true })
      expect(r.shape).toBe('exam')
      expect(r.severity).toBe('info')
    })

    // 160 usuarios reales dejaron exámenes en blanco en 30 días: es abandono,
    // no fraude. Se etiqueta para poder contarlo, pero NO escala a warn.
    it('un examen entregado en blanco se etiqueta pero no alarma', () => {
      const r = classifyValidateCall({ batchSize: 25, answeredCount: 0, hasTestId: true })
      expect(r.shape).toBe('exam_blank')
      expect(r.severity).toBe('info')
      expect(r.reasons).toContain('examen_entregado_en_blanco')
    })

    // El tamaño NO alarma si hay examen detrás: el examen legítimo más grande
    // en prod son 110 preguntas y podría crecer por producto.
    it('un examen grande con testId no se marca como cosecha', () => {
      const r = classifyValidateCall({
        batchSize: ORPHAN_BULK_THRESHOLD + 500,
        answeredCount: 10,
        hasTestId: true,
      })
      expect(r.shape).toBe('exam')
      expect(r.severity).toBe('info')
    })
  })

  // CALIBRACIÓN con datos reales de la primera hora en producción (27/07): 9 de
  // 13 llamadas eran `orphan` y las 9 eran ANÓNIMAS, lote 25, con 24-25
  // contestadas — el flujo normal de probar un examen sin registrarse. Sin
  // usuario no hay `tests` al que anclar, así que NO PUEDEN traer testId.
  // Marcarlas warn metía ~300 avisos/día en el panel de salud.
  describe('examen anónimo (sin cuenta a la que anclar) — NO es sospechoso', () => {
    it('anónimo + contestado = anon_exam/info', () => {
      const r = classifyValidateCall({
        batchSize: 25, answeredCount: 25, hasTestId: false, authenticated: false,
      })
      expect(r.shape).toBe('anon_exam')
      expect(r.severity).toBe('info')
    })

    it('sin saber si hay sesión, se asume anónimo (no alarma por defecto)', () => {
      const r = classifyValidateCall({ batchSize: 25, answeredCount: 25, hasTestId: false })
      expect(r.severity).toBe('info')
    })

    // La discriminación que importaba: el cliente LOGUEADO siempre manda testId.
    it('CON sesión y sin testId sigue siendo orphan/warn', () => {
      const r = classifyValidateCall({
        batchSize: 25, answeredCount: 25, hasTestId: false, authenticated: true,
      })
      expect(r.shape).toBe('orphan')
      expect(r.severity).toBe('warn')
      expect(r.reasons).toContain('con_sesion_deberia_traer_test_id')
    })

    // La firma de oráculo: pedir correcciones sin haber hecho el examen.
    it('anónimo pero SIN contestar nada sigue siendo orphan/warn', () => {
      const r = classifyValidateCall({
        batchSize: 25, answeredCount: 0, hasTestId: false, authenticated: false,
      })
      expect(r.shape).toBe('orphan')
      expect(r.severity).toBe('warn')
    })

    it('el lote desmedido escala aunque sea anónimo y contestado', () => {
      const r = classifyValidateCall({
        batchSize: ORPHAN_BULK_THRESHOLD + 1, answeredCount: 200, hasTestId: false, authenticated: false,
      })
      expect(r.shape).toBe('orphan_bulk')
      expect(r.severity).toBe('error')
    })
  })

  describe('sin testId (no persiste nada → sin rastro)', () => {
    it('marca orphan/warn', () => {
      const r = classifyValidateCall({
        batchSize: 25, answeredCount: 25, hasTestId: false, authenticated: true,
      })
      expect(r.shape).toBe('orphan')
      expect(r.severity).toBe('warn')
      expect(r.reasons).toContain('sin_test_id')
    })

    it('sin respuestas añade el motivo (firma de oráculo puro)', () => {
      const r = classifyValidateCall({ batchSize: 50, answeredCount: 0, hasTestId: false })
      expect(r.shape).toBe('orphan')
      expect(r.reasons).toEqual(expect.arrayContaining(['sin_test_id', 'lote_sin_respuestas']))
    })

    it('un lote por encima del máximo real escala a error', () => {
      const r = classifyValidateCall({
        batchSize: ORPHAN_BULK_THRESHOLD + 1,
        answeredCount: 0,
        hasTestId: false,
      })
      expect(r.shape).toBe('orphan_bulk')
      expect(r.severity).toBe('error')
      expect(r.reasons.some((x) => x.startsWith('lote_'))).toBe(true)
    })

    it('justo en el umbral NO escala (frontera cerrada por arriba)', () => {
      const r = classifyValidateCall({
        batchSize: ORPHAN_BULK_THRESHOLD,
        answeredCount: 0,
        hasTestId: false,
      })
      expect(r.shape).toBe('orphan')
      expect(r.severity).toBe('warn')
    })
  })

  describe('robustez (es un path de observabilidad: nunca debe romper la respuesta)', () => {
    it.each([
      [NaN, 0],
      [-5, -5],
      [Infinity, NaN],
    ])('no lanza con batchSize=%p answeredCount=%p', (batchSize, answeredCount) => {
      expect(() =>
        classifyValidateCall({ batchSize, answeredCount, hasTestId: true }),
      ).not.toThrow()
    })

    it('el umbral documentado deja margen sobre el examen real más grande (110)', () => {
      expect(ORPHAN_BULK_THRESHOLD).toBeGreaterThan(110)
    })
  })
})
