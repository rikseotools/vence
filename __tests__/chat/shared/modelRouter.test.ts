// __tests__/chat/shared/modelRouter.test.ts
// Verifica el routing de proveedor LLM. Crítico para que las preguntas
// numéricas vayan a Claude Sonnet y no a GPT-4o (caso #3 auditoría 15/05).

import { selectModel, usesClaude } from '@/lib/chat/shared/modelRouter'

describe('selectModel — routing LLM por contexto', () => {
  describe('Subtypes psicotécnicos en CLAUDE_SUBTYPES', () => {
    test('calculation → Claude Sonnet (razonamiento matemático)', () => {
      const r = selectModel({
        domain: 'psychometric',
        questionSubtype: 'calculation',
        isPsicotecnico: true,
      })
      expect(r.provider).toBe('anthropic')
      expect(r.reason).toContain('calculation')
    })

    test('sequence_numeric → Claude Sonnet', () => {
      const r = selectModel({ questionSubtype: 'sequence_numeric', isPsicotecnico: true })
      expect(r.provider).toBe('anthropic')
    })

    test('sequence_letter → Claude Sonnet', () => {
      const r = selectModel({ questionSubtype: 'sequence_letter', isPsicotecnico: true })
      expect(r.provider).toBe('anthropic')
    })

    test('data_tables → Claude Sonnet', () => {
      const r = selectModel({ questionSubtype: 'data_tables', isPsicotecnico: true })
      expect(r.provider).toBe('anthropic')
    })
  })

  describe('Fix caso #3: text_question + categoría numérica → Claude', () => {
    test('text_question + razonamiento-numerico → Claude (matemáticas)', () => {
      const r = selectModel({
        questionSubtype: 'text_question',
        questionCategory: 'razonamiento-numerico',
        isPsicotecnico: true,
      })
      expect(r.provider).toBe('anthropic')
      expect(r.reason).toContain('razonamiento-numerico')
    })

    test('text_question + capacidad-ortografica → GPT-4o (no es matemática)', () => {
      const r = selectModel({
        questionSubtype: 'text_question',
        questionCategory: 'capacidad-ortografica',
        isPsicotecnico: true,
      })
      expect(r.provider).toBe('openai')
    })

    test('text_question + razonamiento-verbal → GPT-4o', () => {
      const r = selectModel({
        questionSubtype: 'text_question',
        questionCategory: 'razonamiento-verbal',
        isPsicotecnico: true,
      })
      expect(r.provider).toBe('openai')
    })

    test('text_question sin category → GPT-4o (sin info para decidir Claude)', () => {
      const r = selectModel({
        questionSubtype: 'text_question',
        questionCategory: null,
        isPsicotecnico: true,
      })
      expect(r.provider).toBe('openai')
    })
  })

  describe('Contextos no psicotécnicos', () => {
    test('isPsicotecnico=false con subtype numérico → GPT-4o', () => {
      // Aunque el subtype sería Claude, isPsicotecnico=false anula el routing.
      const r = selectModel({
        questionSubtype: 'calculation',
        isPsicotecnico: false,
      })
      expect(r.provider).toBe('openai')
    })

    test('dominio legal (search) sin subtype → GPT-4o', () => {
      const r = selectModel({ domain: 'search' })
      expect(r.provider).toBe('openai')
    })

    test('sin parámetros → GPT-4o por defecto', () => {
      const r = selectModel({})
      expect(r.provider).toBe('openai')
    })
  })

  describe('Subtypes psicotécnicos NO en CLAUDE_SUBTYPES', () => {
    test('analogy → GPT-4o (razonamiento verbal funciona bien con GPT)', () => {
      const r = selectModel({ questionSubtype: 'analogy', isPsicotecnico: true })
      expect(r.provider).toBe('openai')
    })

    test('synonym → GPT-4o', () => {
      const r = selectModel({ questionSubtype: 'synonym', isPsicotecnico: true })
      expect(r.provider).toBe('openai')
    })

    test('error_detection → GPT-4o', () => {
      const r = selectModel({ questionSubtype: 'error_detection', isPsicotecnico: true })
      expect(r.provider).toBe('openai')
    })
  })

  describe('Prioridad: subtype gana sobre category', () => {
    test('calculation + categoría no Claude → sigue siendo Claude', () => {
      // Si llegan ambos, el subtype CLAUDE_SUBTYPES manda. Refleja la
      // intención: las series/cálculos siempre necesitan razonamiento avanzado.
      const r = selectModel({
        questionSubtype: 'calculation',
        questionCategory: 'capacidad-ortografica',
        isPsicotecnico: true,
      })
      expect(r.provider).toBe('anthropic')
    })
  })
})

describe('usesClaude — helper para callers que solo necesitan boolean', () => {
  test('subtype en CLAUDE_SUBTYPES → true', () => {
    expect(usesClaude('calculation')).toBe(true)
    expect(usesClaude('sequence_numeric')).toBe(true)
  })

  test('category en CLAUDE_CATEGORIES → true', () => {
    expect(usesClaude(null, 'razonamiento-numerico')).toBe(true)
    expect(usesClaude('text_question', 'razonamiento-numerico')).toBe(true)
  })

  test('subtype + category ambos fuera → false', () => {
    expect(usesClaude('text_question', 'capacidad-ortografica')).toBe(false)
    expect(usesClaude('analogy')).toBe(false)
  })

  test('null/undefined → false', () => {
    expect(usesClaude(null)).toBe(false)
    expect(usesClaude(undefined)).toBe(false)
    expect(usesClaude(null, null)).toBe(false)
  })
})
