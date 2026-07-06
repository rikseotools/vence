/**
 * Leyes-contenedor de VARIANTE de una aplicación (p.ej. "Word 365 · solo Escritorio",
 * "Excel 365 · solo Web"). Agrupan las preguntas específicas de una versión concreta
 * de un software para poder escoparlas por `topic_scope` a la oposición correcta
 * (examen web vs escritorio).
 *
 * NO son unidades de estudio independientes: son contenedores internos. Deben:
 *  - seguir ACTIVAS (`is_active = true`) — las preguntas y la teoría cuelgan de ellas
 *    y el topic_scope las referencia; desactivarlas rompería colocación y teoría.
 *  - quedar EXCLUIDAS del catálogo de leyes de usuario (/leyes, /teoria), para no
 *    aparecer como leyes sueltas duplicadas junto a la ley común.
 *
 * Se identifican por el sufijo del slug. Ver `docs/roadmap/office-web-escritorio` /
 * memoria `project_office_web_escritorio_split`.
 */
export const VARIANT_LAW_SLUG_SUFFIXES = ['-solo-escritorio', '-solo-web'] as const

export function isVariantContainerLaw(slug: string | null | undefined): boolean {
  if (!slug) return false
  return VARIANT_LAW_SLUG_SUFFIXES.some((suffix) => slug.endsWith(suffix))
}
