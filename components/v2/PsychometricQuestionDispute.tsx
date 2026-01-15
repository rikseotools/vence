// components/v2/PsychometricQuestionDispute.tsx
// Componente para impugnar preguntas psicotécnicas
'use client'

import { useState } from 'react'

interface PsychometricQuestionDisputeProps {
  questionId: string
  user: { id: string; email?: string; user_metadata?: { full_name?: string } } | null
  supabase: any
}

type DisputeType = '' | 'respuesta_incorrecta' | 'ai_detected_error' | 'otro'

export default function PsychometricQuestionDispute({
  questionId,
  user,
  supabase
}: PsychometricQuestionDisputeProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [disputeType, setDisputeType] = useState<DisputeType>('')
  const [description, setDescription] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    e.stopPropagation()

    if (!user) {
      alert('Debes estar registrado para impugnar preguntas')
      return
    }

    if (!disputeType) {
      alert('Por favor selecciona un motivo de impugnación')
      return
    }

    if (disputeType === 'otro' && description.trim().length < 10) {
      alert('Por favor describe el problema con al menos 10 caracteres')
      return
    }

    setSubmitting(true)

    try {
      const response = await fetch('/api/dispute/psychometric', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          questionId,
          userId: user.id,
          disputeType,
          description: disputeType === 'otro'
            ? description.trim()
            : `Motivo: ${disputeType}${description.trim() ? ` - Detalles: ${description.trim()}` : ''}`
        })
      })

      const result = await response.json()

      if (!response.ok) {
        if (response.status === 409) {
          alert('Ya has impugnado esta pregunta anteriormente.')
        } else {
          alert(result.error || 'Error al enviar la impugnación')
        }
      } else {
        setSubmitted(true)
        setDescription('')
        setDisputeType('')

        // Auto-cerrar después de 5 segundos
        setTimeout(() => {
          setIsOpen(false)
          setSubmitted(false)
        }, 5000)
      }
    } catch (error) {
      console.error('Error enviando impugnación:', error)
      alert('Error inesperado al enviar la impugnación')
    } finally {
      setSubmitting(false)
    }
  }

  const canSubmit = questionId && disputeType && !submitting &&
    (disputeType !== 'otro' || description.trim().length >= 10)

  return (
    <div className="mt-4">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center space-x-2 px-3 py-2 bg-yellow-100 hover:bg-yellow-200 dark:bg-yellow-900/30 dark:hover:bg-yellow-900/50 text-yellow-800 dark:text-yellow-300 text-sm rounded-lg border border-yellow-300 dark:border-yellow-700 transition-colors"
      >
        <span className="text-lg">⚠️</span>
        <span className="font-medium">Impugnar pregunta</span>
        <span className={`transform transition-transform ${isOpen ? 'rotate-180' : ''}`}>
          ▼
        </span>
      </button>

      {isOpen && (
        <div className="mt-3 p-4 bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800 rounded-lg">
          {submitted ? (
            <div className="text-center py-6">
              <div className="text-4xl mb-3">✅</div>
              <h4 className="font-bold text-green-800 dark:text-green-300 mb-2">
                ¡Impugnación enviada!
              </h4>
              <p className="text-green-700 dark:text-green-400 text-sm mb-2">
                Tu impugnación ha sido registrada y será revisada lo antes posible.
              </p>
              <p className="text-green-600 dark:text-green-500 text-xs">
                Se cerrará automáticamente...
              </p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <h4 className="font-bold text-orange-800 dark:text-orange-300 mb-2">
                  ⚖️ Impugnar esta pregunta psicotécnica
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
                <div className="space-y-2">
                  <label className="flex items-center space-x-2 cursor-pointer">
                    <input
                      type="radio"
                      name="disputeType"
                      value="respuesta_incorrecta"
                      checked={disputeType === 'respuesta_incorrecta'}
                      onChange={(e) => setDisputeType(e.target.value as DisputeType)}
                      className="text-orange-600 focus:ring-orange-500"
                    />
                    <span className="text-sm text-orange-700 dark:text-orange-300">
                      ❌ La respuesta marcada como correcta es errónea
                    </span>
                  </label>

                  <label className="flex items-center space-x-2 cursor-pointer">
                    <input
                      type="radio"
                      name="disputeType"
                      value="ai_detected_error"
                      checked={disputeType === 'ai_detected_error'}
                      onChange={(e) => setDisputeType(e.target.value as DisputeType)}
                      className="text-orange-600 focus:ring-orange-500"
                    />
                    <span className="text-sm text-orange-700 dark:text-orange-300">
                      📊 Error en los datos, gráficos o explicación
                    </span>
                  </label>

                  <label className="flex items-center space-x-2 cursor-pointer">
                    <input
                      type="radio"
                      name="disputeType"
                      value="otro"
                      checked={disputeType === 'otro'}
                      onChange={(e) => setDisputeType(e.target.value as DisputeType)}
                      className="text-orange-600 focus:ring-orange-500"
                    />
                    <span className="text-sm text-orange-700 dark:text-orange-300">
                      💭 Otro motivo
                    </span>
                  </label>
                </div>
              </div>

              {/* Campo de descripción */}
              {disputeType && (
                <div>
                  <label className="block text-sm font-medium text-orange-800 dark:text-orange-300 mb-2">
                    {disputeType === 'otro' ? 'Descripción: * (mínimo 10 caracteres)' : 'Información adicional (opcional):'}
                  </label>
                  <textarea
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    rows={3}
                    className="w-full px-3 py-2 border border-orange-300 dark:border-orange-700 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500 dark:bg-gray-800 dark:text-gray-200 text-sm"
                    placeholder={
                      disputeType === 'otro'
                        ? 'Describe detalladamente el problema...'
                        : disputeType === 'respuesta_incorrecta'
                        ? 'Opcionalmente, indica cuál crees que es la correcta...'
                        : 'Información adicional...'
                    }
                    required={disputeType === 'otro'}
                  />
                  <div className="text-xs text-orange-600 dark:text-orange-400 mt-1">
                    {description.trim().length}/500 caracteres
                    {disputeType === 'otro' && description.trim().length < 10 && description.trim().length > 0 && (
                      <span className="text-red-600 ml-2">
                        (Faltan {10 - description.trim().length} caracteres)
                      </span>
                    )}
                  </div>
                </div>
              )}

              {/* Info */}
              <div className="bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-700 rounded-lg p-3">
                <div className="flex items-start space-x-2">
                  <span className="text-blue-600 dark:text-blue-400">ℹ️</span>
                  <p className="text-xs text-blue-700 dark:text-blue-300">
                    Tu impugnación será revisada. Recibirás una respuesta en tu perfil lo antes posible.
                  </p>
                </div>
              </div>

              {/* Botones */}
              <div className="flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => setIsOpen(false)}
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
                      <span>⚖️</span>
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
