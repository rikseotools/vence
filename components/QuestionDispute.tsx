// components/QuestionDispute.tsx - Componente unificado para impugnar preguntas
'use client'
import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import type { ExistingDisputeData } from '@/lib/api/dispute'

// ============================================
// TIPOS
// ============================================

interface AuthContextValue {
  supabase: ReturnType<typeof import('@supabase/supabase-js').createClient>
}

interface QuestionDisputeProps {
  questionId: string | null | undefined
  user: { id: string; email?: string; user_metadata?: { full_name?: string } } | null
  isOpen?: boolean | null   // null/undefined = inline, boolean = modal
  onClose?: (() => void) | null
}

type DisputeTypeValue = 'no_literal' | 'respuesta_incorrecta' | 'otro' | ''

// ============================================
// HELPERS
// ============================================

function formatDate(dateString: string): string {
  return new Date(dateString).toLocaleDateString('es-ES', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function getStatusEmoji(status: string): string {
  switch (status) {
    case 'pending': return '⏳'
    case 'approved': return '✅'
    case 'rejected': return '❌'
    case 'under_review': return '🔍'
    default: return '📋'
  }
}

function getStatusText(status: string): string {
  switch (status) {
    case 'pending': return 'Pendiente de revisión'
    case 'approved': return 'Aprobada'
    case 'rejected': return 'Rechazada'
    case 'under_review': return 'En revisión'
    default: return 'Estado desconocido'
  }
}

function buildDescription(disputeType: string, description: string): string {
  if (disputeType === 'otro') return description.trim()
  return `Motivo: ${disputeType}${description.trim() ? ` - Detalles: ${description.trim()}` : ''}`
}

// ============================================
// COMPONENTE
// ============================================

export default function QuestionDispute({
  questionId,
  user,
  isOpen: externalIsOpen = null,
  onClose = null,
}: QuestionDisputeProps) {
  const { supabase } = useAuth() as AuthContextValue

  const [internalIsOpen, setInternalIsOpen] = useState(false)
  const isOpen = externalIsOpen !== null ? externalIsOpen : internalIsOpen

  const [disputeType, setDisputeType] = useState<DisputeTypeValue>('')
  const [description, setDescription] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')

  // Verificación previa
  const [existingDispute, setExistingDispute] = useState<ExistingDisputeData | null>(null)
  const [checkingExisting, setCheckingExisting] = useState(false)
  const [hasChecked, setHasChecked] = useState(false)

  // ------------------------------------------
  // Obtener token de sesión
  // ------------------------------------------
  const getToken = useCallback(async (): Promise<string | null> => {
    try {
      const { data: { session } } = await supabase.auth.getSession()
      return session?.access_token ?? null
    } catch {
      return null
    }
  }, [supabase])

  // ------------------------------------------
  // Verificar impugnación existente (GET)
  // ------------------------------------------
  const checkExistingDispute = useCallback(async () => {
    if (!questionId) return
    setCheckingExisting(true)
    setErrorMessage('')

    try {
      const token = await getToken()
      if (!token) {
        // Sin token: mostrar formulario (fallback graceful)
        setCheckingExisting(false)
        setHasChecked(true)
        return
      }

      const res = await fetch(`/api/dispute?questionId=${questionId}`, {
        headers: { 'Authorization': `Bearer ${token}` },
      })

      if (res.ok) {
        const result = await res.json()
        if (result.success && result.data) {
          setExistingDispute(result.data)
        }
      }
    } catch (err) {
      console.error('Error checking existing dispute:', err)
      // Fallback: mostrar formulario
    } finally {
      setCheckingExisting(false)
      setHasChecked(true)
    }
  }, [questionId, getToken])

  // Al abrir, verificar si ya existe
  useEffect(() => {
    if (isOpen && questionId && !hasChecked) {
      checkExistingDispute()
    }
  }, [isOpen, questionId, hasChecked, checkExistingDispute])

  // ------------------------------------------
  // Submit (POST)
  // ------------------------------------------
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setErrorMessage('')

    if (!user) {
      setErrorMessage('Debes estar registrado para impugnar preguntas')
      return
    }

    if (!disputeType) {
      setErrorMessage('Por favor selecciona un motivo de impugnación')
      return
    }

    if (existingDispute) {
      setErrorMessage('Ya has impugnado esta pregunta anteriormente')
      return
    }

    const token = await getToken()
    if (!token) {
      setErrorMessage('Error de autenticación. Intenta iniciar sesión de nuevo.')
      return
    }

    setSubmitting(true)

    try {
      const desc = buildDescription(disputeType, description)

      const res = await fetch('/api/dispute', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          questionId,
          disputeType,
          description: desc,
        }),
      })

      const result = await res.json()

      if (!res.ok || !result.success) {
        if (res.status === 409) {
          setErrorMessage('Ya has impugnado esta pregunta anteriormente')
        } else {
          setErrorMessage(result.error || 'Error al enviar la impugnación')
        }
        return
      }

      // Email admin (fire-and-forget)
      if (result.data) {
        import('../lib/notifications/adminEmailNotifications')
          .then(({ sendAdminDisputeNotification }) =>
            sendAdminDisputeNotification({
              id: result.data.id,
              question_id: questionId!,
              user_id: user.id,
              user_email: user.email || 'Usuario anónimo',
              user_name: user.user_metadata?.full_name || 'Sin nombre',
              dispute_type: disputeType,
              description: desc,
              created_at: result.data.createdAt,
            })
          )
          .catch((err) => console.error('Error enviando email admin:', err))
      }

      setSubmitted(true)
      setDescription('')
      setDisputeType('')

      // Scroll suave al éxito
      setTimeout(() => {
        const el = document.querySelector('[data-success-message]')
        if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' })
      }, 150)

      // Auto-cerrar a los 6s
      setTimeout(() => {
        if (onClose) {
          onClose()
        } else {
          setInternalIsOpen(false)
        }
        setSubmitted(false)
        setHasChecked(false)
      }, 6000)
    } catch (err) {
      console.error('❌ Error enviando impugnación:', err)
      setErrorMessage('Error inesperado al enviar la impugnación. Inténtalo de nuevo.')
    } finally {
      setSubmitting(false)
    }
  }

  // ------------------------------------------
  // Validación
  // ------------------------------------------
  const canSubmit = !!questionId && !!disputeType && !submitting && !existingDispute

  // ------------------------------------------
  // Render helpers
  // ------------------------------------------

  const renderExistingDispute = () => (
    <div className="bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-700 rounded-lg p-4">
      <div className="flex items-start space-x-3">
        <span className="text-2xl">{getStatusEmoji(existingDispute!.status || '')}</span>
        <div className="flex-1">
          <h4 className="font-semibold text-blue-800 dark:text-blue-300 mb-2">
            Ya impugnaste esta pregunta
          </h4>
          <div className="space-y-2 text-sm text-blue-700 dark:text-blue-400">
            <p><strong>Estado:</strong> {getStatusText(existingDispute!.status || '')}</p>
            <p><strong>Motivo:</strong> {existingDispute!.disputeType}</p>
            {existingDispute!.createdAt && (
              <p><strong>Fecha:</strong> {formatDate(existingDispute!.createdAt)}</p>
            )}

            {existingDispute!.adminResponse && (
              <div className="mt-3 p-3 bg-white dark:bg-gray-800 rounded border">
                <p className="font-medium text-gray-800 dark:text-gray-200 mb-1">Respuesta del administrador:</p>
                <p className="text-gray-700 dark:text-gray-300 text-sm">{existingDispute!.adminResponse}</p>
              </div>
            )}
          </div>

          <div className="mt-3 text-xs text-blue-600 dark:text-blue-500">
            Solo se permite una impugnación por pregunta y usuario. Puedes consultar todas tus impugnaciones en tu perfil.
          </div>
        </div>
      </div>
    </div>
  )

  const renderErrorMessage = () =>
    errorMessage ? (
      <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-3 text-sm text-red-700 dark:text-red-300">
        {errorMessage}
      </div>
    ) : null

  const renderRadioButtons = (isModal: boolean) => {
    const textColor = isModal
      ? 'text-gray-700 dark:text-gray-300'
      : 'text-orange-700 dark:text-orange-300'

    return (
      <div className="space-y-2">
        <label className="flex items-center space-x-2 cursor-pointer">
          <input
            type="radio"
            name="disputeType"
            value="no_literal"
            checked={disputeType === 'no_literal'}
            onChange={(e) => setDisputeType(e.target.value as DisputeTypeValue)}
            className="text-orange-600 focus:ring-orange-500"
          />
          <span className={`text-sm ${textColor}`}>
            Pregunta no literal (no se ajusta exactamente al artículo)
          </span>
        </label>

        <label className="flex items-center space-x-2 cursor-pointer">
          <input
            type="radio"
            name="disputeType"
            value="respuesta_incorrecta"
            checked={disputeType === 'respuesta_incorrecta'}
            onChange={(e) => setDisputeType(e.target.value as DisputeTypeValue)}
            className="text-orange-600 focus:ring-orange-500"
          />
          <span className={`text-sm ${textColor}`}>
            La respuesta marcada como correcta es errónea
          </span>
        </label>

        <label className="flex items-center space-x-2 cursor-pointer">
          <input
            type="radio"
            name="disputeType"
            value="otro"
            checked={disputeType === 'otro'}
            onChange={(e) => setDisputeType(e.target.value as DisputeTypeValue)}
            className="text-orange-600 focus:ring-orange-500"
          />
          <span className={`text-sm ${textColor}`}>
            Otro motivo
          </span>
        </label>
      </div>
    )
  }

  const renderSuccessMessage = () => (
    <div data-success-message className="text-center py-6">
      <div className="text-4xl mb-3">✅</div>
      <h4 className="font-bold text-green-800 dark:text-green-300 mb-2">
        ¡Impugnación enviada!
      </h4>
      <p className="text-green-700 dark:text-green-400 text-sm mb-2">
        Tu impugnación ha sido registrada y será revisada lo antes posible.
      </p>
      <p className="text-green-600 dark:text-green-500 text-xs">
        Se cerrará automáticamente en unos segundos...
      </p>
    </div>
  )

  const renderInfoBox = () => (
    <div className="bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-700 rounded-lg p-3">
      <div className="flex items-start space-x-2">
        <span className="text-blue-600 dark:text-blue-400">ℹ️</span>
        <div className="text-xs text-blue-700 dark:text-blue-300">
          <p>Tu impugnación será revisada. Recibirás una respuesta en tu perfil lo antes posible.</p>
        </div>
      </div>
    </div>
  )

  const renderLoading = () => (
    <div className="text-center py-4">
      <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-orange-600 mx-auto mb-2"></div>
      <p className="text-orange-700 dark:text-orange-400 text-sm">Verificando impugnaciones anteriores...</p>
    </div>
  )

  // ============================================
  // MODO MODAL
  // ============================================

  if (externalIsOpen !== null) {
    return (
      <>
        {isOpen && (
          <div className="fixed inset-0 flex items-center justify-center z-50 p-4 pointer-events-none">
            <div className="pointer-events-auto">
              <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl max-w-md w-full max-h-[90vh] overflow-y-auto">
                <div className="p-6">
                  {/* Header del modal */}
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                      Impugnar Pregunta
                    </h3>
                    <button
                      onClick={() => onClose?.()}
                      className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                    >
                      ✕
                    </button>
                  </div>

                  {/* Contenido del modal */}
                  <div className="bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800 rounded-lg p-4">

                    {/* Sin questionId */}
                    {!questionId && (
                      <div className="bg-yellow-50 dark:bg-yellow-900/30 border border-yellow-300 dark:border-yellow-700 rounded-lg p-4 text-center">
                        <div className="text-3xl mb-3">⚠️</div>
                        <h4 className="font-semibold text-yellow-800 dark:text-yellow-200 mb-2">
                          No se detectó ninguna pregunta
                        </h4>
                        <p className="text-sm text-yellow-700 dark:text-yellow-300 mb-3">
                          Para impugnar una pregunta, debes hacerlo desde el test mientras visualizas la pregunta.
                        </p>
                        <p className="text-xs text-yellow-600 dark:text-yellow-400">
                          Usa el botón <strong>&quot;Impugnar pregunta&quot;</strong> que aparece debajo de cada pregunta después de responderla.
                        </p>
                      </div>
                    )}

                    {/* Loading */}
                    {questionId && checkingExisting && renderLoading()}

                    {/* Impugnación existente */}
                    {questionId && !checkingExisting && existingDispute && renderExistingDispute()}

                    {/* Éxito */}
                    {questionId && !checkingExisting && !existingDispute && submitted && renderSuccessMessage()}

                    {/* Formulario */}
                    {questionId && !checkingExisting && !existingDispute && !submitted && (
                      <form onSubmit={handleSubmit} className="space-y-4">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
                            Motivo de impugnación *
                          </label>
                          {renderRadioButtons(true)}
                        </div>

                        {/* Descripción */}
                        <div>
                          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                            Descripción {disputeType === 'otro' ? '*' : '(opcional)'}
                          </label>
                          <textarea
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                            placeholder={
                              disputeType === 'otro'
                                ? 'Describe detalladamente el problema con esta pregunta...'
                                : 'Información adicional (opcional)...'
                            }
                            rows={4}
                            className="w-full p-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder-gray-500 dark:placeholder-gray-400 focus:ring-2 focus:ring-orange-500 focus:border-orange-500 transition-colors resize-none"
                          />
                        </div>

                        {renderErrorMessage()}
                        {renderInfoBox()}

                        {/* Botones */}
                        <div className="flex items-center justify-between pt-4">
                          <button
                            type="button"
                            onClick={() => onClose?.()}
                            className="px-4 py-2 text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 text-sm transition-colors"
                          >
                            Cancelar
                          </button>

                          <button
                            type="submit"
                            disabled={!canSubmit}
                            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                              canSubmit
                                ? 'bg-orange-600 hover:bg-orange-700 text-white'
                                : 'bg-gray-300 dark:bg-gray-600 text-gray-500 dark:text-gray-400 cursor-not-allowed'
                            }`}
                          >
                            {submitting ? 'Enviando...' : 'Enviar Impugnación'}
                          </button>
                        </div>
                      </form>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </>
    )
  }

  // ============================================
  // MODO INLINE
  // ============================================

  return (
    <div className="mt-4">
      <button
        onClick={() => setInternalIsOpen(!isOpen)}
        className="flex items-center space-x-2 px-3 py-2 bg-yellow-100 hover:bg-yellow-200 dark:bg-yellow-900/30 dark:hover:bg-yellow-900/50 text-yellow-800 dark:text-yellow-300 text-sm rounded-lg border border-yellow-300 dark:border-yellow-700 transition-colors"
      >
        <span className="text-lg">⚠️</span>
        <span className="font-medium">
          {existingDispute ? 'Ver impugnación' : 'Impugnar pregunta'}
        </span>
        <span className={`transform transition-transform ${isOpen ? 'rotate-180' : ''}`}>
          ▼
        </span>
      </button>

      {/* Contenido desplegable */}
      {isOpen && (
        <div className="mt-3 p-4 bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800 rounded-lg">

          {/* Loading */}
          {checkingExisting && renderLoading()}

          {/* Impugnación existente */}
          {!checkingExisting && existingDispute && renderExistingDispute()}

          {/* Éxito */}
          {!checkingExisting && !existingDispute && submitted && renderSuccessMessage()}

          {/* Formulario */}
          {!checkingExisting && !existingDispute && !submitted && (
            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Header */}
              <div>
                <h4 className="font-bold text-orange-800 dark:text-orange-300 mb-2">
                  Impugnar esta pregunta
                </h4>
                <p className="text-orange-700 dark:text-orange-400 text-sm">
                  Si consideras que hay un error en esta pregunta, puedes impugnarla.
                </p>
              </div>

              {/* Tipo de impugnación */}
              <div>
                <label className="block text-sm font-medium text-orange-800 dark:text-orange-300 mb-2">
                  Motivo de la impugnación: *
                </label>
                {renderRadioButtons(false)}
              </div>

              {/* Campo de descripción - Solo para "otro" */}
              {disputeType === 'otro' && (
                <div>
                  <label className="block text-sm font-medium text-orange-800 dark:text-orange-300 mb-2">
                    Explica detalladamente el problema: * (mínimo 10 caracteres)
                  </label>
                  <textarea
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    rows={4}
                    className="w-full px-3 py-2 border border-orange-300 dark:border-orange-700 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500 dark:bg-gray-800 dark:text-gray-200 text-sm"
                    placeholder="Describe el problema que has encontrado..."
                    required
                  />
                  <div className="text-xs text-orange-600 dark:text-orange-400 mt-1">
                    {description.trim().length}/500 caracteres
                    {description.trim().length < 10 && description.trim().length > 0 && (
                      <span className="text-red-600 ml-2">
                        (Faltan {10 - description.trim().length} caracteres)
                      </span>
                    )}
                  </div>
                </div>
              )}

              {/* Descripción opcional para casos preconfigurados */}
              {(disputeType === 'no_literal' || disputeType === 'respuesta_incorrecta') && (
                <div>
                  <label className="block text-sm font-medium text-orange-800 dark:text-orange-300 mb-2">
                    Información adicional (opcional):
                  </label>
                  <textarea
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    rows={3}
                    className="w-full px-3 py-2 border border-orange-300 dark:border-orange-700 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500 dark:bg-gray-800 dark:text-gray-200 text-sm"
                    placeholder={
                      disputeType === 'no_literal'
                        ? 'Opcionalmente, explica por qué la pregunta no es literal...'
                        : 'Opcionalmente, explica cuál debería ser la respuesta correcta...'
                    }
                  />
                  <div className="text-xs text-orange-600 dark:text-orange-400 mt-1">
                    Campo opcional - {description.trim().length}/500 caracteres
                  </div>
                </div>
              )}

              {renderErrorMessage()}
              {renderInfoBox()}

              {/* Botones */}
              <div className="flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => {
                    if (onClose) {
                      onClose()
                    } else {
                      setInternalIsOpen(false)
                    }
                  }}
                  className="px-4 py-2 text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 text-sm transition-colors"
                >
                  Cancelar
                </button>

                <button
                  type="submit"
                  disabled={!canSubmit}
                  className={`px-6 py-2 rounded-lg text-sm font-medium transition-colors flex items-center space-x-2 ${
                    canSubmit
                      ? 'bg-orange-600 text-white hover:bg-orange-700'
                      : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                  }`}
                >
                  {submitting ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                      <span>Enviando...</span>
                    </>
                  ) : (
                    <>
                      <span>Enviar impugnación</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          )}
        </div>
      )}
    </div>
  )
}
