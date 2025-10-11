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
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6">
      {/* Número de pregunta */}
      <div className="mb-4">
        <span className="text-sm font-semibold text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20 px-3 py-1 rounded-full">
          02. 
        </span>
      </div>

      {/* Pregunta */}
      <div className="mb-6 sm:mb-6 mb-3">
        <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-3">
          {question.question_text}
        </h2>
        
        {/* Contexto */}
        {question.content_data?.question_context && (
          <p className="text-gray-700 dark:text-gray-300 mb-4">
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
              buttonClass += " border-green-500 dark:border-green-400 bg-green-50 dark:bg-green-900/20 text-green-800 dark:text-green-300"
            } else if (index === selectedAnswer) {
              // Respuesta seleccionada incorrecta
              buttonClass += " border-red-500 dark:border-red-400 bg-red-50 dark:bg-red-900/20 text-red-800 dark:text-red-300"
            } else {
              // Otras opciones
              buttonClass += " border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 text-gray-600 dark:text-gray-400"
            }
          } else if (selectedAnswer === index) {
            buttonClass += " border-blue-500 dark:border-blue-400 bg-blue-50 dark:bg-blue-900/20 text-blue-800 dark:text-blue-300"
          } else {
            buttonClass += " border-gray-200 dark:border-gray-600 hover:border-blue-300 dark:hover:border-blue-500 hover:bg-blue-25 dark:hover:bg-blue-900/10 text-gray-700 dark:text-gray-300"
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
                  ? 'bg-blue-600 dark:bg-blue-500 text-white border-2 border-blue-600'
                  : 'bg-white dark:bg-gray-800 border-2 border-blue-600 text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:bg-blue-900/20'
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
          <div className="bg-blue-50 dark:bg-blue-900/20 p-6 rounded-lg">
            <div className="flex items-center mb-4">
              <div className="bg-blue-600 dark:bg-blue-500 text-white rounded-full w-8 h-8 flex items-center justify-center text-sm font-bold mr-3">
                ✓
              </div>
              <h4 className="font-bold text-blue-900 dark:text-blue-200 text-lg">
                CAPACIDAD ADMINISTRATIVA: GRÁFICOS
              </h4>
            </div>
            
            <div className="bg-white dark:bg-gray-800 p-4 rounded-lg mb-4 border-l-4 border-blue-600">
              <p className="text-gray-700 dark:text-gray-300 text-sm leading-relaxed">
                <strong>💡 ¿Qué evalúa este ejercicio?</strong><br/>
                {question.content_data?.evaluation_description || 'Tu capacidad para interpretar gráficos y realizar cálculos con los datos presentados.'}
              </p>
            </div>

            <h4 className="font-bold text-blue-900 dark:text-blue-200 mb-3 flex items-center">
              <span className="bg-green-100 text-green-800 dark:text-green-300 rounded-full w-6 h-6 flex items-center justify-center text-xs font-bold mr-2">1</span>
              ANÁLISIS PASO A PASO:
            </h4>
            
            {/* Secciones específicas de explicación */}
            <div className="space-y-4">
              {explanationSections}
            </div>

            {/* Técnicas de descarte rápido */}
            <div className="mt-6">
              <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-700 rounded-lg p-4">
                <h5 className="font-bold text-yellow-800 dark:text-yellow-300 mb-3 flex items-center">
                  ⚡ TÉCNICAS DE ANÁLISIS RÁPIDO (Para oposiciones)
                </h5>
                
                <div className="space-y-3 text-sm">
                  <div className="bg-white dark:bg-gray-800 p-3 rounded border-l-4 border-yellow-500">
                    <h6 className="font-semibold text-yellow-800 mb-1">🔍 Método 1: Observación visual directa</h6>
                    <p className="text-gray-700 dark:text-gray-300">
                      {question.content_data?.quick_method_1 || 'Identifica patrones visuales antes de calcular números exactos.'}
                    </p>
                  </div>

                  <div className="bg-white dark:bg-gray-800 p-3 rounded border-l-4 border-orange-500">
                    <h6 className="font-semibold text-orange-800 mb-1">🧮 Método 2: Cálculo mental</h6>
                    <p className="text-gray-700 dark:text-gray-300">
                      {question.content_data?.quick_method_2 || 'Usa aproximaciones y cálculos simples para estimar la respuesta.'}
                    </p>
                  </div>

                  <div className="bg-white dark:bg-gray-800 p-3 rounded border-l-4 border-purple-500">
                    <h6 className="font-semibold text-purple-800 mb-1">💰 Método 3: Descarte de opciones</h6>
                    <p className="text-gray-700 dark:text-gray-300">
                      {question.content_data?.quick_method_3 || 'Elimina opciones obviamente incorrectas antes de calcular.'}
                    </p>
                  </div>

                  <div className="bg-white dark:bg-gray-800 p-3 rounded border-l-4 border-red-500 dark:border-red-400">
                    <h6 className="font-semibold text-red-800 dark:text-red-300 mb-1">❌ Errores comunes a evitar</h6>
                    <p className="text-gray-700 dark:text-gray-300">
                      {question.content_data?.common_errors || 'Verificar unidades, leer correctamente las etiquetas y no confundir conceptos.'}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-4 p-3 bg-green-100 dark:bg-green-900/20 rounded-lg">
              <p className="text-green-800 dark:text-green-300 text-sm text-center">
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