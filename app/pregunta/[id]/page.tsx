// app/pregunta/[id]/page.tsx - Página individual de pregunta con modo quiz interactivo
'use client'
import { useState, useEffect } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import ArticleModal from '@/components/ArticleModal'
import { useLawSlugs } from '@/contexts/LawSlugContext'

interface QuestionArticle {
  id: string
  article_number: string
  title: string
  content: string
  law_id?: string
  laws?: {
    id: string
    short_name: string
    name: string
  }
}

interface QuestionData {
  id: string
  question?: string
  question_text?: string
  option_a?: string
  option_b?: string
  option_c?: string
  option_d?: string
  options?: string[]
  correct?: number
  correct_option?: number
  explanation?: string
  is_official_exam?: boolean
  exam_source?: string
  exam_date?: string
  primary_article_id?: string
  articles?: QuestionArticle
}

export default function QuestionPage({ params }: { params: Promise<{ id: string }> }) {
  const { user, supabase } = useAuth() as { user: { id: string } | null; supabase: ReturnType<typeof import('@supabase/supabase-js').createClient> }
  const { getSlug: resolveLawSlug } = useLawSlugs()
  const searchParams = useSearchParams()
  const [question, setQuestion] = useState<QuestionData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [resolvedParams, setResolvedParams] = useState<{ id: string } | null>(null)

  // Estado para modo quiz interactivo
  const [selectedAnswer, setSelectedAnswer] = useState<number | null>(null)
  const [hasAnswered, setHasAnswered] = useState(false)
  const [answerStartTime, setAnswerStartTime] = useState<number | null>(null)
  const [showArticleModal, setShowArticleModal] = useState(false)
  const [lawSlug, setLawSlug] = useState<string | null>(null)

  // Slug de ley: usa el context con cache de BD (via LawSlugProvider)
  const generateLawSlug = (lawShortName: string | undefined): string | null => {
    if (!lawShortName) return null
    return resolveLawSlug(lawShortName)
  }

  // Detectar modo quiz y fuente desde URL
  const isQuizMode = searchParams.get('modo') === 'quiz'
  const sourcePlatform = searchParams.get('utm_source') || null

  // Resolver parámetros async
  useEffect(() => {
    async function resolveParams() {
      const resolved = await params
      setResolvedParams(resolved)
    }
    resolveParams()
  }, [params])

  // Cargar pregunta cuando tenemos los parámetros
  useEffect(() => {
    if (resolvedParams?.id) {
      loadQuestion(resolvedParams.id)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resolvedParams, supabase])

  const loadQuestion = async (questionId: string) => {
    try {
      setLoading(true)
      setError(null)

      // 1. Obtener la pregunta
      const { data: questionData, error: questionError } = await supabase
        .from('questions')
        .select('*')
        .eq('id', questionId)
        .single()

      if (questionError || !questionData) {
        setError('Pregunta no encontrada')
        return
      }

      const qData = questionData as Record<string, unknown>

      // 2. Si tiene artículo vinculado, obtenerlo
      if (qData.primary_article_id) {
        const { data: articleData } = await supabase
          .from('articles')
          .select('id, article_number, title, content, law_id')
          .eq('id', qData.primary_article_id as string)
          .single()

        if (articleData) {
          const article = articleData as Record<string, unknown>
          qData.articles = article

          // 3. Si el artículo tiene ley, obtenerla
          if (article.law_id) {
            const { data: lawData } = await supabase
              .from('laws')
              .select('id, short_name, name')
              .eq('id', article.law_id as string)
              .single()

            if (lawData) {
              (qData.articles as Record<string, unknown>).laws = lawData
              const lawName = (lawData as Record<string, unknown>).short_name as string || (lawData as Record<string, unknown>).name as string
              if (lawName) {
                setLawSlug(generateLawSlug(lawName))
              }
            }
          }
        }
      }

      setQuestion(qData as unknown as QuestionData)
      // Iniciar timer para medir tiempo de respuesta
      setAnswerStartTime(Date.now())
    } catch (err) {
      console.error('Error cargando pregunta:', err)
      setError('Error al cargar la pregunta')
    } finally {
      setLoading(false)
    }
  }

  // Trackear respuesta a pregunta compartida
  const trackSharedQuestionResponse = async (answerIndex: number, isCorrect: boolean, timeMs: number | null) => {
    try {
      await supabase
        .from('shared_question_responses')
        .insert({
          question_id: resolvedParams?.id,
          answer_selected: answerIndex,
          is_correct: isCorrect,
          time_to_answer_ms: timeMs,
          source_platform: sourcePlatform,
          share_mode: isQuizMode ? 'quiz' : 'educational',
          referrer: typeof document !== 'undefined' ? document.referrer : null,
          visitor_user_id: user?.id || null,
          device_info: {
            screen: typeof window !== 'undefined' ? `${window.innerWidth}x${window.innerHeight}` : null,
            userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : null
          }
        })
    } catch (error) {
      console.error('Error tracking response:', error)
    }
  }

  // Manejar selección de respuesta en modo quiz
  const handleAnswerSelect = async (index: number) => {
    if (hasAnswered) return

    const correctIndex = question?.correct ?? question?.correct_option ?? 0
    const isCorrect = index === correctIndex
    const timeToAnswer = answerStartTime ? Date.now() - answerStartTime : null

    setSelectedAnswer(index)
    setHasAnswered(true)

    if (isQuizMode) {
      await trackSharedQuestionResponse(index, isCorrect, timeToAnswer)
    }
  }

  const getCorrectIndex = (): number => {
    return question?.correct ?? question?.correct_option ?? 0
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-3"></div>
          <p className="text-gray-600 dark:text-gray-400 text-sm">Cargando pregunta...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="max-w-md mx-auto text-center p-6">
          <div className="text-6xl mb-4">&#x274C;</div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-3">
            Pregunta No Encontrada
          </h1>
          <p className="text-gray-600 dark:text-gray-400 mb-6">{error}</p>
          <Link
            href="/leyes"
            className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            ← Volver a Tests
          </Link>
        </div>
      </div>
    )
  }

  if (!question) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <p className="text-gray-600 dark:text-gray-400">No se pudo cargar la pregunta.</p>
      </div>
    )
  }

  const correctIndex = getCorrectIndex()
  const options = [
    question.option_a || question.options?.[0],
    question.option_b || question.options?.[1],
    question.option_c || question.options?.[2],
    question.option_d || question.options?.[3]
  ].filter((option): option is string => !!option)

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-gray-900 dark:to-gray-800">
      <main className="container mx-auto px-4 py-8">
        <div className="max-w-4xl mx-auto">

          <div className="mb-6">
            <Link
              href="/leyes"
              className="inline-flex items-center text-gray-600 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors text-sm"
            >
              ← Volver a Tests
            </Link>
          </div>

          <div className="text-center mb-8">
            <div className={`inline-flex items-center space-x-2 px-4 py-2 rounded-full text-white text-sm font-semibold mb-4 shadow-lg ${
              isQuizMode
                ? 'bg-gradient-to-r from-purple-500 to-pink-600'
                : 'bg-gradient-to-r from-blue-500 to-indigo-600'
            }`}>
              <span>{isQuizMode ? '🧠' : '🔍'}</span>
              <span>{isQuizMode ? '¡Responde el reto!' : 'Pregunta Individual'}</span>
            </div>

            <h1 className="text-3xl font-bold text-gray-800 dark:text-gray-100 mb-2">
              {isQuizMode ? '¿Sabrías responder?' : 'Vista Detallada'}
            </h1>
            {!isQuizMode && question.articles && (
              <p className="text-gray-600 dark:text-gray-400">
                Art. {question.articles.article_number} - {question.articles.title}
              </p>
            )}
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg dark:shadow-gray-900/20 p-8 mb-8 border border-gray-100 dark:border-gray-700">

            <div className="mb-8">
              {!isQuizMode && (
                <h2 className="text-xl font-bold text-gray-800 dark:text-gray-100 mb-4">
                  Pregunta
                </h2>
              )}
              {!isQuizMode && question.articles && (
                <div className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                  Art. {question.articles.article_number} - {question.articles.title}
                </div>
              )}
              <div className="prose max-w-none dark:prose-invert">
                <p className="text-lg text-gray-800 dark:text-gray-200 leading-relaxed">
                  {question.question || question.question_text}
                </p>
              </div>
            </div>

            <div className="space-y-3 mb-8">
              {!isQuizMode && (
                <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-100 mb-4">
                  Opciones de Respuesta
                </h3>
              )}
              {options.map((option, index) => {
                let buttonClass = ''

                if (isQuizMode && !hasAnswered) {
                  buttonClass = 'cursor-pointer border-gray-200 dark:border-gray-600 hover:border-blue-400 dark:hover:border-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/20 text-gray-800 dark:text-gray-200'
                } else if (isQuizMode && hasAnswered) {
                  if (index === correctIndex) {
                    buttonClass = 'border-green-500 bg-green-50 dark:bg-green-900/30 text-green-800 dark:text-green-300'
                  } else if (index === selectedAnswer && selectedAnswer !== correctIndex) {
                    buttonClass = 'border-red-500 bg-red-50 dark:bg-red-900/30 text-red-800 dark:text-red-300'
                  } else {
                    buttonClass = 'border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 text-gray-500 dark:text-gray-400'
                  }
                } else {
                  if (index === correctIndex) {
                    buttonClass = 'border-green-500 bg-green-50 dark:bg-green-900/30 text-green-800 dark:text-green-300'
                  } else {
                    buttonClass = 'border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 text-gray-600 dark:text-gray-400'
                  }
                }

                return (
                  <button
                    key={index}
                    onClick={() => isQuizMode && handleAnswerSelect(index)}
                    disabled={!isQuizMode || hasAnswered}
                    className={`w-full text-left p-4 rounded-lg border-2 transition-all ${buttonClass} ${
                      isQuizMode && !hasAnswered ? 'active:scale-[0.99]' : ''
                    }`}
                  >
                    <span className="inline-flex items-center">
                      <span className={`w-6 h-6 rounded-full border-2 flex items-center justify-center text-sm font-bold mr-3 ${
                        (isQuizMode && hasAnswered && index === correctIndex) || (!isQuizMode && index === correctIndex)
                          ? 'border-green-500 bg-green-500 text-white'
                          : isQuizMode && hasAnswered && index === selectedAnswer && selectedAnswer !== correctIndex
                            ? 'border-red-500 bg-red-500 text-white'
                            : 'border-gray-300 dark:border-gray-500 text-gray-500 dark:text-gray-400'
                      }`}>
                        {String.fromCharCode(65 + index)}
                      </span>
                      {option}
                    </span>

                    {((isQuizMode && hasAnswered) || !isQuizMode) && index === correctIndex && (
                      <span className="float-right text-green-600 dark:text-green-400">✅</span>
                    )}
                    {isQuizMode && hasAnswered && index === selectedAnswer && selectedAnswer !== correctIndex && (
                      <span className="float-right text-red-600 dark:text-red-400">&#x274C;</span>
                    )}
                  </button>
                )
              })}
            </div>

            {isQuizMode && hasAnswered && (
              <div className={`p-4 rounded-lg mb-6 ${
                selectedAnswer === correctIndex
                  ? 'bg-green-50 dark:bg-green-900/30 border border-green-200 dark:border-green-700'
                  : 'bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-700'
              }`}>
                <div className="flex items-center gap-3">
                  <span className="text-3xl">
                    {selectedAnswer === correctIndex ? '🎉' : '😔'}
                  </span>
                  <div>
                    <p className={`font-bold ${
                      selectedAnswer === correctIndex
                        ? 'text-green-800 dark:text-green-300'
                        : 'text-red-800 dark:text-red-300'
                    }`}>
                      {selectedAnswer === correctIndex ? '¡Correcto!' : 'Incorrecto'}
                    </p>
                    <p className={`text-sm ${
                      selectedAnswer === correctIndex
                        ? 'text-green-700 dark:text-green-400'
                        : 'text-red-700 dark:text-red-400'
                    }`}>
                      La respuesta correcta es: <strong>{String.fromCharCode(65 + correctIndex)}</strong>
                    </p>
                  </div>
                </div>
              </div>
            )}

            {question.explanation && (!isQuizMode || hasAnswered) && (
              <div className="bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-700 rounded-lg p-4 mb-6">
                <h4 className="font-bold text-blue-800 dark:text-blue-300 mb-2">Explicacion:</h4>
                <p className="text-blue-700 dark:text-blue-400 text-sm leading-relaxed">
                  {question.explanation}
                </p>
              </div>
            )}

            {question.articles && (!isQuizMode || hasAnswered) && (
              <div className="mb-6">
                <button
                  onClick={() => setShowArticleModal(true)}
                  className="w-full flex items-center justify-center gap-3 p-4 bg-gradient-to-r from-indigo-50 to-blue-50 dark:from-indigo-900/30 dark:to-blue-900/30 border-2 border-indigo-200 dark:border-indigo-700 rounded-xl hover:from-indigo-100 hover:to-blue-100 dark:hover:from-indigo-900/50 dark:hover:to-blue-900/50 transition-all group"
                >
                  <span className="text-2xl group-hover:scale-110 transition-transform">📋</span>
                  <div className="text-left">
                    <div className="font-bold text-indigo-800 dark:text-indigo-300">
                      Ver Articulo {question.articles.article_number}
                    </div>
                    <div className="text-sm text-indigo-600 dark:text-indigo-400">
                      {question.articles.laws?.short_name || question.articles.laws?.name || 'Contenido del articulo con palabras clave resaltadas'}
                    </div>
                  </div>
                  <span className="text-indigo-500 dark:text-indigo-400 ml-auto">→</span>
                </button>
              </div>
            )}

            {question.articles && question.articles.content && (!isQuizMode || hasAnswered) && (
              <div className="bg-gray-50 dark:bg-gray-700/50 border border-gray-200 dark:border-gray-600 rounded-lg p-6 mb-6">
                <div className="flex items-center justify-between mb-3">
                  <h4 className="font-bold text-gray-800 dark:text-gray-200 text-lg">
                    Articulo {question.articles.article_number}
                  </h4>
                  <button
                    onClick={() => setShowArticleModal(true)}
                    className="text-sm px-3 py-1 bg-blue-100 hover:bg-blue-200 dark:bg-blue-900/50 dark:hover:bg-blue-800/50 text-blue-700 dark:text-blue-300 rounded-lg transition-colors"
                  >
                    Ver completo →
                  </button>
                </div>
                <p className="text-gray-700 dark:text-gray-300 leading-relaxed italic line-clamp-4">
                  &ldquo;{question.articles.content.substring(0, 300)}{question.articles.content.length > 300 ? '... ' : ''}&rdquo;
                  {question.articles.content.length > 300 && (
                    <button
                      onClick={() => setShowArticleModal(true)}
                      className="text-blue-600 dark:text-blue-400 hover:underline not-italic font-medium"
                    >
                      ver mas
                    </button>
                  )}
                </p>
              </div>
            )}

            {question.is_official_exam && (!isQuizMode || hasAnswered) && (
              <div className="bg-gradient-to-r from-purple-50 to-indigo-50 dark:from-purple-900/20 dark:to-indigo-900/20 border border-purple-200 dark:border-purple-700 rounded-lg p-4 mb-6">
                <div className="flex items-start space-x-3">
                  <div className="text-2xl">🏛️</div>
                  <div className="flex-1">
                    <h4 className="font-bold text-purple-800 dark:text-purple-300 mb-2">
                      Pregunta de Examen Oficial Real
                    </h4>
                    <div className="space-y-1 text-sm text-purple-700 dark:text-purple-400">
                      {question.exam_source && (
                        <div className="flex items-center space-x-2">
                          <span>📋</span>
                          <span><strong>Examen:</strong> {question.exam_source}</span>
                        </div>
                      )}
                      {question.exam_date && (
                        <div className="flex items-center space-x-2">
                          <span>📅</span>
                          <span><strong>Ano:</strong> {new Date(question.exam_date).getFullYear()}</span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}

            <div className="bg-gradient-to-r from-indigo-500 to-purple-600 rounded-xl p-6 text-center text-white">
              <h3 className="text-xl font-bold mb-2">
                {isQuizMode ? '¿Te ha gustado el reto?' : '¿Quieres practicar mas?'}
              </h3>
              <p className="text-indigo-100 mb-4 text-sm">
                En Vence tenemos +5000 preguntas de oposiciones para practicar
              </p>
              <Link
                href="/leyes"
                className="inline-flex items-center px-6 py-3 bg-white text-indigo-600 font-semibold rounded-lg hover:bg-indigo-50 transition-colors"
              >
                Empezar a practicar gratis →
              </Link>
            </div>
          </div>
        </div>
      </main>

      {question?.articles && lawSlug && (
        <ArticleModal
          isOpen={showArticleModal}
          onClose={() => setShowArticleModal(false)}
          articleNumber={question.articles.article_number}
          lawSlug={lawSlug}
          questionText={question.question || question.question_text || ''}
          correctAnswer={correctIndex}
          options={options}
        />
      )}
    </div>
  )
}
