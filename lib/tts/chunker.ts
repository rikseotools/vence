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
 * Si una frase suelta excede MAX, se fuerza la partición — primero por
 * comas (puntos de pausa naturales en texto jurídico español), y como
 * último recurso por palabras.
 *
 * Por qué la partición forzada: Chrome rechaza síncronamente con
 * `synthesis-failed` los utterances que superan ~300 chars (visto en
 * Art. 1 del Reglamento Asamblea Madrid: 474 chars sin terminador
 * intermedio). Devolver una frase íntegra >MAX deja al engine en bucle
 * de retry sobre un chunk que jamás se sintetizará.
 *
 * @returns Siempre al menos un elemento. Para texto vacío devuelve [''].
 */
export function splitIntoChunks(text: string): string[] {
  const sentences = text.split(/(?<=[.!?;])\s+/)
  const chunks: string[] = []
  let current = ''

  for (const sentence of sentences) {
    const pieces =
      sentence.length > MAX_CHUNK_LENGTH ? forceSplitOversize(sentence) : [sentence]
    for (const piece of pieces) {
      // El separador suma 1 char al acumular — hay que contarlo o el
      // chunk final puede salir con MAX+1 (visto en property-based test).
      const sepLen = current.length > 0 ? 1 : 0
      if (
        current.length + sepLen + piece.length > MAX_CHUNK_LENGTH &&
        current.length > 0
      ) {
        chunks.push(current.trim())
        current = piece
      } else {
        current += (current ? ' ' : '') + piece
      }
    }
  }
  if (current.trim()) chunks.push(current.trim())

  return chunks.length > 0 ? chunks : [text]
}

/**
 * Trocea una frase oversize en sub-piezas ≤ MAX_CHUNK_LENGTH. Estrategia:
 *   1. Por comas (con espacio detrás). Cada pieza conserva su coma final.
 *   2. Si alguna sub-pieza sigue siendo >MAX, fallback a palabras.
 *   3. Palabra única > MAX (caso patológico: URLs, identificadores) se
 *      devuelve íntegra — no rompemos a mitad de carácter.
 */
function forceSplitOversize(sentence: string): string[] {
  const commaParts = sentence.split(/(?<=,)\s+/)
  if (commaParts.length > 1) {
    const out: string[] = []
    for (const part of commaParts) {
      if (part.length <= MAX_CHUNK_LENGTH) {
        out.push(part)
      } else {
        out.push(...splitByWords(part))
      }
    }
    return packBySize(out, ' ')
  }
  return splitByWords(sentence)
}

function splitByWords(text: string): string[] {
  return packBySize(text.split(/\s+/).filter((w) => w.length > 0), ' ')
}

function packBySize(parts: string[], joiner: string): string[] {
  const out: string[] = []
  let cur = ''
  for (const p of parts) {
    if (!p) continue
    const candidate = cur ? cur + joiner + p : p
    if (candidate.length > MAX_CHUNK_LENGTH && cur) {
      out.push(cur)
      cur = p
    } else {
      cur = candidate
    }
  }
  if (cur) out.push(cur)
  return out
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
