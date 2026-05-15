// lib/chat/shared/complaintDetector.ts
// Detecta cuándo un mensaje del usuario es una queja sobre la pregunta del
// test (no una petición legal). Caso real: feedback negativo donde el usuario
// preguntó "¿por qué se me pregunta esto? no tiene sentido", la IA respondió
// re-explicando el artículo en lugar de ofrecer impugnación.

/**
 * Patrones que indican queja/crítica sobre la pregunta del test.
 * Se combinan con la presencia de questionContext: si no estamos en una
 * pregunta, la mayoría son falsos positivos (ej. "no tiene sentido lo que
 * dice este artículo" sin contexto de pregunta).
 */
const COMPLAINT_PATTERNS: RegExp[] = [
  /no\s+tiene\s+sentido/i,
  /no\s+me\s+parece(\s+\w+)?(\s+(la|esta))?\s*(pregunta|opcion|opción)/i,
  /(esta|la)\s+pregunta\s+(est[aá]\s+)?(mal|fatal|raro|raro|absurd)/i,
  /(es|me\s+parece)\s+absurd/i,
  /(es|parece)\s+(una\s+)?trampa/i,
  /(es|pregunta)\s+tramposa/i,
  /por\s+qu[eé]\s+(se\s+)?me\s+pregunt/i,
  /qu[eé]\s+pregunta\s+es\s+esta/i,
  /(esta|la)\s+pregunta\s+es\s+(rara|ambigua|confusa)/i,
  /mal\s+planteada/i,
  /no\s+(es\s+)?correcta\s+la\s+respuesta/i,
]

export interface ComplaintDetection {
  isComplaint: boolean
  matchedPattern?: string
}

/**
 * Detecta si un mensaje contiene una queja sobre la pregunta del test.
 * Solo devuelve true si HAY questionContext (no estamos en chat libre).
 */
export function detectQuestionComplaint(
  message: string,
  hasQuestionContext: boolean,
): ComplaintDetection {
  if (!hasQuestionContext) return { isComplaint: false }
  if (!message || message.length < 5) return { isComplaint: false }

  for (const pattern of COMPLAINT_PATTERNS) {
    if (pattern.test(message)) {
      return { isComplaint: true, matchedPattern: pattern.source }
    }
  }
  return { isComplaint: false }
}

/**
 * Construye el bloque sugerencia de impugnación que se añade al final de la
 * respuesta cuando se detecta queja. Usa el mismo wording que el aviso de
 * error existente en AIChatWidget para consistencia.
 *
 * El flujo de impugnación se activa con el botón "Impugnar" que aparece en
 * la propia pregunta del test (componente QuestionDispute). No enlazamos a
 * una URL externa porque el botón ya está visible en la pantalla.
 */
export function buildComplaintSuggestion(): string {
  return `\n\n---\n💡 **Si crees que esta pregunta está mal planteada o tiene un error**, puedes reportarla con el botón **Impugnar** que aparece en la pregunta. La revisaremos y, si es un error real, te ajustaremos el resultado.`
}
