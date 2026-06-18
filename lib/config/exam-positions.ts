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
  'administrativo_estado': [
    'administrativo',
    'administrativo_estado',
    'cuerpo_general_administrativo',
    'cuerpo general administrativo de la administración del estado',
  ],
  'gestion_administracion_civil': [
    'cuerpo_gestion_administracion_civil',
    'cuerpo de gestión de la administración civil del estado',
  ],
  'administrativo_seguridad_social': [
    'administrativo_seguridad_social',
    'administrativo de la administración de la seguridad social',
    'cuerpo administrativo de la administración de la seguridad social',
  ],
  'tramitacion_procesal': [
    'tramitacion_procesal',
    'tramitación procesal',
  ],
  'auxiliar_administrativo_cyl': [
    'auxiliar_administrativo_cyl',
    'auxiliar administrativo castilla y leon',
    'auxiliar administrativo cyl',
  ],
  'administrativo_castilla_leon': [
    'administrativo_castilla_leon',
    'administrativo castilla y leon',
    'cuerpo administrativo de castilla y leon',
    'cuerpo administrativo castilla y leon',
    'administrativo cyl',
  ],
  'administrativo_castilla_la_mancha': [
    'administrativo_castilla_la_mancha',
    'administrativo castilla-la mancha',
    'administrativo castilla la mancha',
    'cuerpo ejecutivo administrativa',
    'administrativo jccm',
  ],
  'administrativo_la_rioja': [
    'administrativo_la_rioja',
    'administrativo la rioja',
    'cuerpo administrativo de administracion general la rioja',
    'administrativo gobierno de la rioja',
  ],
  'administrativo_diputacion_jaen': [
    'administrativo_diputacion_jaen',
    'administrativo diputacion jaen',
    'administrativo diputacion provincial de jaen',
  ],
  'auxiliar_administrativo_ayuntamiento_marbella': [
    'auxiliar_administrativo_ayuntamiento_marbella',
    'auxiliar administrativo ayuntamiento de marbella',
    'auxiliar administrativo marbella',
  ],
  'auxiliar_administrativo_ayuntamiento_valladolid': [
    'auxiliar_administrativo_ayuntamiento_valladolid',
    'auxiliar administrativo ayuntamiento de valladolid',
    'auxiliar administrativo valladolid',
  ],
  'auxiliar_administrativo_extremadura': [
    'auxiliar_administrativo_extremadura',
    'auxiliar administrativo extremadura',
    'auxiliar administrativo junta de extremadura',
    'cuerpo auxiliar administracion comunidad autonoma extremadura',
  ],
  'auxiliar_administrativo_canarias': [
    'auxiliar_administrativo_canarias',
    'auxiliar administrativo canarias',
    'auxiliar administrativo gobierno de canarias',
    'cuerpo auxiliar administracion publica comunidad autonoma canarias',
  ],
  'auxiliar_administrativo_scs_canarias': [
    'auxiliar_administrativo_scs_canarias',
    'auxiliar administrativo scs canarias',
    'auxiliar administrativo servicio canario de la salud',
    'grupo auxiliar administrativo de la funcion administrativa',
  ],
  'auxilio_judicial': [
    'auxilio_judicial',
    'auxilio judicial',
  ],
  'gestion_procesal': [
    'gestion_procesal',
    'gestión procesal',
  ],
  'auxiliar_administrativo_andalucia': [
    'auxiliar_administrativo_andalucia',
    'auxiliar administrativo andalucia',
  ],
  'auxiliar_administrativo_carm': [
    'auxiliar_administrativo_carm',
    'auxiliar administrativo carm',
    'auxiliar administrativo murcia',
  ],
  'auxiliar_administrativo_clm': [
    'auxiliar_administrativo_clm',
    'auxiliar administrativo clm',
    'auxiliar administrativo castilla-la mancha',
  ],
  'auxiliar_administrativo_valencia': [
    'auxiliar_administrativo_valencia',
    'auxiliar administrativo valencia',
    'auxiliar administrativo generalitat valenciana',
    'auxiliar administrativo gva',
  ],
  'administrativo_diputacion_valencia': [
    'administrativo_diputacion_valencia',
    'administrativo diputacion valencia',
    'administrativo dival',
  ],
  'auxiliar_administrativo_ayuntamiento_valencia': [
    'auxiliar_administrativo_ayuntamiento_valencia',
    'auxiliar administrativo ayuntamiento valencia',
  ],
  'auxiliar_administrativo_ayuntamiento_zaragoza': [
    'auxiliar_administrativo_ayuntamiento_zaragoza',
    'auxiliar administrativo ayuntamiento zaragoza',
  ],
  'administrativo_gva': [
    'administrativo_gva',
    'administrativo gva',
    'administrativo generalitat valenciana',
    'administrativo c1-01 gva',
    'cuerpo administrativo c1-01',
  ],
  'guardia_civil': [
    'guardia_civil',
    'guardia civil',
    'escala cabos y guardias',
  ],
  'policia_nacional': [
    'policia_nacional',
    'policía nacional',
    'policia nacional',
    'escala basica policia nacional',
  ],
  // Oposiciones SIN preguntas oficiales registradas todavía (array vacío
  // silencia el warning 'no_exam_position_mapping' en validation_error_logs).
  // Detectado 30/05/2026 al revisar validation_error_logs post-cutover.
  // Cuando se importen preguntas oficiales para alguna, añadir las variantes
  // de exam_position aquí (igual que el resto de oposiciones).
  'auxiliar_administrativo_diputacion_zaragoza': [],
  'auxiliar_administrativo_sermas': [],
  'tcae_sermas_madrid': [],
  'administrativo_galicia': [],
  'auxiliar_administrativo_aragon': [],
  // Añadidas 31/05/2026 — landings nuevas sin exámenes oficiales aún en BD
  'auxiliar_administrativo_catalunya': [],
  'auxiliar_administrativo_pais_vasco': [],
}

