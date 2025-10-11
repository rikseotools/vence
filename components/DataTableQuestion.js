'use client'
import { useState, useEffect } from 'react'
import { useAuth } from '../contexts/AuthContext'
import PsychometricQuestionEvolution from './PsychometricQuestionEvolution'

export default function DataTableQuestion({ 
  question, 
  onAnswer, 
  selectedAnswer, 
  showResult, 
  isAnswering 
}) {
  const { user } = useAuth()
  const [analysisSteps, setAnalysisSteps] = useState([])

  useEffect(() => {
    if (question.content_data?.example_analysis) {
      generateAnalysisSteps()
    }
  }, [question])

  const generateAnalysisSteps = () => {
    const example = question.content_data.example_analysis
    const criteria = question.content_data.criteria

    const steps = criteria.map((criterion, index) => {
      const letter = criterion.column
      const matches = example.matches[letter]
      
      return {
        column: letter,
        description: criterion.description,
        matches: matches,
        analysis: generateStepAnalysis(criterion, example, matches)
      }
    })

    setAnalysisSteps(steps)
  }

  const generateStepAnalysis = (criterion, example, matches) => {
    const conditions = criterion.conditions
    const checks = []

    // Verificar tipo
    if (conditions.tipo) {
      const typeMatch = conditions.tipo.includes(example.tipo.toLowerCase())
      checks.push({
        condition: `Tipo: ${conditions.tipo.join(' o ')}`,
        actual: example.tipo,
        result: typeMatch,
        description: typeMatch ? '✅ Cumple' : '❌ No cumple'
      })
    }

    // Verificar cantidad
    if (conditions.cantidad_min && conditions.cantidad_max) {
      const amountMatch = example.cantidad >= conditions.cantidad_min && example.cantidad <= conditions.cantidad_max
      checks.push({
        condition: `Cantidad: ${conditions.cantidad_min}€ - ${conditions.cantidad_max}€`,
        actual: `${example.cantidad}€`,
        result: amountMatch,
        description: amountMatch ? '✅ Dentro del rango' : '❌ Fuera del rango'
      })
    } else if (conditions.cantidad_max) {
      const amountMatch = example.cantidad <= conditions.cantidad_max
      checks.push({
        condition: `Cantidad: hasta ${conditions.cantidad_max}€`,
        actual: `${example.cantidad}€`,
        result: amountMatch,
        description: amountMatch ? '✅ Dentro del límite' : '❌ Supera el límite'
      })
    }

    // Verificar fecha
    if (conditions.fecha_inicio && conditions.fecha_fin) {
      const exampleDate = new Date(example.fecha)
      const startDate = new Date(conditions.fecha_inicio)
      const endDate = new Date(conditions.fecha_fin)
      const dateMatch = exampleDate >= startDate && exampleDate <= endDate
      
      checks.push({
        condition: `Fecha: ${formatDate(conditions.fecha_inicio)} - ${formatDate(conditions.fecha_fin)}`,
        actual: formatDate(example.fecha),
        result: dateMatch,
        description: dateMatch ? '✅ Dentro del período' : '❌ Fuera del período'
      })
    }

    return {
      checks,
      finalResult: matches,
      summary: matches ? '✅ CUMPLE todos los criterios' : '❌ NO CUMPLE algún criterio'
    }
  }

  const formatDate = (dateStr) => {
    const date = new Date(dateStr)
    return date.toLocaleDateString('es-ES')
  }

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
      <div className="mb-6">
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

      {/* Ejemplo de datos */}
      {question.content_data?.table_data?.example_row && (
        <div className="mb-6">
          <h3 className="font-bold text-gray-900 dark:text-white mb-3">📋 Datos del Seguro:</h3>
          <div className="bg-orange-50 dark:bg-orange-900/20 border-2 border-orange-200 dark:border-orange-700 rounded-lg p-4">
            <div className="flex justify-center">
              <table className="border-collapse">
                <tbody>
                  <tr className="border border-orange-300 dark:border-orange-600">
                    <td className="border border-orange-300 dark:border-orange-600 px-4 py-2 bg-orange-100 dark:bg-orange-800/30 font-semibold text-center">
                      {question.content_data.table_data.example_row.cantidad}
                    </td>
                    <td className="border border-orange-300 dark:border-orange-600 px-4 py-2 bg-orange-100 dark:bg-orange-800/30 font-semibold text-center">
                      {question.content_data.table_data.example_row.tipo}
                    </td>
                    <td className="border border-orange-300 dark:border-orange-600 px-4 py-2 bg-orange-100 dark:bg-orange-800/30 font-semibold text-center">
                      {question.content_data.table_data.example_row.fecha}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Criterios */}
      {question.content_data?.criteria && (
        <div className="mb-6">
          <h3 className="font-bold text-gray-900 dark:text-white mb-3">📝 Criterios de Clasificación:</h3>
          <div className="space-y-3">
            {question.content_data.criteria.map((criterion, index) => {
              let criterionClass = "bg-gray-50 dark:bg-gray-700 border border-gray-200 rounded-lg p-4 cursor-pointer transition-all duration-200 hover:bg-blue-50 dark:bg-blue-900/20 hover:border-blue-300"
              
              if (showResult) {
                if (index === question.correct_option) {
                  criterionClass = "bg-green-50 border-2 border-green-500 rounded-lg p-4"
                } else if (index === selectedAnswer) {
                  criterionClass = "bg-red-50 border-2 border-red-500 rounded-lg p-4"
                } else {
                  criterionClass = "bg-gray-50 dark:bg-gray-700 border border-gray-200 rounded-lg p-4"
                }
              } else if (selectedAnswer !== null && selectedAnswer === index) {
                criterionClass = "bg-blue-50 dark:bg-blue-900/20 border-2 border-blue-500 rounded-lg p-4"
              }

              return (
                <div 
                  key={index} 
                  className={criterionClass}
                  onClick={() => !showResult && !isAnswering && onAnswer(index)}
                >
                  <div className="flex items-start">
                    <span className="font-bold text-lg text-blue-600 dark:text-blue-400 mr-3 bg-blue-100 dark:bg-blue-800/30 w-8 h-8 rounded-full flex items-center justify-center">
                      {criterion.column}
                    </span>
                    <p className="text-gray-700 dark:text-gray-300 text-sm leading-relaxed flex-1">
                      {criterion.description}
                    </p>
                    {showResult && index === question.correct_option && (
                      <span className="ml-auto text-green-600 dark:text-green-400 font-bold">✓</span>
                    )}
                    {showResult && index === selectedAnswer && index !== question.correct_option && (
                      <span className="ml-auto text-red-600 dark:text-red-400 font-bold">✗</span>
                    )}
                  </div>
                </div>
              )
            })}
            {/* Criterio D - Si no se cumple ninguna condición */}
            {(() => {
              const dIndex = 3; // D es el índice 3
              let criterionClass = "bg-gray-50 dark:bg-gray-700 border border-gray-200 rounded-lg p-4 cursor-pointer transition-all duration-200 hover:bg-blue-50 dark:bg-blue-900/20 hover:border-blue-300"
              
              if (showResult) {
                if (dIndex === question.correct_option) {
                  criterionClass = "bg-green-50 border-2 border-green-500 rounded-lg p-4"
                } else if (dIndex === selectedAnswer) {
                  criterionClass = "bg-red-50 border-2 border-red-500 rounded-lg p-4"
                } else {
                  criterionClass = "bg-gray-50 dark:bg-gray-700 border border-gray-200 rounded-lg p-4"
                }
              } else if (selectedAnswer !== null && selectedAnswer === dIndex) {
                criterionClass = "bg-blue-50 dark:bg-blue-900/20 border-2 border-blue-500 rounded-lg p-4"
              }

              return (
                <div 
                  className={criterionClass}
                  onClick={() => !showResult && !isAnswering && onAnswer(dIndex)}
                >
                  <div className="flex items-start">
                    <span className="font-bold text-lg text-blue-600 dark:text-blue-400 mr-3 bg-blue-100 dark:bg-blue-800/30 w-8 h-8 rounded-full flex items-center justify-center">
                      D
                    </span>
                    <p className="text-gray-700 dark:text-gray-300 text-sm leading-relaxed flex-1">
                      Si no se cumple ninguna de las condiciones anteriores.
                    </p>
                    {showResult && dIndex === question.correct_option && (
                      <span className="ml-auto text-green-600 dark:text-green-400 font-bold">✓</span>
                    )}
                    {showResult && dIndex === selectedAnswer && dIndex !== question.correct_option && (
                      <span className="ml-auto text-red-600 dark:text-red-400 font-bold">✗</span>
                    )}
                  </div>
                </div>
              )
            })()}
          </div>
        </div>
      )}


      {/* Botones A/B/C/D para respuesta */}
      <div className="flex justify-center gap-3 mb-6">
        {options.map((option, index) => {
          let buttonClass = "w-14 h-14 rounded-lg font-bold text-lg transition-all duration-200 "
          
          if (showResult) {
            if (index === question.correct_option) {
              buttonClass += "bg-green-600 text-white border-2 border-green-600"
            } else if (index === selectedAnswer) {
              buttonClass += "bg-red-600 text-white border-2 border-red-600"
            } else {
              buttonClass += "bg-white dark:bg-gray-800 border-2 border-gray-300 text-gray-600 dark:text-gray-400"
            }
          } else if (selectedAnswer !== null && selectedAnswer === index) {
            buttonClass += "bg-blue-600 text-white border-2 border-blue-600"
          } else {
            // Todos los botones no seleccionados deben tener el mismo estilo azul
            buttonClass += "bg-white dark:bg-gray-800 border-2 border-blue-600 text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:bg-blue-900/20"
          }

          return (
            <button
              key={index}
              onClick={() => !showResult && !isAnswering && onAnswer(index)}
              disabled={showResult || isAnswering}
              className={buttonClass}
            >
              {String.fromCharCode(65 + index)}
              {showResult && index === question.correct_option && (
                <span className="ml-1 text-xs">✓</span>
              )}
              {showResult && index === selectedAnswer && index !== question.correct_option && (
                <span className="ml-1 text-xs">✗</span>
              )}
            </button>
          )
        })}
      </div>

      {/* Explicación (solo mostrar después de responder) */}
      {showResult && (
        <div className="border-t pt-6">
          <div className="bg-blue-50 dark:bg-blue-900/20 p-6 rounded-lg">
            <div className="flex items-center mb-4">
              <div className="bg-blue-600 text-white rounded-full w-8 h-8 flex items-center justify-center text-sm font-bold mr-3">
                ✓
              </div>
              <h4 className="font-bold text-blue-900 text-lg">
                CAPACIDAD ADMINISTRATIVA: TABLAS
              </h4>
            </div>
            
            <div className="bg-white dark:bg-gray-800 p-4 rounded-lg mb-4 border-l-4 border-blue-600">
              <p className="text-gray-700 dark:text-gray-300 text-sm leading-relaxed">
                <strong>💡 ¿Qué evalúa este ejercicio?</strong><br/>
                Tu capacidad para analizar información tabular y aplicar múltiples criterios de filtrado simultáneamente.
              </p>
            </div>

            <h4 className="font-bold text-blue-900 mb-3 flex items-center">
              <span className="bg-green-100 dark:bg-green-900/20 text-green-800 dark:text-green-300 rounded-full w-6 h-6 flex items-center justify-center text-xs font-bold mr-2">1</span>
              ANÁLISIS PASO A PASO:
            </h4>
            
            <div className="space-y-4">
              {analysisSteps.map((step, index) => (
                <div key={index} className={`bg-white dark:bg-gray-800 p-4 rounded-lg border-l-4 ${
                  step.matches ? 'border-green-500' : 'border-red-500'
                }`}>
                  <h5 className={`font-semibold mb-2 ${
                    step.matches ? 'text-green-800 dark:text-green-300' : 'text-red-800 dark:text-red-300'
                  }`}>
                    📋 Columna {step.column}: {step.matches ? 'SÍ CUMPLE' : 'NO CUMPLE'}
                  </h5>
                  <p className="text-gray-600 dark:text-gray-400 text-sm mb-3">{step.description}</p>
                  
                  <div className="space-y-2">
                    {step.analysis.checks.map((check, checkIndex) => (
                      <div key={checkIndex} className="flex items-center justify-between text-xs bg-gray-50 dark:bg-gray-700 p-2 rounded">
                        <span className="text-gray-600 dark:text-gray-400">{check.condition}</span>
                        <span className="text-gray-800 font-medium">{check.actual}</span>
                        <span className={check.result ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}>
                          {check.description}
                        </span>
                      </div>
                    ))}
                  </div>
                  
                  <div className={`mt-2 p-2 rounded text-xs font-medium ${
                    step.matches ? 'bg-green-100 dark:bg-green-900/20 text-green-800 dark:text-green-300' : 'bg-red-100 text-red-800 dark:text-red-300'
                  }`}>
                    {step.analysis.summary}
                  </div>
                </div>
              ))}
            </div>

            {/* Técnicas de análisis rápido */}
            <div className="mt-6">
              <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-700 rounded-lg p-4">
                <h5 className="font-bold text-yellow-800 dark:text-yellow-300 mb-3 flex items-center">
                  ⚡ TÉCNICAS DE ANÁLISIS RÁPIDO (Para oposiciones)
                </h5>
                
                <div className="space-y-3 text-sm">
                  <div className="bg-white dark:bg-gray-800 p-3 rounded border-l-4 border-yellow-500">
                    <h6 className="font-semibold text-yellow-800 dark:text-yellow-300 mb-1">🔍 Método 1: Análisis sistemático</h6>
                    <p className="text-gray-700 dark:text-gray-300">
                      • <strong>Lee una vez:</strong> Identifica TIPO, CANTIDAD y FECHA del ejemplo<br/>
                      • <strong>Ve criterio por criterio:</strong> Evalúa cada columna secuencialmente<br/>
                      • <strong>Marca mentalmente:</strong> ✓ o ✗ para cada condición<br/>
                      • <strong>Descarta rápido:</strong> Si falla una condición, ya no cumple
                    </p>
                  </div>

                  <div className="bg-white dark:bg-gray-800 p-3 rounded border-l-4 border-orange-500">
                    <h6 className="font-semibold text-orange-800 dark:text-orange-300 mb-1">📅 Método 2: Atajos para fechas</h6>
                    <p className="text-gray-700 dark:text-gray-300">
                      • <strong>Convierte mentalmente:</strong> 22/10/2016 = "octubre 2016"<br/>
                      • <strong>Compara por períodos:</strong> ¿Está entre marzo-mayo 2016? NO<br/>
                      • <strong>Use rangos amplios:</strong> ¿Está en 2016-2017? SÍ<br/>
                      • <strong>Ajusta después:</strong> Verifica meses específicos solo si es candidato
                    </p>
                  </div>

                  <div className="bg-white dark:bg-gray-800 p-3 rounded border-l-4 border-purple-500">
                    <h6 className="font-semibold text-purple-800 dark:text-purple-300 mb-1">💰 Método 3: Rangos de cantidad</h6>
                    <p className="text-gray-700 dark:text-gray-300">
                      • <strong>Identifica límites:</strong> "hasta 3000" vs "desde 1500 a 4500"<br/>
                      • <strong>Usa referencias:</strong> 1000 &lt; 1500 (no cumple mínimo)<br/>
                      • <strong>Elimina rápido:</strong> Si está fuera del rango, siguiente criterio<br/>
                      • <strong>Verifica inclusivo:</strong> "hasta 3000 inclusive" incluye 3000
                    </p>
                  </div>

                  <div className="bg-white dark:bg-gray-800 p-3 rounded border-l-4 border-red-500">
                    <h6 className="font-semibold text-red-800 dark:text-red-300 mb-1">❌ Errores comunes a evitar</h6>
                    <p className="text-gray-700 dark:text-gray-300">
                      • <strong>No confundir "o" con "y":</strong> "vida o accidentes" acepta cualquiera<br/>
                      • <strong>Cuidado con "inclusive":</strong> Incluye el límite exacto<br/>
                      • <strong>Fechas en formato correcto:</strong> DD/MM/YYYY<br/>
                      • <strong>Lee "hasta" vs "desde-hasta":</strong> Diferentes tipos de límites
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-4 p-3 bg-green-100 dark:bg-green-900/20 rounded-lg">
              <p className="text-green-800 dark:text-green-300 text-sm text-center">
                <strong>💪 Consejo de oposición:</strong> En exámenes reales, haz el análisis en el orden: TIPO → CANTIDAD → FECHA. Si falla el primero, no pierdas tiempo con el resto.
              </p>
            </div>
          </div>

          {/* Estadísticas de evolución de la pregunta */}
          {user && (
            <PsychometricQuestionEvolution
              userId={user.id}
              questionId={question.id}
              currentResult={{
                isCorrect: selectedAnswer === question.correct_option,
                timeSpent: 0,
                answer: selectedAnswer
              }}
            />
          )}
        </div>
      )}
    </div>
  )
}