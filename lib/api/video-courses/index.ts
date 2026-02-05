// Schemas
export {
  // Request schemas
  getVideoCoursesRequestSchema,
  getCourseBySlugRequestSchema,
  getVideoUrlRequestSchema,
  saveProgressRequestSchema,
  getProgressRequestSchema,
  // Response schemas
  videoCourseSchema,
  videoLessonSchema,
  lessonProgressSchema,
  videoLessonWithProgressSchema,
  videoCourseWithLessonsSchema,
  getVideoCoursesResponseSchema,
  getCourseBySlugResponseSchema,
  getVideoUrlResponseSchema,
  saveProgressResponseSchema,
  getProgressResponseSchema,
  // Types
  type GetVideoCoursesRequest,
  type GetCourseBySlugRequest,
  type GetVideoUrlRequest,
  type SaveProgressRequest,
  type GetProgressRequest,
  type VideoCourse,
  type VideoLesson,
  type LessonProgress,
  type VideoLessonWithProgress,
  type VideoCourseWithLessons,
  type GetVideoCoursesResponse,
  type GetCourseBySlugResponse,
  type GetVideoUrlResponse,
  type SaveProgressResponse,
  type GetProgressResponse,
  // Validators
  safeParseGetVideoCourses,
  safeParseGetCourseBySlug,
  safeParseGetVideoUrl,
  safeParseSaveProgress,
  safeParseGetProgress,
} from './schemas'

// Queries
export {
  getVideoCourses,
  getCourseBySlug,
  getVideoSignedUrl,
  saveVideoProgress,
  getVideoProgress,
} from './queries'
