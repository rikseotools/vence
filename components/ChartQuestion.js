'use client'
import { useState } from 'react'
import { useAuth } from '../contexts/AuthContext'
import PsychometricQuestionEvolution from './PsychometricQuestionEvolution'

export default function ChartQuestion({ 
  question, 
  onAnswer, 
  selectedAnswer, 
  showResult, 
  isAnswering,
  chartComponent, // Componente específico de renderizado (SVG)
  explanationSections, // Secciones específicas de explicación
  attemptCount = 0 // Número de intentos previos de esta pregunta
}) {
  const { user } = useAuth()

  // Mensajes motivadores basados en el resultado
  const getMotivationalMessage = () => {
    const userName = user?.user_metadata?.full_name?.split(' ')[0] || 'Opositor'
    
    // Mensajes de felicitación para respuestas correctas
    if (selectedAnswer === question.correct_option) {
      const congratsMessages = [
        {
          title: `¡Bien, ${userName}! 🎉`,
          message: "Has acertado. Los psicotécnicos requieren práctica, vas por buen camino.",
          color: "green"
        },
        {
          title: `¡Perfecto, ${userName}! ⭐`,
          message: "Lo estás dominando. La constancia es la clave.",
          color: "green"
        },
        {
          title: `¡Sigue así, ${userName}! 🚀`,
          message: "",
          color: "green"
        },
        {
          title: `Muy bien, ${userName}! 👍`,
          message: "",
          color: "green"
        }
      ]
      
      // Usar el mensaje correspondiente al número de acierto
      return congratsMessages[Math.min(attemptCount, congratsMessages.length - 1)]
    }
    
    switch (attemptCount) {
      case 0: // Primer fallo
        return {
          title: `No te preocupes, ${userName} 💪`,
          message: "Mucha gente falla esta pregunta. Los psicotécnicos son la parte más difícil, pero sigue practicando - al final todos se repiten y los dominarás.",
          color: "blue"
        }
      case 1: // Segundo fallo
        return {
          title: `No te preocupes, ${userName} 🎯`,
          message: "Estas preguntas requieren paciencia. Cada intento te enseña algo nuevo. Revisa los datos paso a paso, sin prisa.",
          color: "orange"
        }
      case 2: // Tercer fallo
        return {
          title: `No te preocupes, ${userName} 🚀`,
          message: "Los psicotécnicos son complicados para todo el mundo. Lo importante es entender el método. Una vez que lo pilles, el resto será igual.",
          color: "red"
        }
      default: // Más de 3 fallos
        return {
          title: `No te preocupes, ${userName}! 👍`,
          message: "Sigue practicando. La constancia es la clave.",
          color: "purple"
        }
    }
  }

  const motivationalMessage = getMotivationalMessage()

  const options = [
    { value: question.option_a || question.options?.A },
    { value: question.option_b || question.options?.B },
    { value: question.option_c || question.options?.C },
    { value: question.option_d || question.options?.D }
  ]

  const correctOptionKey = ['A', 'B', 'C', 'D'][question.correct_option]

  return (
    <div className="bg-white rounded-lg shadow-lg p-6">
      {/* Número de pregunta */}
      <div className="mb-4">
        <span className="text-sm font-semibold text-blue-600 bg-blue-50 px-3 py-1 rounded-full">
          02. 
        </span>
      </div>

      {/* Pregunta */}
      <div className="mb-6 sm:mb-6 mb-3">
        <h2 className="text-xl font-bold text-gray-900 mb-3">
          {question.question_text}
        </h2>
        
        {/* Contexto */}
        {question.content_data?.question_context && (
          <p className="text-gray-700 mb-4">
            {question.content_data.question_context}
          </p>
        )}
      </div>

      {/* Gráfico - Componente específico */}
      <div className="mb-4 -mx-6 -my-2 sm:-mt-2 -mt-8">
        {chartComponent}
      </div>

      {/* Opciones de respuesta */}
      <div className="space-y-3 mb-6">
        {options.map((option, index) => {
          let buttonClass = "w-full p-4 text-left border-2 rounded-lg transition-all duration-200 flex items-center gap-3"
          
          if (showResult) {
            if (index === question.correct_option) {
              // Respuesta correcta
              buttonClass += " border-green-500 bg-green-50 text-green-800"
            } else if (index === selectedAnswer) {
              // Respuesta seleccionada incorrecta
              buttonClass += " border-red-500 bg-red-50 text-red-800"
            } else {
              // Otras opciones
              buttonClass += " border-gray-200 bg-gray-50 text-gray-600"
            }
          } else if (selectedAnswer === index) {
            buttonClass += " border-blue-500 bg-blue-50 text-blue-800"
          } else {
            buttonClass += " border-gray-200 hover:border-blue-300 hover:bg-blue-25 text-gray-700"
          }

          return (
            <button
              key={index}
              onClick={() => !showResult && !isAnswering && onAnswer(index)}
              disabled={showResult || isAnswering}
              className={buttonClass}
            >
              <span className="font-bold text-lg min-w-[24px]">
                {String.fromCharCode(65 + index)}
              </span>
              <span className="text-lg">
                {option.value}
              </span>
              {showResult && index === question.correct_option && (
                <span className="ml-auto text-green-600">✓</span>
              )}
              {showResult && index === selectedAnswer && index !== question.correct_option && (
                <span className="ml-auto text-red-600">✗</span>
              )}
            </button>
          )
        })}
      </div>

      {/* Botones rápidos A/B/C/D (solo si no se ha respondido) */}
      {!showResult && (
        <div className="flex justify-center gap-3 mb-6">
          {options.map((option, index) => (
            <button
              key={index}
              onClick={() => !isAnswering && onAnswer(index)}
              disabled={isAnswering}
              className={`w-14 h-14 rounded-lg font-bold text-lg transition-all duration-200 ${
                selectedAnswer === index
                  ? 'bg-blue-600 text-white border-2 border-blue-600'
                  : 'bg-white border-2 border-blue-600 text-blue-600 hover:bg-blue-50'
              }`}
            >
              {String.fromCharCode(65 + index)}
            </button>
          ))}
        </div>
      )}

      {/* Mensaje motivador (solo cuando se falla) */}
      {showResult && motivationalMessage && (
        <div className="mt-6 mb-4">
          <div className={`p-4 rounded-lg border-l-4 ${
            motivationalMessage.color === 'green' ? 'bg-green-50 border-green-500' :
            motivationalMessage.color === 'blue' ? 'bg-blue-50 border-blue-500' :
            motivationalMessage.color === 'orange' ? 'bg-orange-50 border-orange-500' :
            motivationalMessage.color === 'red' ? 'bg-red-50 border-red-500' :
            'bg-purple-50 border-purple-500'
          }`}>
            <h4 className={`font-bold mb-2 ${
              motivationalMessage.color === 'green' ? 'text-green-800' :
              motivationalMessage.color === 'blue' ? 'text-blue-800' :
              motivationalMessage.color === 'orange' ? 'text-orange-800' :
              motivationalMessage.color === 'red' ? 'text-red-800' :
              'text-purple-800'
            }`}>
              {motivationalMessage.title}
            </h4>
            <p className={`text-sm ${
              motivationalMessage.color === 'green' ? 'text-green-700' :
              motivationalMessage.color === 'blue' ? 'text-blue-700' :
              motivationalMessage.color === 'orange' ? 'text-orange-700' :
              motivationalMessage.color === 'red' ? 'text-red-700' :
              'text-purple-700'
            }`}>
              {motivationalMessage.message}
            </p>
          </div>
        </div>
      )}

      {/* Explicación (solo mostrar después de responder) */}
      {showResult && (
        <div className="border-t pt-6">
          <div className="bg-blue-50 p-6 rounded-lg">
            <div className="flex items-center mb-4">
              <div className={`text-white rounded-full w-8 h-8 flex items-center justify-center text-sm font-bold mr-3 ${
                selectedAnswer === question.correct_option ? 'bg-green-600' : 'bg-red-600'
              }`}>
                {selectedAnswer === question.correct_option ? '✓' : '✗'}
              </div>
              <h4 className="font-bold text-blue-900 text-lg">
                {question.psychometric_sections?.psychometric_categories?.display_name?.toUpperCase()}: {question.psychometric_sections?.display_name?.toUpperCase()}
              </h4>
            </div>
            

            <h4 className="font-bold text-blue-900 mb-3 flex items-center">
              <span className="bg-green-100 text-green-800 rounded-full w-6 h-6 flex items-center justify-center text-xs font-bold mr-2">1</span>
              {question.content_data?.chart_type === 'error_detection' ? 'EXPLICACIÓN:' : 'ANÁLISIS PASO A PASO:'}
            </h4>
            
            {/* Secciones específicas de explicación */}
            <div className="space-y-4">
              {explanationSections}
            </div>

          </div>

          {/* Estadísticas de evolución de la pregunta */}
          {user && (
            <PsychometricQuestionEvolution
              userId={user.id}
              questionId={question.id}
              currentResult={{
                isCorrect: selectedAnswer === question.correct_option - 1,
                timeSpent: 0, // Se podría calcular si se necesita
                answer: selectedAnswer
              }}
            />
          )}
        </div>
      )}
    </div>
  )
}