// lib/config/exam-positions.ts - Mapeo centralizado de exam_position y hot_articles
// Los valores de exam_position y target_oposicion en BD son inconsistentes (legacy).
// Este archivo centraliza TODOS los mapeos de variantes para que solo haya que
// tocarlo aquí al añadir una nueva oposición.
//
// FUENTE DE VERDAD para:
// - exam_position en questions (filtro de preguntas oficiales)
// - target_oposicion en hot_articles (artículos importantes por oposición)
//
// TODO FUTURO: Normalizar BD para que todos los valores usen positionType directamente
// (ej: 'auxiliar_administrativo_madrid'), eliminando la necesidad de mapear variantes.

/**
 * Mapeo: positionType → valores válidos de exam_position en la tabla questions.
 * Las preguntas oficiales se marcan con exam_position al importar.
 */
export const EXAM_POSITION_MAP: Record<string, string[]> = {
  'auxiliar_administrativo_estado': [
    'auxiliar administrativo del estado',
    'auxiliar administrativo',
    'auxiliar_administrativo',
    'auxiliar_administrativo_estado',
  ],
  'auxiliar_administrativo_madrid': [
    'auxiliar_administrativo_madrid',
    'auxiliar administrativo madrid',
    'auxiliar administrativo comunidad de madrid',
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
 * Mapeo: slug/positionType del usuario → valores válidos de target_oposicion en hot_articles.
 * Los valores en BD son inconsistentes (mezcla de guiones y guiones bajos, legacy).
 */
export const HOT_ARTICLE_TARGET_MAP: Record<string, string[]> = {
  // Auxiliar Administrativo del Estado
  'auxiliar-administrativo-estado': ['auxiliar-administrativo-estado', 'auxiliar_administrativo_estado'],
  'auxiliar_administrativo_estado': ['auxiliar-administrativo-estado', 'auxiliar_administrativo_estado'],
  // Auxiliar Administrativo Comunidad de Madrid
  'auxiliar-administrativo-madrid': ['auxiliar_administrativo_madrid'],
  'auxiliar_administrativo_madrid': ['auxiliar_administrativo_madrid'],
  // Administrativo del Estado
  'administrativo-estado': ['administrativo-estado'],
  'administrativo_estado': ['administrativo-estado'],
  'cuerpo-general-administrativo': ['administrativo-estado'],
  'cuerpo_general_administrativo': ['administrativo-estado'],
  // Tramitación Procesal
  'tramitacion-procesal': ['tramitacion-procesal', 'tramitacion_procesal'],
  'tramitacion_procesal': ['tramitacion-procesal', 'tramitacion_procesal'],
  // Auxilio Judicial
  'auxilio-judicial': ['auxilio-judicial'],
  'auxilio_judicial': ['auxilio-judicial'],
  // Gestión Procesal / Estado
  'gestion-estado': ['gestion-estado'],
  'gestion_estado': ['gestion-estado'],
  'gestion-procesal': ['gestion-estado'],
  'gestion_procesal': ['gestion-estado'],
}

/**
 * Obtiene los valores válidos de exam_position para un positionType.
 * Normaliza el input (lowercase, guiones → underscores).
 */
export function getValidExamPositions(positionType: string): string[] {
  if (!positionType) return []
  const normalized = positionType.toLowerCase().replace(/-/g, '_')
  return EXAM_POSITION_MAP[normalized] || []
}

/**
 * Obtiene los valores válidos de target_oposicion en hot_articles para un slug/positionType.
 * Normaliza el input (lowercase).
 */
export function getValidHotArticleTargets(slugOrPositionType: string): string[] {
  if (!slugOrPositionType) return []
  const normalized = slugOrPositionType.toLowerCase()
  return HOT_ARTICLE_TARGET_MAP[normalized] || [normalized]
}

/**
 * Aplica filtro de exam_position a una query Supabase.
 * Usa .in() internamente (NUNCA .or() que rompe la lógica AND).
 *
 * Uso: query = applyExamPositionFilter(query, positionType)
 *
 * Si no hay posiciones válidas para el positionType, no aplica filtro.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function applyExamPositionFilter<T extends { in: (column: string, values: string[]) => T }>(
  query: T,
  positionType: string
): T {
  const validPositions = getValidExamPositions(positionType)
  if (validPositions.length > 0) {
    return query.in('exam_position', validPositions)
  }
  return query
}
