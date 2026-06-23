import { Metadata } from 'next'
import { sql } from 'drizzle-orm'
import { getAdminDb } from '@/db/client'
import VideoCoursePage from './VideoCoursePage'

// Agnóstico (Fase C1): Drizzle (getAdminDb bypasea RLS = el service_role anterior)
// en vez de supabase.from. Lecturas de video_courses/video_lessons (server component).
// Tipos alineados con el contrato de VideoCoursePage (Course/Lesson): estos
// campos son no-null en BD; el código previo (supabase any) ya los pasaba directos.
interface CourseRow {
  id: string; slug: string; title: string; description: string | null
  total_lessons: number; total_duration_minutes: number; is_premium: boolean
}
interface LessonRow {
  id: string; slug: string; title: string; description: string | null
  duration_seconds: number; order_position: number
  is_preview: boolean; preview_seconds: number
}
function firstRow<T>(rows: unknown): T | null {
  const arr = Array.isArray(rows) ? rows : (rows as { rows?: unknown[] }).rows || []
  return (arr[0] as T) ?? null
}
function allRows<T>(rows: unknown): T[] {
  return (Array.isArray(rows) ? rows : (rows as { rows?: unknown[] }).rows || []) as T[]
}

interface Props {
  params: Promise<{ slug: string }>
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params

  let course: { title: string; description: string | null } | null = null
  try {
    course = firstRow(await getAdminDb().execute(sql`
      SELECT title, description FROM video_courses WHERE slug = ${slug} AND is_active = true LIMIT 1
    `))
  } catch { /* metadata best-effort */ }

  if (!course) {
    return { title: 'Curso no encontrado' }
  }

  return {
    title: `${course.title} | Vence`,
    description: course.description || `Curso de video: ${course.title}`,
  }
}

export default async function Page({ params }: Props) {
  const { slug } = await params

  // Get course with lessons
  let course: CourseRow | null = null
  try {
    course = firstRow<CourseRow>(await getAdminDb().execute(sql`
      SELECT id, slug, title, description, total_lessons, total_duration_minutes, is_premium
      FROM video_courses WHERE slug = ${slug} AND is_active = true LIMIT 1
    `))
  } catch { course = null }

  if (!course) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
            Curso no encontrado
          </h1>
          <p className="text-gray-600 dark:text-gray-400">
            El curso que buscas no existe o no está disponible.
          </p>
        </div>
      </div>
    )
  }

  // Get lessons
  let lessons: LessonRow[] = []
  try {
    lessons = allRows<LessonRow>(await getAdminDb().execute(sql`
      SELECT id, slug, title, description, duration_seconds, order_position, is_preview, preview_seconds
      FROM video_lessons WHERE course_id = ${course.id}::uuid AND is_active = true ORDER BY order_position ASC
    `))
  } catch { lessons = [] }

  return (
    <VideoCoursePage
      course={{
        id: course.id,
        slug: course.slug,
        title: course.title,
        description: course.description,
        totalLessons: course.total_lessons,
        totalDurationMinutes: course.total_duration_minutes,
        isPremium: course.is_premium,
      }}
      lessons={lessons.map(l => ({
        id: l.id,
        slug: l.slug,
        title: l.title,
        description: l.description,
        durationSeconds: l.duration_seconds,
        orderPosition: l.order_position,
        isPreview: l.is_preview,
        previewSeconds: l.preview_seconds,
      }))}
    />
  )
}
