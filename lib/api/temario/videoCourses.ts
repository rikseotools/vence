// lib/api/temario/videoCourses.ts
//
// Derivación de vídeo-cursos para un tema. Sustituye al mapping
// `topicVideoCourses` HARDCODEADO y duplicado en cada TopicContentView.tsx.
//
// Por qué (caso María José / Valencia, 08/06/2026): el mapping manual por
// oposición era frágil — Valencia se quedó sin cursos (olvido), Madrid mostraba
// Windows 11 cuando su temario es Windows 10 (versión equivocada), y la mayoría
// tenía cobertura incompleta. La derivación cruza las leyes REALES del tema
// (topic_scope) con video_courses.law_id → fuente única, versión correcta,
// cero mapping que olvidar. Cualquier oposición nueva funciona sola.

import type { VideoCourse } from './schemas'

/** Fila mínima de video_courses necesaria para derivar. */
export interface VideoCourseRow {
  slug: string
  title: string
  totalLessons: number | null
  totalDurationMinutes: number | null
  description: string | null
  lawId: string | null
  isActive: boolean | null
  orderPosition: number | null
}

/**
 * PURA: dados los IDs de las leyes que componen un tema y el catálogo de
 * cursos, devuelve los cursos que corresponden a ese tema.
 *
 * Robustez:
 *   - Solo cursos activos (isActive !== false) y con law_id.
 *   - Un curso aparece SOLO si su ley exacta está en el tema → respeta la
 *     versión (un temario con "Word 2016" NO mostrará el curso de "Word 365").
 *   - Ordenados por order_position (orden curado del catálogo).
 *   - Dedup defensivo por slug (una ley no debería tener 2 cursos, pero no
 *     rompemos si los hubiera).
 */
export function deriveVideoCourses(
  lawIdsInTopic: string[],
  allCourses: VideoCourseRow[],
): VideoCourse[] {
  const lawSet = new Set(lawIdsInTopic.filter(Boolean))
  const seen = new Set<string>()
  return allCourses
    .filter((c) => c.isActive !== false && c.lawId != null && lawSet.has(c.lawId))
    .sort((a, b) => (a.orderPosition ?? 0) - (b.orderPosition ?? 0))
    .filter((c) => {
      if (seen.has(c.slug)) return false
      seen.add(c.slug)
      return true
    })
    .map((c) => ({
      slug: c.slug,
      title: c.title,
      totalLessons: c.totalLessons ?? 0,
      totalDurationMinutes: c.totalDurationMinutes ?? 0,
      description: c.description,
    }))
}
