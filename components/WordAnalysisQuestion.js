'use client'
import { useState } from 'react'

export default function WordAnalysisQuestion({
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
          const optionText = question.options ? question.options[letter] : question[optionKey]
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

      {/* 🔒 SEGURIDAD: Usar verifiedExplanation de API */}
      {showResult && verifiedExplanation && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-6 mt-6">
          <h4 className="font-semibold text-blue-800 mb-2">📝 Explicación:</h4>
          <div
            className="text-blue-700 whitespace-pre-line"
            dangerouslySetInnerHTML={{ __html: verifiedExplanation.replace(/\n/g, '<br>') }}
          />
        </div>
      )}
    </div>
  )
}
