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

import type { TTSChunkMeta, TTSSection } from './types'

/**
 * Pipeline para secciones estructuradas. Cada sección se trocea por
 * separado y los chunks resultantes se concatenan en una lista plana
 * donde cada chunk lleva la sectionIdx a la que pertenece.
 *
 * Esto permite al engine navegar (next/prev section) sin perder la
 * granularidad de chunk necesaria para evitar el bug de Chrome con
 * utterances largos.
 */
export function prepareSectionsForSpeech(
  sections: TTSSection[],
): TTSChunkMeta[] {
  const out: TTSChunkMeta[] = []
  for (let i = 0; i < sections.length; i++) {
    const chunks = splitIntoChunks(cleanText(sections[i].text))
    for (const text of chunks) {
      // Skip chunks vacíos para no quemar utterances que no dicen nada
      if (text.trim().length === 0) continue
      out.push({ text, sectionIdx: i })
    }
  }
  // Garantía: al menos un chunk vacío si todo el input estaba vacío,
  // así el engine no se cuelga en ciclo `0 >= 0`.
  if (out.length === 0) {
    out.push({ text: '', sectionIdx: 0 })
  }
  return out
}

/**
 * Encuentra el índice del PRIMER chunk de una sección. Útil para seek
 * a "next/prev section" / "restart section".
 *
 * @returns chunk index, o -1 si no existe esa sección.
 */
export function firstChunkOfSection(
  chunks: TTSChunkMeta[],
  sectionIdx: number,
): number {
  return chunks.findIndex((c) => c.sectionIdx === sectionIdx)
}
