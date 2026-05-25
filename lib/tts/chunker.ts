// lib/tts/chunker.ts
//
// Funciones puras de preparación de texto para TTS. Sin side effects.
// Test 100% (sin DOM, sin mocks).
//
// El motivo de chunking: Chrome descarta silenciosamente utterances de
// SpeechSynthesisUtterance que superan ~200-300 chars. Partimos por
// frase (terminada en .!?;) sin romper palabras.

/** Chars máx por chunk. Chrome falla silente por encima de ~300. */
export const MAX_CHUNK_LENGTH = 250

/**
 * Limpia markdown que normalmente no se debe pronunciar. Idempotente.
 * Reemplaza saltos dobles por puntos para que el chunker tenga separadores.
 */
export function cleanText(raw: string): string {
  return raw
    .replace(/#{1,6}\s/g, '')
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/\*([^*]+)\*/g, '$1')
    .replace(/>\s?/g, '')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/\n{2,}/g, '. ')
    .replace(/\n/g, ' ')
    .trim()
}

/**
 * Divide texto en chunks ≤ MAX_CHUNK_LENGTH chars, partiendo por frase.
 * Una frase suelta más larga que MAX se devuelve íntegra (no la rompemos
 * a mitad de palabra — preferimos un chunk grande que un chunk roto).
 *
 * @returns Siempre al menos un elemento. Para texto vacío devuelve [''].
 */
export function splitIntoChunks(text: string): string[] {
  const sentences = text.split(/(?<=[.!?;])\s+/)
  const chunks: string[] = []
  let current = ''

  for (const sentence of sentences) {
    if (
      current.length + sentence.length > MAX_CHUNK_LENGTH &&
      current.length > 0
    ) {
      chunks.push(current.trim())
      current = sentence
    } else {
      current += (current ? ' ' : '') + sentence
    }
  }
  if (current.trim()) chunks.push(current.trim())

  return chunks.length > 0 ? chunks : [text]
}

/** Pipeline completo: limpia y divide. */
export function prepareForSpeech(raw: string): string[] {
  return splitIntoChunks(cleanText(raw))
}
