// lib/chat/shared/modelRouter.ts
// Routing inteligente de modelo LLM según contexto de la pregunta

/**
 * Subtypes de psicotécnicos que requieren razonamiento matemático/lógico avanzado.
 * Estos se resuelven mejor con Claude Sonnet que con GPT-4o.
 */
const CLAUDE_SUBTYPES = new Set([
  'data_tables',              // Tablas con cálculos y reglas complejas
  'sequence_letter',          // Series de letras (patrones alfabéticos)
  'sequence_numeric',         // Series numéricas (patrones matemáticos)
  'sequence_alphanumeric',    // Series alfanuméricas
  'calculation',              // Cálculos numéricos
])

export type ModelProvider = 'openai' | 'anthropic'

export interface ModelSelection {
  provider: ModelProvider
  reason: string
}

/**
 * Determina qué proveedor de LLM usar según el contexto.
 *
 * Reglas:
 * - Psicotécnicos con cálculos/series → Claude Sonnet (mejor razonamiento)
 * - Todo lo demás → OpenAI GPT-4o (rápido, barato, funciona bien)
 */
export function selectModel(params: {
  domain?: string
  questionSubtype?: string | null
  isPsicotecnico?: boolean
}): ModelSelection {
  const { domain, questionSubtype, isPsicotecnico } = params

  // Psicotécnicos con subtypes que requieren razonamiento avanzado
  if (isPsicotecnico && questionSubtype && CLAUDE_SUBTYPES.has(questionSubtype)) {
    return {
      provider: 'anthropic',
      reason: `psychometric/${questionSubtype} requires advanced reasoning`,
    }
  }

  // Domain psicotécnico sin subtype específico → OpenAI por defecto
  // (analogías, razonamiento verbal, etc. funcionan bien con GPT)
  return {
    provider: 'openai',
    reason: domain ? `${domain} uses default provider` : 'default',
  }
}

/**
 * Verifica si un subtype de psicotécnico usa Claude.
 */
export function usesClaude(questionSubtype: string | null | undefined): boolean {
  return !!questionSubtype && CLAUDE_SUBTYPES.has(questionSubtype)
}
