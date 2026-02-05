import { Metadata } from 'next'
import { createClient } from '@supabase/supabase-js'
import VideoCoursePage from './VideoCoursePage'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

interface Props {
  params: Promise<{ slug: string }>
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params

  const { data: course } = await supabase
    .from('video_courses')
    .select('title, description')
    .eq('slug', slug)
    .eq('is_active', true)
    .single()

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
  const { data: course, error } = await supabase
    .from('video_courses')
    .select(`
      id,
      slug,
      title,
      description,
      total_lessons,
      total_duration_minutes,
      is_premium
    `)
    .eq('slug', slug)
    .eq('is_active', true)
    .single()

  if (error || !course) {
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
  const { data: lessons } = await supabase
    .from('video_lessons')
    .select(`
      id,
      slug,
      title,
      description,
      duration_seconds,
      order_position,
      is_preview,
      preview_seconds
    `)
    .eq('course_id', course.id)
    .eq('is_active', true)
    .order('order_position', { ascending: true })

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
      lessons={lessons?.map(l => ({
        id: l.id,
        slug: l.slug,
        title: l.title,
        description: l.description,
        durationSeconds: l.duration_seconds,
        orderPosition: l.order_position,
        isPreview: l.is_preview,
        previewSeconds: l.preview_seconds,
      })) || []}
    />
  )
}
