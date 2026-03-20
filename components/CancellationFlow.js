'use client'

import { useState } from 'react'

const REASONS = [
  { value: 'approved', label: 'He aprobado la oposición' },
  { value: 'not_presenting', label: 'Ya no me voy a presentar' },
  { value: 'too_expensive', label: 'Es muy caro' },
  { value: 'prefer_other', label: 'Prefiero estudiar de otra forma (academia, libros...)' },
  { value: 'missing_features', label: 'La app no tiene lo que necesito' },
  { value: 'no_progress', label: 'No veo progreso en mi preparación' },
  { value: 'hard_to_use', label: 'La app es difícil de usar' },
  { value: 'other', label: 'Otro' }
]

const ALTERNATIVES = [
  { value: 'academy_presential', label: 'Academia presencial' },
  { value: 'academy_online', label: 'Academia online' },
  { value: 'books', label: 'Libros y temarios' },
  { value: 'other_app', label: 'Otra app de oposiciones' },
  { value: 'self_study', label: 'Por mi cuenta (sin recursos de pago)' },
  { value: 'stop_preparing', label: 'No voy a seguir preparándome' },
  { value: 'other', label: 'Otro' }
]

// Motivos que NO requieren preguntar alternativa
const SKIP_ALTERNATIVE_REASONS = ['approved', 'not_presenting']

