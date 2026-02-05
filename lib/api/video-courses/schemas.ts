import { z } from 'zod'

// =====================================================
// REQUEST SCHEMAS
// =====================================================

export const getVideoCoursesRequestSchema = z.object({
  onlyActive: z.boolean().default(true),
})

export type GetVideoCoursesRequest = z.infer<typeof getVideoCoursesRequestSchema>

export const getCourseBySlugRequestSchema = z.object({
  slug: z.string().min(1, 'Slug requerido'),
})

export type GetCourseBySlugRequest = z.infer<typeof getCourseBySlugRequestSchema>

export const getVideoUrlRequestSchema = z.object({
  lessonId: z.string().uuid('ID de lección inválido'),
})

export type GetVideoUrlRequest = z.infer<typeof getVideoUrlRequestSchema>

export const saveProgressRequestSchema = z.object({
  lessonId: z.string().uuid('ID de lección inválido'),
  currentTimeSeconds: z.number().int().min(0, 'Tiempo debe ser positivo'),
  completed: z.boolean().default(false),
})

export type SaveProgressRequest = z.infer<typeof saveProgressRequestSchema>

export const getProgressRequestSchema = z.object({
  lessonId: z.string().uuid('ID de lección inválido'),
})

export type GetProgressRequest = z.infer<typeof getProgressRequestSchema>

// =====================================================
// RESPONSE SCHEMAS
// =====================================================

export const videoCourseSchema = z.object({
  id: z.string().uuid(),
  slug: z.string(),
  title: z.string(),
  description: z.string().nullable(),
  thumbnailPath: z.string().nullable(),
  totalLessons: z.number(),
  totalDurationMinutes: z.number(),
  isPremium: z.boolean(),
  orderPosition: z.number(),
})

export type VideoCourse = z.infer<typeof videoCourseSchema>

export const videoLessonSchema = z.object({
  id: z.string().uuid(),
  slug: z.string(),
  title: z.string(),
  description: z.string().nullable(),
  durationSeconds: z.number(),
  orderPosition: z.number(),
  isPreview: z.boolean(),
  previewSeconds: z.number(),
})

export type VideoLesson = z.infer<typeof videoLessonSchema>

export const lessonProgressSchema = z.object({
  currentTime: z.number(),
  completed: z.boolean(),
})

export type LessonProgress = z.infer<typeof lessonProgressSchema>

export const videoLessonWithProgressSchema = videoLessonSchema.extend({
  progress: lessonProgressSchema.nullable(),
})

export type VideoLessonWithProgress = z.infer<typeof videoLessonWithProgressSchema>

export const videoCourseWithLessonsSchema = videoCourseSchema.extend({
  lessons: z.array(videoLessonWithProgressSchema),
})

export type VideoCourseWithLessons = z.infer<typeof videoCourseWithLessonsSchema>

// API Response schemas
export const getVideoCoursesResponseSchema = z.object({
  success: z.boolean(),
  courses: z.array(videoCourseSchema).optional(),
  error: z.string().optional(),
})

export type GetVideoCoursesResponse = z.infer<typeof getVideoCoursesResponseSchema>

export const getCourseBySlugResponseSchema = z.object({
  success: z.boolean(),
  course: videoCourseWithLessonsSchema.optional(),
  error: z.string().optional(),
})

export type GetCourseBySlugResponse = z.infer<typeof getCourseBySlugResponseSchema>

export const getVideoUrlResponseSchema = z.object({
  success: z.boolean(),
  signedUrl: z.string().optional(),
  previewOnly: z.boolean().optional(),
  previewSeconds: z.number().nullable().optional(),
  error: z.string().optional(),
})

export type GetVideoUrlResponse = z.infer<typeof getVideoUrlResponseSchema>

export const saveProgressResponseSchema = z.object({
  success: z.boolean(),
  message: z.string().optional(),
  error: z.string().optional(),
})

export type SaveProgressResponse = z.infer<typeof saveProgressResponseSchema>

export const getProgressResponseSchema = z.object({
  success: z.boolean(),
  progress: z.object({
    currentTimeSeconds: z.number(),
    completed: z.boolean(),
    lastWatchedAt: z.string().nullable(),
  }).optional(),
  error: z.string().optional(),
})

export type GetProgressResponse = z.infer<typeof getProgressResponseSchema>

// =====================================================
// VALIDATORS
// =====================================================

export function safeParseGetVideoCourses(data: unknown) {
  return getVideoCoursesRequestSchema.safeParse(data)
}

export function safeParseGetCourseBySlug(data: unknown) {
  return getCourseBySlugRequestSchema.safeParse(data)
}

export function safeParseGetVideoUrl(data: unknown) {
  return getVideoUrlRequestSchema.safeParse(data)
}

export function safeParseSaveProgress(data: unknown) {
  return saveProgressRequestSchema.safeParse(data)
}

export function safeParseGetProgress(data: unknown) {
  return getProgressRequestSchema.safeParse(data)
}
