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

/**
 * Categorías psicotécnicas que requieren Claude (independientemente del subtype).
 * `text_question` es un cajón de sastre que mezcla razonamiento numérico (matemáticas
 * complejas: fracciones, porcentajes, álgebra) con razonamiento verbal y ortografía.
 * Para distinguir, miramos también la category_key de la pregunta.
 */
const CLAUDE_CATEGORIES = new Set([
  'razonamiento-numerico',    // Problemas matemáticos verbales (herencias, repartos, etc.)
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
 * - Psicotécnicos con categoría razonamiento-numerico → Claude Sonnet
 * - Todo lo demás → OpenAI GPT-4o (rápido, barato, funciona bien)
 */
export function selectModel(params: {
  domain?: string
  questionSubtype?: string | null
  questionCategory?: string | null
  isPsicotecnico?: boolean
}): ModelSelection {
  const { domain, questionSubtype, questionCategory, isPsicotecnico } = params

  if (isPsicotecnico) {
    // Subtypes inequívocos: series, tablas, cálculos
    if (questionSubtype && CLAUDE_SUBTYPES.has(questionSubtype)) {
      return {
        provider: 'anthropic',
        reason: `psychometric/${questionSubtype} requires advanced reasoning`,
      }
    }
    // Subtypes ambiguos (text_question): mirar categoría para detectar matemáticas
    if (questionCategory && CLAUDE_CATEGORIES.has(questionCategory)) {
      return {
        provider: 'anthropic',
        reason: `psychometric category/${questionCategory} requires advanced reasoning`,
      }
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
 * Verifica si un contexto psicotécnico debe usar Claude.
 * Considera tanto subtype como category (para text_question matemáticas).
 */
export function usesClaude(
  questionSubtype: string | null | undefined,
  questionCategory?: string | null,
): boolean {
  if (questionSubtype && CLAUDE_SUBTYPES.has(questionSubtype)) return true
  if (questionCategory && CLAUDE_CATEGORIES.has(questionCategory)) return true
  return false
}
