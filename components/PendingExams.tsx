// components/PendingExams.tsx - Notificación de exámenes pendientes (dismissable)
'use client'
import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useAuth } from '../contexts/AuthContext'

interface PendingExam {
  id: string
  title: string | null
  temaNumber: number | null
  totalQuestions: number
  answeredQuestions: number
}

interface PendingPsychometricSession {
  id: string
  categoryName: string | null
  totalQuestions: number
  questionsAnswered: number
  correctAnswers: number
  accuracyPercentage: number
  startedAt: string | null
}

interface PendingExamsProps {
  temaNumber?: number | null
  limit?: number
}

interface AuthContextValue {
  user: { id: string } | null
}

export default function PendingExams({ temaNumber = null, limit = 5 }: PendingExamsProps) {
  const { user } = useAuth() as AuthContextValue
  const [pendingExams, setPendingExams] = useState<PendingExam[]>([])
  const [pendingPsychometric, setPendingPsychometric] = useState<PendingPsychometricSession[]>([])
  const [loading, setLoading] = useState(true)
  const [dismissed, setDismissed] = useState(false)
  const [expanded, setExpanded] = useState(false)
  const [discarding, setDiscarding] = useState<string | null>(null)
  const [confirmingDiscard, setConfirmingDiscard] = useState<string | null>(null)

  useEffect(() => {
    if (!user?.id) {
      setLoading(false)
      return
    }

    loadPendingExams()
  }, [user?.id, temaNumber])

  async function loadPendingExams() {
    if (!user?.id) return

    try {
      setLoading(true)

      // Fetch both exam and psychometric pending sessions in parallel
      const [examResponse, psychoResponse] = await Promise.all([
        fetch(`/api/exam/pending?${new URLSearchParams({
          userId: user.id,
          testType: 'exam',
          limit: limit.toString()
        })}`),
        fetch(`/api/psychometric/pending?${new URLSearchParams({
          userId: user.id,
          limit: '5'
        })}`).catch(() => null),
      ])

      const examData = await examResponse.json()
      const psychoData = psychoResponse ? await psychoResponse.json().catch(() => null) : null

      // Psychometric sessions
      if (psychoData?.success && psychoData.sessions?.length > 0) {
        setPendingPsychometric(psychoData.sessions)
      } else {
        setPendingPsychometric([])
      }

      if (!examResponse.ok || !examData.success) {
        setPendingExams([])
        return
      }

      // Filtrar por tema si se especifica
      let exams: PendingExam[] = examData.exams || []
      if (temaNumber) {
        exams = exams.filter(e => e.temaNumber === temaNumber)
      }

      // Verificar si estos exámenes fueron cerrados antes
      const dismissedIds: string[] = JSON.parse(localStorage.getItem('pendingExamsDismissedIds') || '[]')
      const currentIds = exams.map(e => e.id)

      // Include psychometric IDs in the "new items" check
      const allPendingIds = [...currentIds, ...(psychoData?.sessions?.map((s: PendingPsychometricSession) => s.id) || [])]

      // Si hay exámenes nuevos que no fueron cerrados, mostrar banner
      const hasNewExams = allPendingIds.some(id => !dismissedIds.includes(id))

      if (!hasNewExams && (exams.length > 0 || (psychoData?.sessions?.length || 0) > 0)) {
        // Todos los exámenes fueron cerrados antes, verificar timeout
        const dismissedUntil = localStorage.getItem('pendingExamsDismissedUntil')
        if (dismissedUntil && Date.now() < parseInt(dismissedUntil)) {
          setDismissed(true)
          setPendingExams(exams)
          return
        }
      }

      // Hay exámenes nuevos o expiró el timeout, mostrar
      setDismissed(false)
      setPendingExams(exams)
    } catch (err) {
      console.error('Error cargando exámenes pendientes:', err)
      setPendingExams([])
    } finally {
      setLoading(false)
    }
  }

  function handleDismiss() {
    // Guardar IDs de exámenes cerrados (incluye psicotécnicos)
    const currentIds = [...pendingExams.map(e => e.id), ...pendingPsychometric.map(s => s.id)]
    localStorage.setItem('pendingExamsDismissedIds', JSON.stringify(currentIds))

    // Ocultar por 1 hora
    const dismissUntil = Date.now() + (60 * 60 * 1000)
    localStorage.setItem('pendingExamsDismissedUntil', dismissUntil.toString())
    setDismissed(true)
  }

  // Mostrar confirmación inline
  function handleDiscardExam(examId: string) {
    setConfirmingDiscard(examId)
  }

  // Cancelar descarte
  function cancelDiscard() {
    setConfirmingDiscard(null)
  }

  // Descartar examen permanentemente (no se puede recuperar)
  async function confirmDiscardExam(examId: string) {
    if (!user?.id || !examId) return

    try {
      setDiscarding(examId)
      setConfirmingDiscard(null)

      const response = await fetch('/api/exam/discard', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ testId: examId, userId: user.id })
      })

      const result = await response.json()

      if (result.success) {
        // Eliminar de la lista local
        setPendingExams(prev => prev.filter(e => e.id !== examId))
      } else {
        console.error('Error descartando examen:', result.error)
      }
    } catch (err) {
      console.error('Error descartando examen:', err)
    } finally {
      setDiscarding(null)
    }
  }

  // Descartar sesión psicotécnica
  async function confirmDiscardPsychometric(sessionId: string) {
    if (!user?.id || !sessionId) return

    try {
      setDiscarding(sessionId)
      setConfirmingDiscard(null)

      const response = await fetch('/api/psychometric/discard', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId, userId: user.id })
      })

      const result = await response.json()

      if (result.success) {
        setPendingPsychometric(prev => prev.filter(s => s.id !== sessionId))
      } else {
        console.error('Error descartando sesión psicotécnica:', result.error)
      }
    } catch (err) {
      console.error('Error descartando sesión psicotécnica:', err)
    } finally {
      setDiscarding(null)
    }
  }

  // Genera la URL de reanudación según el tipo de examen
  function getResumeUrl(exam: PendingExam): string {
    if (exam.title?.toLowerCase().includes('examen oficial')) {
      return `/auxiliar-administrativo-estado/test/examen-oficial?resume=${exam.id}`
    }
    if (exam.title?.toLowerCase().includes('aleatorio') || exam.temaNumber === 0 || exam.temaNumber === null) {
      return `/test/aleatorio-examen?resume=${exam.id}`
    }
    return `/auxiliar-administrativo-estado/test/tema/${exam.temaNumber || 1}/test-examen?resume=${exam.id}`
  }

  // No mostrar si: no hay usuario, cargando, cerrado, o no hay nada pendiente
  const totalPending = pendingExams.length + pendingPsychometric.length
  if (!user?.id || loading || dismissed || totalPending === 0) {
    return null
  }

  // Build unified list of pending items for rendering
  type PendingItem = {
    id: string
    type: 'exam' | 'psychometric'
    title: string
    answered: number
    total: number
    resumeUrl: string
  }

  const allPendingItems: PendingItem[] = [
    ...pendingExams.map(e => ({
      id: e.id,
      type: 'exam' as const,
      title: e.title || `Tema ${e.temaNumber}`,
      answered: e.answeredQuestions,
      total: e.totalQuestions,
      resumeUrl: getResumeUrl(e),
    })),
    ...pendingPsychometric.map(s => ({
      id: s.id,
      type: 'psychometric' as const,
      title: s.categoryName || 'Test psicotécnico',
      answered: s.questionsAnswered,
      total: s.totalQuestions,
      resumeUrl: `/psicotecnicos/test/ejecutar?resume=${s.id}`,
    })),
  ]

  if (allPendingItems.length === 0) return null

  const first = allPendingItems[0]
  const firstProgress = first.total > 0 ? Math.round((first.answered / first.total) * 100) : 0
  const isPsycho = first.type === 'psychometric'

  // Discard handler: delegates to the right function based on type
  function handleDiscard(item: PendingItem) {
    handleDiscardExam(item.id)
  }
  function confirmDiscard(item: PendingItem) {
    if (item.type === 'psychometric') {
      confirmDiscardPsychometric(item.id)
    } else {
      confirmDiscardExam(item.id)
    }
  }

  const headerLabel = totalPending === 1
    ? (isPsycho ? 'Test psicotécnico pendiente' : 'Examen pendiente')
    : `${totalPending} tests pendientes`

  return (
    <div className="fixed bottom-4 right-4 z-50 max-w-sm animate-in slide-in-from-bottom-4">
      <div className={`${isPsycho ? 'bg-violet-50 border-violet-300' : 'bg-amber-50 border-amber-300'} border rounded-xl shadow-lg overflow-hidden`}>
        {/* Header compacto */}
        <div className={`${isPsycho ? 'bg-violet-100' : 'bg-amber-100'} px-4 py-2 flex items-center justify-between`}>
          <div className="flex items-center gap-2">
            <span className="text-lg">{isPsycho ? '🧠' : '📝'}</span>
            <span className={`font-medium ${isPsycho ? 'text-violet-800' : 'text-amber-800'} text-sm`}>
              {headerLabel}
            </span>
          </div>
          <button
            onClick={handleDismiss}
            className={`${isPsycho ? 'text-violet-600 hover:text-violet-800 hover:bg-violet-200' : 'text-amber-600 hover:text-amber-800 hover:bg-amber-200'} p-1 rounded-full transition-colors`}
            title="Cerrar (reaparecerá en 1 hora)"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Contenido */}
        <div className="p-4">
          {confirmingDiscard === first.id ? (
            <div className="text-center py-2">
              <p className="text-sm text-gray-700 mb-3">
                ¿Descartar este {isPsycho ? 'test' : 'examen'}?
              </p>
              <div className="flex gap-2 justify-center">
                <button
                  onClick={cancelDiscard}
                  className="px-4 py-2 text-sm font-medium text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
                >
                  Cancelar
                </button>
                <button
                  onClick={() => confirmDiscard(first)}
                  className="px-4 py-2 text-sm font-medium text-white bg-red-500 hover:bg-red-600 rounded-lg transition-colors"
                >
                  Sí, descartar
                </button>
              </div>
            </div>
          ) : (
            <>
              <div className="flex items-center justify-between gap-3 mb-3">
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-gray-800 truncate">
                    {first.title}
                  </div>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-xs text-gray-500">
                      {first.answered}/{first.total}
                    </span>
                    <div className="flex-1 bg-gray-200 rounded-full h-1.5">
                      <div
                        className={`${isPsycho ? 'bg-violet-500' : 'bg-amber-500'} h-1.5 rounded-full`}
                        style={{ width: `${firstProgress}%` }}
                      />
                    </div>
                    <span className={`text-xs font-medium ${isPsycho ? 'text-violet-600' : 'text-amber-600'}`}>
                      {firstProgress}%
                    </span>
                  </div>
                </div>
              </div>

              <div className="flex gap-2">
                <Link
                  href={first.resumeUrl}
                  className={`flex-1 text-center px-4 py-2 ${isPsycho ? 'bg-violet-500 hover:bg-violet-600' : 'bg-amber-500 hover:bg-amber-600'} text-white text-sm font-medium rounded-lg transition-colors`}
                >
                  Continuar
                </Link>
                <button
                  onClick={() => handleDiscard(first)}
                  disabled={discarding === first.id}
                  className="px-3 py-2 text-gray-500 hover:text-red-600 hover:bg-red-50 text-sm rounded-lg transition-colors disabled:opacity-50"
                  title="Descartar"
                >
                  {discarding === first.id ? (
                    <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                  ) : (
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  )}
                </button>
              </div>
            </>
          )}

          {allPendingItems.length > 1 && (
            <button
              onClick={() => setExpanded(!expanded)}
              className={`w-full mt-2 text-xs ${isPsycho ? 'text-violet-600 hover:text-violet-800' : 'text-amber-600 hover:text-amber-800'}`}
            >
              {expanded ? 'Ocultar otros' : `Ver ${allPendingItems.length - 1} más`}
            </button>
          )}

          {/* Lista expandida */}
          {expanded && allPendingItems.length > 1 && (
            <div className="mt-3 space-y-2 border-t border-gray-200 pt-3">
              {allPendingItems.slice(1).map(item => {
                const progress = item.total > 0
                  ? Math.round((item.answered / item.total) * 100)
                  : 0
                const itemIsPsycho = item.type === 'psychometric'

                return (
                  <div key={item.id} className={`p-2 bg-white rounded-lg border ${itemIsPsycho ? 'border-violet-200' : 'border-amber-200'}`}>
                    {confirmingDiscard === item.id ? (
                      <div className="text-center py-1">
                        <p className="text-xs text-gray-700 mb-2">¿Descartar?</p>
                        <div className="flex gap-2 justify-center">
                          <button
                            onClick={cancelDiscard}
                            className="px-2 py-1 text-xs font-medium text-gray-600 bg-gray-100 hover:bg-gray-200 rounded transition-colors"
                          >
                            No
                          </button>
                          <button
                            onClick={() => confirmDiscard(item)}
                            className="px-2 py-1 text-xs font-medium text-white bg-red-500 hover:bg-red-600 rounded transition-colors"
                          >
                            Sí
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2">
                        <Link
                          href={item.resumeUrl}
                          className={`flex-1 min-w-0 ${itemIsPsycho ? 'hover:text-violet-600' : 'hover:text-amber-600'} transition-colors`}
                        >
                          <div className="text-xs font-medium text-gray-700 truncate">
                            {itemIsPsycho ? '🧠 ' : ''}{item.title}
                          </div>
                          <div className="text-xs text-gray-500">
                            {item.answered}/{item.total} ({progress}%)
                          </div>
                        </Link>
                        <button
                          onClick={() => handleDiscard(item)}
                          disabled={discarding === item.id}
                          className="flex-shrink-0 p-1 text-gray-400 hover:text-red-500 transition-colors disabled:opacity-50"
                          title="Descartar"
                        >
                          {discarding === item.id ? (
                            <svg className="animate-spin h-3 w-3" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path>
                            </svg>
                          ) : (
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                          )}
                        </button>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
