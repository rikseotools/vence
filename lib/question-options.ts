/**
 * Centralized utilities for variable-length question options (3/4/5).
 *
 * All option-related constants and helpers live here so the rest of the
 * codebase imports from a single source of truth.
 */

/** All possible option letters, indexed 0-4 */
export const OPTION_LETTERS = ['A', 'B', 'C', 'D', 'E'] as const
export const OPTION_LETTERS_LOWER = ['a', 'b', 'c', 'd', 'e'] as const

export const MIN_OPTIONS = 2
export const MAX_OPTIONS = 5
/** Maximum valid index for correct_option / userAnswer (0-based) */
export const MAX_OPTION_INDEX = MAX_OPTIONS - 1 // 4

/**
 * Build an options array from individual DB columns, filtering out nulls.
 * Preserves order: A, B, C, then D if present, then E if present.
 *
 * @example
 * buildOptionsArray('texto A', 'texto B', 'texto C', null, null) // → ['texto A', 'texto B', 'texto C']
 * buildOptionsArray('A', 'B', 'C', 'D', 'E')                     // → ['A', 'B', 'C', 'D', 'E']
 */
export function buildOptionsArray(
  a: string,
  b: string,
  c: string,
  d: string | null | undefined,
  e: string | null | undefined,
): string[] {
  const result = [a, b, c]
  if (d != null && d !== '') result.push(d)
  if (e != null && e !== '') result.push(e)
  return result
}

/**
 * Get the letters array for a given option count.
 *
 * @example
 * getLetters(3) // → ['A', 'B', 'C']
 * getLetters(5) // → ['A', 'B', 'C', 'D', 'E']
 */
export function getLetters(count: number): string[] {
  return OPTION_LETTERS.slice(0, Math.min(count, MAX_OPTIONS)) as unknown as string[]
}

/**
 * Convert a 0-based index to a letter (A-E).
 * Returns '?' for out-of-range indices.
 */
export function indexToLetter(index: number): string {
  return OPTION_LETTERS[index] ?? '?'
}

/**
 * Convert a letter (case-insensitive) to a 0-based index.
 * Returns -1 for unrecognized letters.
 */
export function letterToIndex(letter: string): number {
  const lower = letter.toLowerCase()
  const idx = (OPTION_LETTERS_LOWER as readonly string[]).indexOf(lower)
  return idx >= 0 ? idx : -1
}