/**
 * Mapeo: slug/positionType del usuario → valor de target_oposicion en hot_articles.
 * BD normalizada: hot_articles.target_oposicion siempre usa dashes.
 */
export const HOT_ARTICLE_TARGET_MAP: Record<string, string[]> = {
  'auxiliar-administrativo-estado': ['auxiliar-administrativo-estado'],
  'auxiliar_administrativo_estado': ['auxiliar-administrativo-estado'],
  'auxiliar-administrativo-madrid': ['auxiliar-administrativo-madrid'],
  'auxiliar_administrativo_madrid': ['auxiliar-administrativo-madrid'],
  'auxiliar-administrativo-cyl': ['auxiliar-administrativo-cyl'],
  'auxiliar_administrativo_cyl': ['auxiliar-administrativo-cyl'],
  'administrativo-castilla-leon': ['administrativo-castilla-leon'],
  'administrativo_castilla_leon': ['administrativo-castilla-leon'],
  'administrativo-castilla-la-mancha': ['administrativo-castilla-la-mancha'],
  'administrativo_castilla_la_mancha': ['administrativo-castilla-la-mancha'],
  'administrativo-la-rioja': ['administrativo-la-rioja'],
  'administrativo_la_rioja': ['administrativo-la-rioja'],
  'administrativo-diputacion-jaen': ['administrativo-diputacion-jaen'],
  'administrativo_diputacion_jaen': ['administrativo-diputacion-jaen'],
  'auxiliar-administrativo-ayuntamiento-marbella': ['auxiliar-administrativo-ayuntamiento-marbella'],
  'auxiliar_administrativo_ayuntamiento_marbella': ['auxiliar-administrativo-ayuntamiento-marbella'],
  'auxiliar-administrativo-ayuntamiento-valladolid': ['auxiliar-administrativo-ayuntamiento-valladolid'],
  'auxiliar_administrativo_ayuntamiento_valladolid': ['auxiliar-administrativo-ayuntamiento-valladolid'],
  'administrativo-estado': ['administrativo-estado'],
  'administrativo_estado': ['administrativo-estado'],
  'cuerpo-general-administrativo': ['administrativo-estado'],
  'cuerpo_general_administrativo': ['administrativo-estado'],
  'tramitacion-procesal': ['tramitacion-procesal'],
  'tramitacion_procesal': ['tramitacion-procesal'],
  'auxilio-judicial': ['auxilio-judicial'],
  'auxilio_judicial': ['auxilio-judicial'],
  'gestion-estado': ['gestion-estado'],
  'gestion_estado': ['gestion-estado'],
  'gestion-procesal': ['gestion-estado'],
  'gestion_procesal': ['gestion-estado'],
  'auxiliar-administrativo-carm': ['auxiliar-administrativo-carm'],
  'auxiliar_administrativo_carm': ['auxiliar-administrativo-carm'],
  'auxiliar-administrativo-extremadura': ['auxiliar-administrativo-extremadura'],
  'auxiliar_administrativo_extremadura': ['auxiliar-administrativo-extremadura'],
  'auxiliar-administrativo-canarias': ['auxiliar-administrativo-canarias'],
  'auxiliar_administrativo_canarias': ['auxiliar-administrativo-canarias'],
  'auxiliar-administrativo-scs-canarias': ['auxiliar-administrativo-scs-canarias'],
  'auxiliar_administrativo_scs_canarias': ['auxiliar-administrativo-scs-canarias'],
  'auxiliar-administrativo-valencia': ['auxiliar-administrativo-valencia'],
  'auxiliar_administrativo_valencia': ['auxiliar-administrativo-valencia'],
  'administrativo_diputacion_valencia': ['administrativo-diputacion-valencia'],
  'auxiliar-administrativo-ayuntamiento-valencia': ['auxiliar-administrativo-ayuntamiento-valencia'],
  'auxiliar_administrativo_ayuntamiento_valencia': ['auxiliar-administrativo-ayuntamiento-valencia'],
  'administrativo-gva': ['administrativo-gva'],
  'administrativo_gva': ['administrativo-gva'],
  'policia-nacional': ['policia-nacional'],
  'policia_nacional': ['policia-nacional'],
  // Añadidas 31/05/2026 — landings nuevas
  'auxiliar-administrativo-catalunya': ['auxiliar-administrativo-catalunya'],
  'auxiliar_administrativo_catalunya': ['auxiliar-administrativo-catalunya'],
  'auxiliar-administrativo-pais-vasco': ['auxiliar-administrativo-pais-vasco'],
  'auxiliar_administrativo_pais_vasco': ['auxiliar-administrativo-pais-vasco'],
  // Añadida 09/06/2026 — SERMAS auxiliar administrativo
  'auxiliar-administrativo-sermas': ['auxiliar-administrativo-sermas'],
  'auxiliar_administrativo_sermas': ['auxiliar-administrativo-sermas'],
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
 * True si el positionType está REGISTRADO en EXAM_POSITION_MAP (aunque con
 * array vacío). Permite distinguir "oposición sin oficiales aún (caso conocido,
 * silenciar warn)" de "positionType nuevo no registrado (caso real, warn)".
 *
 * Añadido 30/05/2026 tras detectar 5 oposiciones disparando warn no_exam_position_mapping
 * a diario sin tener oficiales todavía (tcae_sermas_madrid, etc.).
 */
export function isExamPositionRegistered(positionType: string): boolean {
  if (!positionType) return false
  const normalized = positionType.toLowerCase().replace(/-/g, '_')
  return normalized in EXAM_POSITION_MAP
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
