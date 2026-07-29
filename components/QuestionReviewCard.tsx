'use client'
// components/QuestionReviewCard.tsx
// Tarjeta de REVISIÓN de una pregunta: enunciado, todas las opciones con la correcta
// marcada, explicación y artículo vinculado. Plegable.
//
// Nace de la sección de preguntas guardadas (T-261): un listado con el enunciado
// truncado no sirve para repasar; hace falta ver la pregunta entera, como tras un test.
//
// PRESENTACIONAL puro (sin fetch ni contexto de examen) a propósito: el mismo bloque
// vive hoy embebido en `ExamReviewLayout` (~L400-470) acoplado a la nota de corte y a
// la respuesta del usuario. Este componente es el destino natural de aquel código; se
// deja preparado para que lo adopte (ver deuda anotada en T-261) en vez de duplicar la
// lógica de examen aquí.
import { useState, useEffect, type ReactNode } from 'react'
import MarkdownExplanation from './MarkdownExplanation'
import ArticleModal from './ArticleModal'

export interface QuestionReviewData {
  id: string
  question: string
  options: string[]
  /** Índice 0-3 de la opción correcta (convención de `questions.correct_option`). */
  correct_option: number
  explanation?: string | null
  article_number?: string | null
  article_title?: string | null
  law_name?: string | null
  /** Slug real de la ley: lo que necesita `ArticleModal` para cargar el texto. */
  law_actual_slug?: string | null
}

interface Props {
  question: QuestionReviewData
  /** Índice que respondió el usuario, si se conoce (repaso de fallos, revisión de test). */
  userAnswerIndex?: number | null
  /** Numeración visible en la cabecera. */
  index?: number
  /** Acciones a la derecha de la cabecera (p.ej. el corazón para desmarcar). */
  acciones?: ReactNode
  defaultOpen?: boolean
  /**
   * Control externo del plegado ("desplegar todas"). Cuando cambia, la tarjeta se
   * sincroniza; el usuario puede seguir plegándola a mano después.
   */
  open?: boolean
}

const LETRAS = ['A', 'B', 'C', 'D', 'E']

export default function QuestionReviewCard({
  question,
  userAnswerIndex = null,
  index,
  acciones,
  defaultOpen = false,
  open,
}: Props) {
  const [abierta, setAbierta] = useState(open ?? defaultOpen)
  const [verArticulo, setVerArticulo] = useState(false)
  useEffect(() => {
    if (open !== undefined) setAbierta(open)
  }, [open])

  const referencia = [
    question.article_number ? `Art. ${question.article_number}` : null,
    question.law_name,
  ]
    .filter(Boolean)
    .join(' · ')

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm overflow-hidden">
      <div className="flex items-start gap-2 px-4 py-3">
        <button
          type="button"
          onClick={() => setAbierta((v) => !v)}
          aria-expanded={abierta}
          className="flex-1 text-left flex items-start gap-3 min-w-0"
        >
          <span className="shrink-0 text-gray-400 mt-0.5">{abierta ? '▼' : '▶'}</span>
          <span className="min-w-0">
            {referencia && (
              <span className="block text-xs font-medium text-rose-600 dark:text-rose-400 mb-1">
                {referencia}
              </span>
            )}
            <span className="block text-sm text-gray-800 dark:text-gray-100">
              {index != null && <strong className="mr-1">{index}.</strong>}
              {abierta || question.question.length <= 150
                ? question.question
                : `${question.question.slice(0, 150)}…`}
            </span>
          </span>
        </button>
        {acciones && <div className="shrink-0">{acciones}</div>}
      </div>

      {abierta && (
        <div className="px-4 pb-4 border-t border-gray-100 dark:border-gray-700">
          <div className="space-y-2 mt-4">
            {question.options.map((opcion, i) => {
              const esCorrecta = i === question.correct_option
              const esDelUsuario = userAnswerIndex != null && i === userAnswerIndex

              let clase = 'bg-gray-50 dark:bg-gray-700 border-gray-200 dark:border-gray-600'
              let nota: string | null = null

              if (esCorrecta && esDelUsuario) {
                clase = 'bg-green-100 dark:bg-green-900/30 border-green-500'
                nota = 'Tu respuesta (correcta)'
              } else if (esCorrecta) {
                clase = 'bg-green-50 dark:bg-green-900/20 border-green-400'
                nota = 'Respuesta correcta'
              } else if (esDelUsuario) {
                clase = 'bg-red-100 dark:bg-red-900/30 border-red-500'
                nota = 'Tu respuesta'
              }

              return (
                <div key={i} className={`p-3 rounded-lg border-2 ${clase}`}>
                  <div className="flex items-start gap-3">
                    <span
                      className={`shrink-0 w-7 h-7 rounded-full flex items-center justify-center text-sm font-bold ${
                        esCorrecta
                          ? 'bg-green-500 text-white'
                          : esDelUsuario
                            ? 'bg-red-500 text-white'
                            : 'bg-gray-300 dark:bg-gray-600 text-gray-700 dark:text-gray-300'
                      }`}
                    >
                      {LETRAS[i] ?? i + 1}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="text-gray-800 dark:text-white text-sm">{opcion}</p>
                      {nota && <p className="text-xs mt-1 font-medium">{nota}</p>}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>

          {question.explanation && (
            <div className="mt-4 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
              <h4 className="font-semibold text-blue-800 dark:text-blue-300 mb-2 text-sm">
                Explicación
              </h4>
              <MarkdownExplanation
                content={question.explanation}
                className="text-blue-800 dark:text-blue-200 text-sm"
              />
            </div>
          )}

          {question.article_number && (
            <>
              {/* MISMO modal que en los tests y exámenes (components/ArticleModal):
                  abre el texto del artículo con su contexto, en vez de dejar una
                  referencia muerta que obliga a buscarla a mano. */}
              <button
                type="button"
                onClick={() => setVerArticulo(true)}
                className="mt-4 text-sm text-blue-600 hover:text-blue-800 dark:text-blue-400 hover:underline flex items-center gap-1"
              >
                📚 Ver {question.law_name || 'la ley'} — Artículo {question.article_number}
                {question.article_title ? `: ${question.article_title}` : ''}
                <span className="text-xs">▸</span>
              </button>
              <ArticleModal
                isOpen={verArticulo}
                onClose={() => setVerArticulo(false)}
                articleNumber={question.article_number}
                lawSlug={question.law_actual_slug || null}
                questionText={question.question}
                correctAnswer={question.correct_option}
                options={question.options}
              />
            </>
          )}
        </div>
      )}
    </div>
  )
}
