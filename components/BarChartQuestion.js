'use client'
import { useState, useEffect } from 'react'
import ChartQuestion from './ChartQuestion'

export default function BarChartQuestion({ 
  question, 
  onAnswer, 
  selectedAnswer, 
  showResult, 
  isAnswering 
}) {
  const [chartSvg, setChartSvg] = useState('')

  useEffect(() => {
    generateBarChart()
  }, [question])

  const generateBarChart = () => {
    if (!question.content_data?.chart_data) return

    const data = question.content_data.chart_data
    const chartWidth = 400
    const chartHeight = 350
    const margin = { top: 60, right: 30, bottom: 60, left: 60 }
    const plotWidth = chartWidth - margin.left - margin.right
    const plotHeight = chartHeight - margin.top - margin.bottom

    // Encontrar valores máximos para escalado
    let maxValue = 0
    data.forEach(yearData => {
      yearData.categories.forEach(category => {
        maxValue = Math.max(maxValue, category.value)
      })
    })

    const barWidth = plotWidth / (data.length * 3 + 1) // 3 categorías por año + espacio
    const groupWidth = barWidth * 3

    let bars = []
    let labels = []
    let legend = []

    // Colores para las categorías
    const categoryColors = {
      'Frutas': '#e91e63',
      'Pescado': '#424242', 
      'Verdura': '#ff9800'
    }

    // Generar barras
    data.forEach((yearData, yearIndex) => {
      const groupX = margin.left + (yearIndex * (groupWidth + barWidth))
      
      yearData.categories.forEach((category, catIndex) => {
        const barHeight = (category.value / maxValue) * plotHeight
        const barX = groupX + (catIndex * barWidth)
        const barY = margin.top + plotHeight - barHeight

        bars.push(
          <rect
            key={`${yearIndex}-${catIndex}`}
            x={barX}
            y={barY}
            width={barWidth - 2}
            height={barHeight}
            fill={categoryColors[category.label]}
            stroke="white"
            strokeWidth="1"
          />
        )

        // Valores en las barras
        bars.push(
          <text
            key={`text-${yearIndex}-${catIndex}`}
            x={barX + (barWidth - 2) / 2}
            y={barY - 5}
            textAnchor="middle"
            fontSize="10"
            fill="#333"
            fontWeight="bold"
          >
            {category.value}
          </text>
        )
      })

      // Etiquetas de años
      labels.push(
        <text
          key={`year-${yearIndex}`}
          x={groupX + groupWidth / 2}
          y={chartHeight - 20}
          textAnchor="middle"
          fontSize="11"
          fill="#333"
          fontWeight="bold"
        >
          {yearData.year}
        </text>
      )
    })

    // Leyenda - posicionada más abajo para evitar solapamiento
    const legendItems = Object.keys(categoryColors)
    legendItems.forEach((item, index) => {
      const legendX = margin.left + (index * 80)
      legend.push(
        <g key={`legend-${index}`}>
          <rect
            x={legendX}
            y={35}
            width={12}
            height={12}
            fill={categoryColors[item]}
          />
          <text
            x={legendX + 18}
            y={46}
            fontSize="10"
            fill="#333"
          >
            {item}
          </text>
        </g>
      )
    })

    // Eje Y con valores
    let yAxisTicks = []
    const tickCount = 5
    for (let i = 0; i <= tickCount; i++) {
      const value = (maxValue / tickCount) * i
      const y = margin.top + plotHeight - (i / tickCount) * plotHeight
      
      yAxisTicks.push(
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
        {/* Título del gráfico - movido más arriba */}
        <text
          x={chartWidth / 2}
          y={20}
          textAnchor="middle"
          fontSize="12"
          fontWeight="bold"
          fill="#333"
        >
          {question.content_data?.y_axis_label || 'Kg/mes'}
        </text>
        
        {/* Leyenda */}
        {legend}
        
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
        
        {/* Ticks del eje Y */}
        {yAxisTicks}
        
        {/* Barras */}
        {bars}
        
        {/* Etiquetas de años */}
        {labels}
        
        {/* Etiqueta del eje X */}
        <text
          x={chartWidth / 2}
          y={chartHeight - 5}
          textAnchor="middle"
          fontSize="11"
          fill="#666"
        >
          {question.content_data?.x_axis_label || 'Años'}
        </text>
      </svg>
    )
  }

  // Secciones específicas de explicación para gráficos de barras
  const explanationSections = (
    <>
      <div className="bg-white p-4 rounded-lg border-l-4 border-green-500">
        <h5 className="font-semibold text-green-800 mb-2">📊 Datos de Frutas:</h5>
        <p className="text-gray-700 text-sm">
          2019: 15 kg/mes<br/>
          2020: 20 kg/mes<br/>
          2021: 10 kg/mes<br/>
          2022: 5 kg/mes<br/>
          <strong>Total: 50 kg/mes ✅</strong>
        </p>
      </div>

      <div className="bg-white p-4 rounded-lg border-l-4 border-yellow-500">
        <h5 className="font-semibold text-yellow-800 mb-2">📊 Datos de Verduras:</h5>
        <p className="text-gray-700 text-sm">
          2019: 20 kg/mes<br/>
          2020: 20 kg/mes<br/>
          2021: 15 kg/mes<br/>
          2022: 10 kg/mes<br/>
          <strong>Total: 65 kg/mes ✅</strong>
        </p>
      </div>

      <div className="bg-white p-4 rounded-lg border-l-4 border-purple-500">
        <h5 className="font-semibold text-purple-800 mb-2">🧮 Diferencia:</h5>
        <p className="text-gray-700 text-sm">
          <strong>Verduras - Frutas = 65 - 50 = 15 kg/mes ✅</strong>
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