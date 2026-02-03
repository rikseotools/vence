// components/ExamReviewLayout.tsx
// Componente para revisar un examen completado con todas las respuestas

'use client'

import { useState, useMemo } from 'react'
import Link from 'next/link'
import type {
  ReviewQuestion,
  TestInfo,
  TestSummary,
  TemaBreakdown,
  DifficultyBreakdown,
} from '@/lib/api/test-review/schemas'

interface ExamReviewLayoutProps {
  test: TestInfo
  summary: TestSummary
  temaBreakdown?: TemaBreakdown[]
  difficultyBreakdown?: DifficultyBreakdown[]
  questions: ReviewQuestion[]
  oposicionSlug?: string
}

type FilterType = 'all' | 'correct' | 'incorrect' | 'blank'

export default function ExamReviewLayout({
  test,
  summary,
  temaBreakdown,
  difficultyBreakdown,
  questions,
  oposicionSlug = 'auxiliar-administrativo-estado'
}: ExamReviewLayoutProps) {
  const [filter, setFilter] = useState<FilterType>('all')
  const [expandedQuestions, setExpandedQuestions] = useState<Set<number>>(new Set())
  const [showArticle, setShowArticle] = useState<string | null>(null)

  // Filtrar preguntas según selección
  const filteredQuestions = useMemo(() => {
    switch (filter) {
      case 'correct':
        return questions.filter(q => q.isCorrect)
      case 'incorrect':
        return questions.filter(q => !q.isCorrect && q.userAnswer)
      case 'blank':
        return questions.filter(q => !q.userAnswer)
      default:
        return questions
    }
  }, [questions, filter])

  // Toggle expandir pregunta
  const toggleExpand = (order: number) => {
    const newExpanded = new Set(expandedQuestions)
    if (newExpanded.has(order)) {
      newExpanded.delete(order)
    } else {
      newExpanded.add(order)
    }
    setExpandedQuestions(newExpanded)
  }

  // Formatear tiempo
  const formatTime = (seconds: number) => {
    if (!seconds) return '0s'
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    if (mins > 0) return `${mins}m ${secs}s`
    return `${secs}s`
  }

  // Formatear fecha
  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('es-ES', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  // Obtener color según resultado
  const getScoreColor = (percentage: number) => {
    if (percentage >= 70) return 'text-green-600'
    if (percentage >= 50) return 'text-yellow-600'
    return 'text-red-600'
  }

  const getScoreBg = (percentage: number) => {
    if (percentage >= 70) return 'bg-green-50 border-green-200'
    if (percentage >= 50) return 'bg-yellow-50 border-yellow-200'
    return 'bg-red-50 border-red-200'
  }

  // Obtener letra de índice
  const indexToLetter = (index: number) => ['A', 'B', 'C', 'D'][index] || ''

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 dark:from-gray-900 dark:to-gray-800">
      <div className="container mx-auto px-4 py-6 max-w-4xl">

        {/* Header con resumen */}
        <div className={`rounded-xl border-2 p-6 mb-6 ${getScoreBg(summary.percentage)}`}>
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold text-gray-800 dark:text-white mb-2">
                {test.title}
              </h1>
              <p className="text-gray-600 dark:text-gray-400 text-sm">
                {test.completedAt && `Completado el ${formatDate(test.completedAt)} • `}
                Duración: {formatTime(test.totalTimeSeconds)}
              </p>
            </div>
            <div className="text-center md:text-right">
              <div className={`text-4xl font-bold ${getScoreColor(summary.percentage)}`}>
                {summary.percentage}%
              </div>
              <div className="text-gray-600 dark:text-gray-400">
                {summary.correctCount}/{summary.totalQuestions} correctas
              </div>
            </div>
          </div>

          {/* Estadísticas rápidas */}
          <div className="grid grid-cols-3 gap-4 mt-6 pt-4 border-t border-gray-200 dark:border-gray-700">
            <div className="text-center">
              <div className="text-2xl font-bold text-green-600">{summary.correctCount}</div>
              <div className="text-sm text-gray-600 dark:text-gray-400">Correctas</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-red-600">{summary.incorrectCount}</div>
              <div className="text-sm text-gray-600 dark:text-gray-400">Incorrectas</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-gray-500">{summary.blankCount}</div>
              <div className="text-sm text-gray-600 dark:text-gray-400">En blanco</div>
            </div>
          </div>
        </div>

        {/* Desglose por dificultad */}
        {difficultyBreakdown && difficultyBreakdown.length > 0 && (
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-4 mb-6">
            <h3 className="font-semibold text-gray-800 dark:text-white mb-3">Por dificultad</h3>
            <div className="flex flex-wrap gap-4">
              {difficultyBreakdown.map(d => (
                <div key={d.difficulty} className="flex items-center gap-2">
                  <span className={`px-2 py-1 rounded text-xs font-medium ${
                    d.difficulty === 'easy' ? 'bg-green-100 text-green-800' :
                    d.difficulty === 'medium' ? 'bg-yellow-100 text-yellow-800' :
                    'bg-red-100 text-red-800'
                  }`}>
                    {d.difficulty === 'easy' ? 'Fácil' : d.difficulty === 'medium' ? 'Media' : 'Difícil'}
                  </span>
                  <span className="text-sm text-gray-600 dark:text-gray-400">
                    {d.correct}/{d.total} ({d.accuracy}%)
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Filtros */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-4 mb-6">
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => setFilter('all')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                filter === 'all'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200'
              }`}
            >
              Todas ({questions.length})
            </button>
            <button
              onClick={() => setFilter('correct')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                filter === 'correct'
                  ? 'bg-green-600 text-white'
                  : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200'
              }`}
            >
              Correctas ({summary.correctCount})
            </button>
            <button
              onClick={() => setFilter('incorrect')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                filter === 'incorrect'
                  ? 'bg-red-600 text-white'
                  : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200'
              }`}
            >
              Incorrectas ({summary.incorrectCount})
            </button>
            <button
              onClick={() => setFilter('blank')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                filter === 'blank'
                  ? 'bg-gray-600 text-white'
                  : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200'
              }`}
            >
              En blanco ({summary.blankCount})
            </button>
          </div>
        </div>

        {/* Lista de preguntas */}
        <div className="space-y-4">
          {filteredQuestions.map((question, idx) => {
            const isExpanded = expandedQuestions.has(question.order)
            const userAnswerIndex = question.userAnswer
              ? ['A', 'B', 'C', 'D'].indexOf(question.userAnswer.toUpperCase())
              : -1
            const correctAnswerIndex = ['A', 'B', 'C', 'D'].indexOf(question.correctAnswer.toUpperCase())

            return (
              <div
                key={question.id || idx}
                className={`bg-white dark:bg-gray-800 rounded-xl shadow-sm overflow-hidden border-l-4 ${
                  question.isCorrect
                    ? 'border-l-green-500'
                    : question.userAnswer
                    ? 'border-l-red-500'
                    : 'border-l-gray-400'
                }`}
              >
                {/* Cabecera de pregunta */}
                <button
                  onClick={() => toggleExpand(question.order)}
                  className="w-full p-4 text-left hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <span className={`px-2 py-1 rounded text-xs font-bold ${
                          question.isCorrect
                            ? 'bg-green-100 text-green-800'
                            : question.userAnswer
                            ? 'bg-red-100 text-red-800'
                            : 'bg-gray-100 text-gray-600'
                        }`}>
                          {question.isCorrect ? 'CORRECTA' : question.userAnswer ? 'INCORRECTA' : 'EN BLANCO'}
                        </span>
                        <span className="text-xs text-gray-500">
                          Pregunta {question.order}
                        </span>
                        {question.lawName && (
                          <span className="text-xs bg-blue-100 text-blue-800 px-2 py-0.5 rounded">
                            {question.lawName} {question.articleNumber ? `Art. ${question.articleNumber}` : ''}
                          </span>
                        )}
                      </div>
                      <p className="text-gray-800 dark:text-white font-medium">
                        {question.questionText}
                      </p>
                    </div>
                    <div className="text-gray-400">
                      {isExpanded ? '▼' : '▶'}
                    </div>
                  </div>
                </button>

                {/* Contenido expandido */}
                {isExpanded && (
                  <div className="px-4 pb-4 border-t border-gray-100 dark:border-gray-700">
                    {/* Opciones */}
                    <div className="space-y-2 mt-4">
                      {question.options.map((option, optIdx) => {
                        const letter = indexToLetter(optIdx)
                        const isUserAnswer = optIdx === userAnswerIndex
                        const isCorrectAnswer = optIdx === correctAnswerIndex

                        let optionClass = 'bg-gray-50 dark:bg-gray-700 border-gray-200 dark:border-gray-600'
                        let indicator = null

                        if (isCorrectAnswer && isUserAnswer) {
                          optionClass = 'bg-green-100 dark:bg-green-900/30 border-green-500'
                          indicator = <span className="text-green-600 font-bold">Tu respuesta (Correcta)</span>
                        } else if (isCorrectAnswer) {
                          optionClass = 'bg-green-50 dark:bg-green-900/20 border-green-400'
                          indicator = <span className="text-green-600 font-medium">Respuesta correcta</span>
                        } else if (isUserAnswer) {
                          optionClass = 'bg-red-100 dark:bg-red-900/30 border-red-500'
                          indicator = <span className="text-red-600 font-bold">Tu respuesta</span>
                        }

                        return (
                          <div
                            key={optIdx}
                            className={`p-3 rounded-lg border-2 ${optionClass}`}
                          >
                            <div className="flex items-start gap-3">
                              <span className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center font-bold ${
                                isCorrectAnswer
                                  ? 'bg-green-500 text-white'
                                  : isUserAnswer
                                  ? 'bg-red-500 text-white'
                                  : 'bg-gray-300 dark:bg-gray-600 text-gray-700 dark:text-gray-300'
                              }`}>
                                {letter}
                              </span>
                              <div className="flex-1">
                                <p className="text-gray-800 dark:text-white">{option}</p>
                                {indicator && (
                                  <p className="text-sm mt-1">{indicator}</p>
                                )}
                              </div>
                            </div>
                          </div>
                        )
                      })}
                    </div>

                    {/* Explicación */}
                    {question.explanation && (
                      <div className="mt-4 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
                        <h4 className="font-semibold text-blue-800 dark:text-blue-300 mb-2">
                          Explicación
                        </h4>
                        <p className="text-gray-700 dark:text-gray-300 whitespace-pre-wrap">
                          {question.explanation}
                        </p>
                      </div>
                    )}

                    {/* Artículo */}
                    {question.article && (
                      <div className="mt-4">
                        <button
                          onClick={() => setShowArticle(showArticle === question.id ? null : question.id)}
                          className="text-blue-600 hover:text-blue-800 text-sm font-medium"
                        >
                          {showArticle === question.id ? '▼ Ocultar artículo' : '▶ Ver artículo completo'}
                        </button>
                        {showArticle === question.id && (
                          <div className="mt-2 p-4 bg-amber-50 dark:bg-amber-900/20 rounded-lg border border-amber-200 dark:border-amber-800">
                            <h4 className="font-semibold text-amber-800 dark:text-amber-300 mb-2">
                              {question.lawName} {question.articleNumber ? `- Art. ${question.articleNumber}` : ''}
                            </h4>
                            <p className="text-gray-700 dark:text-gray-300 whitespace-pre-wrap text-sm">
                              {question.article}
                            </p>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Tiempo */}
                    <div className="mt-4 text-xs text-gray-500">
                      Tiempo: {formatTime(question.timeSpent)}
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>

        {/* No hay resultados con el filtro */}
        {filteredQuestions.length === 0 && (
          <div className="bg-white dark:bg-gray-800 rounded-xl p-8 text-center">
            <p className="text-gray-500 dark:text-gray-400">
              No hay preguntas con este filtro
            </p>
          </div>
        )}

        {/* Acciones finales */}
        <div className="mt-8 flex flex-wrap gap-4 justify-center">
          <Link
            href={`/${oposicionSlug}/test`}
            className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
          >
            Volver a Tests
          </Link>
          <Link
            href="/mis-estadisticas"
            className="px-6 py-3 bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-white rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors font-medium"
          >
            Ver Estadísticas
          </Link>
        </div>
      </div>
    </div>
  )
}
