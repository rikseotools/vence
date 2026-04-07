// components/FailedQuestionsModal.tsx - Modal reutilizable para preguntas falladas
'use client'
import { useState } from 'react'
import type { FailedQuestionsData, FailedQuestionItem } from './TestConfigurator.types'

export type FailedPeriod = 'all' | '7d' | '30d'

interface FailedQuestionsModalProps {
  data: FailedQuestionsData
  title?: string
  onClose: () => void
  onStart: (questionIds: string[], sortOrder: string, count: number | 'all') => void
  onChangePeriod?: (period: FailedPeriod) => void
  currentPeriod?: FailedPeriod
}

export default function FailedQuestionsModal({
  data,
  title,
  onClose,
  onStart,
  onChangePeriod,
  currentPeriod = 'all',
}: FailedQuestionsModalProps) {
  const [selectedOrder, setSelectedOrder] = useState<string | null>(null)
  const [selectedCount, setSelectedCount] = useState<number | 'all'>(25)

  const handleStart = () => {
    if (!selectedOrder) return

    let sorted = [...data.questions]
    switch (selectedOrder) {
      case 'most_failed':
        sorted.sort((a, b) => b.failedCount - a.failedCount)
        break
      case 'recent_failed':
        sorted.sort((a, b) => new Date(b.lastFailed).getTime() - new Date(a.lastFailed).getTime())
        break
      case 'oldest_failed':
        sorted.sort((a, b) => new Date(a.firstFailed).getTime() - new Date(b.firstFailed).getTime())
        break
      case 'random':
        for (let i = sorted.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          [sorted[i], sorted[j]] = [sorted[j], sorted[i]]
        }
        break
    }

    const ids = sorted.map(q => q.questionId)
    onStart(ids, selectedOrder, selectedCount)
  }

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-xl max-w-4xl w-full max-h-[90vh] shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-red-600 to-orange-600 text-white px-4 py-4 flex items-center justify-between">
          <div className="flex items-center space-x-3 min-w-0 flex-1">
            <span className="text-xl sm:text-2xl">❌</span>
            <div className="min-w-0 flex-1">
              <h3 className="text-base sm:text-lg font-bold leading-tight">
                Preguntas Falladas{title ? ` - ${title}` : ''}
              </h3>
              <p className="text-red-100 text-xs sm:text-sm">
                {data.totalQuestions} preguntas diferentes • {data.totalFailures} fallos en total
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 bg-white/20 hover:bg-white/30 rounded-full flex items-center justify-center transition-colors"
          >
            <span className="text-white font-bold">×</span>
          </button>
        </div>

        {/* Content */}
        <div className="p-4 sm:p-6 max-h-[70vh] overflow-y-auto">

          {/* Info */}
          <div className="mb-6 p-4 bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-lg">
            <div className="flex items-center justify-center">
              <span className="text-2xl mr-3">📊</span>
              <div className="text-center">
                <div className="text-2xl font-bold text-blue-800">
                  {data.totalQuestions}
                </div>
                <div className="text-sm text-blue-600">
                  preguntas diferentes que has fallado
                </div>
                <div className="text-xs text-blue-500 mt-1">
                  ({data.totalFailures} fallos en total entre todas)
                </div>
              </div>
            </div>
          </div>

          {/* Filtro de periodo */}
          {onChangePeriod && (
            <div className="mb-6">
              <h4 className="font-bold text-gray-800 mb-3 flex items-center">
                <span className="mr-2">📅</span>
                ¿De qué periodo?
              </h4>
              <div className="grid grid-cols-3 gap-2">
                {([
                  { id: 'all' as const, label: 'Todas', desc: 'Historial completo' },
                  { id: '30d' as const, label: 'Último mes', desc: 'Últimos 30 días' },
                  { id: '7d' as const, label: 'Última semana', desc: 'Últimos 7 días' },
                ]).map((opt) => (
                  <button
                    key={opt.id}
                    onClick={() => {
                      setSelectedOrder(null)
                      onChangePeriod(opt.id)
                    }}
                    className={`p-3 border-2 rounded-lg transition-all text-center ${
                      currentPeriod === opt.id
                        ? 'border-indigo-500 bg-indigo-50'
                        : 'border-gray-200 hover:border-indigo-300 hover:bg-indigo-50'
                    }`}
                  >
                    <div className="font-bold text-sm text-gray-800">{opt.label}</div>
                    <div className="text-xs text-gray-500">{opt.desc}</div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Opciones de ordenación */}
          <div className="mb-6">
            <h4 className="font-bold text-gray-800 mb-3 flex items-center">
              <span className="mr-2">🎯</span>
              ¿Cómo quieres ordenar las preguntas?
            </h4>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {([
                { id: 'most_failed', color: 'red', icon: '🔥', label: 'Más veces falladas primero', desc: 'Empieza por las que más te cuesta dominar' },
                { id: 'recent_failed', color: 'orange', icon: '⏰', label: 'Últimas falladas primero', desc: 'Repasa tus errores más recientes' },
                { id: 'oldest_failed', color: 'blue', icon: '📅', label: 'Más antiguas primero', desc: 'Refuerza conceptos que llevas tiempo sin repasar' },
                { id: 'random', color: 'purple', icon: '🎲', label: 'Orden aleatorio', desc: 'Mezcladas para variar el repaso' },
              ]).map((opt) => (
                <button
                  key={opt.id}
                  onClick={() => setSelectedOrder(opt.id)}
                  className={`p-4 border-2 rounded-lg transition-all text-left ${
                    selectedOrder === opt.id
                      ? `border-${opt.color}-500 bg-${opt.color}-50`
                      : `border-${opt.color}-200 hover:border-${opt.color}-400 hover:bg-${opt.color}-50`
                  }`}
                >
                  <div className={`font-bold text-${opt.color}-800 mb-1`}>{opt.icon} {opt.label}</div>
                  <div className={`text-sm text-${opt.color}-600`}>{opt.desc}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Selector de cantidad */}
          {selectedOrder && (
            <div className="mb-6">
              <h4 className="font-bold text-gray-800 mb-3 flex items-center">
                <span className="mr-2">🔢</span>
                ¿Cuántas preguntas quieres hacer?
              </h4>

              <div className="grid grid-cols-5 gap-1 sm:gap-2 mb-4">
                {(() => {
                  const total = data.totalQuestions
                  const options: (number | 'all')[] = []
                  if (total > 10) options.push(10)
                  if (total > 25) options.push(25)
                  if (total > 50) options.push(50)
                  if (total > 100) options.push(100)
                  options.push('all')

                  return options.map((count) => (
                    <button
                      key={count}
                      onClick={() => setSelectedCount(count)}
                      className={`p-2 sm:p-3 border-2 rounded-lg transition-all text-center font-medium ${
                        selectedCount === count
                          ? 'border-green-500 bg-green-50 text-green-700'
                          : 'border-gray-200 hover:border-green-300 hover:bg-green-25'
                      }`}
                    >
                      <div className="text-sm sm:text-lg font-bold">
                        {count === 'all' ? total : count}
                      </div>
                      <div className="text-xs text-gray-600 hidden sm:block">
                        {count === 'all' ? 'Todas' : 'preguntas'}
                      </div>
                    </button>
                  ))
                })()}
              </div>

              <div className="flex justify-center">
                <button
                  onClick={handleStart}
                  className="px-8 py-3 bg-gradient-to-r from-green-600 to-emerald-600 text-white font-bold rounded-lg hover:from-green-700 hover:to-emerald-700 transition-all shadow-lg hover:shadow-xl transform hover:scale-105"
                >
                  🚀 Comenzar Test de Repaso
                </button>
              </div>
            </div>
          )}

          {/* Lista de preguntas */}
          <div>
            <h5 className="font-bold text-gray-800 mb-3">📋 Tus preguntas falladas:</h5>
            <div className="max-h-64 overflow-y-auto space-y-2">
              {data.questions.slice(0, 20).map((question) => (
                <div key={question.questionId} className="p-3 bg-gray-50 rounded-lg border">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="text-sm font-medium text-gray-800 mb-1">
                        {question.questionText}
                      </div>
                      <div className="flex items-center space-x-3 text-xs text-gray-600">
                        <span>📝 Art. {question.articleNumber} {question.lawShortName}</span>
                        <span className={`px-2 py-1 rounded text-xs font-medium ${
                          question.difficulty === 'easy' ? 'bg-green-100 text-green-700' :
                          question.difficulty === 'medium' ? 'bg-yellow-100 text-yellow-700' :
                          question.difficulty === 'hard' ? 'bg-red-100 text-red-700' :
                          'bg-gray-100 text-gray-700'
                        }`}>
                          {question.difficulty}
                        </span>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-lg font-bold text-red-600">
                        ❌ {question.failedCount}
                      </div>
                      <div className="text-xs text-gray-500">
                        {new Date(question.lastFailed).toLocaleDateString('es-ES')}
                      </div>
                    </div>
                  </div>
                </div>
              ))}

              {data.questions.length > 20 && (
                <div className="text-center text-sm text-gray-500 py-2">
                  ... y {data.questions.length - 20} preguntas más
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
