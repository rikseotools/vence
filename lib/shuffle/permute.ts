/**
 * Barajar opciones — FASE 1: permutación pura y REPRODUCIBLE de las opciones.
 *
 * Convención de `order` (la misma que `test_questions.option_order`):
 *   order[i] = índice ORIGINAL (0=A en BD) que se muestra en la posición i.
 *   Ej.: order = [2,0,1] → la posición 0 (letra A al render) muestra la opción
 *   original C, la posición 1 muestra A, la posición 2 muestra B.
 *
 * La verdad de una exposición es la FILA `test_questions.option_order`, no el
 * algoritmo: guardamos el `order` resultante y con él se mapea en la validación
 * server-side (posición mostrada → índice original). Por eso `permutationFor` solo
 * necesita ser reproducible dentro de una request (no un contrato eterno).
 *
 * NO se usa Math.random (romperia reproducibilidad y tests): el orden se deriva de
 * hash(questionId + nonce). El `nonce` cambia por EXPOSICIÓN (id de fila servida /
 * session+order) para que una repetición reordene distinto.
 *
 * Diseño: docs/roadmap/barajar-opciones-fase1-spec.md §3.
 */

/** Hash determinista de string → uint32 (FNV-1a). Sin dependencias externas. */
function hashString(input: string): number {
  let h = 0x811c9dc5 // offset basis FNV-1a 32-bit
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i)
    // FNV prime 16777619, con Math.imul para mantener 32-bit
    h = Math.imul(h, 0x01000193)
  }
  return h >>> 0
}

/** PRNG determinista sembrado (mulberry32). Devuelve floats en [0,1). */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0
  return function () {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/**
 * Permutación reproducible de [0..n-1] sembrada por (questionId + nonce).
 * Fisher-Yates con PRNG determinista. Devuelve un array `order` (ver convención).
 */
export function permutationFor(questionId: string, nonce: string, n: number): number[] {
  const order = Array.from({ length: n }, (_, i) => i)
  if (n <= 1) return order
  const rand = mulberry32(hashString(`${questionId}::${nonce}`))
  for (let i = n - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1))
    ;[order[i], order[j]] = [order[j], order[i]]
  }
  return order
}

/**
 * Reordena `items` según `order`: resultado[i] = items[order[i]].
 * `order` debe ser una permutación de [0..items.length-1].
 */
export function applyOrder<T>(items: T[], order: number[]): T[] {
  return order.map((original) => items[original])
}

/**
 * Mapea una posición MOSTRADA (0=A al render) al índice ORIGINAL (0=A en BD).
 * Es exactamente `order[displayedIdx]`. Si `order` es null/undefined → identidad
 * (pregunta sin barajar / histórico), 100% retrocompatible.
 */
export function displayedToOriginal(order: number[] | null | undefined, displayedIdx: number): number {
  if (!order) return displayedIdx
  const mapped = order[displayedIdx]
  return mapped == null ? displayedIdx : mapped
}

/**
 * ¿Es `order` una permutación válida de [0..n-1]? Guardarraíl para no confiar en un
 * `option_order` corrupto en la validación (ante uno inválido → tratar como null).
 */
export function isValidOrder(order: unknown, n: number): order is number[] {
  if (!Array.isArray(order) || order.length !== n) return false
  const seen = new Set<number>()
  for (const v of order) {
    if (!Number.isInteger(v) || v < 0 || v >= n || seen.has(v)) return false
    seen.add(v)
  }
  return true
}
