'use client'
import PsychometricAIHelpButton from './PsychometricAIHelpButton'
import { type StandaloneQuestionProps } from './psychometric-types'

export default function WordAnalysisQuestion({
  question,
  onAnswer,
  selectedAnswer,
  showResult,
  isAnswering,
  attemptCount = 0,
  verifiedCorrectAnswer = null,
  verifiedExplanation = null
}: StandaloneQuestionProps) {

  // 🔒 SEGURIDAD: Usar verifiedCorrectAnswer de API cuando esté disponible
  const effectiveCorrectAnswer = showResult && verifiedCorrectAnswer !== null
    ? verifiedCorrectAnswer
    : null // NO usamos question.correct_option como fallback

  return (
    <div className="bg-white rounded-lg shadow-lg p-8">
      <h3 className="text-xl font-bold text-gray-900 mb-6">
        {question.question_text}
      </h3>

      {/* Mostrar recuadro con las palabras a analizar */}
      {question.content_data?.original_text && (
        <div className="bg-gradient-to-r from-blue-50 to-blue-100 border-2 border-blue-200 rounded-xl p-6 shadow-lg mb-6">
          <div className="bg-white border-2 border-blue-300 rounded-lg p-6 shadow-inner">
            <p className="text-gray-900 text-xl leading-relaxed font-medium text-center italic">
              {question.content_data.original_text}
            </p>
          </div>
        </div>
      )}

      <div className="grid gap-4 mb-8">
        {['A', 'B', 'C', 'D'].map((letter, index) => {
          const optionKey = `option_${letter.toLowerCase()}`
          const optionText = question.options ? question.options[letter as keyof typeof question.options] : question[optionKey]
          const isSelected = selectedAnswer === index
          // 🔒 SEGURIDAD: Usar effectiveCorrectAnswer de API
          const isCorrectOption = showResult && effectiveCorrectAnswer !== null
            ? index === effectiveCorrectAnswer
            : false

          return (
            <button
              key={letter}
              onClick={() => !showResult && onAnswer(index)}
              disabled={showResult || isAnswering}
              className={`text-left p-4 rounded-lg border transition-all duration-200 ${
                showResult
                  ? isCorrectOption
                    ? 'bg-green-100 border-green-500 text-green-800'
                    : isSelected
                      ? 'bg-red-100 border-red-500 text-red-800'
                      : 'bg-gray-50 border-gray-300 text-gray-600'
                  : isSelected
                    ? 'bg-blue-100 border-blue-500 text-blue-800'
                    : 'bg-gray-50 border-gray-300 hover:bg-gray-100'
              }`}
            >
              <div className="flex items-start gap-3">
                <span className="font-bold text-lg">{letter})</span>
                <span className="flex-1">{optionText}</span>
                {showResult && isCorrectOption && (
                  <span className="text-green-600">✓</span>
                )}
                {showResult && isSelected && !isCorrectOption && (
                  <span className="text-red-600">✗</span>
                )}
              </div>
            </button>
          )
        })}
      </div>

      {/* Resultado y explicación */}
      {showResult && effectiveCorrectAnswer !== null && (
        <div className="mt-6 p-6 bg-gray-50 rounded-lg">
          <div className={`flex items-center mb-4 ${selectedAnswer === effectiveCorrectAnswer ? 'text-green-700' : 'text-red-700'}`}>
            <span className="text-2xl mr-2">{selectedAnswer === effectiveCorrectAnswer ? '✅' : '❌'}</span>
            <span className="text-lg font-semibold">
              {selectedAnswer === effectiveCorrectAnswer ? '¡Correcto!' : 'Incorrecto'}
            </span>
            <PsychometricAIHelpButton question={question} questionTypeLabel="Análisis de palabras" className="ml-auto" />
          </div>

          {/* 🔒 SEGURIDAD: Usar verifiedExplanation de API */}
          {verifiedExplanation && (
            <div className="bg-white p-4 rounded-lg border-l-4 border-green-500">
              <h5 className="font-semibold text-green-800 mb-2">📝 Explicación:</h5>
              <div
                className="text-gray-700 text-sm whitespace-pre-line"
                dangerouslySetInnerHTML={{ __html: verifiedExplanation.replace(/\n/g, '<br>') }}
              />
            </div>
          )}
        </div>
      )}
    </div>
  )
}
