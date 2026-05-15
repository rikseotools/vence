// __tests__/chat/shared/complaintDetector.test.ts
// Verifica detección de quejas sobre la pregunta del test (caso #6 auditoría).
// Debe detectar críticas como "no tiene sentido" / "está mal planteada"
// SOLO cuando hay questionContext, sin disparar en peticiones legales legítimas.

import {
  detectQuestionComplaint,
  buildComplaintSuggestion,
} from '@/lib/chat/shared/complaintDetector'

describe('detectQuestionComplaint', () => {
  describe('detecta quejas con questionContext', () => {
    test('frase original caso #6', () => {
      const r = detectQuestionComplaint(
        'y por qué se me pregunta por plazos? no tiene sentidod que haya plazos en una cuestión de discriminació',
        true,
      )
      expect(r.isComplaint).toBe(true)
    })

    test('"esta pregunta está mal planteada"', () => {
      expect(detectQuestionComplaint('esta pregunta está mal planteada', true).isComplaint).toBe(true)
    })

    test('"es una pregunta tramposa"', () => {
      expect(detectQuestionComplaint('es una pregunta tramposa', true).isComplaint).toBe(true)
    })

    test('"por qué me preguntan esto"', () => {
      expect(detectQuestionComplaint('por qué me preguntan esto', true).isComplaint).toBe(true)
    })

    test('"qué pregunta es esta"', () => {
      expect(detectQuestionComplaint('qué pregunta es esta', true).isComplaint).toBe(true)
    })

    test('"no me parece la pregunta clara"', () => {
      expect(detectQuestionComplaint('no me parece la pregunta clara', true).isComplaint).toBe(true)
    })

    test('"la pregunta es ambigua"', () => {
      expect(detectQuestionComplaint('la pregunta es ambigua', true).isComplaint).toBe(true)
    })
  })

  describe('NO detecta peticiones legales legítimas', () => {
    test('"cuál es el plazo?"', () => {
      expect(detectQuestionComplaint('cuál es el plazo?', true).isComplaint).toBe(false)
    })

    test('"explícame el artículo"', () => {
      expect(detectQuestionComplaint('explícame el artículo', true).isComplaint).toBe(false)
    })

    test('"qué dice el art 53 CE"', () => {
      expect(detectQuestionComplaint('qué dice el art 53 CE', true).isComplaint).toBe(false)
    })

    test('"y la promoción interna?"', () => {
      expect(detectQuestionComplaint('y la promoción interna?', true).isComplaint).toBe(false)
    })
  })

  describe('NO detecta cuando NO hay questionContext (chat libre)', () => {
    test('queja válida pero sin contexto de pregunta → no aplica', () => {
      // Sin contexto de pregunta del test, no tiene sentido sugerir impugnación.
      const r = detectQuestionComplaint('esta pregunta está mal planteada', false)
      expect(r.isComplaint).toBe(false)
    })

    test('"no tiene sentido" sin contexto → no aplica', () => {
      expect(detectQuestionComplaint('no tiene sentido', false).isComplaint).toBe(false)
    })
  })

  describe('Edge cases', () => {
    test('mensaje vacío', () => {
      expect(detectQuestionComplaint('', true).isComplaint).toBe(false)
    })

    test('mensaje muy corto (<5 chars)', () => {
      expect(detectQuestionComplaint('mal', true).isComplaint).toBe(false)
    })

    test('matchedPattern se devuelve cuando hay detección', () => {
      const r = detectQuestionComplaint('no tiene sentido la pregunta', true)
      expect(r.isComplaint).toBe(true)
      expect(r.matchedPattern).toBeDefined()
      expect(typeof r.matchedPattern).toBe('string')
    })
  })
})

describe('buildComplaintSuggestion', () => {
  test('devuelve bloque con instrucción de impugnar', () => {
    const text = buildComplaintSuggestion()
    expect(text).toContain('Impugnar')
    expect(text).toMatch(/mal\s+planteada|error/i)
  })

  test('el bloque empieza con separador markdown', () => {
    expect(buildComplaintSuggestion()).toMatch(/^\n+---\n/)
  })
})