export default function CancellationFlow({ isOpen, onClose, userId, periodEndDate, onCancelled }) {
  const [step, setStep] = useState(1)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [success, setSuccess] = useState(false)
  const [resultPeriodEnd, setResultPeriodEnd] = useState(null)

  // Form data
  const [reason, setReason] = useState('')
  const [reasonDetails, setReasonDetails] = useState('')
  const [alternative, setAlternative] = useState('')
  const [contactedSupport, setContactedSupport] = useState(null)

  const resetForm = () => {
    setStep(1)
    setReason('')
    setReasonDetails('')
    setAlternative('')
    setContactedSupport(null)
    setError(null)
    setSuccess(false)
    setResultPeriodEnd(null)
  }

  const handleClose = () => {
    resetForm()
    onClose()
  }

  const handleConfirmStart = () => {
    setStep(2)
  }

  const handleReasonSubmit = () => {
    if (!reason) return

    // Si el motivo es "aprobé" o "no me presento", saltar a paso 4
    if (SKIP_ALTERNATIVE_REASONS.includes(reason)) {
      setStep(4)
    } else {
      setStep(3)
    }
  }

  const handleAlternativeSubmit = () => {
    if (!alternative) return
    setStep(4)
  }

  const handleCancel = async () => {
    setLoading(true)
    setError(null)

    try {
      const response = await fetch('/api/stripe/cancel', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId,
          feedback: {
            reason,
            reasonDetails: reasonDetails || null,
            alternative: alternative || null,
            contactedSupport: contactedSupport === 'yes'
          }
        })
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
      setError(err.message)
    } finally {
      setLoading(false)
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
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={!loading && !success ? handleClose : undefined}
      />

      {/* Modal */}
      <div className="relative bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-lg mx-4 overflow-hidden">

        {/* Progress bar */}
        {!success && (
          <div className="h-1 bg-gray-200 dark:bg-gray-700">
            <div
              className="h-full bg-gradient-to-r from-purple-500 to-indigo-500 transition-all duration-300"
              style={{ width: `${(step / 4) * 100}%` }}
            />
          </div>
        )}

        <div className="p-6">

          {/* PASO 1: Confirmación inicial */}
          {step === 1 && !success && (
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
                  Tu suscripcion tiene precio de fidelizacion
                </p>
                <p className="text-xs text-amber-700 dark:text-amber-300">
                  Como suscriptor activo disfrutas de descuentos progresivos de hasta un 20%. Si cancelas y vuelves a suscribirte, empezaras desde el precio base sin descuento.
                </p>
              </div>
              <p className="text-sm text-amber-600 dark:text-amber-400 mb-6">
                Tu historial de tests y estadísticas se mantendrán guardados por un tiempo limitado, después se eliminarán.
              </p>

              <div className="flex gap-3">
                <button
                  onClick={handleClose}
                  className="flex-1 py-3 px-4 rounded-lg border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 font-medium hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                >
                  Volver
                </button>
                <button
                  onClick={handleConfirmStart}
                  className="flex-1 py-3 px-4 rounded-lg bg-red-500 hover:bg-red-600 text-white font-medium transition-colors"
                >
                  Continuar
                </button>
              </div>
            </div>
          )}

          {/* PASO 2: Motivo + texto opcional */}
          {step === 2 && !success && (
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400 mb-2">Una última cosa...</p>
              <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-1">
                ¿Por qué quieres cancelar tu suscripción?
              </h2>
              <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
                Tu feedback nos ayuda a mejorar
              </p>

              <div className="space-y-2 mb-4">
                {REASONS.map((r) => (
                  <button
                    key={r.value}
                    onClick={() => setReason(r.value)}
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

              <div className="mb-6">
                <label className="block text-sm text-gray-600 dark:text-gray-400 mb-2">
                  ¿Algo más que quieras contarnos? (opcional)
                </label>
                <textarea
                  value={reasonDetails}
                  onChange={(e) => setReasonDetails(e.target.value)}
                  placeholder="Escribe aquí..."
                  rows={3}
                  className="w-full p-3 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 focus:ring-2 focus:ring-purple-500 focus:border-transparent resize-none"
                />
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() => setStep(1)}
                  className="py-3 px-4 rounded-lg border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 font-medium hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                >
                  Atrás
                </button>
                <button
                  onClick={handleReasonSubmit}
                  disabled={!reason}
                  className="flex-1 py-3 px-4 rounded-lg bg-purple-600 hover:bg-purple-700 disabled:bg-gray-300 dark:disabled:bg-gray-600 text-white font-medium transition-colors disabled:cursor-not-allowed"
                >
                  Continuar
                </button>
              </div>
            </div>
          )}

          {/* PASO 3: Alternativa */}
          {step === 3 && !success && (
            <div>
              <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-1">
                ¿Cómo vas a seguir preparándote?
              </h2>
              <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
                Esto nos ayuda a entender mejor el mercado
              </p>

              <div className="space-y-2 mb-6">
                {ALTERNATIVES.map((a) => (
                  <button
                    key={a.value}
                    onClick={() => setAlternative(a.value)}
                    className={`w-full text-left p-3 rounded-lg border-2 transition-all ${
                      alternative === a.value
                        ? 'border-purple-500 bg-purple-50 dark:bg-purple-900/20 text-purple-700 dark:text-purple-300'
                        : 'border-gray-200 dark:border-gray-600 hover:border-gray-300 dark:hover:border-gray-500 text-gray-700 dark:text-gray-300'
                    }`}
                  >
                    {a.label}
                  </button>
                ))}
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() => setStep(2)}
                  className="py-3 px-4 rounded-lg border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 font-medium hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                >
                  Atrás
                </button>
                <button
                  onClick={handleAlternativeSubmit}
                  disabled={!alternative}
                  className="flex-1 py-3 px-4 rounded-lg bg-purple-600 hover:bg-purple-700 disabled:bg-gray-300 dark:disabled:bg-gray-600 text-white font-medium transition-colors disabled:cursor-not-allowed"
                >
                  Continuar
                </button>
              </div>
            </div>
          )}

          {/* PASO 4: Confirmación final */}
          {step === 4 && !success && !loading && (
            <div className="text-center">
              <div className="text-4xl mb-4">📝</div>
              <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-3">
                Gracias por tu feedback
              </h2>
              <p className="text-gray-600 dark:text-gray-300 mb-6">
                ¿Confirmas la cancelación de tu suscripción?
              </p>

              {error && (
                <div className="mb-4 p-3 bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 rounded-lg text-sm">
                  {error}
                </div>
              )}

              <div className="flex gap-3">
                <button
                  onClick={() => setStep(SKIP_ALTERNATIVE_REASONS.includes(reason) ? 2 : 3)}
                  className="flex-1 py-3 px-4 rounded-lg border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 font-medium hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                >
                  Atrás
                </button>
                <button
                  onClick={handleCancel}
                  className="flex-1 py-3 px-4 rounded-lg bg-red-500 hover:bg-red-600 text-white font-medium transition-colors"
                >
                  Confirmar cancelación
                </button>
              </div>
            </div>
          )}

          {/* PASO 4: Loading */}
          {step === 4 && loading && (
            <div className="text-center py-8">
              <div className="animate-spin rounded-full h-12 w-12 border-4 border-purple-500 border-t-transparent mx-auto mb-4"></div>
              <p className="text-gray-600 dark:text-gray-300">
                Cancelando tu suscripción...
              </p>
            </div>
          )}

          {/* ÉXITO */}
          {success && (
            <div className="text-center">
              <div className="text-4xl mb-4">✅</div>
              <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-3">
                Suscripción cancelada
              </h2>
              <p className="text-gray-600 dark:text-gray-300 mb-2">
                Tu suscripción ha sido cancelada correctamente.
              </p>
              {formattedResultEnd && (
                <p className="text-sm text-purple-600 dark:text-purple-400 mb-6">
                  Mantendrás acceso Premium hasta el <strong>{formattedResultEnd}</strong>
                </p>
              )}

              <button
                onClick={handleClose}
                className="w-full py-3 px-4 rounded-lg bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 font-medium hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
              >
                Cerrar
              </button>
            </div>
          )}

        </div>
      </div>
    </div>
  )
}
