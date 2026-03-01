// app/admin/analytics/page.js - Analytics de preguntas problemáticas
'use client'
import { useState, useEffect } from 'react'
import { useAuth } from '@/contexts/AuthContext'

export default function AnalyticsPage() {
  const { supabase } = useAuth()
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [reviewModal, setReviewModal] = useState({ isOpen: false, question: null, detectionType: null })
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    async function loadAnalytics() {
      if (!supabase) return
      try {
        setLoading(true)
        const { data: { session } } = await supabase.auth.getSession()
        if (!session?.access_token) throw new Error('No autenticado')

        const res = await fetch('/api/admin/analytics', {
          headers: { Authorization: `Bearer ${session.access_token}` },
        })
        if (!res.ok) {
          const body = await res.json().catch(() => ({}))
          throw new Error(body.error || `Error ${res.status}`)
        }
        setData(await res.json())
      } catch (err) {
        console.error('❌ Error cargando analytics:', err)
        setError(err.message)
      } finally {
        setLoading(false)
      }
    }
    loadAnalytics()
  }, [supabase])

  const markQuestionAsReviewed = (questionId, detectionType, questionData) => {
    setReviewModal({
      isOpen: true,
      question: { questionId, ...questionData },
      detectionType
    })
  }

  const handleReviewSubmit = async (reviewData) => {
    if (!supabase || !reviewModal.question) return
    setSubmitting(true)
    try {
      const { error } = await supabase
        .from('problematic_questions_tracking')
        .insert({
          question_id: reviewModal.question.questionId,
          detection_type: reviewModal.detectionType,
          failure_rate: reviewModal.question.failureRate || null,
          abandonment_rate: reviewModal.question.abandonmentRate || null,
          users_affected: reviewModal.question.uniqueUsersWrongCount || reviewModal.question.uniqueUsersAbandonedCount,
          total_attempts: reviewModal.question.totalAttempts || reviewModal.question.totalAppearances,
          status: 'resolved',
          resolved_at: new Date().toISOString(),
          resolved_by: (await supabase.auth.getUser()).data.user?.id,
          admin_notes: reviewData.notes,
          resolution_action: reviewData.action,
          redetection_threshold_users: reviewData.threshold || 5
        })
      if (error) throw error
      window.location.reload()
    } catch (error) {
      console.error('Error marcando pregunta como revisada:', error)
      alert('Error: ' + error.message)
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600 dark:text-gray-400">Analizando preguntas problematicas...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-6">
        <h3 className="text-lg font-semibold text-red-800 dark:text-red-200 mb-2">Error cargando analytics</h3>
        <p className="text-red-600 dark:text-red-400">{error}</p>
        <button
          onClick={() => window.location.reload()}
          className="mt-4 bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 transition-colors"
        >
          Reintentar
        </button>
      </div>
    )
  }

  if (!data) return <div>No hay datos disponibles</div>

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Analytics</h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">Preguntas con alto abandono o tasa de fallo</p>
        </div>
        <div className="flex space-x-3">
          <button
            onClick={() => window.location.reload()}
            className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors text-sm"
          >
            Actualizar
          </button>
          <a
            href="/admin"
            className="bg-gray-600 text-white px-4 py-2 rounded-lg hover:bg-gray-700 transition-colors text-sm"
          >
            Dashboard
          </a>
        </div>
      </div>

      {/* Preguntas que causan abandono */}
      {data.problematicQuestions?.length > 0 && (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow border p-6">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            Preguntas que Causan Mas Abandono ({data.problematicQuestions.length})
          </h3>
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
            Preguntas <strong>activas</strong> donde multiples usuarios abandonan el test. <strong>Pueden tener errores o ser confusas.</strong>
          </p>
          <div className="space-y-4">
            {data.problematicQuestions.map((question, index) => (
              <div key={index} className="border border-red-200 dark:border-red-700 rounded-lg p-4 bg-red-50 dark:bg-red-900/20">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center space-x-2 mb-2">
                      <span className="text-red-600 font-bold text-lg">#{index + 1}</span>
                      <span className="bg-red-600 text-white px-2 py-1 rounded-full text-xs font-medium">
                        {question.uniqueUsersAbandonedCount} usuarios abandonaron
                      </span>
                      <span className="bg-orange-100 text-orange-800 px-2 py-1 rounded-full text-xs">
                        {question.abandonmentRate}% abandono
                      </span>
                    </div>
                    <div className="text-sm text-gray-900 dark:text-white mb-2 font-medium">
                      {question.questionText || 'Texto de pregunta no disponible'}
                    </div>
                    <div className="flex items-center space-x-4 text-xs text-gray-600 dark:text-gray-400">
                      <span>{question.law} - Art. {question.article}</span>
                      <span>{question.totalAppearances} apariciones</span>
                      <span>Pregunta promedio #{question.avgQuestionOrder}</span>
                      <span>{question.uniqueTestsCount} tests</span>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-xs text-red-600 font-medium mb-1">ACCION REQUERIDA</div>
                    {question.abandonmentRate >= 70 ? (
                      <div className="text-xs text-red-800 bg-red-200 px-2 py-1 rounded mb-2">REVISAR URGENTE</div>
                    ) : question.abandonmentRate >= 50 ? (
                      <div className="text-xs text-orange-800 bg-orange-200 px-2 py-1 rounded mb-2">VERIFICAR CONTENIDO</div>
                    ) : (
                      <div className="text-xs text-yellow-800 bg-yellow-200 px-2 py-1 rounded mb-2">MONITOREAR</div>
                    )}
                    {question.questionId ? (
                      <>
                        <button
                          onClick={() => markQuestionAsReviewed(question.questionId, 'high_abandonment', question)}
                          className="bg-blue-600 hover:bg-blue-700 text-white text-xs px-2 py-1 rounded mb-1 block w-full transition-colors"
                        >
                          Revisar
                        </button>
                        <div className="text-xs text-gray-500">ID: {question.questionId}</div>
                      </>
                    ) : (
                      <div className="text-xs text-red-500 bg-red-100 px-2 py-1 rounded">Sin ID</div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
          <div className="mt-4 p-3 bg-red-100 dark:bg-red-900/30 rounded-lg">
            <p className="text-sm text-red-800 dark:text-red-200">
              <strong>Recomendaciones:</strong> Estas preguntas requieren revision inmediata. Pueden tener:
            </p>
            <ul className="text-sm text-red-700 dark:text-red-300 mt-2 ml-4 list-disc">
              <li>Respuestas incorrectas o ambiguas</li>
              <li>Enunciados confusos o mal redactados</li>
              <li>Referencias a articulos derogados</li>
              <li>Dificultad excesiva para su posicion en el test</li>
            </ul>
          </div>
        </div>
      )}

      {/* Preguntas falladas frecuentemente */}
      {data.frequentlyFailedQuestions?.length > 0 && (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow border p-6">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            Preguntas Falladas Frecuentemente ({data.frequentlyFailedQuestions.length})
          </h3>
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
            Preguntas <strong>activas</strong> con alta tasa de error que multiples usuarios fallan. <strong>Pueden tener respuestas incorrectas o ser excesivamente dificiles.</strong>
          </p>
          <div className="space-y-4">
            {data.frequentlyFailedQuestions.map((question, index) => (
              <div key={index} className="border border-orange-200 dark:border-orange-700 rounded-lg p-4 bg-orange-50 dark:bg-orange-900/20">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center space-x-2 mb-2">
                      <span className="text-orange-600 font-bold text-lg">#{index + 1}</span>
                      <span className="bg-orange-600 text-white px-2 py-1 rounded-full text-xs font-medium">
                        {question.uniqueUsersWrongCount} usuarios fallaron
                      </span>
                      <span className="bg-red-100 text-red-800 px-2 py-1 rounded-full text-xs">
                        {question.failureRate}% error
                      </span>
                      <span className="bg-blue-100 text-blue-800 px-2 py-1 rounded-full text-xs">
                        {question.avgTimeSpent}s promedio
                      </span>
                    </div>
                    <div className="text-sm text-gray-900 dark:text-white mb-2 font-medium">
                      {question.questionText || 'Texto de pregunta no disponible'}
                    </div>
                    <div className="flex items-center space-x-4 text-xs text-gray-600 dark:text-gray-400">
                      <span>{question.law} - Art. {question.article}</span>
                      <span>{question.totalAttempts} intentos totales</span>
                      <span>{question.incorrectAttempts} fallos</span>
                      <span>{question.correctAttempts} aciertos</span>
                      <span>{question.uniqueTestsCount} tests</span>
                      {question.lowConfidenceRate > 0 && (
                        <span>{question.lowConfidenceRate}% baja confianza</span>
                      )}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-xs text-orange-600 font-medium mb-1">REVISAR CONTENIDO</div>
                    {question.failureRate >= 80 ? (
                      <div className="text-xs text-red-800 bg-red-200 px-2 py-1 rounded mb-2">CRITICO</div>
                    ) : question.failureRate >= 70 ? (
                      <div className="text-xs text-orange-800 bg-orange-200 px-2 py-1 rounded mb-2">REVISAR RESPUESTA</div>
                    ) : (
                      <div className="text-xs text-yellow-800 bg-yellow-200 px-2 py-1 rounded mb-2">MEJORAR EXPLICACION</div>
                    )}
                    {question.questionId ? (
                      <>
                        <button
                          onClick={() => markQuestionAsReviewed(question.questionId, 'frequent_fails', question)}
                          className="bg-blue-600 hover:bg-blue-700 text-white text-xs px-2 py-1 rounded mb-1 block w-full transition-colors"
                        >
                          Revisar
                        </button>
                        <div className="text-xs text-gray-500">ID: {question.questionId}</div>
                      </>
                    ) : (
                      <div className="text-xs text-red-500 bg-red-100 px-2 py-1 rounded">Sin ID</div>
                    )}
                  </div>
                </div>
                {/* Ratio visual */}
                <div className="mt-3 bg-gray-100 dark:bg-gray-700 rounded-lg p-2">
                  <div className="flex items-center justify-between text-xs">
                    <div className="flex items-center space-x-2">
                      <div className="flex items-center space-x-1">
                        <div className="w-3 h-3 bg-red-500 rounded"></div>
                        <span>{question.uniqueUsersWrongCount} fallaron</span>
                      </div>
                      <div className="flex items-center space-x-1">
                        <div className="w-3 h-3 bg-green-500 rounded"></div>
                        <span>{question.uniqueUsersCorrectCount} acertaron</span>
                      </div>
                    </div>
                    <div className="text-gray-600 dark:text-gray-400">
                      Ratio: {question.uniqueUsersWrongCount}:{question.uniqueUsersCorrectCount}
                    </div>
                  </div>
                  <div className="mt-2 w-full bg-gray-200 rounded-full h-2">
                    <div
                      className="bg-red-500 h-2 rounded-full"
                      style={{
                        width: `${Math.min(100, (question.uniqueUsersWrongCount / (question.uniqueUsersWrongCount + question.uniqueUsersCorrectCount)) * 100)}%`
                      }}
                    ></div>
                  </div>
                </div>
              </div>
            ))}
          </div>
          <div className="mt-4 p-3 bg-orange-100 dark:bg-orange-900/30 rounded-lg">
            <p className="text-sm text-orange-800 dark:text-orange-200">
              <strong>Posibles causas:</strong> Estas preguntas requieren revision del contenido:
            </p>
            <ul className="text-sm text-orange-700 dark:text-orange-300 mt-2 ml-4 list-disc">
              <li>Respuesta marcada como correcta es incorrecta</li>
              <li>Multiples respuestas validas sin especificar "la mas correcta"</li>
              <li>Enunciado ambiguo o mal interpretable</li>
              <li>Dificultad excesiva para el nivel del examen</li>
              <li>Informacion desactualizada o derogada</li>
            </ul>
          </div>
        </div>
      )}

      {/* Empty state */}
      {!data.problematicQuestions?.length && !data.frequentlyFailedQuestions?.length && (
        <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 rounded-lg p-6 text-center">
          <p className="text-green-800 dark:text-green-200 font-medium">No hay preguntas problematicas detectadas</p>
          <p className="text-sm text-green-600 dark:text-green-400 mt-1">Todas las preguntas estan dentro de los umbrales normales.</p>
        </div>
      )}

      {/* Review Modal */}
      {reviewModal.isOpen && (
        <ReviewModal
          question={reviewModal.question}
          detectionType={reviewModal.detectionType}
          onSubmit={handleReviewSubmit}
          onClose={() => setReviewModal({ isOpen: false, question: null, detectionType: null })}
          submitting={submitting}
        />
      )}
    </div>
  )
}

// Componente Modal de Revision
function ReviewModal({ question, detectionType, onSubmit, onClose, submitting }) {
  const [notes, setNotes] = useState('')
  const [action, setAction] = useState('')
  const [threshold, setThreshold] = useState(5)

  const handleSubmit = (e) => {
    e.preventDefault()
    if (!action) {
      alert('Por favor selecciona una accion tomada')
      return
    }
    onSubmit({ notes, action, threshold })
  }

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-[999]">
      <div className="bg-white dark:bg-gray-800 rounded-xl w-full max-w-2xl max-h-[90vh] overflow-hidden shadow-2xl">
        {/* Header */}
        <div className="bg-blue-600 text-white px-6 py-4 flex items-center justify-between">
          <div>
            <h3 className="text-lg font-bold">Marcar Pregunta como Revisada</h3>
            <p className="text-blue-100 text-sm">
              {detectionType === 'frequent_fails' ? 'Pregunta Fallada Frecuentemente' : 'Pregunta con Alto Abandono'}
            </p>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 bg-white/20 hover:bg-white/30 rounded-full flex items-center justify-center transition-colors"
          >
            <span className="text-white font-bold">x</span>
          </button>
        </div>

        {/* Content */}
        <div className="p-6 max-h-[80vh] overflow-y-auto">
          <div className="space-y-6">
            {/* Metrics header */}
            <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 rounded-lg p-4">
              <div className="flex items-center justify-between mb-2">
                <h4 className="font-bold text-red-800 dark:text-red-200">Pregunta Problematica</h4>
                <span className="text-xs text-red-600 bg-red-100 px-2 py-1 rounded">ID: {question.questionId}</span>
              </div>
              <div className="text-sm text-red-700 dark:text-red-300">
                <strong>Metrica:</strong> {
                  detectionType === 'frequent_fails'
                    ? `${question.failureRate}% fallos (${question.uniqueUsersWrongCount} usuarios unicos)`
                    : `${question.abandonmentRate}% abandono (${question.uniqueUsersAbandonedCount} usuarios unicos)`
                }
              </div>
            </div>

            {/* Full question data */}
            {question.fullData && (
              <>
                <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 rounded-lg p-4">
                  <h5 className="font-bold text-blue-800 dark:text-blue-200 mb-3">Enunciado</h5>
                  <p className="text-gray-800 dark:text-gray-200 leading-relaxed">
                    {question.fullData.question_text}
                  </p>
                </div>

                <div className="bg-gray-50 dark:bg-gray-700 border border-gray-200 rounded-lg p-4">
                  <h5 className="font-bold text-gray-800 dark:text-gray-200 mb-3">Opciones de Respuesta</h5>
                  <div className="space-y-2">
                    {['a', 'b', 'c', 'd'].map((letter, index) => {
                      const optionKey = `option_${letter}`
                      const isCorrect = question.fullData.correct_option === index
                      return (
                        <div
                          key={letter}
                          className={`p-3 rounded-lg border-2 ${
                            isCorrect
                              ? 'bg-green-100 border-green-300 text-green-800 dark:bg-green-900/30 dark:border-green-600 dark:text-green-200'
                              : 'bg-white border-gray-200 text-gray-700 dark:bg-gray-600 dark:border-gray-500 dark:text-gray-200'
                          }`}
                        >
                          <span className="font-bold uppercase mr-2">{letter})</span>
                          {question.fullData[optionKey]}
                          {isCorrect && <span className="ml-2 text-green-600">CORRECTA</span>}
                        </div>
                      )
                    })}
                  </div>
                </div>

                <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 rounded-lg p-4">
                  <h5 className="font-bold text-yellow-800 dark:text-yellow-200 mb-3">Explicacion</h5>
                  <p className="text-gray-800 dark:text-gray-200 leading-relaxed">
                    {question.fullData.explanation || 'Sin explicacion disponible'}
                  </p>
                </div>

                <div className="bg-purple-50 dark:bg-purple-900/20 border border-purple-200 rounded-lg p-4">
                  <h5 className="font-bold text-purple-800 dark:text-purple-200 mb-3">Marco Legal</h5>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                    <div>
                      <strong className="text-purple-700 dark:text-purple-300">Ley:</strong>
                      <div className="text-gray-700 dark:text-gray-300">
                        {question.fullData.articles?.laws?.name || 'No disponible'}
                        {question.fullData.articles?.laws?.short_name &&
                          ` (${question.fullData.articles.laws.short_name})`
                        }
                      </div>
                    </div>
                    <div>
                      <strong className="text-purple-700 dark:text-purple-300">Articulo:</strong>
                      <div className="text-gray-700 dark:text-gray-300">
                        Art. {question.fullData.articles?.article_number || 'No disponible'}
                        {question.fullData.articles?.title &&
                          ` - ${question.fullData.articles.title}`
                        }
                      </div>
                    </div>
                  </div>
                </div>
              </>
            )}

            {!question.fullData && (
              <div className="bg-gray-100 dark:bg-gray-700 border border-gray-300 rounded-lg p-4 text-center">
                <p className="text-gray-600 dark:text-gray-400">
                  No se pudieron cargar los datos completos de la pregunta
                </p>
              </div>
            )}

            {/* Review history */}
            {question.reviewHistory && question.reviewHistory.length > 0 && (
              <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 rounded-lg p-4">
                <h5 className="font-bold text-amber-800 dark:text-amber-200 mb-3 flex items-center">
                  Historial de Revisiones ({question.reviewHistory.length})
                </h5>
                <div className="space-y-3 max-h-60 overflow-y-auto">
                  {question.reviewHistory.map((review, index) => (
                    <div key={review.id} className="bg-white dark:bg-gray-600 border border-amber-200 rounded-lg p-3">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center space-x-2">
                          <span className={`text-xs px-2 py-1 rounded-full font-medium ${
                            review.status === 'resolved'
                              ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-200'
                              : review.status === 'pending'
                              ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-200'
                              : 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300'
                          }`}>
                            {review.status === 'resolved' ? 'Resuelto' :
                             review.status === 'pending' ? 'Pendiente' :
                             review.status}
                          </span>
                          <span className="text-xs text-gray-500">
                            #{question.reviewHistory.length - index}
                          </span>
                        </div>
                        <span className="text-xs text-gray-500">
                          {new Date(review.detected_at).toLocaleDateString('es-ES', {
                            day: '2-digit', month: '2-digit', year: 'numeric',
                            hour: '2-digit', minute: '2-digit'
                          })}
                        </span>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-xs">
                        <div>
                          <strong className="text-amber-700 dark:text-amber-300">Tipo:</strong>
                          <span className="ml-1 text-gray-700 dark:text-gray-300">
                            {review.detection_type === 'frequent_fails' ? 'Fallos frecuentes' : 'Alto abandono'}
                          </span>
                        </div>
                        <div>
                          <strong className="text-amber-700 dark:text-amber-300">Metrica:</strong>
                          <span className="ml-1 text-gray-700 dark:text-gray-300">
                            {review.detection_type === 'frequent_fails'
                              ? `${review.failure_rate}% fallos`
                              : `${review.abandonment_rate}% abandono`
                            } ({review.users_affected} usuarios)
                          </span>
                        </div>
                      </div>

                      {review.status === 'resolved' && (
                        <div className="mt-2 pt-2 border-t border-amber-200">
                          <div className="text-xs">
                            <div className="mb-1">
                              <strong className="text-green-700 dark:text-green-300">Admin:</strong>
                              <span className="ml-1 text-gray-700 dark:text-gray-300">
                                {review.admin_full_name || 'Admin desconocido'}
                              </span>
                            </div>
                            {review.resolution_action && (
                              <div className="mb-1">
                                <strong className="text-green-700 dark:text-green-300">Accion:</strong>
                                <span className="ml-1 text-gray-700 dark:text-gray-300">
                                  {review.resolution_action === 'question_fixed' ? 'Pregunta corregida' :
                                   review.resolution_action === 'answer_corrected' ? 'Respuesta corregida' :
                                   review.resolution_action === 'explanation_improved' ? 'Explicacion mejorada' :
                                   review.resolution_action === 'question_deactivated' ? 'Pregunta desactivada' :
                                   review.resolution_action === 'no_action_needed' ? 'No requeria accion' :
                                   review.resolution_action === 'monitoring_required' ? 'Requiere monitoreo' :
                                   review.resolution_action}
                                </span>
                              </div>
                            )}
                            {review.admin_notes && (
                              <div>
                                <strong className="text-green-700 dark:text-green-300">Notas:</strong>
                                <p className="ml-1 text-gray-700 dark:text-gray-300 italic">
                                  &quot;{review.admin_notes}&quot;
                                </p>
                              </div>
                            )}
                            {review.resolved_at && (
                              <div className="text-xs text-gray-500 mt-1">
                                Resuelto el {new Date(review.resolved_at).toLocaleDateString('es-ES', {
                                  day: '2-digit', month: '2-digit', year: 'numeric',
                                  hour: '2-digit', minute: '2-digit'
                                })}
                              </div>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="border-t border-gray-300 dark:border-gray-600 my-6"></div>

          {/* Review form */}
          <div>
            <h4 className="text-lg font-bold text-gray-900 dark:text-white mb-4">
              Formulario de Revision
            </h4>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Que accion tomaste?
                </label>
                <select
                  value={action}
                  onChange={(e) => setAction(e.target.value)}
                  className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                  required
                >
                  <option value="">Selecciona una accion...</option>
                  <option value="question_fixed">Pregunta corregida</option>
                  <option value="answer_corrected">Respuesta corregida</option>
                  <option value="explanation_improved">Explicacion mejorada</option>
                  <option value="question_deactivated">Pregunta desactivada</option>
                  <option value="no_action_needed">No requiere accion (falso positivo)</option>
                  <option value="monitoring_required">Requiere monitoreo adicional</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Notas de revision (opcional)
                </label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={3}
                  className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                  placeholder="Describe que encontraste y que accion tomaste..."
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Umbral para re-deteccion (usuarios adicionales que la fallen)
                </label>
                <input
                  type="number"
                  value={threshold}
                  onChange={(e) => setThreshold(parseInt(e.target.value) || 5)}
                  min="1"
                  max="20"
                  className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                />
                <p className="text-xs text-gray-500 mt-1">
                  La pregunta volvera a aparecer si {threshold} usuarios mas la fallan despues de esta revision
                </p>
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={onClose}
                  className="flex-1 bg-gray-500 hover:bg-gray-600 text-white py-3 px-4 rounded-lg font-medium transition-colors"
                  disabled={submitting}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="flex-1 bg-green-600 hover:bg-green-700 text-white py-3 px-4 rounded-lg font-medium transition-colors disabled:opacity-50"
                  disabled={submitting}
                >
                  {submitting ? 'Guardando...' : 'Marcar como Revisada'}
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  )
}
