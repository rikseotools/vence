'use client'
import { useState, useEffect } from 'react'

export default function PieChartQuestion({ 
  question, 
  onAnswer, 
  selectedAnswer, 
  showResult, 
  isAnswering 
}) {
  const [chartSvg, setChartSvg] = useState('')

  useEffect(() => {
    generatePieChart()
  }, [question])

  const generatePieChart = () => {
    if (!question.content_data?.chart_data) return

    const data = question.content_data.chart_data
    const centerSize = 200
    const margin = 80 // Margen para las etiquetas
    const totalSize = centerSize + (margin * 2)
    const center = totalSize / 2
    const radius = 80

    let cumulativePercentage = 0
    let paths = []
    
    // Colores para los segmentos del gráfico
    const colors = [
      '#FF9500', // Naranja para POEMAS
      '#FFB84D', // Naranja claro para CIENCIA FICCIÓN  
      '#FF6B35', // Naranja rojizo para POLICIACA
      '#FFC985'  // Naranja muy claro para ROMÁNTICA
    ]

    data.forEach((item, index) => {
      const percentage = item.percentage
      const startAngle = (cumulativePercentage / 100) * 360
      const endAngle = ((cumulativePercentage + percentage) / 100) * 360
      
      const x1 = center + radius * Math.cos((startAngle - 90) * Math.PI / 180)
      const y1 = center + radius * Math.sin((startAngle - 90) * Math.PI / 180)
      const x2 = center + radius * Math.cos((endAngle - 90) * Math.PI / 180)
      const y2 = center + radius * Math.sin((endAngle - 90) * Math.PI / 180)
      
      const largeArcFlag = percentage > 50 ? 1 : 0
      
      const pathData = [
        `M ${center} ${center}`,
        `L ${x1} ${y1}`,
        `A ${radius} ${radius} 0 ${largeArcFlag} 1 ${x2} ${y2}`,
        'Z'
      ].join(' ')
      
      // Calcular posición para la etiqueta con mejor distribución
      const labelAngle = ((startAngle + endAngle) / 2 - 90) * Math.PI / 180
      const labelRadius = radius + 40 // Más distancia del centro
      let labelX = center + labelRadius * Math.cos(labelAngle)
      let labelY = center + labelRadius * Math.sin(labelAngle)
      
      // Determinar la posición del texto basada en el cuadrante
      let textAnchor = "middle"
      let textX = labelX
      let textY = labelY
      
      // Cuadrante derecho
      if (labelAngle >= -Math.PI/2 && labelAngle <= Math.PI/2) {
        textAnchor = "start"
        textX = labelX + 5
      } 
      // Cuadrante izquierdo
      else {
        textAnchor = "end" 
        textX = labelX - 5
      }
      
      // Evitar que las etiquetas se salgan del área visible
      const padding = 15
      if (textX < padding) {
        textX = padding
        textAnchor = "start"
      } else if (textX > totalSize - padding) {
        textX = totalSize - padding
        textAnchor = "end"
      }
      
      if (textY < padding) {
        textY = padding + 10
      } else if (textY > totalSize - padding) {
        textY = totalSize - padding - 10
      }
      
      // Línea conectora desde el segmento a la etiqueta
      const connectorStartX = center + (radius + 8) * Math.cos(labelAngle)
      const connectorStartY = center + (radius + 8) * Math.sin(labelAngle)
      const connectorMidX = center + (radius + 30) * Math.cos(labelAngle)
      const connectorMidY = center + (radius + 30) * Math.sin(labelAngle)
      
      paths.push(
        <g key={index}>
          <path
            d={pathData}
            fill={colors[index]}
            stroke="white"
            strokeWidth="2"
          />
          {/* Línea conectora mejorada */}
          <polyline
            points={`${connectorStartX},${connectorStartY} ${connectorMidX},${connectorMidY} ${textX},${textY}`}
            stroke="#666"
            strokeWidth="1"
            fill="none"
          />
          {/* Fondo semi-transparente para las etiquetas */}
          <rect
            x={textAnchor === "start" ? textX - 2 : textAnchor === "end" ? textX - item.label.length * 7 : textX - (item.label.length * 3.5)}
            y={textY - 15}
            width={item.label.length * 7 + 4}
            height="30"
            fill="rgba(255, 255, 255, 0.9)"
            stroke="rgba(0, 0, 0, 0.1)"
            strokeWidth="1"
            rx="3"
          />
          {/* Etiqueta principal */}
          <text
            x={textX}
            y={textY - 3}
            textAnchor={textAnchor}
            dominantBaseline="middle"
            fontSize="11"
            fontWeight="bold"
            fill="#333"
          >
            {item.label}
          </text>
          {/* Porcentaje */}
          <text
            x={textX}
            y={textY + 9}
            textAnchor={textAnchor}
            dominantBaseline="middle"
            fontSize="10"
            fill="#666"
          >
            {item.percentage}%
          </text>
        </g>
      )
      
      cumulativePercentage += percentage
    })

    setChartSvg(
      <svg 
        width={totalSize} 
        height={totalSize} 
        className="mx-auto"
        viewBox={`0 0 ${totalSize} ${totalSize}`}
        style={{ maxWidth: '100%', height: 'auto' }}
      >
        {paths}
      </svg>
    )
  }

  const options = [
    { key: 'A', value: question.option_a },
    { key: 'B', value: question.option_b },
    { key: 'C', value: question.option_c },
    { key: 'D', value: question.option_d }
  ]

  const correctOptionKey = ['A', 'B', 'C', 'D'][question.correct_option]

  return (
    <div className="bg-white rounded-lg shadow-lg p-6">
      {/* Número de pregunta */}
      <div className="mb-4">
        <span className="text-sm font-semibold text-blue-600 bg-blue-50 px-3 py-1 rounded-full">
          01. 
        </span>
      </div>

      {/* Pregunta */}
      <div className="mb-6">
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

      {/* Gráfico */}
      <div className="mb-8">
        <h3 className="text-center font-bold text-gray-900 mb-4">
          {question.content_data?.chart_title || 'LIBROS VENDIDOS EN EL AÑO 2023'}
        </h3>
        <div className="flex justify-center px-4">
          <div className="max-w-md w-full">
            {chartSvg}
          </div>
        </div>
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
                {option.key}
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
              {option.key}
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
                Tu capacidad para interpretar datos de un gráfico circular y realizar cálculos matemáticos básicos con porcentajes.
              </p>
            </div>

            <h4 className="font-bold text-blue-900 mb-3 flex items-center">
              <span className="bg-green-100 text-green-800 rounded-full w-6 h-6 flex items-center justify-center text-xs font-bold mr-2">1</span>
              PASO A PASO - SOLUCIÓN:
            </h4>
            
            <div className="space-y-4">
              <div className="bg-white p-4 rounded-lg border-l-4 border-green-500">
                <h5 className="font-semibold text-green-800 mb-2">📊 Paso 1: Identificar los datos</h5>
                <p className="text-gray-700 text-sm">
                  Del gráfico vemos que:<br/>
                  • POEMAS = <strong>34,5%</strong><br/>
                  • CIENCIA FICCIÓN = <strong>21,8%</strong><br/>
                  • Total de libros vendidos = <strong>2.350 libros</strong>
                </p>
              </div>

              <div className="bg-white p-4 rounded-lg border-l-4 border-yellow-500">
                <h5 className="font-semibold text-yellow-800 mb-2">➕ Paso 2: Sumar los porcentajes</h5>
                <p className="text-gray-700 text-sm">
                  Poemas + Ciencia ficción = <strong>34,5% + 21,8% = 56,3%</strong>
                </p>
              </div>

              <div className="bg-white p-4 rounded-lg border-l-4 border-purple-500">
                <h5 className="font-semibold text-purple-800 mb-2">🧮 Paso 3: Calcular el 56,3% de 2.350</h5>
                <p className="text-gray-700 text-sm">
                  <strong>Método:</strong> (Porcentaje ÷ 100) × Total<br/>
                  <strong>Cálculo:</strong> (56,3 ÷ 100) × 2.350<br/>
                  <strong>Resultado:</strong> 0,563 × 2.350 = <strong>1.323,05 libros</strong>
                </p>
              </div>

              <div className="bg-white p-4 rounded-lg border-l-4 border-blue-500">
                <h5 className="font-semibold text-blue-800 mb-2">🎯 Paso 4: Respuesta final</h5>
                <p className="text-gray-700 text-sm">
                  Como hablamos de libros (no pueden ser decimales), redondeamos:<br/>
                  <strong>1.323,05 ≈ 1.323 libros</strong> ✅
                </p>
              </div>
            </div>

            <div className="mt-4 p-3 bg-green-100 rounded-lg">
              <p className="text-green-800 text-sm text-center">
                <strong>💪 Consejo:</strong> En gráficos circulares, siempre suma primero los porcentajes y luego calcula sobre el total.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}