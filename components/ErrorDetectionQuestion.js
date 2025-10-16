'use client'
import { useState, useEffect } from 'react'
import ChartQuestion from './ChartQuestion'

export default function ErrorDetectionQuestion({ 
  question, 
  onAnswer, 
  selectedAnswer, 
  showResult, 
  isAnswering,
  attemptCount = 0
}) {
  const [textComponent, setTextComponent] = useState('')

  useEffect(() => {
    generateTextComponent()
  }, [question])

  const generateTextComponent = () => {
    const contentData = question.content_data
    
    if (!contentData) return

    const originalText = contentData.original_text || ''
    const errorCount = contentData.error_count || 0
    const errors = contentData.errors_found || []

    setTextComponent(
      <div className="w-full space-y-6">
        {/* Separar visualmente la frase a analizar del enunciado */}
        <div className="bg-gradient-to-r from-blue-50 to-blue-100 dark:from-blue-900/20 dark:to-blue-800/20 border-2 border-blue-200 dark:border-blue-700 rounded-xl p-6 shadow-lg">
          <div className="text-center mb-4">
            <div className="flex items-center justify-center mb-3">
              <div className="bg-blue-500 text-white rounded-full w-8 h-8 flex items-center justify-center mr-3">
                📝
              </div>
              <h3 className="font-bold text-blue-800 dark:text-blue-300 text-lg">
                Texto a analizar
              </h3>
            </div>
          </div>
          
          {/* La frase destacada en una caja especial */}
          <div className="bg-white dark:bg-gray-800 border-2 border-blue-300 dark:border-blue-600 rounded-lg p-6 shadow-inner">
            <p className="text-gray-900 dark:text-white text-xl leading-relaxed font-medium text-center italic">
              "{originalText}"
            </p>
          </div>
        </div>

      </div>
    )
  }

  // Secciones de explicación específicas para detección de errores
  const explanationSections = (
    <div className="space-y-4">
      {question.content_data?.explanation_sections?.map((section, index) => (
        <div key={index} className="bg-white dark:bg-gray-800 p-4 rounded-lg border-l-4 border-blue-500">
          <h5 className="font-semibold text-blue-800 dark:text-blue-300 mb-2">
            {section.title}
          </h5>
          <div className="text-gray-700 dark:text-gray-300 text-sm whitespace-pre-line">
            {section.content}
          </div>
        </div>
      )) || (
        <div className="bg-white dark:bg-gray-800 p-4 rounded-lg border-l-4 border-green-500">
          <h5 className="font-semibold text-green-800 dark:text-green-300 mb-2">
            📝 Análisis de errores:
          </h5>
          <div className="text-gray-700 dark:text-gray-300 text-sm">
            {question.content_data?.errors_found?.map((error, index) => (
              <div key={index} className="mb-2">
                <span className="font-medium">• {error.incorrect}</span> → 
                <span className="text-green-600 dark:text-green-400 font-medium"> {error.correct}</span>
                <span className="text-gray-600 dark:text-gray-400"> ({error.explanation})</span>
              </div>
            )) || (
              <p>Se encontraron {question.content_data?.error_count || 0} errores ortográficos en el texto.</p>
            )}
          </div>
        </div>
      )}
    </div>
  )

  return (
    <ChartQuestion
      question={question}
      onAnswer={onAnswer}
      selectedAnswer={selectedAnswer}
      showResult={showResult}
      isAnswering={isAnswering}
      chartComponent={textComponent}
      explanationSections={explanationSections}
      attemptCount={attemptCount}
    />
  )
}