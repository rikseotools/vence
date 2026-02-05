import { getDb } from '@/db/client'
import { videoCourses, videoLessons, userVideoProgress, userProfiles } from '@/db/schema'
import { eq, and, asc, inArray } from 'drizzle-orm'
import { createClient } from '@supabase/supabase-js'
import type {
  GetVideoCoursesResponse,
  GetCourseBySlugResponse,
  GetVideoUrlResponse,
  SaveProgressResponse,
  GetProgressResponse,
  VideoCourse,
  VideoLessonWithProgress,
} from './schemas'

// Supabase client for storage operations
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

/**
 * Get all active video courses
 */
export async function getVideoCourses(): Promise<GetVideoCoursesResponse> {
  try {
    const db = getDb()

    const coursesData = await db
      .select({
        id: videoCourses.id,
        slug: videoCourses.slug,
        title: videoCourses.title,
        description: videoCourses.description,
        thumbnailPath: videoCourses.thumbnailPath,
        totalLessons: videoCourses.totalLessons,
        totalDurationMinutes: videoCourses.totalDurationMinutes,
        isPremium: videoCourses.isPremium,
        orderPosition: videoCourses.orderPosition,
      })
      .from(videoCourses)
      .where(eq(videoCourses.isActive, true))
      .orderBy(asc(videoCourses.orderPosition))

    const courses: VideoCourse[] = coursesData.map(c => ({
      id: c.id,
      slug: c.slug,
      title: c.title,
      description: c.description,
      thumbnailPath: c.thumbnailPath,
      totalLessons: c.totalLessons ?? 0,
      totalDurationMinutes: c.totalDurationMinutes ?? 0,
      isPremium: c.isPremium ?? true,
      orderPosition: c.orderPosition ?? 0,
    }))

    console.log(`✅ [VideoCoursesQuery] Found ${courses.length} courses`)

    return {
      success: true,
      courses,
    }
  } catch (error) {
    console.error('❌ [VideoCoursesQuery] Error fetching courses:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Error desconocido',
    }
  }
}

/**
 * Get course by slug with all lessons and optional user progress
 */
export async function getCourseBySlug(
  slug: string,
  userId?: string | null
): Promise<GetCourseBySlugResponse> {
  try {
    const db = getDb()

    // Get course
    const courseResult = await db
      .select({
        id: videoCourses.id,
        slug: videoCourses.slug,
        title: videoCourses.title,
        description: videoCourses.description,
        thumbnailPath: videoCourses.thumbnailPath,
        totalLessons: videoCourses.totalLessons,
        totalDurationMinutes: videoCourses.totalDurationMinutes,
        isPremium: videoCourses.isPremium,
        orderPosition: videoCourses.orderPosition,
      })
      .from(videoCourses)
      .where(and(
        eq(videoCourses.slug, slug),
        eq(videoCourses.isActive, true)
      ))
      .limit(1)

    if (courseResult.length === 0) {
      return {
        success: false,
        error: 'Curso no encontrado',
      }
    }

    const course = courseResult[0]

    // Get lessons
    const lessonsData = await db
      .select({
        id: videoLessons.id,
        slug: videoLessons.slug,
        title: videoLessons.title,
        description: videoLessons.description,
        durationSeconds: videoLessons.durationSeconds,
        orderPosition: videoLessons.orderPosition,
        isPreview: videoLessons.isPreview,
        previewSeconds: videoLessons.previewSeconds,
      })
      .from(videoLessons)
      .where(and(
        eq(videoLessons.courseId, course.id),
        eq(videoLessons.isActive, true)
      ))
      .orderBy(asc(videoLessons.orderPosition))

    // Get user progress if authenticated
    let progressMap: Record<string, { currentTime: number; completed: boolean }> = {}

    if (userId && lessonsData.length > 0) {
      const lessonIds = lessonsData.map(l => l.id)

      const progressData = await db
        .select({
          lessonId: userVideoProgress.lessonId,
          currentTimeSeconds: userVideoProgress.currentTimeSeconds,
          completed: userVideoProgress.completed,
        })
        .from(userVideoProgress)
        .where(and(
          eq(userVideoProgress.userId, userId),
          inArray(userVideoProgress.lessonId, lessonIds)
        ))

      for (const p of progressData) {
        if (p.lessonId) {
          progressMap[p.lessonId] = {
            currentTime: p.currentTimeSeconds ?? 0,
            completed: p.completed ?? false,
          }
        }
      }
    }

    // Build lessons with progress
    const lessons: VideoLessonWithProgress[] = lessonsData.map(l => ({
      id: l.id,
      slug: l.slug,
      title: l.title,
      description: l.description,
      durationSeconds: l.durationSeconds,
      orderPosition: l.orderPosition,
      isPreview: l.isPreview ?? false,
      previewSeconds: l.previewSeconds ?? 600,
      progress: progressMap[l.id] ?? null,
    }))

    console.log(`✅ [VideoCoursesQuery] Course ${slug}: ${lessons.length} lessons`)

    return {
      success: true,
      course: {
        id: course.id,
        slug: course.slug,
        title: course.title,
        description: course.description,
        thumbnailPath: course.thumbnailPath,
        totalLessons: course.totalLessons ?? 0,
        totalDurationMinutes: course.totalDurationMinutes ?? 0,
        isPremium: course.isPremium ?? true,
        orderPosition: course.orderPosition ?? 0,
        lessons,
      },
    }
  } catch (error) {
    console.error('❌ [VideoCoursesQuery] Error fetching course:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Error desconocido',
    }
  }
}

/**
 * Get signed URL for video playback
 * Returns previewOnly=true if user is not premium and course is premium
 */
