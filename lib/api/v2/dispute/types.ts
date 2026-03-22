// lib/api/v2/dispute/types.ts
// Fuente de verdad única para los tipos de impugnación.
// Frontend (QuestionDispute.tsx) y backend (schemas.ts) importan de aquí.

/** Tipos exclusivos de preguntas legislativas */
export const LEGISLATIVE_ONLY_TYPES = ['no_literal'] as const

/** Tipos exclusivos de preguntas psicotécnicas */
export const PSYCHOMETRIC_ONLY_TYPES = ['ai_detected_error'] as const

/** Tipos comunes a ambos tipos de pregunta */
export const COMMON_DISPUTE_TYPES = [
  'respuesta_incorrecta',
  'desacuerdo_correcta',
  'mal_formulada',
  'pregunta_repetida',
  'explicacion_confusa',
  'explicacion_mejorable',
  'tema_incorrecto',
  'otro',
] as const

/** Todos los tipos de impugnación válidos */
export const ALL_DISPUTE_TYPES = [
  ...LEGISLATIVE_ONLY_TYPES,
  ...PSYCHOMETRIC_ONLY_TYPES,
  ...COMMON_DISPUTE_TYPES,
] as const

/** Tipos válidos para preguntas legislativas */
export const LEGISLATIVE_DISPUTE_TYPES = [
  ...LEGISLATIVE_ONLY_TYPES,
  ...COMMON_DISPUTE_TYPES,
] as const

/** Tipos válidos para preguntas psicotécnicas */
export const PSYCHOMETRIC_DISPUTE_TYPES = [
  ...PSYCHOMETRIC_ONLY_TYPES,
  ...COMMON_DISPUTE_TYPES,
] as const

export type DisputeType = (typeof ALL_DISPUTE_TYPES)[number]
export type LegislativeDisputeType = (typeof LEGISLATIVE_DISPUTE_TYPES)[number]
export type PsychometricDisputeType = (typeof PSYCHOMETRIC_DISPUTE_TYPES)[number]

/** Labels para mostrar en UI */
export const DISPUTE_TYPE_LABELS: Record<DisputeType, string> = {
  no_literal: 'Pregunta no literal (no se ajusta exactamente al artículo)',
  ai_detected_error: 'Error detectado en la pregunta o respuesta',
  respuesta_incorrecta: 'La respuesta marcada como correcta es errónea',
  desacuerdo_correcta: 'No estoy de acuerdo con la opción marcada como correcta',
  mal_formulada: 'Pregunta mal formulada',
  pregunta_repetida: 'Pregunta repetida',
  explicacion_confusa: 'Explicación confusa',
  explicacion_mejorable: 'Explicación mejorable',
  tema_incorrecto: 'Pregunta de otro tema',
  otro: 'Otro motivo',
}
