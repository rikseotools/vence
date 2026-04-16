'use client'

import { useState } from 'react'

interface CancellationFlowProps {
  isOpen: boolean
  onClose: () => void
  userId: string
  periodEndDate?: string | number
  onCancelled?: (periodEnd: string) => void
}

const REASONS = [
  { value: 'approved', label: 'He aprobado la oposición' },
  { value: 'not_presenting', label: 'Ya no me voy a presentar' },
  { value: 'exam_done', label: 'Ya hice el examen y no lo necesito' },
  { value: 'too_expensive', label: 'Es muy caro' },
  { value: 'prefer_other', label: 'Prefiero estudiar de otra forma (academia, libros...)' },
  { value: 'missing_features', label: 'La app no tiene lo que necesito' },
  { value: 'no_progress', label: 'No veo progreso en mi preparación' },
  { value: 'hard_to_use', label: 'La app es difícil de usar' },
  { value: 'other', label: 'Otro' },
]

export default function CancellationFlow({ isOpen, onClose, userId, periodEndDate, onCancelled }: CancellationFlowProps) {
  const [loading, setLoading] = useState(false)
  const [feedbackSubmitting, setFeedbackSubmitting] = useState(false)
  const [feedbackSent, setFeedbackSent] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const [resultPeriodEnd, setResultPeriodEnd] = useState<string | null>(null)

  // Form data (solo post-cancelación)
  const [reason, setReason] = useState('')
  const [reasonDetails, setReasonDetails] = useState('')

  const resetForm = () => {
    setReason('')
    setReasonDetails('')
    setError(null)
    setSuccess(false)
    setResultPeriodEnd(null)
    setFeedbackSent(false)
  }

  const handleClose = () => {
    resetForm()
    onClose()
  }

  const handleCancel = async () => {
    setLoading(true)
    setError(null)

    try {
      const response = await fetch('/api/stripe/cancel', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId }), // sin feedback: flujo 1-clic
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Error al cancelar')
      }

      setSuccess(true)
      setResultPeriodEnd(data.periodEnd)

      if (onCancelled) {
        onCancelled(data.periodEnd)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error desconocido')
    } finally {
      setLoading(false)
    }
  }

  const handleSubmitFeedback = async () => {
    if (!reason) return
    setFeedbackSubmitting(true)
    try {
      await fetch('/api/stripe/cancel/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId,
          feedback: {
            reason,
            reasonDetails: reasonDetails || null,
          },
        }),
      })
      setFeedbackSent(true)
    } catch {
      // El feedback es opcional — no bloqueamos al usuario si falla
      setFeedbackSent(true)
    } finally {
      setFeedbackSubmitting(false)
    }
  }

  if (!isOpen) return null

  const formattedPeriodEnd = periodEndDate
    ? new Date(periodEndDate).toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' })
    : null

  const formattedResultEnd = resultPeriodEnd
    ? new Date(resultPeriodEnd).toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' })
    : null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={!loading && !feedbackSubmitting ? handleClose : undefined}
      />

      <div className="relative bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-lg mx-4 max-h-[90vh] overflow-y-auto">
        <div className="p-6">

          {/* PASO 1: Confirmación — un solo clic cancela */}
          {!success && !loading && (
            <div className="text-center">
              <div className="text-4xl mb-4">🤔</div>
              <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-3">
                ¿Seguro que quieres cancelar?
              </h2>
              <p className="text-gray-600 dark:text-gray-300 mb-2">
                Si cancelas, perderás acceso a las funcionalidades Premium cuando termine tu período actual.
              </p>
              {formattedPeriodEnd && (
                <p className="text-sm text-gray-500 dark:text-gray-400 mb-2">
                  Tu acceso Premium termina el <strong>{formattedPeriodEnd}</strong>
                </p>
              )}
              <div className="bg-gradient-to-r from-amber-50 to-orange-50 dark:from-amber-900/20 dark:to-orange-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-3 mb-3">
                <p className="text-sm font-medium text-amber-800 dark:text-amber-200 mb-1">
                  Si cancelas vas a perder tu descuento de fidelidad
                </p>
                <p className="text-xs text-amber-700 dark:text-amber-300">
                  Tu plan incluye un 10% de descuento en la primera y segunda renovación, y un 20% a partir de la tercera. Al cancelar, este beneficio se pierde y no se recupera.
                </p>
              </div>
              <p className="text-sm text-amber-600 dark:text-amber-400 mb-6">
                Tu historial de tests y estadísticas se mantendrán guardados por un tiempo limitado, después se eliminarán.
              </p>

              {error && (
                <div className="mb-4 p-3 bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 rounded-lg text-sm">
                  {error}
                </div>
              )}

              <div className="flex gap-3">
                <button
                  onClick={handleClose}
                  className="flex-1 py-3 px-4 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-medium transition-colors"
                >
                  Mantener mi suscripción
                </button>
                <button
                  onClick={handleCancel}
                  className="flex-1 py-3 px-4 rounded-lg border border-red-300 dark:border-red-700 text-red-600 dark:text-red-400 font-medium hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                >
                  Estoy conforme en perderlo y cancelar
                </button>
              </div>
            </div>
          )}

          {/* Cargando cancelación */}
          {loading && (
            <div className="text-center py-8">
              <div className="animate-spin rounded-full h-12 w-12 border-4 border-purple-500 border-t-transparent mx-auto mb-4"></div>
              <p className="text-gray-600 dark:text-gray-300">Cancelando tu suscripción...</p>
            </div>
          )}

          {/* Éxito + feedback opcional */}
          {success && (
            <div>
              <div className="text-center mb-6">
                <div className="text-4xl mb-4">✅</div>
                <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-3">
                  Suscripción cancelada
                </h2>
                <p className="text-gray-600 dark:text-gray-300 mb-2">
                  Tu suscripción ha sido cancelada correctamente.
                </p>
                {formattedResultEnd && (
                  <p className="text-sm text-purple-600 dark:text-purple-400">
                    Mantendrás acceso Premium hasta el <strong>{formattedResultEnd}</strong>
                  </p>
                )}
              </div>

              {!feedbackSent ? (
                <div className="border-t border-gray-200 dark:border-gray-700 pt-6">
                  <h3 className="text-base font-semibold text-gray-900 dark:text-white mb-1">
                    ¿Nos ayudas a mejorar? (opcional)
                  </h3>
                  <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
                    Cuéntanos el motivo; nos sirve para mejorar la plataforma.
                  </p>

                  <div className="space-y-2 mb-4">
                    {REASONS.map((r) => (
                      <button
                        key={r.value}
                        onClick={() => setReason(r.value)}
                        disabled={feedbackSubmitting}
                        className={`w-full text-left p-3 rounded-lg border-2 transition-all ${
                          reason === r.value
                            ? 'border-purple-500 bg-purple-50 dark:bg-purple-900/20 text-purple-700 dark:text-purple-300'
                            : 'border-gray-200 dark:border-gray-600 hover:border-gray-300 dark:hover:border-gray-500 text-gray-700 dark:text-gray-300'
                        }`}
                      >
                        {r.label}
                      </button>
                    ))}
                  </div>

                  <div className="mb-4">
                    <label className="block text-sm text-gray-600 dark:text-gray-400 mb-2">
                      ¿Algo más que quieras contarnos? (opcional)
                    </label>
                    <textarea
                      value={reasonDetails}
                      onChange={(e) => setReasonDetails(e.target.value)}
                      disabled={feedbackSubmitting}
                      placeholder="Escribe aquí..."
                      rows={3}
                      className="w-full p-3 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 focus:ring-2 focus:ring-purple-500 focus:border-transparent resize-none"
                    />
                  </div>

                  <div className="flex gap-3">
                    <button
                      onClick={handleClose}
                      disabled={feedbackSubmitting}
                      className="py-3 px-4 rounded-lg border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 font-medium hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors disabled:opacity-50"
                    >
                      Omitir
                    </button>
                    <button
                      onClick={handleSubmitFeedback}
                      disabled={!reason || feedbackSubmitting}
                      className="flex-1 py-3 px-4 rounded-lg bg-purple-600 hover:bg-purple-700 disabled:bg-gray-300 dark:disabled:bg-gray-600 text-white font-medium transition-colors disabled:cursor-not-allowed"
                    >
                      {feedbackSubmitting ? 'Enviando…' : 'Enviar feedback'}
                    </button>
                  </div>
                </div>
              ) : (
                <div className="text-center border-t border-gray-200 dark:border-gray-700 pt-6">
                  <p className="text-sm text-gray-600 dark:text-gray-300 mb-4">
                    Gracias por tu feedback. Nos ayuda muchísimo a mejorar.
                  </p>
                  <button
                    onClick={handleClose}
                    className="w-full py-3 px-4 rounded-lg bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 font-medium hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
                  >
                    Cerrar
                  </button>
                </div>
              )}
            </div>
          )}

        </div>
      </div>
    </div>
  )
}
