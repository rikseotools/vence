// components/PendingExams.js - Notificación de exámenes pendientes (dismissable)
'use client'
import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useAuth } from '../contexts/AuthContext'

export default function PendingExams({ temaNumber = null, limit = 5 }) {
  const { user } = useAuth()
  const [pendingExams, setPendingExams] = useState([])
  const [loading, setLoading] = useState(true)
  const [dismissed, setDismissed] = useState(false)
  const [expanded, setExpanded] = useState(false)

  useEffect(() => {
    if (!user?.id) {
      setLoading(false)
      return
    }

    // Siempre cargar exámenes primero para verificar si hay nuevos
    loadPendingExams()
  }, [user?.id, temaNumber])

  async function loadPendingExams() {
    try {
      setLoading(true)

      const params = new URLSearchParams({
        userId: user.id,
        testType: 'exam',
        limit: limit.toString()
      })

      const response = await fetch(`/api/exam/pending?${params}`)
      const data = await response.json()

      if (!response.ok || !data.success) {
        setPendingExams([])
        return
      }

      // Filtrar por tema si se especifica
      let exams = data.exams || []
      if (temaNumber) {
        exams = exams.filter(e => e.temaNumber === temaNumber)
      }

      // Verificar si estos exámenes fueron cerrados antes
      const dismissedIds = JSON.parse(localStorage.getItem('pendingExamsDismissedIds') || '[]')
      const currentIds = exams.map(e => e.id)

      // Si hay exámenes nuevos que no fueron cerrados, mostrar banner
      const hasNewExams = currentIds.some(id => !dismissedIds.includes(id))

      if (!hasNewExams && exams.length > 0) {
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
    // Guardar IDs de exámenes cerrados
    const currentIds = pendingExams.map(e => e.id)
    localStorage.setItem('pendingExamsDismissedIds', JSON.stringify(currentIds))

    // Ocultar por 1 hora
    const dismissUntil = Date.now() + (60 * 60 * 1000)
    localStorage.setItem('pendingExamsDismissedUntil', dismissUntil.toString())
    setDismissed(true)
  }

  // No mostrar si: no hay usuario, cargando, cerrado, o no hay exámenes
  if (!user?.id || loading || dismissed || pendingExams.length === 0) {
    return null
  }

  const exam = pendingExams[0] // Mostrar el más reciente
  const progressPercent = exam.totalQuestions > 0
    ? Math.round((exam.answeredQuestions / exam.totalQuestions) * 100)
    : 0

  const resumeUrl = `/auxiliar-administrativo-estado/test/tema/${exam.temaNumber || 1}/test-examen?resume=${exam.id}`

  return (
    <div className="fixed bottom-4 right-4 z-50 max-w-sm animate-in slide-in-from-bottom-4">
      <div className="bg-amber-50 border border-amber-300 rounded-xl shadow-lg overflow-hidden">
        {/* Header compacto */}
        <div className="bg-amber-100 px-4 py-2 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-lg">📝</span>
            <span className="font-medium text-amber-800 text-sm">
              {pendingExams.length === 1 ? 'Examen pendiente' : `${pendingExams.length} exámenes pendientes`}
            </span>
          </div>
          <button
            onClick={handleDismiss}
            className="text-amber-600 hover:text-amber-800 p-1 rounded-full hover:bg-amber-200 transition-colors"
            title="Cerrar (reaparecerá en 1 hora)"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Contenido */}
        <div className="p-4">
          <div className="flex items-center justify-between gap-3 mb-3">
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium text-gray-800 truncate">
                {exam.title || `Tema ${exam.temaNumber}`}
              </div>
              <div className="flex items-center gap-2 mt-1">
                <span className="text-xs text-gray-500">
                  {exam.answeredQuestions}/{exam.totalQuestions}
                </span>
                <div className="flex-1 bg-gray-200 rounded-full h-1.5">
                  <div
                    className="bg-amber-500 h-1.5 rounded-full"
                    style={{ width: `${progressPercent}%` }}
                  />
                </div>
                <span className="text-xs font-medium text-amber-600">
                  {progressPercent}%
                </span>
              </div>
            </div>
          </div>

          <Link
            href={resumeUrl}
            className="block w-full text-center px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white text-sm font-medium rounded-lg transition-colors"
          >
            Continuar examen
          </Link>

          {pendingExams.length > 1 && (
            <button
              onClick={() => setExpanded(!expanded)}
              className="w-full mt-2 text-xs text-amber-600 hover:text-amber-800"
            >
              {expanded ? 'Ocultar otros' : `Ver ${pendingExams.length - 1} más`}
            </button>
          )}

          {/* Lista expandida */}
          {expanded && pendingExams.length > 1 && (
            <div className="mt-3 space-y-2 border-t border-amber-200 pt-3">
              {pendingExams.slice(1).map(e => {
                const url = `/auxiliar-administrativo-estado/test/tema/${e.temaNumber || 1}/test-examen?resume=${e.id}`
                const progress = e.totalQuestions > 0
                  ? Math.round((e.answeredQuestions / e.totalQuestions) * 100)
                  : 0

                return (
                  <Link
                    key={e.id}
                    href={url}
                    className="block p-2 bg-white rounded-lg border border-amber-200 hover:border-amber-400 transition-colors"
                  >
                    <div className="text-xs font-medium text-gray-700 truncate">
                      {e.title || `Tema ${e.temaNumber}`}
                    </div>
                    <div className="text-xs text-gray-500">
                      {e.answeredQuestions}/{e.totalQuestions} ({progress}%)
                    </div>
                  </Link>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
