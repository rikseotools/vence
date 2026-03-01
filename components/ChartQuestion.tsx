'use client'
import { useState, useEffect, useCallback, type ReactNode } from 'react'
import { useAuth } from '../contexts/AuthContext'
import MarkdownExplanation from './MarkdownExplanation'

interface ChartQuestionData {
  id: string
  question_text: string
  option_a: string
  option_b: string
  option_c: string
  option_d: string
  options?: { A?: string; B?: string; C?: string; D?: string }
  explanation?: string | null
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  content_data?: Record<string, any> | null
  question_subtype?: string
  psychometric_sections?: {
    display_name?: string
    psychometric_categories?: {
      display_name?: string
    }
  }
}

interface ChartQuestionProps {
  question: ChartQuestionData
  onAnswer: (index: number) => void
  selectedAnswer: number | null
  showResult: boolean
  isAnswering: boolean
  chartComponent?: ReactNode
  explanationSections?: ReactNode
  attemptCount?: number
  verifiedCorrectAnswer?: number | null
  verifiedExplanation?: string | null
  hideAIChat?: boolean
}

interface MotivationalMessage {
  title: string
  message: string
  color: string
}

export default function ChartQuestion({
  question,
  onAnswer,
  selectedAnswer,
  showResult,
  isAnswering,
  chartComponent,
  explanationSections,
  attemptCount = 0,
  verifiedCorrectAnswer = null,
  verifiedExplanation = null,
  hideAIChat = false
}: ChartQuestionProps) {
  const { user } = useAuth() as { user: { id: string; user_metadata?: { full_name?: string } } | null }
  const [showZoomModal, setShowZoomModal] = useState(false)

  const closeZoomModal = useCallback(() => setShowZoomModal(false), [])

  useEffect(() => {
    if (!showZoomModal) return
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeZoomModal()
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [showZoomModal, closeZoomModal])

  // SEGURIDAD: Usar verifiedCorrectAnswer de API cuando esté disponible
  const effectiveCorrectAnswer = showResult && verifiedCorrectAnswer !== null
    ? verifiedCorrectAnswer
    : null // NO usamos effectiveCorrectAnswer como fallback

  // Mensajes motivadores basados en el resultado
  const getMotivationalMessage = (): MotivationalMessage => {
    const userName = user?.user_metadata?.full_name?.split(' ')[0] || 'Opositor'

    // SEGURIDAD: Solo mostrar mensaje de acierto si tenemos validación de API
    if (showResult && effectiveCorrectAnswer !== null && selectedAnswer === effectiveCorrectAnswer) {
      const congratsMessages: MotivationalMessage[] = [
        {
          title: `¡Bien, ${userName}! 🎉`,
          message: "Has acertado. Los psicotécnicos requieren práctica, vas por buen camino.",
          color: "green"
        },
        {
          title: `¡Perfecto, ${userName}! ⭐`,
          message: "Lo estás dominando. La constancia es la clave.",
          color: "green"
        },
        {
          title: `¡Sigue así, ${userName}! 🚀`,
          message: "",
          color: "green"
        },
        {
          title: `Muy bien, ${userName}! 👍`,
          message: "",
          color: "green"
        }
      ]

      // Usar el mensaje correspondiente al número de acierto
      return congratsMessages[Math.min(attemptCount, congratsMessages.length - 1)]
    }

    switch (attemptCount) {
      case 0: // Primer fallo
        return {
          title: `No te preocupes, ${userName} 💪`,
          message: "Mucha gente falla esta pregunta. Los psicotécnicos son la parte más difícil, pero sigue practicando - al final todos se repiten y los dominarás.",
          color: "blue"
        }
      case 1: // Segundo fallo
        return {
          title: `No te preocupes, ${userName} 🎯`,
          message: "Estas preguntas requieren paciencia. Cada intento te enseña algo nuevo. Revisa los datos paso a paso, sin prisa.",
          color: "orange"
        }
      case 2: // Tercer fallo
        return {
          title: `No te preocupes, ${userName} 🚀`,
          message: "Los psicotécnicos son complicados para todo el mundo. Lo importante es entender el método. Una vez que lo pilles, el resto será igual.",
          color: "red"
        }
      default: // Más de 3 fallos
        return {
          title: `No te preocupes, ${userName}! 👍`,
          message: "Sigue practicando. La constancia es la clave.",
          color: "purple"
        }
    }
  }

  const motivationalMessage = getMotivationalMessage()

  const options = [
    { value: question.option_a || question.options?.A },
    { value: question.option_b || question.options?.B },
    { value: question.option_c || question.options?.C },
    { value: question.option_d || question.options?.D }
  ]

  return (
    <div className="bg-white rounded-lg shadow-lg p-6">
      {/* Contexto adicional (si existe) */}
      {question.content_data?.question_context && (
        <p className="text-gray-700 mb-4">
          {question.content_data.question_context}
        </p>
      )}

      {/* Gráfico - Componente específico (solo si existe) */}
      {chartComponent && (
        <div className="relative mb-4 -mx-6 -my-2 sm:-mt-2 -mt-8">
          <div
            className="sm:cursor-pointer"
            onClick={() => {
              if (window.innerWidth >= 640) setShowZoomModal(true)
            }}
          >
            {chartComponent}
          </div>
          {/* Botón lupa - solo desktop */}
          <button
            onClick={(e) => { e.stopPropagation(); setShowZoomModal(true) }}
            className="hidden sm:flex absolute top-2 right-2 items-center justify-center w-9 h-9 rounded-lg bg-white/70 hover:bg-white border border-gray-200 shadow-sm transition-all duration-150 z-10"
            title="Ampliar gráfico"
          >
            <svg className="w-5 h-5 text-gray-600" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 3.75v4.5m0-4.5h4.5m-4.5 0L9 9m11.25-5.25v4.5m0-4.5h-4.5m4.5 0L15 9m-11.25 11.25v-4.5m0 4.5h4.5m-4.5 0L9 15m11.25 5.25v-4.5m0 4.5h-4.5m4.5 0L15 15" />
            </svg>
          </button>
        </div>
      )}

      {/* Modal de zoom - solo desktop */}
      {showZoomModal && chartComponent && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
          onClick={closeZoomModal}
        >
          <div
            className="bg-white rounded-xl max-w-6xl w-full max-h-[90vh] overflow-auto p-6 relative"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={closeZoomModal}
              className="absolute top-3 right-3 w-9 h-9 flex items-center justify-center rounded-lg hover:bg-gray-100 transition-colors z-10"
              title="Cerrar"
            >
              <svg className="w-5 h-5 text-gray-500" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
            <div className="pt-2">
              {chartComponent}
            </div>
          </div>
        </div>
      )}

      {/* Texto de la pregunta */}
      {question.question_text && (
        <h3 className="text-lg font-semibold text-gray-900 mb-4">
          {question.question_text}
        </h3>
      )}

      {/* Opciones de respuesta */}
      <div className="space-y-3 mb-6">
        {options.map((option, index) => {
          let buttonClass = "w-full p-4 text-left border-2 rounded-lg transition-all duration-200 flex items-center gap-3"

          if (showResult) {
            if (index === effectiveCorrectAnswer) {
              // Respuesta correcta
              buttonClass += " border-green-500 bg-green-50 text-green-800"
            } else if (index === selectedAnswer) {
              // Respuesta seleccionada incorrecta
              buttonClass += " border-red-500 bg-red-50 text-red-800"
            } else {
              // Otras opciones
              buttonClass += " border-gray-200 bg-gray-50 text-gray-600"
            }
          } else if (selectedAnswer === index) {
            buttonClass += " border-blue-500 bg-blue-50 text-blue-800"
          } else {
            buttonClass += " border-gray-200 hover:border-blue-300 hover:bg-blue-25 text-gray-700"
          }

          return (
            <button
              key={index}
              onClick={() => !showResult && !isAnswering && onAnswer(index)}
              disabled={showResult || isAnswering}
              className={buttonClass}
            >
              <span className="font-bold text-lg min-w-[24px]">
                {String.fromCharCode(65 + index)}
              </span>
              <span className="text-lg">
                {option.value}
              </span>
              {showResult && index === effectiveCorrectAnswer && (
                <span className="ml-auto text-green-600">✓</span>
              )}
              {showResult && index === selectedAnswer && index !== effectiveCorrectAnswer && (
                <span className="ml-auto text-red-600">✗</span>
              )}
            </button>
          )
        })}
      </div>

      {/* Botones rápidos A/B/C/D (solo si no se ha respondido) */}
      {!showResult && (
        <div className="flex justify-center gap-3 mb-6">
          {options.map((option, index) => (
            <button
              key={index}
              onClick={() => !isAnswering && onAnswer(index)}
              disabled={isAnswering}
              className={`w-14 h-14 rounded-lg font-bold text-lg transition-all duration-200 ${
                selectedAnswer === index
                  ? 'bg-blue-600 text-white border-2 border-blue-600'
                  : 'bg-white border-2 border-blue-600 text-blue-600 hover:bg-blue-50'
              }`}
            >
              {String.fromCharCode(65 + index)}
            </button>
          ))}
        </div>
      )}

      {/* Mensaje motivador (solo en práctica, no en exámenes oficiales) */}
      {showResult && motivationalMessage && !hideAIChat && (
        <div className="mt-6 mb-4">
          <div className={`p-4 rounded-lg border-l-4 ${
            motivationalMessage.color === 'green' ? 'bg-green-50 border-green-500' :
            motivationalMessage.color === 'blue' ? 'bg-blue-50 border-blue-500' :
            motivationalMessage.color === 'orange' ? 'bg-orange-50 border-orange-500' :
            motivationalMessage.color === 'red' ? 'bg-red-50 border-red-500' :
            'bg-purple-50 border-purple-500'
          }`}>
            <h4 className={`font-bold mb-2 ${
              motivationalMessage.color === 'green' ? 'text-green-800' :
              motivationalMessage.color === 'blue' ? 'text-blue-800' :
              motivationalMessage.color === 'orange' ? 'text-orange-800' :
              motivationalMessage.color === 'red' ? 'text-red-800' :
              'text-purple-800'
            }`}>
              {motivationalMessage.title}
            </h4>
            <p className={`text-sm ${
              motivationalMessage.color === 'green' ? 'text-green-700' :
              motivationalMessage.color === 'blue' ? 'text-blue-700' :
              motivationalMessage.color === 'orange' ? 'text-orange-700' :
              motivationalMessage.color === 'red' ? 'text-red-700' :
              'text-purple-700'
            }`}>
              {motivationalMessage.message}
            </p>
          </div>
        </div>
      )}

      {/* Explicación (solo mostrar después de responder) */}
      {showResult && (
        <div className="border-t pt-6">
          <div className="bg-blue-50 p-6 rounded-lg">
            <div className="flex items-center mb-4">
              <div className={`text-white rounded-full w-8 h-8 flex items-center justify-center text-sm font-bold mr-3 ${
                selectedAnswer === effectiveCorrectAnswer ? 'bg-green-600' : 'bg-red-600'
              }`}>
                {selectedAnswer === effectiveCorrectAnswer ? '✓' : '✗'}
              </div>
              {/* Solo mostrar categoría si existe psychometric_sections */}
              {question.psychometric_sections?.psychometric_categories?.display_name && (
                <h4 className="font-bold text-blue-900 text-lg">
                  {question.psychometric_sections.psychometric_categories.display_name.toUpperCase()}: {question.psychometric_sections.display_name?.toUpperCase()}
                </h4>
              )}
              {/* Botón para abrir IA - oculto en exámenes oficiales */}
              {!hideAIChat && <button
                  onClick={() => {
                    // Determinar el tipo de pregunta para el mensaje
                    const isErrorDetection = question.content_data?.chart_type === 'error_detection' || question.question_subtype === 'error_detection'
                    const isDataTable = question.question_subtype === 'data_tables' || !!question.content_data?.table_data
                    const questionType = isErrorDetection ? 'ortografía' : isDataTable ? 'tablas' : 'gráficos'

                    // Para error_detection, incluir la frase original
                    let additionalContext = ''
                    if (isErrorDetection && question.content_data?.original_text) {
                      additionalContext = `\n\nFrase a analizar: "${question.content_data.original_text}"`
                    }

                    // Para tablas, incluir los datos de la tabla
                    if (isDataTable && question.content_data?.table_data) {
                      const td = question.content_data.table_data
                      const tableName = question.content_data.table_name || td.title || 'Tabla de datos'
                      let tableText = `\n\n📊 ${tableName}:\n`
                      if (td.headers && td.rows) {
                        tableText += td.headers.join(' | ') + '\n'
                        tableText += td.headers.map(() => '---').join(' | ') + '\n'
                        td.rows.forEach((row: string[]) => {
                          tableText += row.join(' | ') + '\n'
                        })
                      }
                      additionalContext = tableText
                    }

                    window.dispatchEvent(new CustomEvent('openAIChat', {
                      detail: {
                        message: `Explícame paso a paso cómo resolver esta pregunta de ${questionType}: "${question.question_text}"${additionalContext}\n\nLas opciones son:\nA) ${question.option_a}\nB) ${question.option_b}\nC) ${question.option_c}\nD) ${question.option_d}`,
                        suggestion: 'explicar_psico'
                      }
                    }))
                  }}
                  className="flex items-center gap-2 px-3 py-1.5 ml-auto bg-blue-900 text-white rounded-lg hover:bg-blue-950 transition-colors text-sm font-medium"
                >
                  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M9.5 2l1.5 3.5L14.5 7l-3.5 1.5L9.5 12l-1.5-3.5L4.5 7l3.5-1.5L9.5 2z"/>
                    <path d="M18 8l1 2.5 2.5 1-2.5 1-1 2.5-1-2.5L14.5 11l2.5-1L18 8z"/>
                  </svg>
                  <span>¿Necesitas ayuda?</span>
                </button>}
            </div>


            {/* Secciones específicas de explicación o explicación estándar */}
            <div className="space-y-4">
              {explanationSections ? (
                // Si hay explanationSections, mostrarlas directamente (ya tienen sus propios títulos)
                explanationSections
              ) : (
                // Fallback: mostrar header + explanation
                <>
                  <h4 className="font-bold text-blue-900 mb-3 flex items-center">
                    <span className="bg-green-100 text-green-800 rounded-full w-6 h-6 flex items-center justify-center text-xs font-bold mr-2">1</span>
                    {question.content_data?.chart_type === 'error_detection' ? 'EXPLICACIÓN:' : 'ANÁLISIS PASO A PASO:'}
                  </h4>
                  {(verifiedExplanation || question.explanation) && (
                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
                      <MarkdownExplanation
                        content={verifiedExplanation || question.explanation || ''}
                        className="text-blue-700"
                      />
                    </div>
                  )}
                </>
              )}
            </div>

          </div>

        </div>
      )}
    </div>
  )
}
