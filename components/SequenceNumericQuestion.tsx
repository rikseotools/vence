'use client'
import { useState, useEffect } from 'react'
import PsychometricAIHelpButton from './PsychometricAIHelpButton'
import PsychometricExplanation from './PsychometricExplanation'
import { type StandaloneQuestionProps } from './psychometric-types'

export default function SequenceNumericQuestion({
  question,
  onAnswer,
  selectedAnswer,
  showResult,
  isAnswering,
  attemptCount = 0,
  verifiedCorrectAnswer = null,
  verifiedExplanation = null
}: StandaloneQuestionProps) {
  const [timeTaken, setTimeTaken] = useState<number>(0)
  const [startTime, setStartTime] = useState<number | null>(null)

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

  const handleAnswer = (optionIndex: number): void => {
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
    // Series con disposición visual (p.ej. circular): se renderiza un SVG inline
    // alimentado por content_data.pairs. El resto de series llevan los datos en
    // question_text, por lo que aquí solo cubrimos los patrones visuales.
    const cd = (question.content_data || {}) as {
      pattern_type?: string
      pairs?: Array<[number | string | null, number | string | null]>
    }

    if (cd.pattern_type === 'visual_circular' && Array.isArray(cd.pairs) && cd.pairs.length > 0) {
      const pairs = cd.pairs
      const cx = 200, cy = 200, R = 130, nodeR = 32
      const nodes: Array<{ x: number; y: number; value: number | string | null }> = []
      pairs.forEach((p, i) => {
        const a1 = -Math.PI / 2 + (i / pairs.length) * Math.PI
        const a2 = a1 + Math.PI
        nodes.push({ x: cx + R * Math.cos(a1), y: cy + R * Math.sin(a1), value: p[0] })
        nodes.push({ x: cx + R * Math.cos(a2), y: cy + R * Math.sin(a2), value: p[1] })
      })

      return (
        <div className="my-6 flex justify-center">
          <svg viewBox="0 0 400 400" width="320" height="320" className="rounded-lg">
            {pairs.map((_, i) => {
              const a = nodes[i * 2], b = nodes[i * 2 + 1]
              return (
                <line
                  key={`line-${i}`}
                  x1={a.x} y1={a.y} x2={b.x} y2={b.y}
                  className="stroke-gray-300 dark:stroke-gray-600"
                  strokeWidth={1}
                  strokeDasharray="4 4"
                />
              )
            })}
            <circle cx={cx} cy={cy} r={R}
              className="fill-none stroke-gray-200 dark:stroke-gray-700" strokeWidth={1} />
            {nodes.map((n, i) => {
              const isUnknown = n.value === null || n.value === undefined || n.value === '?'
              return (
                <g key={`node-${i}`}>
                  <circle cx={n.x} cy={n.y} r={nodeR}
                    className={isUnknown
                      ? 'fill-amber-100 dark:fill-amber-900 stroke-gray-700 dark:stroke-gray-300'
                      : 'fill-white dark:fill-gray-700 stroke-gray-700 dark:stroke-gray-300'}
                    strokeWidth={2} />
                  <text x={n.x} y={n.y + 7} textAnchor="middle"
                    className="fill-gray-900 dark:fill-gray-100"
                    fontSize={22} fontWeight={700}
                    style={{ fontFamily: 'ui-sans-serif, system-ui, -apple-system, sans-serif' }}>
                    {isUnknown ? '?' : String(n.value)}
                  </text>
                </g>
              )
            })}
          </svg>
        </div>
      )
    }

    // Otras series numéricas: la serie va integrada en el texto de la pregunta
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
          <PsychometricAIHelpButton question={question} questionTypeLabel="Serie numérica" className="ml-auto" />
        </div>

        <PsychometricExplanation
          verifiedExplanation={verifiedExplanation}
          explanationSections={question.content_data?.explanation_sections}
        />
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
