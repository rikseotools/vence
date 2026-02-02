'use client'
import { useState, useEffect } from 'react'
import MarkdownExplanation from './MarkdownExplanation'

export default function SequenceNumericQuestion({
  question,
  onAnswer,
  selectedAnswer,
  showResult,
  isAnswering,
  attemptCount = 0,
  // 🔒 SEGURIDAD: Props para validación segura via API
  verifiedCorrectAnswer = null,
  verifiedExplanation = null
}) {
  const [timeTaken, setTimeTaken] = useState(0)
  const [startTime, setStartTime] = useState(null)

  // 🔒 SEGURIDAD: Usar verifiedCorrectAnswer de API cuando esté disponible
  const effectiveCorrectAnswer = showResult && verifiedCorrectAnswer !== null
    ? verifiedCorrectAnswer
    : null // NO usamos question.correct_option como fallback

  useEffect(() => {
    if (!showResult) {
      setStartTime(Date.now())
    }
  }, [question, showResult])

  useEffect(() => {
    if (showResult && startTime) {
      setTimeTaken(Math.round((Date.now() - startTime) / 1000))
    }
  }, [showResult, startTime])

  const handleAnswer = (optionIndex) => {
    if (isAnswering || showResult) return

    const timeSpent = startTime ? Math.round((Date.now() - startTime) / 1000) : 0
    setTimeTaken(timeSpent)

    onAnswer(optionIndex, {
      timeTaken: timeSpent,
      attemptCount: attemptCount,
      interactionData: {
        sequence_analyzed: question.content_data?.sequence,
        pattern_identified: question.content_data?.pattern_type,
        solution_method: question.content_data?.solution_method || 'manual'
      }
    })
  }

  const renderSequence = () => {
    // No renderizar recuadro azul para secuencias numéricas
    // Las secuencias van integradas en el texto de la pregunta
    return null
  }

  const renderOptions = () => {
    const options = [
      { key: 'A', text: question.option_a || question.options?.A },
      { key: 'B', text: question.option_b || question.options?.B },
      { key: 'C', text: question.option_c || question.options?.C },
      { key: 'D', text: question.option_d || question.options?.D }
    ]

    return (
      <div className="space-y-3 mb-6">
        {options.map((option, index) => {
          let buttonClass = 'w-full p-4 text-left border-2 rounded-lg transition-all duration-200 '

          // 🔒 SEGURIDAD: Usar effectiveCorrectAnswer de API
          const isCorrectOption = showResult && effectiveCorrectAnswer !== null
            ? index === effectiveCorrectAnswer
            : false

          if (showResult) {
            if (isCorrectOption) {
              buttonClass += 'border-green-500 bg-green-50 text-green-800'
            } else if (selectedAnswer === index) {
              buttonClass += 'border-red-500 bg-red-50 text-red-800'
            } else {
              buttonClass += 'border-gray-200 bg-gray-50 text-gray-600'
            }
          } else if (selectedAnswer === index) {
            buttonClass += 'border-blue-500 bg-blue-50 text-blue-800'
          } else {
            buttonClass += 'border-gray-200 bg-white hover:border-blue-300 hover:bg-blue-50'
          }

          return (
            <button
              key={index}
              onClick={() => handleAnswer(index)}
              disabled={isAnswering || showResult}
              className={buttonClass}
            >
              <span className="font-semibold mr-3">{option.key}.</span>
              {option.text}
            </button>
          )
        })}
      </div>
    )
  }

  const renderQuickButtons = () => {
    if (showResult) return null

    return (
      <div className="flex justify-center space-x-4 mb-6">
        {['A', 'B', 'C', 'D'].map((letter, index) => (
          <button
            key={letter}
            onClick={() => handleAnswer(index)}
            disabled={isAnswering}
            className={`w-14 h-14 rounded-lg font-bold text-lg transition-all duration-200 ${
              selectedAnswer === index
                ? 'bg-blue-600 text-white border-2 border-blue-600'
                : 'bg-blue-100 text-blue-700 border-2 border-blue-300 hover:bg-blue-200'
            }`}
          >
            {letter}
          </button>
        ))}
      </div>
    )
  }

  const renderExplanation = () => {
    if (!showResult) return null

    // 🔒 SEGURIDAD: Usar effectiveCorrectAnswer de API
    const isCorrect = effectiveCorrectAnswer !== null && selectedAnswer === effectiveCorrectAnswer
    const sequence = question.content_data?.sequence || []
    const patternType = question.content_data?.pattern_type || 'unknown'

    return (
      <div className="mt-6 p-6 bg-gray-50 rounded-lg">
        <div className={`flex items-center mb-4 ${isCorrect ? 'text-green-700' : 'text-red-700'}`}>
          <span className="text-2xl mr-2">{isCorrect ? '✅' : '❌'}</span>
          <span className="text-lg font-semibold">
            {isCorrect ? '¡Correcto!' : 'Incorrecto'}
          </span>
          {timeTaken > 0 && (
            <span className="ml-4 text-sm text-gray-600">
              Tiempo: {timeTaken}s
            </span>
          )}
          {/* Botón para abrir IA si la respuesta fue incorrecta */}
          {!isCorrect && (
            <button
              onClick={() => {
                window.dispatchEvent(new CustomEvent('openAIChat', {
                  detail: {
                    message: `Explícame paso a paso cómo resolver esta Serie numérica: "${question.question_text}"\n\nLas opciones son:\nA) ${question.option_a}\nB) ${question.option_b}\nC) ${question.option_c}\nD) ${question.option_d}`,
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
            </button>
          )}
        </div>

        <div className="space-y-4">
          {question.content_data?.explanation_sections ? (
            // Renderizar explanation_sections (sistema moderno)
            question.content_data.explanation_sections.map((section, index) => (
              <div key={index} className="bg-white p-4 rounded-lg border-l-4 border-green-500">
                <h5 className="font-semibold text-green-800 mb-2">{section.title}</h5>
                <div className="text-gray-700 text-sm whitespace-pre-line">
                  {section.content}
                </div>
              </div>
            ))
          ) : verifiedExplanation ? (
            // 🔒 SEGURIDAD: Usar verifiedExplanation de API
            <div className="bg-white p-4 rounded-lg border-l-4 border-green-500">
              <div className="text-gray-700 text-sm whitespace-pre-line">
                {verifiedExplanation}
              </div>
            </div>
          ) : (
            // Fallback para explanation simple o hardcoded
            <div className="bg-white p-4 rounded-lg border-l-4 border-green-500">
              <div className="text-gray-700 text-sm">
                {patternType === 'intercalated' ? (
                  <div>
                    <p>• 11, 11 → 9, 9: Los números se repiten de dos en dos, restando 2</p>
                    <p>• 9, 9 → 7, 7: Confirmamos el patrón: -2 y repetición</p>
                    <p>• 7, 7 → ?, ?: Siguiendo el patrón: 7 - 2 = 5</p>
                    <p className="mt-2"><strong>✅ Patrón identificado:</strong> Series intercaladas con números repetidos que disminuyen de 2 en 2</p>
                    <p><strong>✅ Siguiente término:</strong> 5 (porque 7 - 2 = 5)</p>
                  </div>
                ) : (
                  <MarkdownExplanation
                    content={question.explanation}
                    className="text-gray-700"
                  />
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="bg-white rounded-lg shadow-lg p-8">
      <div className="mb-6">
        <h3 className="text-xl font-bold text-gray-800 mb-4">
          {question.question_text}
        </h3>

        {renderSequence()}
        {renderOptions()}
        {renderQuickButtons()}
        {renderExplanation()}
      </div>
    </div>
  )
}
