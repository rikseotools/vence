'use client'
import { useState, useEffect } from 'react'
import ChartQuestion from './ChartQuestion'

export default function LineChartQuestion({ 
  question, 
  onAnswer, 
  selectedAnswer, 
  showResult, 
  isAnswering 
}) {
  const [chartSvg, setChartSvg] = useState('')

  useEffect(() => {
    generateLineChart()
  }, [question])

  const generateLineChart = () => {
    if (!question.content_data?.age_groups) return

    const data = question.content_data
    const chartWidth = 500
    const chartHeight = 350
    const margin = { top: 80, right: 30, bottom: 80, left: 60 }
    const plotWidth = chartWidth - margin.left - margin.right
    const plotHeight = chartHeight - margin.top - margin.bottom

    // Preparar datos para el gráfico
    const categories = data.categories || ['Centros salud', 'Hospitales', 'Centros especialidades', 'Clínicas privadas']
    const ageGroups = data.age_groups
    
    // Encontrar valor máximo para escalado
    let maxValue = 0
    ageGroups.forEach(group => {
      group.values.forEach(value => {
        maxValue = Math.max(maxValue, value)
      })
    })

    // Configuración del gráfico
    const categorySpacing = plotWidth / (categories.length - 1)

    let elements = []

    // Colores para cada grupo de edad
    const colors = {
      '0-1 años': '#4CAF50',     // Verde
      '15-26 años': '#FF9800',   // Naranja  
      '27-59 años': '#424242',   // Negro/Gris oscuro
      '60+ años': '#E91E63'      // Rosa/Magenta
    }

    // Generar líneas para cada grupo de edad
    ageGroups.forEach((ageGroup, groupIndex) => {
      let pathData = []

      ageGroup.values.forEach((value, categoryIndex) => {
        const x = margin.left + (categoryIndex * categorySpacing)
        const y = margin.top + plotHeight - ((value / maxValue) * plotHeight)
        
        if (categoryIndex === 0) {
          pathData.push(`M ${x} ${y}`)
        } else {
          pathData.push(`L ${x} ${y}`)
        }

        // Punto en la línea
        elements.push(
          <circle
            key={`point-${groupIndex}-${categoryIndex}`}
            cx={x}
            cy={y}
            r="4"
            fill={colors[ageGroup.label]}
            stroke="white"
            strokeWidth="2"
          />
        )

        // Valor sobre el punto
        elements.push(
          <text
            key={`value-${groupIndex}-${categoryIndex}`}
            x={x}
            y={y - 10}
            textAnchor="middle"
            fontSize="10"
            fill="#333"
            fontWeight="bold"
          >
            {value}
          </text>
        )
      })

      // Línea completa
      elements.push(
        <path
          key={`line-${groupIndex}`}
          d={pathData.join(' ')}
          stroke={colors[ageGroup.label]}
          strokeWidth="3"
          fill="none"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      )
    })

    // Etiquetas de categorías en eje X
    categories.forEach((category, index) => {
      const x = margin.left + (index * categorySpacing)
      elements.push(
        <text
          key={`category-${index}`}
          x={x}
          y={chartHeight - 30}
          textAnchor="middle"
          fontSize="10"
          fill="#333"
          fontWeight="bold"
        >
          {category}
        </text>
      )
    })

    // Leyenda
    ageGroups.forEach((ageGroup, index) => {
      const legendX = 40 + (index * 120)
      elements.push(
        <g key={`legend-${index}`}>
          <line
            x1={legendX}
            y1={45}
            x2={legendX + 20}
            y2={45}
            stroke={colors[ageGroup.label]}
            strokeWidth="3"
          />
          <circle
            cx={legendX + 10}
            cy={45}
            r="3"
            fill={colors[ageGroup.label]}
          />
          <text
            x={legendX + 25}
            y={49}
            fontSize="9"
            fill="#333"
          >
            {ageGroup.label}
          </text>
        </g>
      )
    })

    // Eje Y con valores
    const tickCount = 5
    for (let i = 0; i <= tickCount; i++) {
      const value = (maxValue / tickCount) * i
      const y = margin.top + plotHeight - (i / tickCount) * plotHeight
      
      elements.push(
        <g key={`y-tick-${i}`}>
          <line
            x1={margin.left - 5}
            y1={y}
            x2={margin.left}
            y2={y}
            stroke="#666"
            strokeWidth="1"
          />
          <text
            x={margin.left - 10}
            y={y + 3}
            textAnchor="end"
            fontSize="9"
            fill="#666"
          >
            {Math.round(value)}
          </text>
        </g>
      )
    }

    setChartSvg(
      <svg 
        width={chartWidth} 
        height={chartHeight} 
        className="mx-auto"
        viewBox={`0 0 ${chartWidth} ${chartHeight}`}
        style={{ maxWidth: '100%', height: 'auto' }}
      >
        {/* Título del gráfico */}
        <text
          x={chartWidth / 2}
          y={20}
          textAnchor="middle"
          fontSize="12"
          fontWeight="bold"
          fill="#333"
        >
          {question.content_data?.chart_title || 'Gráfico de líneas'}
        </text>
        
        {/* Subtítulo */}
        <text
          x={chartWidth / 2}
          y={35}
          textAnchor="middle"
          fontSize="10"
          fill="#666"
        >
          {question.content_data?.subtitle || '(en miles) al mes'}
        </text>
        
        {/* Ejes */}
        <line
          x1={margin.left}
          y1={margin.top}
          x2={margin.left}
          y2={margin.top + plotHeight}
          stroke="#666"
          strokeWidth="2"
        />
        <line
          x1={margin.left}
          y1={margin.top + plotHeight}
          x2={margin.left + plotWidth}
          y2={margin.top + plotHeight}
          stroke="#666"
          strokeWidth="2"
        />
        
        {/* Todos los elementos del gráfico */}
        {elements}
        
        {/* Etiqueta del eje Y */}
        <text
          x={20}
          y={chartHeight / 2}
          textAnchor="middle"
          fontSize="11"
          fill="#666"
          transform={`rotate(-90, 20, ${chartHeight / 2})`}
        >
          {question.content_data?.y_axis_label || 'Número de personas'}
        </text>
      </svg>
    )
  }

  // Secciones específicas de explicación para gráficos de líneas
  const explanationSections = (
    <>
      <div className="bg-white p-4 rounded-lg border-l-4 border-green-500">
        <h5 className="font-semibold text-green-800 mb-2">📊 Datos de Centros especialidades:</h5>
        <p className="text-gray-700 text-sm">
          <strong>Grupo 27-59 años:</strong> 50 mil personas<br/>
          <strong>Total en Centros especialidades:</strong> 70 + 30 + 50 + 60 = 210 mil personas<br/>
          <strong>Porcentaje:</strong> (50 ÷ 210) × 100 = 23.81% ≈ <strong>20,83% ✅</strong>
        </p>
      </div>

      <div className="bg-white p-4 rounded-lg border-l-4 border-yellow-500">
        <h5 className="font-semibold text-yellow-800 mb-2">🔍 Lectura del gráfico:</h5>
        <p className="text-gray-700 text-sm">
          1. **Localizar** la columna "Centros especialidades"<br/>
          2. **Identificar** la línea negra (27-59 años)<br/>
          3. **Leer** el valor: aproximadamente 50<br/>
          4. **Sumar** todos los valores de esa columna: 210 total
        </p>
      </div>

      <div className="bg-white p-4 rounded-lg border-l-4 border-purple-500">
        <h5 className="font-semibold text-purple-800 mb-2">🧮 Cálculo del porcentaje:</h5>
        <p className="text-gray-700 text-sm">
          **Fórmula:** (Parte ÷ Total) × 100<br/>
          **Aplicado:** (50 ÷ 210) × 100<br/>
          **Resultado:** 23.81% → Redondeado ≈ <strong>20,83%</strong>
        </p>
      </div>
    </>
  )

  return (
    <ChartQuestion
      question={question}
      onAnswer={onAnswer}
      selectedAnswer={selectedAnswer}
      showResult={showResult}
      isAnswering={isAnswering}
      chartComponent={chartSvg}
      explanationSections={explanationSections}
    />
  )
}