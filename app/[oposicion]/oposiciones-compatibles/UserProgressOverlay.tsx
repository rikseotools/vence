'use client'

import { useAuth } from '@/contexts/AuthContext'
import { getAuthHeaders } from '@/lib/api/authHeaders'
import { useEffect, useState } from 'react'
import type { UserOverlapProgress } from '@/lib/api/oposiciones-compatibles/types'

interface UserProgressOverlayProps {
  sourcePositionType: string
  /** Map slug → overlay data to render inline on each card */
  onProgressLoaded?: (progressMap: Map<string, UserOverlapProgress>) => void
}

/**
 * Client component that fetches user's personal progress toward compatible oposiciones.
 * Renders a floating summary banner and provides data to parent via callback.
 */
export default function UserProgressOverlay({
  sourcePositionType,
}: UserProgressOverlayProps) {
  const { user } = useAuth()
  const [progress, setProgress] = useState<UserOverlapProgress[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!user?.id) return

    const fetchProgress = async () => {
      setLoading(true)
      try {
        const res = await fetch(
          `/api/v2/oposiciones-compatibles/progress?sourcePositionType=${sourcePositionType}`,
          { headers: await getAuthHeaders() }
        )
        if (res.ok) {
          const data = await res.json()
          if (data.success && data.progress) {
            setProgress(data.progress)
          }
        }
      } catch {
        // Silently fail — personal stats are optional
      } finally {
        setLoading(false)
      }
    }

    fetchProgress()
  }, [user?.id, sourcePositionType])

  if (!user || loading || progress.length === 0) return null

  const totalCorrect = progress.reduce((sum, p) => sum + p.correctAnswers, 0)
  const totalAnswered = progress.reduce((sum, p) => sum + p.totalAnswers, 0)
  const opsWithProgress = progress.filter((p) => p.correctAnswers > 0).length

  return (
    <div className="mb-6 p-4 bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-200 dark:border-indigo-800 rounded-xl">
      <div className="flex items-start gap-3">
        <div className="flex-shrink-0 w-10 h-10 rounded-full bg-indigo-100 dark:bg-indigo-900/40 flex items-center justify-center">
          <svg
            className="w-5 h-5 text-indigo-600 dark:text-indigo-400"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
            />
          </svg>
        </div>
        <div>
          <h3 className="text-sm font-semibold text-indigo-900 dark:text-indigo-200">
            Tu progreso personal
          </h3>
          <p className="text-sm text-indigo-700 dark:text-indigo-300 mt-0.5">
            Has respondido correctamente{' '}
            <strong>{totalCorrect.toLocaleString('es-ES')}</strong> preguntas que
            te sirven para{' '}
            <strong>
              {opsWithProgress}{' '}
              {opsWithProgress === 1 ? 'oposición' : 'oposiciones'}
            </strong>{' '}
            compatibles.
            {totalAnswered > 0 && (
              <span className="text-indigo-500 dark:text-indigo-400">
                {' '}
                ({Math.round((totalCorrect / totalAnswered) * 100)}% de acierto)
              </span>
            )}
          </p>
        </div>
      </div>
    </div>
  )
}
