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

interface NotaCorte {
  descripcion: string
  primera_parte: { nota: number; aciertos?: number; errores?: number }
  segunda_parte: { nota: number; aciertos?: number; errores?: number }
  total: number
  orden: number
  convocatoria_url?: string
}

interface ExamReviewLayoutProps {
  test: TestInfo
  summary: TestSummary
  temaBreakdown?: TemaBreakdown[]
  difficultyBreakdown?: DifficultyBreakdown[]
  questions: ReviewQuestion[]
  notaCorte?: NotaCorte
  oposicionSlug?: string
  parte?: 'primera' | 'segunda' | null
}

type FilterType = 'all' | 'correct' | 'incorrect' | 'blank'

export default function ExamReviewLayout({
  test,
  summary,
  temaBreakdown,
  difficultyBreakdown,
  questions,
  notaCorte,
  oposicionSlug = 'auxiliar-administrativo-estado',
  parte
}: ExamReviewLayoutProps) {
  const [filter, setFilter] = useState<FilterType>('all')
  // Start with incorrect and blank questions expanded by default
  const [expandedQuestions, setExpandedQuestions] = useState<Set<number>>(() => {
    const initialExpanded = new Set<number>()
    questions.forEach(q => {
      if (!q.isCorrect) {
        initialExpanded.add(q.order)
      }
    })
    return initialExpanded
  })
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

        {/* Nota de corte oficial */}
        {notaCorte && (() => {
          // Determinar qué nota de corte usar según la parte
          const parteData = parte === 'primera'
            ? notaCorte.primera_parte
            : parte === 'segunda'
            ? notaCorte.segunda_parte
            : null

          // Preguntas reales por parte (primera=60, segunda=50, total=110)
          const maxPreguntas = parte === 'primera' ? 60 : parte === 'segunda' ? 50 : 110
          const notaCorteRelevante = parte
            ? (parte === 'primera' ? notaCorte.primera_parte.nota : notaCorte.segunda_parte.nota)
            : notaCorte.total

          // Nota de corte "sobre 10" (la nota oficial ya tiene penalización incluida)
          const notaCorteSobre10 = (notaCorteRelevante / maxPreguntas) * 10

          // Nota del usuario "sobre 10" (aciertos - errores/3) / totalPreguntas * 10
          const penalizacion = summary.incorrectCount / 3
          const notaUsuarioNeta = summary.correctCount - penalizacion
          const userNotaSobre10 = (notaUsuarioNeta / summary.totalQuestions) * 10

          // Comparar en base 10
          const isAboveCutoff = userNotaSobre10 >= notaCorteSobre10

          return (
          <div className="relative bg-white dark:bg-gray-800 rounded-xl shadow-sm p-4 mb-6 border-l-4 border-amber-500">
            {/* Confeti si supera la nota de corte */}
            {isAboveCutoff && (
              <div className="absolute inset-0 pointer-events-none overflow-hidden rounded-xl">
                <div className="confetti-container">
                  {[...Array(30)].map((_, i) => (
                    <div
                      key={i}
                      className="confetti"
                      style={{
                        left: `${Math.random() * 100}%`,
                        animationDelay: `${Math.random() * 3}s`,
                        backgroundColor: ['#fbbf24', '#f59e0b', '#10b981', '#3b82f6', '#8b5cf6', '#ec4899'][Math.floor(Math.random() * 6)]
                      }}
                    />
                  ))}
                </div>
              </div>
            )}
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold text-gray-800 dark:text-white flex items-center gap-2">
                <span className="text-amber-500">📊</span>
                Nota de corte oficial {parte ? `(${parte === 'primera' ? '1ª' : '2ª'} parte)` : ''}
              </h3>
              {notaCorte.convocatoria_url && (
                <a
                  href={notaCorte.convocatoria_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-blue-600 hover:text-blue-800 hover:underline flex items-center gap-1"
                >
                  Ver convocatoria
                  <span>↗</span>
                </a>
              )}
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">{notaCorte.descripcion}</p>
            <p className="text-xs text-gray-400 dark:text-gray-500 mb-3 italic">
              Puntuación = aciertos − (errores ÷ 3). {parte === 'primera' ? '60 preguntas' : parte === 'segunda' ? '50 preguntas' : '110 preguntas totales'}.
            </p>

            {/* Vista específica por parte */}
            {parte && parteData ? (
              <div className="grid grid-cols-3 gap-3">
                {/* Nota de corte oficial */}
                <div className={`${parte === 'primera' ? 'bg-blue-50 dark:bg-blue-900/20' : 'bg-green-50 dark:bg-green-900/20'} rounded-lg p-3`}>
                  <div className={`text-xs ${parte === 'primera' ? 'text-blue-600 dark:text-blue-400' : 'text-green-600 dark:text-green-400'} font-medium mb-1`}>
                    Nota de corte
                  </div>
                  <div className={`text-lg font-bold ${parte === 'primera' ? 'text-blue-800 dark:text-blue-300' : 'text-green-800 dark:text-green-300'}`}>
                    {parteData.nota} pts
                  </div>
                  {parteData.aciertos !== undefined && parteData.errores !== undefined && (
                    <div className="text-xs text-gray-500 dark:text-gray-400">
                      <span className="text-green-600">{parteData.aciertos} aciertos</span>
                      {' · '}
                      <span className="text-red-600">{parteData.errores} errores</span>
                    </div>
                  )}
                  <div className={`text-xs ${parte === 'primera' ? 'text-blue-600 dark:text-blue-400' : 'text-green-600 dark:text-green-400'} mt-2 font-medium border-t border-gray-200 dark:border-gray-600 pt-2`}>
                    = {notaCorteSobre10.toFixed(2)} sobre 10
                  </div>
                </div>

                {/* Tu nota */}
                <div className={`${isAboveCutoff ? 'bg-green-50 dark:bg-green-900/20' : 'bg-red-50 dark:bg-red-900/20'} rounded-lg p-3`}>
                  <div className={`text-xs ${isAboveCutoff ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'} font-medium mb-1`}>
                    Tu nota
                  </div>
                  <div className={`text-lg font-bold ${isAboveCutoff ? 'text-green-800 dark:text-green-300' : 'text-red-800 dark:text-red-300'}`}>
                    {notaUsuarioNeta.toFixed(2)} pts
                  </div>
                  <div className="text-xs text-gray-500 dark:text-gray-400">
                    <span className="text-green-600">{summary.correctCount} aciertos</span>
                    {' · '}
                    <span className="text-red-600">{summary.incorrectCount} errores</span>
                    {' · '}
                    <span className="text-gray-400">{summary.blankCount} en blanco</span>
                  </div>
                  <div className={`text-xs ${isAboveCutoff ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'} mt-2 font-medium border-t border-gray-200 dark:border-gray-600 pt-2`}>
                    = {userNotaSobre10.toFixed(2)} sobre 10
                  </div>
                </div>

                {/* Orden */}
                <div className="bg-purple-50 dark:bg-purple-900/20 rounded-lg p-3">
                  <div className="text-xs text-purple-600 dark:text-purple-400 font-medium mb-1">Último aprobado</div>
                  <div className="text-lg font-bold text-purple-800 dark:text-purple-300">#{notaCorte.orden}</div>
                  <div className="text-xs text-gray-500 dark:text-gray-400">en la lista</div>
                </div>
              </div>
            ) : (
              /* Vista completa con ambas partes */
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {/* Primera parte */}
                <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-3">
                  <div className="text-xs text-blue-600 dark:text-blue-400 font-medium mb-1">1ª Parte (corte)</div>
                  <div className="text-lg font-bold text-blue-800 dark:text-blue-300">{notaCorte.primera_parte.nota} pts</div>
                  {notaCorte.primera_parte.aciertos !== undefined && notaCorte.primera_parte.errores !== undefined && (
                    <div className="text-xs text-gray-500 dark:text-gray-400">
                      <span className="text-green-600">{notaCorte.primera_parte.aciertos} aciertos</span>
                      {' · '}
                      <span className="text-red-600">{notaCorte.primera_parte.errores} errores</span>
                    </div>
                  )}
                  <div className="text-xs text-blue-600 dark:text-blue-400 mt-2 font-medium border-t border-blue-200 dark:border-blue-700 pt-2">
                    = {((notaCorte.primera_parte.nota / 60) * 10).toFixed(2)} sobre 10
                  </div>
                </div>

                {/* Segunda parte */}
                <div className="bg-green-50 dark:bg-green-900/20 rounded-lg p-3">
                  <div className="text-xs text-green-600 dark:text-green-400 font-medium mb-1">2ª Parte (corte)</div>
                  <div className="text-lg font-bold text-green-800 dark:text-green-300">{notaCorte.segunda_parte.nota} pts</div>
                  {notaCorte.segunda_parte.aciertos !== undefined && notaCorte.segunda_parte.errores !== undefined && (
                    <div className="text-xs text-gray-500 dark:text-gray-400">
                      <span className="text-green-600">{notaCorte.segunda_parte.aciertos} aciertos</span>
                      {' · '}
                      <span className="text-red-600">{notaCorte.segunda_parte.errores} errores</span>
                    </div>
                  )}
                  <div className="text-xs text-green-600 dark:text-green-400 mt-2 font-medium border-t border-green-200 dark:border-green-700 pt-2">
                    = {((notaCorte.segunda_parte.nota / 50) * 10).toFixed(2)} sobre 10
                  </div>
                </div>

                {/* Total nota corte */}
                <div className="bg-amber-50 dark:bg-amber-900/20 rounded-lg p-3">
                  <div className="text-xs text-amber-600 dark:text-amber-400 font-medium mb-1">Total (corte)</div>
                  <div className="text-lg font-bold text-amber-800 dark:text-amber-300">{notaCorte.total} pts</div>
                  <div className="text-xs text-gray-500 dark:text-gray-400">aprobado #{notaCorte.orden}</div>
                  <div className="text-xs text-amber-600 dark:text-amber-400 mt-2 font-medium border-t border-amber-200 dark:border-amber-700 pt-2">
                    = {((notaCorte.total / 110) * 10).toFixed(2)} sobre 10
                  </div>
                </div>

                {/* Tu nota */}
                <div className={`${isAboveCutoff ? 'bg-green-50 dark:bg-green-900/20' : 'bg-red-50 dark:bg-red-900/20'} rounded-lg p-3`}>
                  <div className={`text-xs ${isAboveCutoff ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'} font-medium mb-1`}>Tu nota</div>
                  <div className={`text-lg font-bold ${isAboveCutoff ? 'text-green-800 dark:text-green-300' : 'text-red-800 dark:text-red-300'}`}>{notaUsuarioNeta.toFixed(2)} pts</div>
                  <div className="text-xs text-gray-500 dark:text-gray-400">
                    <span className="text-green-600">{summary.correctCount} ac</span>
                    {' · '}
                    <span className="text-red-600">{summary.incorrectCount} err</span>
                    {' · '}
                    <span className="text-gray-400">{summary.blankCount} bl</span>
                  </div>
                  <div className={`text-xs ${isAboveCutoff ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'} mt-2 font-medium border-t border-gray-200 dark:border-gray-600 pt-2`}>
                    = {userNotaSobre10.toFixed(2)} sobre 10
                  </div>
                </div>
              </div>
            )}

            {/* Comparación con tu resultado */}
            <div className="mt-4 pt-3 border-t border-gray-200 dark:border-gray-700">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                <div className="text-sm text-gray-600 dark:text-gray-400">
                  <strong className={isAboveCutoff ? 'text-green-600' : 'text-red-600'}>Tu nota: {userNotaSobre10.toFixed(2)}/10</strong>
                  <span className="mx-2">vs</span>
                  <strong className="text-amber-600">Corte: {notaCorteSobre10.toFixed(2)}/10</strong>
                </div>
                <span className={`text-sm font-bold px-3 py-1 rounded-full ${isAboveCutoff ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                  {isAboveCutoff ? '✓ APROBADO' : '✗ SUSPENSO'}
                </span>
              </div>
            </div>
          </div>
          )
        })()}


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
