// lib/chat/shared/constants.ts
// Constantes compartidas del sistema de chat

/**
 * Subtipos de preguntas psicotecnicas.
 * Usados por ChatOrchestrator y SearchDomain para detectar y rutear
 * preguntas de psicotecnicos (no deben ir a busqueda de articulos).
 */
export const PSYCHOMETRIC_SUBTYPES = [
  'bar_chart',
  'pie_chart',
  'line_chart',
  'mixed_chart',
  'data_tables',
  'error_detection',
  'sequence_numeric',
  'sequence_letter',
  'sequence_alphanumeric',
  'word_analysis',
] as const

export type PsychometricSubtype = typeof PSYCHOMETRIC_SUBTYPES[number]

/**
 * Comprueba si un subtype es psicotecnico
 */
export function isPsychometricSubtype(subtype: string | null | undefined): boolean {
  return subtype ? (PSYCHOMETRIC_SUBTYPES as readonly string[]).includes(subtype) : false
}
