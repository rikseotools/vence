// app/pregunta/[id]/page.js - Página individual de pregunta
'use client'
import { useState, useEffect } from 'react'
import { useAuth } from '../../../contexts/AuthContext'
import Link from 'next/link'

export default function QuestionPage({ params }) {
  const { user, supabase } = useAuth()
  const [question, setQuestion] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [resolvedParams, setResolvedParams] = useState(null)

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
  }, [resolvedParams, supabase])

  const loadQuestion = async (questionId) => {
    try {
      setLoading(true)
      setError(null)

      console.log('🔍 Cargando pregunta con ID:', questionId)

      // Primero intentar obtener la pregunta básica para verificar que existe
      const { data: basicQuestion, error: basicError } = await supabase
        .from('questions')
        .select('*')
        .eq('id', questionId)
        .single()

      if (basicError) {
        console.error('❌ Error en consulta básica:', basicError)
        setError(`Pregunta no encontrada (ID: ${questionId})`)
        return
      }

      console.log('✅ Pregunta básica encontrada:', basicQuestion)

      // Ahora obtener con información del artículo
      const { data, error } = await supabase
        .from('questions')
        .select(`
          *,
          articles:primary_article_id (
            id,
            number,
            title,
            content
          )
        `)
        .eq('id', questionId)
        .single()

      if (error) {
        console.error('❌ Error cargando pregunta con artículo:', error)
        // Si falla la consulta con artículo, usar la básica
        console.log('⚠️ Usando pregunta sin información de artículo')
        setQuestion(basicQuestion)
        return
      }

      console.log('✅ Pregunta completa cargada:', data)
      console.log('🔍 Estructura de la pregunta:', {
        id: data.id,
        hasQuestion: !!data.question,
        hasQuestionText: !!data.question_text,
        hasOptions: !!(data.option_a || data.options),
        correct: data.correct,
        correctOption: data.correct_option,
        hasArticle: !!data.articles,
        hasExplanation: !!data.explanation
      })
      setQuestion(data)
    } catch (err) {
      console.error('❌ Error general:', err)
      setError('Error al cargar la pregunta')
    } finally {
      setLoading(false)
    }
  }

  // Estados de carga
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
          <div className="text-6xl mb-4">❌</div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-3">
            Pregunta No Encontrada
          </h1>
          <p className="text-gray-600 dark:text-gray-400 mb-6">{error}</p>
          <Link 
            href="/test"
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

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-gray-900 dark:to-gray-800">
      <main className="container mx-auto px-4 py-8">
        <div className="max-w-4xl mx-auto">
          
          {/* Header */}
          <div className="text-center mb-8">
            <div className="inline-flex items-center space-x-2 px-4 py-2 rounded-full text-white text-sm font-semibold bg-gradient-to-r from-blue-500 to-indigo-600 mb-4 shadow-lg">
              <span>🔍</span>
              <span>Pregunta Individual</span>
            </div>
            
            <h1 className="text-3xl font-bold text-gray-800 dark:text-gray-100 mb-2">
              Vista Detallada de Pregunta
            </h1>
            <p className="text-gray-600 dark:text-gray-400">
              {question.articles ? `${question.articles.number} - ${question.articles.title}` : 'Pregunta de examen'}
            </p>
          </div>

          {/* Contenido principal */}
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg dark:shadow-gray-900/20 p-8 mb-8 border border-gray-100 dark:border-gray-700">
            
            {/* Pregunta */}
            <div className="mb-8">
              <h2 className="text-xl font-bold text-gray-800 dark:text-gray-100 mb-4">
                Pregunta
              </h2>
              {question.articles && (
                <div className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                  📚 {question.articles.number} - {question.articles.title}
                </div>
              )}
              <div className="prose max-w-none dark:prose-invert">
                <p className="text-lg text-gray-800 dark:text-gray-200 leading-relaxed">
                  {question.question || question.question_text}
                </p>
              </div>
            </div>

            {/* Opciones de respuesta */}
            <div className="space-y-3 mb-8">
              <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-100 mb-4">
                Opciones de Respuesta
              </h3>
              {[
                question.option_a || question.options?.[0],
                question.option_b || question.options?.[1], 
                question.option_c || question.options?.[2],
                question.option_d || question.options?.[3]
              ].filter(option => option).map((option, index) => (
                <div
                  key={index}
                  className={`w-full text-left p-4 rounded-lg border-2 ${
                    index === (question.correct || question.correct_option)
                      ? 'border-green-500 bg-green-50 dark:bg-green-900/30 text-green-800 dark:text-green-300'
                      : 'border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 text-gray-600 dark:text-gray-400'
                  }`}
                >
                  <span className="inline-flex items-center">
                    <span className={`w-6 h-6 rounded-full border-2 flex items-center justify-center text-sm font-bold mr-3 ${
                      index === (question.correct || question.correct_option)
                        ? 'border-green-500 bg-green-500 text-white'
                        : 'border-gray-300 dark:border-gray-500 text-gray-500 dark:text-gray-400'
                    }`}>
                      {String.fromCharCode(65 + index)}
                    </span>
                    {option}
                  </span>
                  
                  {index === (question.correct || question.correct_option) && (
                    <span className="float-right">
                      <span className="text-green-600 dark:text-green-400">✅</span>
                    </span>
                  )}
                </div>
              ))}
            </div>

            {/* Explicación */}
            {question.explanation && (
              <div className="bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-700 rounded-lg p-4 mb-6">
                <h4 className="font-bold text-blue-800 dark:text-blue-300 mb-2">📖 Explicación:</h4>
                <p className="text-blue-700 dark:text-blue-400 text-sm leading-relaxed">
                  {question.explanation}
                </p>
              </div>
            )}

            {/* Información del artículo */}
            {question.articles && question.articles.content && (
              <div className="bg-gray-50 dark:bg-gray-700/50 border border-gray-200 dark:border-gray-600 rounded-lg p-6 mb-6">
                <h4 className="font-bold text-gray-800 dark:text-gray-200 mb-3 text-lg">
                  📋 {question.articles.number}
                </h4>
                <p className="text-gray-700 dark:text-gray-300 leading-relaxed italic">
                  "{question.articles.content}"
                </p>
              </div>
            )}

            {/* Información de procedencia oficial */}
            {question.is_official_exam && (
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
                          <span><strong>Año:</strong> {new Date(question.exam_date).getFullYear()}</span>
                        </div>
                      )}
                      <div className="mt-3 p-2 bg-purple-100 dark:bg-purple-800/30 rounded text-xs text-purple-800 dark:text-purple-300">
                        <strong>💡 Valor especial:</strong> Esta pregunta apareció textualmente en un examen oficial. 
                        Es crucial para tu preparación.
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Botones de navegación */}
            <div className="flex justify-between items-center pt-6 border-t dark:border-gray-600">
              <Link
                href="/test"
                className="inline-flex items-center px-4 py-2 text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 transition-colors"
              >
                ← Volver a Tests
              </Link>
              
              {user && (
                <Link
                  href="/mis-impugnaciones"
                  className="inline-flex items-center px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
                >
                  Ver Mis Impugnaciones
                </Link>
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}