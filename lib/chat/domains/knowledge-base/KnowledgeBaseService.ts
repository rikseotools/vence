// lib/chat/domains/knowledge-base/KnowledgeBaseService.ts
// Servicio principal de la base de conocimiento

import { generateEmbedding } from '../search/EmbeddingService'
import {
  searchKnowledgeBase,
  searchKnowledgeBaseByKeywords,
  detectCategory,
  isPlatformQuery,
  extractPlatformKeywords,
  type KnowledgeBaseEntry,
  type KBCategory,
} from './queries'
import { logger } from '../../shared/logger'
import type { ChatContext } from '../../core/types'

// ============================================
// TIPOS
// ============================================

export interface KBSearchResult {
  entries: KnowledgeBaseEntry[]
  category: KBCategory | null
  searchMethod: 'semantic' | 'keywords' | 'none'
  confidence: number
}

// ============================================
// SERVICIO PRINCIPAL
// ============================================

/**
 * Busca información relevante en la knowledge base
 */
export async function searchKB(
  context: ChatContext
): Promise<KBSearchResult> {
  const message = context.currentMessage

  // 1. Detectar si es una consulta sobre la plataforma
  if (!isPlatformQuery(message)) {
    logger.debug('Not a platform query', { domain: 'knowledge-base' })
    return {
      entries: [],
      category: null,
      searchMethod: 'none',
      confidence: 0,
    }
  }

  // 2. Detectar categoría probable
  const category = detectCategory(message)
  logger.debug(`Detected category: ${category || 'none'}`, { domain: 'knowledge-base' })

  // 3. Intentar búsqueda semántica
  try {
    const { embedding } = await generateEmbedding(message)
    const entries = await searchKnowledgeBase(embedding, {
      threshold: 0.40,
      limit: 3,
      category,
    })

    if (entries.length > 0) {
      // Calcular confianza basada en similarity
      const avgSimilarity = entries.reduce((sum, e) => sum + (e.similarity || 0), 0) / entries.length
      const confidence = Math.min(avgSimilarity + 0.2, 1) // Boost por coincidencia de categoría

      logger.info(`KB semantic search: ${entries.length} results`, {
        domain: 'knowledge-base',
        category,
        avgSimilarity,
      })

      return {
        entries,
        category,
        searchMethod: 'semantic',
        confidence,
      }
    }
  } catch (error) {
    logger.error('Error in KB semantic search, falling back to keywords', error, {
      domain: 'knowledge-base',
    })
  }

  // 4. Fallback: búsqueda por keywords
  const keywords = extractPlatformKeywords(message)
  if (keywords.length > 0) {
    const entries = await searchKnowledgeBaseByKeywords(keywords, {
      limit: 3,
      category,
    })

    if (entries.length > 0) {
      logger.info(`KB keyword search: ${entries.length} results`, {
        domain: 'knowledge-base',
        keywords,
      })

      return {
        entries,
        category,
        searchMethod: 'keywords',
        confidence: 0.6, // Menor confianza para búsqueda por keywords
      }
    }
  }

  // 5. No se encontró nada
  logger.debug('No KB results found', { domain: 'knowledge-base' })
  return {
    entries: [],
    category,
    searchMethod: 'none',
    confidence: 0,
  }
}

/**
 * Formatea las entradas de KB para incluir en el prompt
 */
export function formatKBContext(entries: KnowledgeBaseEntry[]): string {
  if (!entries || entries.length === 0) {
    return ''
  }

  let context = '\n\n📋 INFORMACIÓN DE LA PLATAFORMA VENCE:\n'
  context += 'El usuario está preguntando sobre la plataforma. Usa esta información para responder:\n\n'

  entries.forEach((entry) => {
    context += `--- ${entry.title} ---\n`
    context += `${entry.content}\n\n`
  })

  context += 'IMPORTANTE: Responde de forma natural y amigable usando esta información. '
  context += 'No digas "según la base de conocimiento" ni cites la fuente, simplemente responde como si lo supieras.\n'

  return context
}

/**
 * Obtiene una respuesta corta si está disponible
 */
