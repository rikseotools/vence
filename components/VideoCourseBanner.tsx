'use client'

import Link from 'next/link'
import { useAuth } from '@/contexts/AuthContext'

interface VideoCourseBannerProps {
  courseSlug: string
  courseTitle: string
  totalLessons: number
  totalDurationMinutes: number
  description?: string
}

export default function VideoCourseBanner({
  courseSlug,
  courseTitle,
  totalLessons,
  totalDurationMinutes,
  description,
}: VideoCourseBannerProps) {
  const { isPremium } = useAuth() as { isPremium: boolean }

  const hours = Math.floor(totalDurationMinutes / 60)
  const mins = totalDurationMinutes % 60

  return (
    <div className="my-6 p-5 bg-gradient-to-r from-purple-50 via-indigo-50 to-blue-50 dark:from-purple-900/30 dark:via-indigo-900/30 dark:to-blue-900/30 border border-purple-200 dark:border-purple-700 rounded-xl">
      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
        {/* Icon */}
        <div className="flex-shrink-0 w-14 h-14 bg-gradient-to-br from-purple-500 to-indigo-600 rounded-xl flex items-center justify-center shadow-lg">
          <svg className="w-7 h-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <h3 className="text-lg font-bold text-purple-900 dark:text-purple-100">
              {courseTitle}
            </h3>
            {isPremium ? (
              <span className="px-2 py-0.5 text-xs font-medium bg-green-100 dark:bg-green-800 text-green-700 dark:text-green-200 rounded-full">
                Incluido
              </span>
            ) : (
              <span className="px-2 py-0.5 text-xs font-medium bg-amber-100 dark:bg-amber-800 text-amber-700 dark:text-amber-200 rounded-full">
                Premium
              </span>
            )}
          </div>

          <p className="text-sm text-purple-700 dark:text-purple-300 mb-2">
            {description || `Curso completo en video para dominar este tema.`}
          </p>

          <div className="flex flex-wrap items-center gap-3 text-xs text-purple-600 dark:text-purple-400">
            <span className="flex items-center gap-1">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
              </svg>
              {totalLessons} bloques
            </span>
            <span className="flex items-center gap-1">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              {hours}h {mins}m de video
            </span>
            {!isPremium && (
              <span className="flex items-center gap-1">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                </svg>
                10 min gratis
              </span>
            )}
          </div>
        </div>

        {/* CTA */}
        <div className="flex-shrink-0 w-full sm:w-auto">
          <Link
            href={`/cursos/${courseSlug}`}
            className="flex items-center justify-center gap-2 w-full sm:w-auto px-5 py-2.5 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white font-medium rounded-lg shadow-md hover:shadow-lg transition-all"
          >
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" clipRule="evenodd" />
            </svg>
            Ver curso
          </Link>
        </div>
      </div>
    </div>
  )
}
