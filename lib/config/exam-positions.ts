// lib/config/exam-positions.ts - Mapeo centralizado de exam_position
// Las preguntas oficiales en BD tienen exam_position con valores inconsistentes.
// Este mapeo normaliza positionType → valores válidos de exam_position.
// FUENTE DE VERDAD: Todos los archivos que filtran por exam_position importan de aquí.

export const EXAM_POSITION_MAP: Record<string, string[]> = {
  'auxiliar_administrativo': [
    'auxiliar administrativo del estado',
    'auxiliar administrativo',
    'auxiliar_administrativo',
    'auxiliar_administrativo_estado',
  ],
  'administrativo': [
    'administrativo',
    'administrativo_estado',
    'cuerpo_general_administrativo',
    'cuerpo general administrativo de la administración del estado',
  ],
  'gestion_administracion_civil': [
    'cuerpo_gestion_administracion_civil',
    'cuerpo de gestión de la administración civil del estado',
  ],
  'tramitacion_procesal': [
    'tramitacion_procesal',
    'tramitación procesal',
  ],
  'auxilio_judicial': [
    'auxilio_judicial',
    'auxilio judicial',
  ],
  'gestion_procesal': [
    'gestion_procesal',
    'gestión procesal',
  ],
}

/**
 * Obtiene los valores válidos de exam_position para un positionType.
 * Normaliza el input (lowercase, guiones → underscores).
 * @returns string[] (vacío si no hay mapeo)
 */
export function getValidExamPositions(positionType: string): string[] {
  if (!positionType) return []
  const normalized = positionType.toLowerCase().replace(/-/g, '_')
  return EXAM_POSITION_MAP[normalized] || []
}

/**
 * Construye un filtro de exam_position para Supabase PostgREST.
 * @returns string como "exam_position.in.(...)" o null si no hay mapeo
 */
export function buildExamPositionFilter(positionType: string): string | null {
  if (!positionType) return null
  const validPositions = getValidExamPositions(positionType)
  if (validPositions.length === 0) return null
  const escaped = validPositions.map(p => p.replace(/,/g, '\\,')).join(',')
  return `exam_position.in.(${escaped})`
}
