'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { useAuth } from '@/contexts/AuthContext'

interface Lesson {
  id: string
  slug: string
  title: string
  description: string | null
  durationSeconds: number
  orderPosition: number
  isPreview: boolean
  previewSeconds: number
}

interface Course {
  id: string
  slug: string
  title: string
  description: string | null
  totalLessons: number
  totalDurationMinutes: number
  isPremium: boolean
}

interface VideoCoursePageProps {
  course: Course
  lessons: Lesson[]
}

export default function VideoCoursePage({ course, lessons }: VideoCoursePageProps) {
  const { user, isPremium, supabase, loading: authLoading } = useAuth() as {
    user: any
    isPremium: boolean
    supabase: any
    loading: boolean
  }

  const [currentLesson, setCurrentLesson] = useState<Lesson | null>(lessons[0] || null)
  const [videoUrl, setVideoUrl] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true) // Start true while auth loads
  const [error, setError] = useState<string | null>(null)
  const [previewOnly, setPreviewOnly] = useState(false)
  const [previewSeconds, setPreviewSeconds] = useState(600)
  const [showPreviewWarning, setShowPreviewWarning] = useState(false)
  const [progress, setProgress] = useState<Record<string, { currentTime: number; completed: boolean }>>({})

  const videoRef = useRef<HTMLVideoElement>(null)
  const saveProgressTimeout = useRef<NodeJS.Timeout | null>(null)

  // Load video URL when lesson changes
  const loadVideo = useCallback(async (lesson: Lesson) => {
    if (!user || !supabase) {
      setError('Inicia sesión para ver los videos')
      return
    }

    // Get current session from Supabase
    const { data: { session } } = await supabase.auth.getSession()
    if (!session?.access_token) {
      setError('Inicia sesión para ver los videos')
      return
    }

    setIsLoading(true)
    setError(null)
    setShowPreviewWarning(false)

    try {
      const response = await fetch('/api/cursos/video-url', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ lessonId: lesson.id }),
      })

      const data = await response.json()

      if (!data.success) {
        setError(data.error || 'Error al cargar el video')
        return
      }

      setVideoUrl(data.signedUrl)
      setPreviewOnly(data.previewOnly || false)
      setPreviewSeconds(data.previewSeconds || 600)

      // Load saved progress
      const progressRes = await fetch(`/api/cursos/progress?lessonId=${lesson.id}`, {
        headers: { 'Authorization': `Bearer ${session.access_token}` },
      })
      const progressData = await progressRes.json()

      if (progressData.success && progressData.progress) {
        setProgress(prev => ({
          ...prev,
          [lesson.id]: {
            currentTime: progressData.progress.currentTimeSeconds,
            completed: progressData.progress.completed,
          }
        }))
      }
    } catch (err) {
      setError('Error de conexión')
    } finally {
      setIsLoading(false)
    }
  }, [user, supabase])

  // Load video when lesson changes and auth is ready
  useEffect(() => {
    // Wait for auth to finish loading
    if (authLoading) {
      setIsLoading(true)
      return
    }

    if (currentLesson) {
      loadVideo(currentLesson)
    }
  }, [currentLesson, loadVideo, authLoading])

  // Set video time when loaded
  useEffect(() => {
    if (videoRef.current && currentLesson && progress[currentLesson.id]) {
      const savedTime = progress[currentLesson.id].currentTime
      if (savedTime > 0 && savedTime < videoRef.current.duration - 10) {
        videoRef.current.currentTime = savedTime
      }
    }
  }, [videoUrl, currentLesson, progress])

  // Save progress periodically
  const saveProgress = useCallback(async (lessonId: string, currentTime: number, completed: boolean = false) => {
    if (!supabase) return

    const { data: { session } } = await supabase.auth.getSession()
    if (!session?.access_token) return

    try {
      await fetch('/api/cursos/progress', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          lessonId,
          currentTimeSeconds: Math.floor(currentTime),
          completed,
        }),
      })
    } catch (err) {
      console.error('Error saving progress:', err)
    }
  }, [supabase])

  // Handle time update
  const handleTimeUpdate = () => {
    if (!videoRef.current || !currentLesson) return

    const currentTime = videoRef.current.currentTime

    // Check preview limit
    if (previewOnly && currentTime >= previewSeconds) {
      videoRef.current.pause()
      videoRef.current.currentTime = previewSeconds
      setShowPreviewWarning(true)
      return
    }

    // Save progress every 10 seconds
    if (saveProgressTimeout.current) {
      clearTimeout(saveProgressTimeout.current)
    }
    saveProgressTimeout.current = setTimeout(() => {
      saveProgress(currentLesson.id, currentTime)
    }, 10000)
  }

  // Handle video end
  const handleVideoEnded = () => {
    if (!currentLesson) return
    saveProgress(currentLesson.id, videoRef.current?.duration || 0, true)
    setProgress(prev => ({
      ...prev,
      [currentLesson.id]: { currentTime: 0, completed: true }
    }))
  }

  const formatDuration = (seconds: number) => {
    const h = Math.floor(seconds / 3600)
    const m = Math.floor((seconds % 3600) / 60)
    const s = seconds % 60
    if (h > 0) return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
    return `${m}:${s.toString().padStart(2, '0')}`
  }

  const hours = Math.floor(course.totalDurationMinutes / 60)
  const mins = course.totalDurationMinutes % 60

  return (
    <div className="min-h-screen bg-gray-100 dark:bg-gray-900">
      {/* Header */}
      <header className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Link
                href="/auxiliar-administrativo-estado/temario"
                className="flex items-center gap-2 text-gray-600 dark:text-gray-300 hover:text-indigo-600 dark:hover:text-indigo-400"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
                Volver al temario
              </Link>
            </div>
            <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
              <span>{course.totalLessons} bloques</span>
              <span>·</span>
              <span>{hours}h {mins}m</span>
            </div>
          </div>
          <h1 className="mt-2 text-xl font-bold text-gray-900 dark:text-white">
            {course.title}
          </h1>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 py-6">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Video Player */}
          <div className="lg:col-span-2">
            <div className="bg-black rounded-xl overflow-hidden aspect-video relative">
              {isLoading && (
                <div className="absolute inset-0 flex items-center justify-center bg-gray-900">
                  <div className="animate-spin rounded-full h-12 w-12 border-4 border-indigo-500 border-t-transparent"></div>
                </div>
              )}

              {error && (
                <div className="absolute inset-0 flex items-center justify-center bg-gray-900">
                  <div className="text-center p-6">
                    <svg className="w-12 h-12 mx-auto text-red-500 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                    </svg>
                    <p className="text-white mb-4">{error}</p>
                    {!user && (
                      <Link
                        href="/login?return_to=/cursos/word-365"
                        className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
                      >
                        Iniciar sesión
                      </Link>
                    )}
                  </div>
                </div>
              )}

              {videoUrl && !isLoading && !error && (
                <video
                  ref={videoRef}
                  src={videoUrl}
                  controls
                  className="w-full h-full"
                  onTimeUpdate={handleTimeUpdate}
                  onEnded={handleVideoEnded}
                />
              )}

              {/* Preview warning overlay */}
              {showPreviewWarning && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/80">
                  <div className="text-center p-6 max-w-md">
                    <div className="w-16 h-16 mx-auto mb-4 bg-amber-500/20 rounded-full flex items-center justify-center">
                      <svg className="w-8 h-8 text-amber-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                      </svg>
                    </div>
                    <h3 className="text-xl font-bold text-white mb-2">
                      Vista previa finalizada
                    </h3>
                    <p className="text-gray-300 mb-4">
                      Has visto los primeros 10 minutos de este bloque. Hazte Premium para acceder al curso completo.
                    </p>
                    <div className="flex flex-col sm:flex-row gap-3 justify-center">
                      <Link
                        href="/planes"
                        className="px-6 py-2 bg-gradient-to-r from-amber-500 to-orange-500 text-white font-medium rounded-lg hover:from-amber-600 hover:to-orange-600"
                      >
                        Ver planes Premium
                      </Link>
                      <button
                        onClick={() => {
                          setShowPreviewWarning(false)
                          if (videoRef.current) videoRef.current.currentTime = 0
                        }}
                        className="px-6 py-2 bg-gray-700 text-white rounded-lg hover:bg-gray-600"
                      >
                        Volver al inicio
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Current lesson info */}
            {currentLesson && (
              <div className="mt-4 p-4 bg-white dark:bg-gray-800 rounded-xl">
                <h2 className="text-lg font-bold text-gray-900 dark:text-white">
                  {currentLesson.title}
                </h2>
                {currentLesson.description && (
                  <p className="mt-2 text-gray-600 dark:text-gray-400">
                    {currentLesson.description}
                  </p>
                )}
                {previewOnly && (
                  <div className="mt-3 flex items-center gap-2 text-amber-600 dark:text-amber-400 text-sm">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    Vista previa: primeros 10 minutos disponibles
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Lessons list */}
          <div className="lg:col-span-1">
            <div className="bg-white dark:bg-gray-800 rounded-xl overflow-hidden">
              <div className="p-4 border-b border-gray-200 dark:border-gray-700">
                <h3 className="font-bold text-gray-900 dark:text-white">
                  Contenido del curso
                </h3>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  {lessons.length} bloques · {hours}h {mins}m
                </p>
              </div>

              <div className="divide-y divide-gray-200 dark:divide-gray-700 max-h-[600px] overflow-y-auto">
                {lessons.map((lesson, index) => {
                  const isActive = currentLesson?.id === lesson.id
                  const lessonProgress = progress[lesson.id]
                  const isCompleted = lessonProgress?.completed

                  return (
                    <button
                      key={lesson.id}
                      onClick={() => setCurrentLesson(lesson)}
                      className={`w-full p-4 text-left hover:bg-gray-50 dark:hover:bg-gray-750 transition-colors ${
                        isActive ? 'bg-indigo-50 dark:bg-indigo-900/30' : ''
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        {/* Number/status indicator */}
                        <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                          isCompleted
                            ? 'bg-green-100 dark:bg-green-800 text-green-600 dark:text-green-300'
                            : isActive
                            ? 'bg-indigo-100 dark:bg-indigo-800 text-indigo-600 dark:text-indigo-300'
                            : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400'
                        }`}>
                          {isCompleted ? (
                            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                              <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                            </svg>
                          ) : (
                            index + 1
                          )}
                        </div>

                        <div className="flex-1 min-w-0">
                          <h4 className={`font-medium truncate ${
                            isActive
                              ? 'text-indigo-600 dark:text-indigo-400'
                              : 'text-gray-900 dark:text-white'
                          }`}>
                            {lesson.title}
                          </h4>
                          <div className="flex items-center gap-2 mt-1 text-xs text-gray-500 dark:text-gray-400">
                            <span>{formatDuration(lesson.durationSeconds)}</span>
                            {lesson.isPreview && (
                              <span className="px-1.5 py-0.5 bg-green-100 dark:bg-green-800 text-green-700 dark:text-green-300 rounded">
                                Gratis
                              </span>
                            )}
                            {!isPremium && !lesson.isPreview && (
                              <span className="px-1.5 py-0.5 bg-amber-100 dark:bg-amber-800 text-amber-700 dark:text-amber-300 rounded">
                                10 min gratis
                              </span>
                            )}
                          </div>
                        </div>

                        {isActive && (
                          <svg className="w-5 h-5 text-indigo-500" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" clipRule="evenodd" />
                          </svg>
                        )}
                      </div>
                    </button>
                  )
                })}
              </div>
            </div>

            {/* Premium CTA */}
            {!isPremium && (
              <div className="mt-4 p-4 bg-gradient-to-br from-amber-50 to-orange-50 dark:from-amber-900/30 dark:to-orange-900/30 border border-amber-200 dark:border-amber-700 rounded-xl">
                <h4 className="font-bold text-amber-900 dark:text-amber-100 mb-2">
                  Accede al curso completo
                </h4>
                <p className="text-sm text-amber-700 dark:text-amber-300 mb-3">
                  Con Premium tienes acceso ilimitado a todos los videos y guardamos tu progreso.
                </p>
                <Link
                  href="/planes"
                  className="block w-full text-center py-2 bg-gradient-to-r from-amber-500 to-orange-500 text-white font-medium rounded-lg hover:from-amber-600 hover:to-orange-600"
                >
                  Ver planes
                </Link>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
