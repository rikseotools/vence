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
  const [discarding, setDiscarding] = useState(null) // ID del examen que se está descartando

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

  // Descartar examen permanentemente (no se puede recuperar)
  async function handleDiscardExam(examId) {
    if (!user?.id || !examId) return

    const confirmed = window.confirm(
      '¿Descartar este examen?\n\nEsto eliminará el examen de tu lista de pendientes. No podrás retomarlo.'
    )

    if (!confirmed) return

    try {
      setDiscarding(examId)

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
        alert('Error al descartar el examen')
      }
    } catch (err) {
      console.error('Error descartando examen:', err)
      alert('Error al descartar el examen')
    } finally {
      setDiscarding(null)
    }
  }

  // No mostrar si: no hay usuario, cargando, cerrado, o no hay exámenes
  if (!user?.id || loading || dismissed || pendingExams.length === 0) {
    return null
  }

  const exam = pendingExams[0] // Mostrar el más reciente
  const progressPercent = exam.totalQuestions > 0
    ? Math.round((exam.answeredQuestions / exam.totalQuestions) * 100)
    : 0

  // Generar URL correcta según tipo de examen
  let resumeUrl
  if (exam.title?.toLowerCase().includes('examen oficial')) {
    resumeUrl = `/auxiliar-administrativo-estado/test/examen-oficial?resume=${exam.id}`
  } else if (exam.title?.toLowerCase().includes('aleatorio') || exam.temaNumber === 0 || exam.temaNumber === null) {
    resumeUrl = `/test/aleatorio-examen?resume=${exam.id}`
  } else {
    resumeUrl = `/auxiliar-administrativo-estado/test/tema/${exam.temaNumber || 1}/test-examen?resume=${exam.id}`
  }

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

          <div className="flex gap-2">
            <Link
              href={resumeUrl}
              className="flex-1 text-center px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white text-sm font-medium rounded-lg transition-colors"
            >
              Continuar
            </Link>
            <button
              onClick={() => handleDiscardExam(exam.id)}
              disabled={discarding === exam.id}
              className="px-3 py-2 text-gray-500 hover:text-red-600 hover:bg-red-50 text-sm rounded-lg transition-colors disabled:opacity-50"
              title="Descartar examen"
            >
              {discarding === exam.id ? (
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
                // Generar URL correcta según tipo de examen
                let url
                if (e.title?.toLowerCase().includes('examen oficial')) {
                  url = `/auxiliar-administrativo-estado/test/examen-oficial?resume=${e.id}`
                } else if (e.title?.toLowerCase().includes('aleatorio') || e.temaNumber === 0 || e.temaNumber === null) {
                  url = `/test/aleatorio-examen?resume=${e.id}`
                } else {
                  url = `/auxiliar-administrativo-estado/test/tema/${e.temaNumber || 1}/test-examen?resume=${e.id}`
                }
                const progress = e.totalQuestions > 0
                  ? Math.round((e.answeredQuestions / e.totalQuestions) * 100)
                  : 0

                return (
                  <div key={e.id} className="flex items-center gap-2 p-2 bg-white rounded-lg border border-amber-200">
                    <Link
                      href={url}
                      className="flex-1 hover:text-amber-600 transition-colors"
                    >
                      <div className="text-xs font-medium text-gray-700 truncate">
                        {e.title || `Tema ${e.temaNumber}`}
                      </div>
                      <div className="text-xs text-gray-500">
                        {e.answeredQuestions}/{e.totalQuestions} ({progress}%)
                      </div>
                    </Link>
                    <button
                      onClick={() => handleDiscardExam(e.id)}
                      disabled={discarding === e.id}
                      className="p-1 text-gray-400 hover:text-red-500 transition-colors disabled:opacity-50"
                      title="Descartar"
                    >
                      {discarding === e.id ? (
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
                )
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
