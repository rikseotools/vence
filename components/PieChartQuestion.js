'use client'
import { useState, useEffect } from 'react'
import { useAuth } from '../contexts/AuthContext'
import ChartQuestion from './ChartQuestion'

export default function PieChartQuestion({
  question,
  onAnswer,
  selectedAnswer,
  showResult,
  isAnswering,
  attemptCount = 0,
  // 🔒 SEGURIDAD: Props para validación segura via API
  verifiedCorrectAnswer = null,
  verifiedExplanation = null,
  hideAIChat = false
}) {
  const { user } = useAuth()
  const [chartSvg, setChartSvg] = useState('')
  // Dark mode desactivado para psicotécnicos
  const isDarkMode = false

  useEffect(() => {
    generatePieChart()
  }, [question])

  // Dark mode desactivado para gráficos psicotécnicos

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
            stroke={isDarkMode ? "#cbd5e0" : "#666"}
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

  // Crear componente del gráfico para ChartQuestion
  const chartComponent = (
    <div className="mb-8">
      <h3 className="text-center font-bold text-gray-900  mb-4">
        {question.content_data?.chart_title || 'LIBROS VENDIDOS EN EL AÑO 2023'}
      </h3>
      <div className="flex justify-center px-4">
        <div className="max-w-md w-full">
          {chartSvg}
        </div>
      </div>
    </div>
  )

  // Usar las explicaciones de la base de datos
  // Si hay explanation_sections, usarlas. Si no, dejar que ChartQuestion use verifiedExplanation
  const explanationSections = question.content_data?.explanation_sections ? (
    <>
      {question.content_data.explanation_sections.map((section, index) => (
        <div key={index} className="bg-white  p-4 rounded-lg border-l-4 border-blue-500 mb-4">
          <h5 className="font-semibold text-blue-800  mb-2">{section.title}</h5>
          <div className="text-gray-700  text-sm whitespace-pre-line">
            {section.content.replace(/\\n/g, '\n')}
          </div>
        </div>
      ))}
    </>
  ) : null // No usar fallback genérico - dejar que ChartQuestion muestre verifiedExplanation

  return (
    <ChartQuestion
      question={question}
      onAnswer={onAnswer}
      selectedAnswer={selectedAnswer}
      showResult={showResult}
      isAnswering={isAnswering}
      chartComponent={chartComponent}
      explanationSections={explanationSections}
      attemptCount={attemptCount}
      verifiedCorrectAnswer={verifiedCorrectAnswer}
      verifiedExplanation={verifiedExplanation}
      hideAIChat={hideAIChat}
    />
  )
}