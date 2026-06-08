// components/TopicVideoCourses.tsx
//
// Renderiza los vídeo-cursos de un tema. Fuente: content.videoCourses, derivado
// automáticamente en el fetcher del temario cruzando las leyes del tema con
// video_courses.law_id (ver lib/api/temario/videoCourses.ts).
//
// Sustituye al patrón anterior: un mapping `topicVideoCourses` hardcodeado y
// DUPLICADO en cada TopicContentView.tsx (frágil — Valencia se quedó sin cursos,
// Madrid mostraba versión equivocada). Un solo componente, cero mappings.

import VideoCourseBanner from './VideoCourseBanner'
import type { VideoCourse } from '@/lib/api/temario/schemas'

export default function TopicVideoCourses({ courses }: { courses?: VideoCourse[] }) {
  if (!courses || courses.length === 0) return null
  return (
    <>
      {courses.map((c) => (
        <VideoCourseBanner
          key={c.slug}
          courseSlug={c.slug}
          courseTitle={c.title}
          totalLessons={c.totalLessons}
          totalDurationMinutes={c.totalDurationMinutes}
          description={c.description ?? undefined}
        />
      ))}
    </>
  )
}
