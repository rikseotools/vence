// components/DynamicTest.js
'use client'
import { useState, useEffect } from 'react'
import Link from 'next/link'
import AdSenseComponent from './AdSenseComponent'

export default function DynamicTest({ titulo, dificultad }) {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [testData, setTestData] = useState(null)
  const [currentQuestion, setCurrentQuestion] = useState(0)
  const [selectedAnswer, setSelectedAnswer] = useState(null)
  const [showResult, setShowResult] = useState(false)
  const [score, setScore] = useState(0)
  const [answeredQuestions, setAnsweredQuestions] = useState([])
  const [showReview, setShowReview] = useState(false)
  const [startTime] = useState(Date.now())
  const [sessionId, setSessionId] = useState(null)

  const difficultyConfig = {
    alta: {
      name: "Alta",
      color: "from-orange-500 to-red-500",
      icon: "🔥",
      description: "Análisis jurídico e interpretación constitucional"
    },
    muy_alta: {
      name: "Muy Alta",
      color: "from-red-600 to-red-700",
      icon: "🎯",
      description: "Nivel experto en Derecho Constitucional"
    }
  }

  const config = difficultyConfig[dificultad] || difficultyConfig.alta

  useEffect(() => {
    generateTest()
  }, [titulo, dificultad])

  const generateTest = async () => {
    try {
      setLoading(true)
      setError(null)

      // Generar o recuperar sessionId
      let currentSessionId = sessionStorage.getItem('testSessionId')
      if (!currentSessionId) {
        currentSessionId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
        sessionStorage.setItem('testSessionId', currentSessionId)
      }
      setSessionId(currentSessionId)

      const response = await fetch('/api/generate-test', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-session-id': currentSessionId
        },
        body: JSON.stringify({
          titulo,
          dificultad,
          numPreguntas: 20
        })
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Error al generar el test')
      }

      setTestData(data.test)
      
    } catch (err) {
      console.error('Error generating test:', err)
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const handleAnswerClick = (answerIndex) => {
    if (showResult) return
    
    setSelectedAnswer(answerIndex)
    setShowResult(true)
    
    const isCorrect = answerIndex === testData.questions[currentQuestion].correct
    if (isCorrect) {
      setScore(score + 1)
    }
    
    setAnsweredQuestions([...answeredQuestions, {
      question: currentQuestion,
      selectedAnswer: answerIndex,
      correct: isCorrect,
      questionData: testData.questions[currentQuestion]
    }])
  }

  const handleNextQuestion = () => {
    if (currentQuestion < testData.questions.length - 1) {
      setCurrentQuestion(currentQuestion + 1)
      setSelectedAnswer(null)
      setShowResult(false)
    }
  }

  const handleTestComplete = async () => {
    try {
      const tiempoTotal = Math.round((Date.now() - startTime) / 1000)
      
      await fetch('/api/save-test-results', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          testId: testData.id,
          respuestas: answeredQuestions,
          score,
          tiempoTotal
        })
      })
    } catch (err) {
      console.error('Error saving results:', err)
    }
  }

  const handleRestartTest = () => {
    setCurrentQuestion(0)
    setSelectedAnswer(null)
    setShowResult(false)
    setScore(0)
    setAnsweredQuestions([])
    setShowReview(false)
    generateTest() // Generar nuevas preguntas
  }

  const isTestCompleted = currentQuestion === testData?.questions.length - 1 && showResult

  useEffect(() => {
    if (isTestCompleted) {
      handleTestComplete()
    }
  }, [isTestCompleted])

  // Componente para revisar fallos
  const ReviewMistakes = () => {
    const mistakes = answeredQuestions.filter(q => !q.correct)
    
    if (mistakes.length === 0) {
      return (
        <div className="bg-green-50 border border-green-200 rounded-lg p-6 text-center">
          <span className="text-4xl mb-4 block">🎉</span>
          <h3 className="text-xl font-bold text-green-800 mb-2">¡Perfecto!</h3>
          <p className="text-green-700">No has cometido ningún error en este test generado por IA.</p>
        </div>
      )
    }

    return (
      <div className="space-y-6">
        <div className="text-center mb-8">
          <h3 className="text-2xl font-bold text-gray-800 mb-2">
            Revisión de Errores ({mistakes.length}/{testData.questions.length})
          </h3>
          <p className="text-gray-600">
            Preguntas generadas dinámicamente con IA - Revisa los errores para mejorar
          </p>
        </div>

        {mistakes.map((mistake, index) => (
          <div key={index} className="bg-white rounded-xl shadow-lg p-6 border-l-4 border-red-500">
            <div className="mb-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-red-600 font-semibold">
                  Pregunta {mistake.question + 1} - {config.name}
                </span>
                <span className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded">
                  IA Generated
                </span>
              </div>
              <h4 className="text-lg font-bold text-gray-800">
                {mistake.questionData.question}
              </h4>
            </div>

            <div className="grid gap-3 mb-4">
              {mistake.questionData.options.map((option, optIndex) => (
                <div 
                  key={optIndex}
                  className={`p-3 rounded-lg border-2 ${
                    optIndex === mistake.questionData.correct 
                      ? 'border-green-500 bg-green-50 text-green-800' 
                      : optIndex === mistake.selectedAnswer 
                      ? 'border-red-500 bg-red-50 text-red-800'
                      : 'border-gray-200 bg-gray-50 text-gray-600'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center">
                      <span className="flex-shrink-0 w-6 h-6 rounded-full border border-current flex items-center justify-center mr-3 font-bold text-xs">
                        {String.fromCharCode(65 + optIndex)}
                      </span>
                      <span className="text-sm">{option}</span>
                    </div>
                    <span className="text-sm">
                      {optIndex === mistake.questionData.correct ? '✅ Correcta' : 
                       optIndex === mistake.selectedAnswer ? '❌ Tu respuesta' : ''}
                    </span>
                  </div>
                </div>
              ))}
            </div>

            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
              <h5 className="font-bold text-blue-800 mb-2">Explicación de IA:</h5>
              <p className="text-blue-700 text-sm leading-relaxed">
                {mistake.questionData.explanation}
              </p>
            </div>

            {mistake.questionData.article && (
              <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                <h5 className="font-bold text-gray-800 mb-2 text-sm">
                  {mistake.questionData.article.number}
                </h5>
                <p className="text-gray-700 text-sm italic">
                  &ldquo;{mistake.questionData.article.text}&rdquo;
                </p>
              </div>
            )}
          </div>
        ))}

        <div className="text-center pt-6">
          <button
            onClick={() => setShowReview(false)}
            className="bg-blue-600 text-white px-8 py-3 rounded-lg hover:bg-blue-700 transition-colors font-semibold"
          >
            ← Volver a Resultados
          </button>
        </div>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-red-50 to-yellow-50 flex items-center justify-center">
        <div className="bg-white rounded-xl shadow-lg p-8 text-center max-w-md">
          <div className="animate-spin w-12 h-12 border-4 border-orange-500 border-t-transparent rounded-full mx-auto mb-4"></div>
          <h3 className="text-xl font-bold text-gray-800 mb-2">Generando Test con IA</h3>
          <p className="text-gray-600 mb-4">
            Creando 20 preguntas únicas de dificultad {config.name} sobre {titulo}...
          </p>
          <div className="text-xs text-gray-500">
            🤖 Esto puede tomar 10-30 segundos
          </div>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-red-50 to-yellow-50 flex items-center justify-center">
        <div className="bg-white rounded-xl shadow-lg p-8 text-center max-w-md">
          <span className="text-4xl mb-4 block">❌</span>
          <h3 className="text-xl font-bold text-red-800 mb-2">Error al Generar Test</h3>
          <p className="text-red-600 mb-4">{error}</p>
          <button
            onClick={generateTest}
            className="bg-red-600 text-white px-6 py-3 rounded-lg hover:bg-red-700 transition-colors font-semibold"
          >
            🔄 Intentar de Nuevo
          </button>
        </div>
      </div>
    )
  }

  if (!testData) return null

  const currentQ = testData.questions[currentQuestion]

  return (
    <div className="min-h-screen bg-gradient-to-br from-red-50 to-yellow-50">
      <div className="bg-white shadow-sm border-b">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <Link href="/constitucion-espanola/titulo-preliminar" className="text-blue-600 hover:text-blue-800 font-medium">
              ← Volver a Tests
            </Link>
            <div className="flex items-center space-x-4">
              <div className={`px-3 py-1 rounded-full text-white text-sm font-semibold bg-gradient-to-r ${config.color}`}>
                {config.icon} {config.name} - IA Generated
              </div>
              {!showReview && (
                <div className="text-sm text-gray-600">
                  {currentQuestion + 1} de {testData.questions.length}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 py-8">
        <div className="max-w-4xl mx-auto">
          {showReview ? (
            <ReviewMistakes />
          ) : !isTestCompleted ? (
            <>
              <div className="mb-6">
                <div className="flex justify-between items-center mb-2">
                  <span className="text-sm font-medium text-gray-700">Progreso</span>
                  <span className="text-sm font-medium text-gray-700">
                    {Math.round(((currentQuestion + (showResult ? 1 : 0)) / testData.questions.length) * 100)}%
                  </span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-3">
                  <div 
                    className={`bg-gradient-to-r ${config.color} h-3 rounded-full transition-all duration-500`}
                    style={{ width: `${((currentQuestion + (showResult ? 1 : 0)) / testData.questions.length) * 100}%` }}
                  ></div>
                </div>
              </div>

              <div className="bg-white rounded-xl shadow-lg p-8">
                <div className="mb-8">
                  <div className="flex items-center justify-between mb-4">
                    <h2 className="text-2xl font-bold text-gray-800">
                      {currentQ.question}
                    </h2>
                    <div className="flex items-center space-x-2">
                      <span className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded font-semibold">
                        IA Generated
                      </span>
                      <span className={`text-xs px-2 py-1 rounded font-semibold ${
                        config.name === 'Muy Alta' ? 'bg-red-100 text-red-700' : 'bg-orange-100 text-orange-700'
                      }`}>
                        {config.name}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="space-y-3 mb-8">
                  {currentQ.options.map((option, index) => {
                    let buttonClass = "w-full p-4 text-left rounded-lg border-2 transition-all duration-300 font-medium "
                    
                    if (showResult) {
                      if (index === currentQ.correct) {
                        buttonClass += "border-green-500 bg-green-50 text-green-800"
                      } else if (index === selectedAnswer) {
                        buttonClass += "border-red-500 bg-red-50 text-red-800"
                      } else {
                        buttonClass += "border-gray-200 bg-gray-50 text-gray-500"
                      }
                    } else {
                      buttonClass += "border-gray-300 bg-white hover:border-blue-400 hover:bg-blue-50 text-gray-800 cursor-pointer"
                    }

                    return (
                      <button
                        key={index}
                        onClick={() => handleAnswerClick(index)}
                        disabled={showResult}
                        className={buttonClass}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center">
                            <span className="flex-shrink-0 w-8 h-8 rounded-full border-2 border-current flex items-center justify-center mr-4 font-bold text-sm">
                              {String.fromCharCode(65 + index)}
                            </span>
                            <span className="leading-relaxed">{option}</span>
                          </div>
                          
                          {showResult && (
                            <span className="text-xl">
                              {index === currentQ.correct ? '✅' : 
                               index === selectedAnswer ? '❌' : ''}
                            </span>
                          )}
                        </div>
                      </button>
                    )
                  })}
                </div>

                {/* Botones de respuesta rápida A/B/C/D - Solo si no se ha respondido */}
                {!showResult && currentQ?.options && (
                  <div className="mb-6">
                    <div className="flex justify-center space-x-4">
                      {currentQ.options.map((option, index) => (
                        <button
                          key={`quick-${index}`}
                          onClick={() => handleAnswerClick(index)}
                          className={`w-14 h-14 rounded-lg border-2 font-bold text-lg transition-all duration-200 ${
                            selectedAnswer === index
                              ? 'border-blue-600 bg-blue-600 text-white shadow-lg transform scale-110'
                              : 'border-blue-400 bg-blue-50 hover:border-blue-600 hover:bg-blue-100 text-blue-700 hover:shadow-lg'
                          }`}
                        >
                          {String.fromCharCode(65 + index)}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {showResult && (
                  <div className="mb-8">
                    <div className={`p-4 rounded-lg border-l-4 mb-4 ${
                      selectedAnswer === currentQ.correct 
                        ? 'bg-green-50 border-green-500' 
                        : 'bg-red-50 border-red-500'
                    }`}>
                      <div className="flex items-center justify-between mb-2">
                        <div className={`flex items-center ${
                          selectedAnswer === currentQ.correct ? 'text-green-700' : 'text-red-700'
                        }`}>
                          <span className="text-2xl mr-2">
                            {selectedAnswer === currentQ.correct ? '🎉' : '😔'}
                          </span>
                          <span className="font-bold text-lg">
                            {selectedAnswer === currentQ.correct ? '¡Correcto!' : 'Incorrecto'}
                          </span>
                          <span className="ml-2 text-xs bg-blue-500 text-white px-2 py-1 rounded">
                            IA
                          </span>
                        </div>
                      </div>
                      <p className="text-gray-700 leading-relaxed mb-4">
                        {currentQ.explanation}
                      </p>
                    </div>

                    {currentQ.article && (
                      <div className="bg-blue-50 border border-blue-200 rounded-lg p-6 mb-6">
                        <h4 className="font-bold text-blue-800 mb-3 text-lg">
                          {currentQ.article.number}
                        </h4>
                        <p className="text-gray-800 leading-relaxed italic text-base">
                          &ldquo;{currentQ.article.text}&rdquo;
                        </p>
                      </div>
                    )}

                    {/* Anuncio AdSense después de cada respuesta */}
                    {currentQuestion > 0 && (
                      <div className="my-6 text-center">
                        <p className="text-xs text-gray-500 mb-3">Publicidad</p>
                        <AdSenseComponent 
                          adSlot="1234567890"
                          style={{ display: 'block', textAlign: 'center' }}
                          className="max-w-lg mx-auto"
                        />
                      </div>
                    )}
                    
                    {currentQuestion < testData.questions.length - 1 && (
                      <div className="text-center">
                        <button
                          onClick={handleNextQuestion}
                          className={`bg-gradient-to-r ${config.color} text-white px-8 py-3 rounded-lg hover:opacity-90 transition-opacity font-semibold`}
                        >
                          Siguiente Pregunta →
                        </button>
                      </div>
                    )}
                  </div>
                )}

                <div className="flex justify-between items-center">
                  <div className="text-sm text-gray-600">
                    Aciertos: <span className="font-bold text-green-600">{score}</span> / {answeredQuestions.length}
                  </div>
                  
                  {showResult && currentQuestion === testData.questions.length - 1 && (
                    <div className="text-sm text-gray-500">
                      ¡Test con IA completado!
                    </div>
                  )}
                </div>
              </div>
            </>
          ) : (
            <div className="bg-white rounded-xl shadow-lg p-8 text-center">
              <div className="mb-8">
                <span className="text-6xl mb-4 block">
                  {score >= Math.ceil(testData.questions.length * 0.8) ? '🏆' : 
                   score >= Math.ceil(testData.questions.length * 0.6) ? '🎯' : '📚'}
                </span>
                <h2 className="text-3xl font-bold text-gray-800 mb-4">
                  ¡Test con IA Completado!
                </h2>
                <div className="text-6xl font-bold mb-4">
                  <span className={
                    score >= Math.ceil(testData.questions.length * 0.8) ? 'text-green-600' : 
                    score >= Math.ceil(testData.questions.length * 0.6) ? 'text-yellow-600' : 'text-red-600'
                  }>
                    {score}/{testData.questions.length}
                  </span>
                </div>
                <p className="text-xl text-gray-600 mb-4">
                  {score >= Math.ceil(testData.questions.length * 0.8) ? 
                    `¡Excelente dominio de nivel ${config.name}! 🎓` :
                   score >= Math.ceil(testData.questions.length * 0.6) ? 
                    `¡Buen nivel ${config.name}! Sigue practicando 💪` :
                    `Requiere más estudio en nivel ${config.name} 📖`}
                </p>
                
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6 max-w-2xl mx-auto">
                  <p className="text-blue-800 text-sm">
                    <strong>🤖 Test Generado con IA:</strong> Cada pregunta fue creada dinámicamente 
                    usando inteligencia artificial basada en los artículos constitucionales.
                  </p>
                </div>
              </div>

              {/* Anuncio AdSense al finalizar test dinámico */}
              <div className="my-8 text-center">
                <p className="text-xs text-gray-500 mb-3">Publicidad</p>
                <AdSenseComponent 
                  adSlot="1234567890"
                  style={{ display: 'block', textAlign: 'center' }}
                  className="max-w-2xl mx-auto"
                />
              </div>

              <div className="grid md:grid-cols-4 gap-4 max-w-3xl mx-auto">
                <button
                  onClick={handleRestartTest}
                  className={`bg-gradient-to-r ${config.color} text-white px-4 py-3 rounded-lg hover:opacity-90 transition-opacity font-semibold`}
                >
                  🔄 Nuevo Test IA
                </button>
                <button
                  onClick={() => setShowReview(true)}
                  className="bg-red-600 text-white px-4 py-3 rounded-lg hover:bg-red-700 transition-colors font-semibold"
                >
                  🔍 Ver Fallos ({answeredQuestions.filter(q => !q.correct).length})
                </button>
                <Link
                  href="/constitucion-espanola/titulo-preliminar"
                  className="bg-blue-600 text-white px-4 py-3 rounded-lg hover:bg-blue-700 transition-colors font-semibold block text-center"
                >
                  📊 Otros Tests
                </Link>
                <Link
                  href="/constitucion-espanola"
                  className="bg-green-600 text-white px-4 py-3 rounded-lg hover:bg-green-700 transition-colors font-semibold block text-center"
                >
                  📚 Otros Títulos
                </Link>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}