// components/QuestionDispute.js - CORREGIDO: Sin scroll + mejor UX
'use client'
import { useState } from 'react'

export default function QuestionDispute({ questionId, user, supabase, isOpen: externalIsOpen = null, onClose = null }) {
  const [internalIsOpen, setInternalIsOpen] = useState(false)
  
  // Usar estado externo si se proporciona, sino usar estado interno
  const isOpen = externalIsOpen !== null ? externalIsOpen : internalIsOpen
  const setIsOpen = onClose ? onClose : setInternalIsOpen
  
  const [disputeType, setDisputeType] = useState('')
  const [description, setDescription] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    e.stopPropagation() // ✅ PREVENIR BUBBLING
    
    
    if (!user) {
      alert('Debes estar registrado para impugnar preguntas')
      return
    }
    
    if (!disputeType) {
      alert('Por favor selecciona un motivo de impugnación')
      return
    }
    
    
    setSubmitting(true)
    
    try {
      const { data, error } = await supabase
        .from('question_disputes')
        .insert({
          question_id: questionId,
          user_id: user.id,
          dispute_type: disputeType,
          description: disputeType === 'otro' ? description.trim() : `Motivo: ${disputeType}${description.trim() ? ` - Detalles: ${description.trim()}` : ''}`,
          status: 'pending'
        })
        .select() // 🔥 IMPORTANTE: Agregar .select() para obtener datos de respuesta
      
      if (error) {
        alert(`Error al enviar la impugnación: ${error.message}`)
      } else {
        // Enviar email de notificación al admin
        if (data && data[0]) {
          try {
            // Obtener el texto de la pregunta para el email admin
            const { data: questionData } = await supabase
              .from('questions')
              .select('question_text')
              .eq('id', questionId)
              .single()

            const { sendAdminDisputeNotification } = await import('../lib/notifications/adminEmailNotifications')
            await sendAdminDisputeNotification({
              id: data[0].id,
              question_id: questionId,
              user_id: user.id,
              user_email: user.email || 'Usuario anónimo',
              user_name: user.user_metadata?.full_name || 'Sin nombre',
              dispute_type: disputeType,
              description: disputeType === 'otro' ? description.trim() : `Motivo: ${disputeType}${description.trim() ? ` - Detalles: ${description.trim()}` : ''}`,
              question_text: questionData?.question_text || 'Texto no disponible',
              created_at: data[0].created_at
            })
          } catch (emailError) {
            console.error('Error enviando email admin:', emailError)
            // No fallar la impugnación por esto
          }
        }

        setSubmitted(true)
        setDescription('')
        setDisputeType('')
        
        // ✅ SCROLL SUAVE AL MENSAJE DE ÉXITO
        setTimeout(() => {
          const successElement = document.querySelector('[data-success-message]')
          if (successElement) {
            successElement.scrollIntoView({ 
              behavior: 'smooth', 
              block: 'center' 
            })
          }
        }, 150)
        
        // ✅ AUTO-CERRAR DESPUÉS DE 6 SEGUNDOS
        setTimeout(() => {
          if (onClose) {
            onClose() // Cerrar externamente
          } else {
            setInternalIsOpen(false) // Cerrar internamente
          }
          setSubmitted(false)
        }, 6000)
      }
    } catch (error) {
      console.error('❌ Error enviando impugnación:', error)
      
      // Manejar errores específicos
      if (error.message?.includes('duplicate key') || error.message?.includes('question_disputes_question_id_user_id_key')) {
        alert('⚠️ Ya has impugnado esta pregunta anteriormente. Solo se permite una impugnación por pregunta y usuario.')
      } else if (error.message?.includes('not authenticated')) {
        alert('🔐 Debes estar registrado para impugnar preguntas. Por favor, inicia sesión.')
      } else {
        alert('❌ Error inesperado al enviar la impugnación. Por favor inténtalo de nuevo.')
      }
    } finally {
      setSubmitting(false)
    }
  }

  // 🔥 FIX: Validación simplificada - solo requiere tipo seleccionado
  const canSubmit = disputeType && !submitting

  // Si está controlado externamente, renderizar como modal
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
                    ⚖️ Impugnar Pregunta
                  </h3>
                  <button
                    onClick={() => onClose()}
                    className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                  >
                    ✕
                  </button>
                </div>
                
                {/* Contenido del modal */}
                <div className="bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800 rounded-lg p-4">
                  
                  {/* Estado de enviado */}
                  {submitted ? (
                    <div 
                      data-success-message
                      className="text-center py-6"
                    >
                      <div className="text-4xl mb-3">✅</div>
                      <h3 className="text-lg font-semibold text-green-700 dark:text-green-300 mb-2">
                        ¡Impugnación enviada!
                      </h3>
                      <p className="text-sm text-green-600 dark:text-green-400">
                        Tu impugnación ha sido registrada y será revisada lo antes posible.
                      </p>
                    </div>
                  ) : (
                    /* Formulario de impugnación (mismo contenido que abajo) */
                    <form onSubmit={handleSubmit} className="space-y-4">
                      {/* Tipo de impugnación */}
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
                          ⚖️ Motivo de impugnación *
                        </label>
                        <div className="space-y-2">
                          <label className="flex items-center space-x-2 cursor-pointer">
                            <input
                              type="radio"
                              name="disputeType"
                              value="no_literal"
                              checked={disputeType === 'no_literal'}
                              onChange={(e) => setDisputeType(e.target.value)}
                              className="text-orange-600 focus:ring-orange-500"
                            />
                            <span className="text-sm text-gray-700 dark:text-gray-300">
                              📝 Pregunta no literal (no se ajusta exactamente al artículo)
                            </span>
                          </label>
                          
                          <label className="flex items-center space-x-2 cursor-pointer">
                            <input
                              type="radio"
                              name="disputeType"
                              value="respuesta_incorrecta"
                              checked={disputeType === 'respuesta_incorrecta'}
                              onChange={(e) => setDisputeType(e.target.value)}
                              className="text-orange-600 focus:ring-orange-500"
                            />
                            <span className="text-sm text-gray-700 dark:text-gray-300">
                              ❌ La respuesta marcada como correcta es errónea
                            </span>
                          </label>
                          
                          <label className="flex items-center space-x-2 cursor-pointer">
                            <input
                              type="radio"
                              name="disputeType"
                              value="otro"
                              checked={disputeType === 'otro'}
                              onChange={(e) => setDisputeType(e.target.value)}
                              className="text-orange-600 focus:ring-orange-500"
                            />
                            <span className="text-sm text-gray-700 dark:text-gray-300">
                              💭 Otro motivo
                            </span>
                          </label>
                        </div>
                      </div>

                      {/* Descripción */}
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                          📝 Descripción {disputeType === 'otro' ? '*' : '(opcional)'}
                        </label>
                        <textarea
                          value={description}
                          onChange={(e) => setDescription(e.target.value)}
                          placeholder={
                            disputeType === 'otro' 
                              ? "Describe detalladamente el problema con esta pregunta..." 
                              : "Información adicional (opcional)..."
                          }
                          rows={4}
                          className="w-full p-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder-gray-500 dark:placeholder-gray-400 focus:ring-2 focus:ring-orange-500 focus:border-orange-500 transition-colors resize-none"
                        />
                      </div>

                      {/* Información adicional */}
                      <div className="bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-700 rounded-lg p-3">
                        <div className="flex items-start space-x-2">
                          <span className="text-blue-600 dark:text-blue-400">ℹ️</span>
                          <div className="text-xs text-blue-700 dark:text-blue-300">
                            <p>Tu impugnación será revisada. Recibirás una respuesta en tu perfil lo antes posible.</p>
                          </div>
                        </div>
                      </div>

                      {/* Botones */}
                      <div className="flex items-center justify-between pt-4">
                        <button
                          type="button"
                          onClick={() => onClose()}
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

  // Modo inline original (para TestLayout)
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

      {/* Contenido desplegable */}
      {isOpen && (
        <div className="mt-3 p-4 bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800 rounded-lg">
          
          {/* Estado de enviado - ✅ MARCADOR PARA SCROLL */}
          {submitted ? (
            <div 
              data-success-message // ✅ MARCADOR PARA SCROLL SUAVE
              className="text-center py-6"
            >
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
          ) : (
            /* Formulario de impugnación */
            <form onSubmit={handleSubmit} className="space-y-4">
              
              {/* Header */}
              <div>
                <h4 className="font-bold text-orange-800 dark:text-orange-300 mb-2">
                  ⚖️ Impugnar esta pregunta
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
                      value="no_literal"
                      checked={disputeType === 'no_literal'}
                      onChange={(e) => setDisputeType(e.target.value)}
                      className="text-orange-600 focus:ring-orange-500"
                    />
                    <span className="text-sm text-orange-700 dark:text-orange-300">
                      📝 Pregunta no literal (no se ajusta exactamente al artículo)
                    </span>
                  </label>
                  
                  <label className="flex items-center space-x-2 cursor-pointer">
                    <input
                      type="radio"
                      name="disputeType"
                      value="respuesta_incorrecta"
                      checked={disputeType === 'respuesta_incorrecta'}
                      onChange={(e) => setDisputeType(e.target.value)}
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
                      value="otro"
                      checked={disputeType === 'otro'}
                      onChange={(e) => setDisputeType(e.target.value)}
                      className="text-orange-600 focus:ring-orange-500"
                    />
                    <span className="text-sm text-orange-700 dark:text-orange-300">
                      💭 Otro motivo
                    </span>
                  </label>
                </div>
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


              {/* Información adicional */}
              <div className="bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-700 rounded-lg p-3">
                <div className="flex items-start space-x-2">
                  <span className="text-blue-600 dark:text-blue-400">ℹ️</span>
                  <div className="text-xs text-blue-700 dark:text-blue-300">
                    <p>Tu impugnación será revisada. Recibirás una respuesta en tu perfil lo antes posible.</p>
                  </div>
                </div>
              </div>

              {/* Botones */}
              <div className="flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => {
                    if (onClose) {
                      onClose() // Cerrar externamente
                    } else {
                      setInternalIsOpen(false) // Cerrar internamente
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