export async function getVideoSignedUrl(
  lessonId: string,
  userId: string
): Promise<GetVideoUrlResponse> {
  try {
    const db = getDb()

    // Get lesson with course info
    const lessonResult = await db
      .select({
        id: videoLessons.id,
        videoPath: videoLessons.videoPath,
        previewSeconds: videoLessons.previewSeconds,
        isPreview: videoLessons.isPreview,
        courseId: videoLessons.courseId,
      })
      .from(videoLessons)
      .where(and(
        eq(videoLessons.id, lessonId),
        eq(videoLessons.isActive, true)
      ))
      .limit(1)

    if (lessonResult.length === 0) {
      return {
        success: false,
        error: 'Lección no encontrada',
      }
    }

    const lesson = lessonResult[0]

    // Get course premium status
    let courseIsPremium = true
    if (lesson.courseId) {
      const courseResult = await db
        .select({ isPremium: videoCourses.isPremium })
        .from(videoCourses)
        .where(eq(videoCourses.id, lesson.courseId))
        .limit(1)

      courseIsPremium = courseResult[0]?.isPremium ?? true
    }

    // Check user premium status
    const profileResult = await db
      .select({
        planType: userProfiles.planType,
      })
      .from(userProfiles)
      .where(eq(userProfiles.id, userId))
      .limit(1)

    const isPremium = profileResult[0]?.planType === 'premium' ||
                      profileResult[0]?.planType === 'trial'

    // Determine access level
    const previewOnly = courseIsPremium && !isPremium && !lesson.isPreview

    // Generate signed URL (valid for 1 hour)
    const { data: signedUrlData, error: signedUrlError } = await supabase
      .storage
      .from('videos-premium')
      .createSignedUrl(lesson.videoPath, 3600)

    if (signedUrlError || !signedUrlData?.signedUrl) {
      console.error('❌ [VideoCoursesQuery] Error creating signed URL:', signedUrlError)
      return {
        success: false,
        error: 'Error al generar URL de video',
      }
    }

    console.log(`✅ [VideoCoursesQuery] Signed URL generated for lesson ${lessonId}, previewOnly: ${previewOnly}`)

    return {
      success: true,
      signedUrl: signedUrlData.signedUrl,
      previewOnly,
      previewSeconds: previewOnly ? (lesson.previewSeconds ?? 600) : null,
    }
  } catch (error) {
    console.error('❌ [VideoCoursesQuery] Error getting video URL:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Error desconocido',
    }
  }
}

/**
 * Save or update video progress
 */
export async function saveVideoProgress(
  userId: string,
  lessonId: string,
  currentTimeSeconds: number,
  completed: boolean = false
): Promise<SaveProgressResponse> {
  try {
    const db = getDb()

    // Verify lesson exists
    const lessonExists = await db
      .select({ id: videoLessons.id })
      .from(videoLessons)
      .where(and(
        eq(videoLessons.id, lessonId),
        eq(videoLessons.isActive, true)
      ))
      .limit(1)

    if (lessonExists.length === 0) {
      return {
        success: false,
        error: 'Lección no encontrada',
      }
    }

    // Check if progress exists
    const existingProgress = await db
      .select({ id: userVideoProgress.id })
      .from(userVideoProgress)
      .where(and(
        eq(userVideoProgress.userId, userId),
        eq(userVideoProgress.lessonId, lessonId)
      ))
      .limit(1)

    const now = new Date().toISOString()

    if (existingProgress.length > 0) {
      // Update existing
      await db
        .update(userVideoProgress)
        .set({
          currentTimeSeconds: Math.floor(currentTimeSeconds),
          completed,
          completedAt: completed ? now : null,
          lastWatchedAt: now,
        })
        .where(eq(userVideoProgress.id, existingProgress[0].id))
    } else {
      // Insert new
      await db
        .insert(userVideoProgress)
        .values({
          userId,
          lessonId,
          currentTimeSeconds: Math.floor(currentTimeSeconds),
          completed,
          completedAt: completed ? now : null,
          lastWatchedAt: now,
          watchCount: 1,
        })
    }

    console.log(`✅ [VideoCoursesQuery] Progress saved: lesson ${lessonId}, time ${currentTimeSeconds}s, completed: ${completed}`)

    return {
      success: true,
      message: 'Progreso guardado',
    }
  } catch (error) {
    console.error('❌ [VideoCoursesQuery] Error saving progress:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Error desconocido',
    }
  }
}

/**
 * Get progress for a specific lesson
 */
export async function getVideoProgress(
  userId: string,
  lessonId: string
): Promise<GetProgressResponse> {
  try {
    const db = getDb()

    const progressResult = await db
      .select({
        currentTimeSeconds: userVideoProgress.currentTimeSeconds,
        completed: userVideoProgress.completed,
        lastWatchedAt: userVideoProgress.lastWatchedAt,
      })
      .from(userVideoProgress)
      .where(and(
        eq(userVideoProgress.userId, userId),
        eq(userVideoProgress.lessonId, lessonId)
      ))
      .limit(1)

    if (progressResult.length === 0) {
      return {
        success: true,
        progress: {
          currentTimeSeconds: 0,
          completed: false,
          lastWatchedAt: null,
        },
      }
    }

    const p = progressResult[0]

    return {
      success: true,
      progress: {
        currentTimeSeconds: p.currentTimeSeconds ?? 0,
        completed: p.completed ?? false,
        lastWatchedAt: p.lastWatchedAt,
      },
    }
  } catch (error) {
    console.error('❌ [VideoCoursesQuery] Error fetching progress:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Error desconocido',
    }
  }
}
