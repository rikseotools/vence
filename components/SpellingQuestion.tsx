'use client'

import { useState } from 'react'

interface SpellingOption {
  letter: string
  text: string
  isCorrectlyWritten: boolean // true = bien escrita, false = mal escrita
}

interface SpellingQuestionProps {
  questionText: string // Frase con **palabras** resaltadas
  options: SpellingOption[]
  explanation: string | null
  onAnswer: (selectedIndices: number[]) => void
  showResult: boolean
  questionNumber: number
}

/**
 * Componente para preguntas de ortografía/gramática de Guardia Civil.
 *
 * El usuario debe marcar TODAS las palabras/frases incorrectas.
 * Puede seleccionar múltiples opciones antes de confirmar.
 *
 * Formato del examen real GC:
 * - Ortografía: frase con 4 palabras resaltadas, señalar las mal escritas
 * - Gramática: 4 frases, señalar las incorrectas morfológica/sintácticamente
 */
export default function SpellingQuestion({
  questionText,
  options,
  explanation,
  onAnswer,
  showResult,
  questionNumber,
}: SpellingQuestionProps) {
  const [selected, setSelected] = useState<Set<number>>(new Set())
  const [confirmed, setConfirmed] = useState(false)

  const toggleOption = (index: number) => {
    if (showResult || confirmed) return
    setSelected(prev => {
      const next = new Set(prev)
      if (next.has(index)) next.delete(index)
      else next.add(index)
      return next
    })
  }

  const handleConfirm = () => {
    if (confirmed || showResult) return
    setConfirmed(true)
    onAnswer(Array.from(selected))
  }

  // Calculate score
  const incorrectIndices = options.map((o, i) => !o.isCorrectlyWritten ? i : -1).filter(i => i >= 0)
  const isFullyCorrect = showResult &&
    incorrectIndices.every(i => selected.has(i)) &&
    Array.from(selected).every(i => incorrectIndices.includes(i))

  // Render question text with **bold** as actual bold
  const renderQuestionText = (text: string) => {
    const parts = text.split(/(\*\*[^*]+\*\*)/g)
    return parts.map((part, i) => {
      if (part.startsWith('**') && part.endsWith('**')) {
        const word = part.slice(2, -2)
        return <strong key={i} className="font-bold text-gray-900 dark:text-white underline decoration-2 underline-offset-2">{word}</strong>
      }
      return <span key={i}>{part}</span>
    })
  }

  return (
    <div className="w-full">
      {/* Instruction */}
      <div className="mb-3 px-3 py-2 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700 rounded-lg">
        <p className="text-sm text-amber-800 dark:text-amber-200 font-medium">
          Señale la(s) palabra(s) o expresión(es) <strong>incorrecta(s)</strong>. Puede seleccionar varias.
        </p>
      </div>

      {/* Question text */}
      <div className="mb-6">
        <p className="text-lg text-gray-800 dark:text-gray-200 leading-relaxed">
          {renderQuestionText(questionText)}
        </p>
      </div>

      {/* Options - multi-select checkboxes */}
      <div className="space-y-3 mb-4">
        {options.map((option, index) => {
          const isSelected = selected.has(index)
          const isIncorrectWord = !option.isCorrectlyWritten // la palabra ESTÁ mal escrita

          let borderClass = 'border-gray-200 dark:border-gray-600'
          let bgClass = ''
          let textClass = 'text-gray-800 dark:text-gray-200'

          if (showResult) {
            if (isIncorrectWord && isSelected) {
              // Correctly identified as wrong
              borderClass = 'border-green-500'
              bgClass = 'bg-green-50 dark:bg-green-900/30'
              textClass = 'text-green-800 dark:text-green-300'
            } else if (isIncorrectWord && !isSelected) {
              // Missed - should have been selected
              borderClass = 'border-amber-500'
              bgClass = 'bg-amber-50 dark:bg-amber-900/30'
              textClass = 'text-amber-800 dark:text-amber-300'
            } else if (!isIncorrectWord && isSelected) {
              // Incorrectly selected (word was fine)
              borderClass = 'border-red-500'
              bgClass = 'bg-red-50 dark:bg-red-900/30'
              textClass = 'text-red-800 dark:text-red-300'
            } else {
              // Correctly left unselected
              borderClass = 'border-gray-200 dark:border-gray-600'
              bgClass = 'bg-gray-50 dark:bg-gray-700'
              textClass = 'text-gray-600 dark:text-gray-400'
            }
          } else if (isSelected) {
            borderClass = 'border-blue-500'
            bgClass = 'bg-blue-50 dark:bg-blue-900/30'
            textClass = 'text-blue-800 dark:text-blue-300'
          }

          return (
            <button
              key={index}
              onClick={() => toggleOption(index)}
              disabled={showResult}
              className={`w-full text-left p-4 rounded-lg border-2 transition-all duration-200 ${borderClass} ${bgClass} ${textClass} ${!showResult ? 'cursor-pointer hover:border-blue-300 dark:hover:border-blue-500' : 'cursor-default'}`}
            >
              <span className="inline-flex items-center w-full">
                {/* Checkbox */}
                <span className={`w-5 h-5 rounded border-2 flex items-center justify-center mr-3 flex-shrink-0 ${
                  isSelected
                    ? (showResult
                      ? (isIncorrectWord ? 'border-green-500 bg-green-500' : 'border-red-500 bg-red-500')
                      : 'border-blue-500 bg-blue-500')
                    : 'border-gray-300 dark:border-gray-500'
                }`}>
                  {isSelected && (
                    <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                    </svg>
                  )}
                </span>

                {/* Letter badge */}
                <span className={`w-6 h-6 rounded-full border-2 flex items-center justify-center text-sm font-bold mr-3 flex-shrink-0 ${
                  showResult
                    ? isIncorrectWord
                      ? isSelected ? 'border-green-500 bg-green-500 text-white' : 'border-amber-500 bg-amber-500 text-white'
                      : isSelected ? 'border-red-500 bg-red-500 text-white' : 'border-gray-300 text-gray-500'
                    : isSelected ? 'border-blue-500 bg-blue-500 text-white' : 'border-gray-300 text-gray-600'
                }`}>
                  {option.letter}
                </span>

                {/* Option text */}
                <span className="flex-1">{option.text}</span>

                {/* Result icon */}
                {showResult && (
                  <span className="ml-2 flex-shrink-0">
                    {isIncorrectWord && isSelected && '✅'}
                    {isIncorrectWord && !isSelected && '⚠️'}
                    {!isIncorrectWord && isSelected && '❌'}
                  </span>
                )}
              </span>
            </button>
          )
        })}
      </div>

      {/* Confirm button (before result) */}
      {!showResult && (
        <button
          onClick={handleConfirm}
          disabled={selected.size === 0}
          className={`w-full py-3 rounded-lg font-semibold transition-all ${
            selected.size > 0
              ? 'bg-blue-600 text-white hover:bg-blue-700'
              : 'bg-gray-200 text-gray-400 cursor-not-allowed'
          }`}
        >
          Confirmar selección ({selected.size} {selected.size === 1 ? 'palabra' : 'palabras'})
        </button>
      )}

      {/* Result summary */}
      {showResult && (
        <div className={`mt-4 p-4 rounded-lg ${isFullyCorrect ? 'bg-green-50 dark:bg-green-900/30 border border-green-200' : 'bg-amber-50 dark:bg-amber-900/30 border border-amber-200'}`}>
          <p className={`font-semibold ${isFullyCorrect ? 'text-green-800 dark:text-green-300' : 'text-amber-800 dark:text-amber-300'}`}>
            {isFullyCorrect ? '✅ ¡Perfecto!' : `⚠️ ${incorrectIndices.length} palabra(s) incorrecta(s)`}
          </p>
          {!isFullyCorrect && (
            <p className="text-sm mt-1 text-gray-600 dark:text-gray-400">
              Las incorrectas eran: {incorrectIndices.map(i => <strong key={i} className="text-red-600"> {options[i].text}</strong>)}
            </p>
          )}
        </div>
      )}
    </div>
  )
}
