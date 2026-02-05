// lib/chat/domains/verification/DiscrepancyDetector.ts
// Detecta cuando la respuesta del AI no coincide con la respuesta correcta en BD

import { logger } from '../../shared/logger'

export interface DiscrepancyResult {
  hasDiscrepancy: boolean
  aiSuggestedAnswer: string | null
  dbAnswer: string
  confidence: 'high' | 'medium' | 'low'
}

/**
 * Detecta si la respuesta de la IA sugiere una opción diferente a la correcta en BD
 * Solo para preguntas psicotécnicas donde tenemos la respuesta correcta
 */
export function detectDiscrepancy(
  aiResponse: string,
  correctAnswer: number // 0=A, 1=B, 2=C, 3=D
): DiscrepancyResult {
  const dbAnswer = ['A', 'B', 'C', 'D'][correctAnswer]

  // Patrones para detectar qué opción recomienda la IA
  // Ordenados de más específico a menos específico
  const patterns = [
    // Patrones muy específicos - alta confianza
    { regex: /respuesta\s+correcta\s+(?:es|sería|debería\s+ser)\s+(?:la\s+)?(?:opción\s+)?([A-D])\b/i, confidence: 'high' as const },
    { regex: /la\s+opción\s+([A-D])\s+es\s+(?:la\s+)?correcta/i, confidence: 'high' as const },
    { regex: /correcta?\s+es\s+(?:la\s+)?([A-D])\b/i, confidence: 'high' as const },

    // Patrones para psicotécnicos de posición/ubicación
    { regex: /se\s+(?:colocaría|ubicaría|situaría)\s+en\s+(?:el\s+pasillo\s+)?([A-D])\d*/i, confidence: 'high' as const },
    { regex: /pasillo\s+([A-D])\d*\s+(?:es|sería)\s+(?:la\s+)?(?:respuesta\s+)?correcta/i, confidence: 'high' as const },
    { regex: /(?:está|estará|estaría)\s+en\s+(?:el\s+pasillo\s+)?([A-D])\d*/i, confidence: 'medium' as const },

    // Patrones de énfasis con negrita/asteriscos
    { regex: /\*\*([A-D])\)\s+[^*]+\*\*/i, confidence: 'medium' as const },
    { regex: /\*\*(?:opción\s+)?([A-D])\*\*/i, confidence: 'medium' as const },

    // Patrones para series y secuencias
    { regex: /(?:el\s+)?(?:siguiente\s+)?(?:número|letra|elemento)\s+(?:es|sería)\s+(?:el\s+)?([A-D])\b/i, confidence: 'medium' as const },
    { regex: /(?:la\s+)?respuesta\s+(?:es|sería)\s+([A-D])\b/i, confidence: 'medium' as const },

    // Patrones genéricos - baja confianza
    { regex: /([A-D])\)\s+es\s+(?:la\s+)?correcta/i, confidence: 'low' as const },
    { regex: /seleccionar\s+(?:la\s+)?(?:opción\s+)?([A-D])\b/i, confidence: 'low' as const },
  ]

  let bestMatch: { answer: string; confidence: 'high' | 'medium' | 'low' } | null = null

  for (const { regex, confidence } of patterns) {
    const match = aiResponse.match(regex)
    if (match) {
      const aiAnswer = match[1].charAt(0).toUpperCase()

      // Priorizar matches de mayor confianza
      if (!bestMatch ||
          (confidence === 'high' && bestMatch.confidence !== 'high') ||
          (confidence === 'medium' && bestMatch.confidence === 'low')) {
        bestMatch = { answer: aiAnswer, confidence }
      }
    }
  }

  if (bestMatch) {
    const hasDiscrepancy = bestMatch.answer !== dbAnswer

    if (hasDiscrepancy) {
      logger.info('Discrepancy detected in AI response', {
        domain: 'verification',
        aiSuggested: bestMatch.answer,
        dbAnswer,
        confidence: bestMatch.confidence
      })
    }

    return {
      hasDiscrepancy,
      aiSuggestedAnswer: bestMatch.answer,
      dbAnswer,
      confidence: bestMatch.confidence
    }
  }

  // No se pudo determinar qué respuesta sugiere la IA
  return {
    hasDiscrepancy: false,
    aiSuggestedAnswer: null,
    dbAnswer,
    confidence: 'low'
  }
}

/**
 * Verifica si el texto contiene indicadores de que la IA está siendo cautelosa
 * o expresando incertidumbre (lo cual reduce la necesidad de re-análisis)
 */
export function hasUncertaintyIndicators(aiResponse: string): boolean {
  const uncertaintyPatterns = [
    /no\s+(?:estoy|puedo\s+estar)\s+(?:segur[oa]|ciert[oa])/i,
    /(?:podría|puede)\s+(?:ser|haber)/i,
    /(?:depende|dependería)\s+de/i,
    /sin\s+(?:ver|conocer)\s+(?:los\s+)?datos/i,
    /necesitaría\s+más\s+(?:información|contexto)/i,
  ]

  return uncertaintyPatterns.some(p => p.test(aiResponse))
}
