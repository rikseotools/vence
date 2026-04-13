// components/Statistics/FailedQuestionsReview.tsx - Sección de repaso de falladas en mis-estadisticas
'use client'
import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { useOposicion } from '@/contexts/OposicionContext'
import { getOposicionByPositionType } from '@/lib/config/oposiciones'
import FailedQuestionsModal, { type FailedPeriod } from '@/components/FailedQuestionsModal'
import type { FailedQuestionsData } from '@/components/TestConfigurator.types'
import { buildTestUrl } from '@/lib/test-url/buildTestUrl'

interface TopicFailed {
  topicNumber: number
  topicTitle: string | null
  failedQuestions: number
  totalFailures: number
}

export default function FailedQuestionsReview() {
  const { user, supabase } = useAuth() as { user: { id: string } | null; supabase: ReturnType<typeof import('@supabase/supabase-js').createClient> }
  // OposicionContext expone `oposicionId` (formato snake_case, = positionType) y `userOposicion` (config completa).
  // Antes se desestructuraba `positionType`/`oposicionSlug` que NO existen en el context → siempre undefined.
  // Eso causaba el bug por el que Madrid/Galicia/etc veían títulos de temas de otras oposiciones.
  const { oposicionId, loading: oposicionLoading } = useOposicion()
  const positionType = oposicionId ?? null
  const oposicion = positionType ? getOposicionByPositionType(positionType) : null
  const oposicionSlug = oposicion?.slug ?? null
  const basePath = oposicionSlug ? `/${oposicionSlug}` : '/'

  const [topics, setTopics] = useState<TopicFailed[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [showAll, setShowAll] = useState(false)

  // Modal state
  const [selectedTopic, setSelectedTopic] = useState<TopicFailed | null>(null)
  const [modalData, setModalData] = useState<FailedQuestionsData | null>(null)
  const [modalLoading, setModalLoading] = useState(false)
  const [modalPeriod, setModalPeriod] = useState<FailedPeriod>('all')

  // Cargar temas con falladas (solo si ya tenemos positionType del context)
  const loadTopics = useCallback(async () => {
    if (!user) return
    // Esperar a que el context cargue positionType antes de consultar.
    // Si no hay positionType, no podemos filtrar por oposición y la API
    // devolverá 400 — evitamos el fetch.
    if (oposicionLoading || !positionType) return
    try {
      const session = await supabase.auth.getSession()
      const token = session.data.session?.access_token
      if (!token) return

      const res = await fetch(`/api/questions/failed-by-topic?positionType=${encodeURIComponent(positionType)}`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      const data = await res.json()

      if (data.success) {
        setTopics(data.topics || [])
      } else {
        setError(data.error)
      }
    } catch (e) {
      setError('Error cargando datos')
    } finally {
      setLoading(false)
    }
  }, [user, supabase, positionType, oposicionLoading])

  useEffect(() => { loadTopics() }, [loadTopics])

  // Cargar preguntas falladas de un tema específico
  const loadFailedForTopic = async (topic: TopicFailed, period: FailedPeriod = 'all') => {
    if (!user) return
    setModalLoading(true)

    let since: string | undefined
    if (period === '7d') since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
    else if (period === '30d') since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()

    try {
      const res = await fetch('/api/questions/user-failed', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: user.id,
          topicNumber: topic.topicNumber,
          since,
        }),
      })
      const data = await res.json()

      if (data.success && data.questions?.length > 0) {
        setModalData({
          totalQuestions: data.totalQuestions,
          totalFailures: data.totalFailures,
          questions: data.questions,
        })
      } else {
        setModalData(null)
        if (period !== 'all') {
          alert('No tienes preguntas falladas en este periodo. Prueba con "Todas".')
        }
      }
    } catch {
      alert('Error al cargar las preguntas falladas')
    } finally {
      setModalLoading(false)
    }
  }

  const handleTopicClick = (topic: TopicFailed) => {
    setSelectedTopic(topic)
    setModalPeriod('all')
    loadFailedForTopic(topic, 'all')
  }

  const handleChangePeriod = (period: FailedPeriod) => {
    setModalPeriod(period)
    if (selectedTopic) {
      loadFailedForTopic(selectedTopic, period)
    }
  }

  const handleStart = (questionIds: string[], sortOrder: string, count: number | 'all') => {
    if (!selectedTopic) return

    const numQuestions = count === 'all' ? questionIds.length : Math.min(count, questionIds.length)
    const ids = questionIds.slice(0, numQuestions)

    // Guardar IDs en sessionStorage
    if (typeof window !== 'undefined') {
      sessionStorage.setItem('pendingFailedQuestionIds', JSON.stringify(ids))
    }

    const url = buildTestUrl({
      basePath,
      temaNumber: selectedTopic.topicNumber,
      testMode: 'practica',
      config: {
        tema: selectedTopic.topicNumber,
        numQuestions,
        difficultyMode: 'random',
        onlyOfficialQuestions: false,
        focusEssentialArticles: false,
        excludeRecent: false,
        recentDays: 30,
        focusWeakAreas: false,
        adaptiveMode: false,
        onlyFailedQuestions: true,
        failedQuestionIds: ids,
        failedQuestionsOrder: sortOrder as any,
        selectedLaws: [],
        selectedArticlesByLaw: {},
        selectedSectionFilters: [],
        timeLimit: null,
        configSource: 'failed_questions_review',
        configTimestamp: new Date().toISOString(),
      },
    })

    window.location.href = url
  }

  const handleClose = () => {
    setSelectedTopic(null)
    setModalData(null)
  }

  if (loading) {
    return (
      <div className="bg-white rounded-xl shadow-lg p-6">
        <div className="animate-pulse space-y-3">
          <div className="h-6 bg-gray-200 rounded w-48"></div>
          <div className="h-4 bg-gray-100 rounded w-full"></div>
          <div className="h-4 bg-gray-100 rounded w-3/4"></div>
        </div>
      </div>
    )
  }

  if (error || topics.length === 0) {
    return (
      <div className="bg-white rounded-xl shadow-lg p-6 text-center">
        <div className="text-4xl mb-3">✅</div>
        <h3 className="text-lg font-bold text-gray-700 mb-1">Sin preguntas falladas</h3>
        <p className="text-sm text-gray-500">Completa tests para que aparezcan aquí las preguntas que necesitas repasar</p>
      </div>
    )
  }

  const totalFailed = topics.reduce((sum, t) => sum + t.failedQuestions, 0)
  const INITIAL_COUNT = 10
  const visibleTopics = showAll ? topics : topics.slice(0, INITIAL_COUNT)
  const hasMore = topics.length > INITIAL_COUNT

  return (
    <>
      <div className="bg-white rounded-xl shadow-lg p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-xl font-bold text-gray-800">❌ Repasa tus fallos</h3>
            <p className="text-sm text-gray-500">{totalFailed} preguntas falladas en {topics.length} temas</p>
          </div>
        </div>

        <div className="space-y-2">
          {visibleTopics.map((topic) => (
            <button
              key={topic.topicNumber}
              onClick={() => handleTopicClick(topic)}
              className="w-full p-4 rounded-lg border border-red-100 bg-red-50 hover:bg-red-100 hover:border-red-200 transition-all text-left"
            >
              <div className="flex items-center justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-gray-800 text-sm sm:text-base line-clamp-2">
                    Tema {topic.topicNumber}{topic.topicTitle ? ` - ${topic.topicTitle}` : ''}
                  </div>
                  <div className="text-xs text-gray-500 mt-0.5">
                    {topic.totalFailures} fallos en {topic.failedQuestions} preguntas
                  </div>
                </div>
                <div className="text-right flex-shrink-0">
                  <div className="text-lg font-bold text-red-600">{topic.failedQuestions}</div>
                  <div className="text-xs text-red-500">falladas</div>
                </div>
              </div>
            </button>
          ))}

          {hasMore && !showAll && (
            <button
              onClick={() => setShowAll(true)}
              className="w-full p-3 rounded-lg border border-gray-200 bg-gray-50 hover:bg-gray-100 transition-all text-center text-sm font-medium text-gray-600"
            >
              Ver {topics.length - INITIAL_COUNT} temas más
            </button>
          )}
        </div>
      </div>

      {/* Modal */}
      {selectedTopic && modalData && !modalLoading && (
        <FailedQuestionsModal
          data={modalData}
          title={selectedTopic.topicTitle || `Tema ${selectedTopic.topicNumber}`}
          onClose={handleClose}
          onStart={handleStart}
          onChangePeriod={handleChangePeriod}
          currentPeriod={modalPeriod}
        />
      )}

      {/* Loading overlay for modal */}
      {modalLoading && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 shadow-xl">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-red-600 mx-auto mb-3"></div>
            <p className="text-sm text-gray-600">Cargando preguntas falladas...</p>
          </div>
        </div>
      )}
    </>
  )
}