export function getShortAnswer(entries: KnowledgeBaseEntry[]): string | null {
  if (!entries || entries.length === 0) {
    return null
  }

  // Buscar la entrada con mayor prioridad que tenga shortAnswer
  const withShortAnswer = entries
    .filter(e => e.shortAnswer)
    .sort((a, b) => b.priority - a.priority)

  return withShortAnswer[0]?.shortAnswer || null
}

/**
 * Genera sugerencias de seguimiento basadas en la categoría
 */
export function generateKBSuggestions(category: KBCategory | null): string[] {
  const suggestions: Record<KBCategory, string[]> = {
    planes: [
      '¿Qué incluye el plan Premium?',
      '¿Cuánto cuesta la suscripción?',
      '¿Puedo probar gratis?',
    ],
    funcionalidades: [
      '¿Cómo creo un test personalizado?',
      '¿Dónde veo mis estadísticas?',
      '¿Qué son los psicotécnicos?',
    ],
    faq: [
      '¿Cómo contacto con soporte?',
      '¿Por qué no puedo acceder?',
      '¿Cómo cancelo mi suscripción?',
    ],
    plataforma: [
      '¿Qué oposiciones tenéis?',
      '¿Cuántas preguntas hay?',
      '¿De dónde salen las preguntas?',
    ],
    oposiciones: [
      '¿Qué leyes entran?',
      '¿Hay preguntas de exámenes oficiales?',
      '¿Se actualiza el temario?',
    ],
  }

  if (category && suggestions[category]) {
    return suggestions[category]
  }

  // Sugerencias generales
  return [
    '¿Qué planes hay disponibles?',
    '¿Cómo funciona Vence?',
    '¿Qué oposiciones preparáis?',
  ]
}

// ============================================
// RESPUESTAS PREDEFINIDAS
// ============================================

/**
 * Obtiene una respuesta predefinida para consultas comunes
 */
export function getPredefinedResponse(message: string): string | null {
  const msgLower = message.toLowerCase()

  // Psicotécnicos
  if (/psicot[eé]c?n?i?c?o?s?|series\s+num[eé]ricas|series\s+alfab[eé]ticas|domin[oó]s|matrices|razonamiento\s+l[oó]gico/i.test(msgLower)) {
    return `📊 **¡Genial! Vamos a practicar psicotécnicos**

👉 **[Empezar a practicar psicotécnicos](/psicotecnicos/test)**

**Tipos de ejercicios disponibles:**
- 🔢 Series numéricas
- 🔤 Series alfabéticas
- 🧩 Secuencias lógicas
- 🎯 Analogías
- 🎲 Dominós
- 📊 Matrices

💡 Cuando estés resolviendo preguntas, ¡pídeme ayuda! Puedo explicarte la lógica de cada ejercicio.`
  }

  // Test Multi-Ley (varias leyes, diferentes leyes, combinar leyes)
  if (/multi[- ]?ley|(varias|diferentes|m[uú]ltiples|distintas)\s+leyes|combinar\s+(leyes|normativa)|mezclar\s+(leyes|preguntas)|test\s+de\s+.*leyes/i.test(msgLower)) {
    return `📚 **¡Sí! En Vence puedes hacer tests combinando varias leyes**

👉 **[Ir al Configurador Multi-Ley](/test/configurar)**

**Características:**
- ✅ Selecciona las leyes que quieras (CE, LPAC, LRJSP, TREBEP...)
- ✅ Buscador para encontrar leyes rápidamente
- ✅ Las preguntas se reparten equitativamente entre las leyes
- ✅ Guarda tus combinaciones favoritas para reutilizarlas
- ✅ Configura número de preguntas, dificultad y más

**Ejemplo:** Si seleccionas CE + LPAC + LRJSP y pides 30 preguntas, saldrán 10 de cada ley.

💡 ¡Ideal para repasar varias leyes relacionadas o simular exámenes reales!`
  }

  return null
}

// Re-exportar tipos y funciones útiles
export { isPlatformQuery, detectCategory, type KBCategory }
