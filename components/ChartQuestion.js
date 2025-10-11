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
  explanationSections // Secciones específicas de explicación
}) {
  const { user } = useAuth()

  const options = [
    { value: question.option_a },
    { value: question.option_b },
    { value: question.option_c },
    { value: question.option_d }
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
            if (index === question.correct_option - 1) {
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
              {showResult && index === question.correct_option - 1 && (
                <span className="ml-auto text-green-600">✓</span>
              )}
              {showResult && index === selectedAnswer && index !== question.correct_option - 1 && (
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

      {/* Explicación (solo mostrar después de responder) */}
      {showResult && (
        <div className="border-t pt-6">
          <div className="bg-blue-50 p-6 rounded-lg">
            <div className="flex items-center mb-4">
              <div className="bg-blue-600 text-white rounded-full w-8 h-8 flex items-center justify-center text-sm font-bold mr-3">
                ✓
              </div>
              <h4 className="font-bold text-blue-900 text-lg">
                CAPACIDAD ADMINISTRATIVA: GRÁFICOS
              </h4>
            </div>
            
            <div className="bg-white p-4 rounded-lg mb-4 border-l-4 border-blue-600">
              <p className="text-gray-700 text-sm leading-relaxed">
                <strong>💡 ¿Qué evalúa este ejercicio?</strong><br/>
                {question.content_data?.evaluation_description || 'Tu capacidad para interpretar gráficos y realizar cálculos con los datos presentados.'}
              </p>
            </div>

            <h4 className="font-bold text-blue-900 mb-3 flex items-center">
              <span className="bg-green-100 text-green-800 rounded-full w-6 h-6 flex items-center justify-center text-xs font-bold mr-2">1</span>
              ANÁLISIS PASO A PASO:
            </h4>
            
            {/* Secciones específicas de explicación */}
            <div className="space-y-4">
              {explanationSections}
            </div>

            {/* Técnicas de descarte rápido */}
            <div className="mt-6">
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                <h5 className="font-bold text-yellow-800 mb-3 flex items-center">
                  ⚡ TÉCNICAS DE ANÁLISIS RÁPIDO (Para oposiciones)
                </h5>
                
                <div className="space-y-3 text-sm">
                  <div className="bg-white p-3 rounded border-l-4 border-yellow-500">
                    <h6 className="font-semibold text-yellow-800 mb-1">🔍 Método 1: Observación visual directa</h6>
                    <p className="text-gray-700">
                      {question.content_data?.quick_method_1 || 'Identifica patrones visuales antes de calcular números exactos.'}
                    </p>
                  </div>

                  <div className="bg-white p-3 rounded border-l-4 border-orange-500">
                    <h6 className="font-semibold text-orange-800 mb-1">🧮 Método 2: Cálculo mental</h6>
                    <p className="text-gray-700">
                      {question.content_data?.quick_method_2 || 'Usa aproximaciones y cálculos simples para estimar la respuesta.'}
                    </p>
                  </div>

                  <div className="bg-white p-3 rounded border-l-4 border-purple-500">
                    <h6 className="font-semibold text-purple-800 mb-1">💰 Método 3: Descarte de opciones</h6>
                    <p className="text-gray-700">
                      {question.content_data?.quick_method_3 || 'Elimina opciones obviamente incorrectas antes de calcular.'}
                    </p>
                  </div>

                  <div className="bg-white p-3 rounded border-l-4 border-red-500">
                    <h6 className="font-semibold text-red-800 mb-1">❌ Errores comunes a evitar</h6>
                    <p className="text-gray-700">
                      {question.content_data?.common_errors || 'Verificar unidades, leer correctamente las etiquetas y no confundir conceptos.'}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-4 p-3 bg-green-100 rounded-lg">
              <p className="text-green-800 text-sm text-center">
                <strong>💪 Consejo de oposición:</strong> {question.content_data?.exam_tip || 'Practica la lectura rápida de gráficos y el cálculo mental básico.'}
              </p>
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