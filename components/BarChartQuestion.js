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

    const rawData = question.content_data.chart_data
    let data = []
    
    // Detectar estructura y normalizar datos
    if (rawData.quarters && Array.isArray(rawData.quarters)) {
      // Nueva estructura (coches): { quarters: [{ name, cocheA, cocheB }] o { name, modelA, modelB }] }
      data = rawData.quarters.map(quarter => ({
        year: quarter.name,
        categories: [
          { 
            name: rawData.legend?.cocheA || rawData.legend?.modelA || 'Coche A', 
            value: quarter.cocheA || quarter.modelA || 0 
          },
          { 
            name: rawData.legend?.cocheB || rawData.legend?.modelB || 'Coche B', 
            value: quarter.cocheB || quarter.modelB || 0 
          }
        ]
      }))
    } else if (Array.isArray(rawData) || (typeof rawData === 'object' && Object.keys(rawData).every(k => !isNaN(k)))) {
      // Estructura antigua (frutas): array o objeto con índices numéricos
      const dataArray = Array.isArray(rawData) ? rawData : Object.values(rawData)
      data = dataArray
    } else {
      console.error('❌ Estructura de datos no reconocida:', rawData)
      return
    }

    const chartWidth = 600  // Más ancho para el Trimestre 4 completo
    const chartHeight = 350
    const margin = { top: 60, right: 50, bottom: 60, left: 60 }  // Más margen derecho
    const plotWidth = chartWidth - margin.left - margin.right
    const plotHeight = chartHeight - margin.top - margin.bottom

    // Encontrar valores máximos para escalado
    let maxValue = 0
    data.forEach(yearData => {
      if (yearData.categories && Array.isArray(yearData.categories)) {
        yearData.categories.forEach(category => {
          maxValue = Math.max(maxValue, category.value)
        })
      }
    })

    const barWidth = plotWidth / (data.length * 3 + 2) // Más espacio entre grupos
    const groupWidth = barWidth * 2.5  // Menos ancho de grupo para más espacio

    let bars = []
    let labels = []
    let legend = []

    // Colores dinámicos según tipo de gráfico
    let categoryColors = {}
    
    if (rawData.type === 'bar_chart' && rawData.title?.includes('COCHES')) {
      // Gráfico de coches - colores bien diferenciados
      categoryColors = {
        'Coche A': '#ff9800',   // Naranja 
        'Coche B': '#2196f3',   // Azul (bien diferenciado)
        'Modelo A': '#ff9800',  // Fallback para compatibilidad
        'Modelo B': '#2196f3'   // Fallback para compatibilidad
      }
    } else {
      // Gráfico de frutas - colores originales
      categoryColors = {
        'Frutas': '#e91e63',
        'Pescado': '#424242', 
        'Verdura': '#ff9800'
      }
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
            fill={categoryColors[category.name] || '#333333'}
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

    // Leyenda - solo mostrar categorías que realmente aparecen en los datos
    const usedCategories = new Set()
    data.forEach(yearData => {
      if (yearData.categories) {
        yearData.categories.forEach(cat => usedCategories.add(cat.name))
      }
    })
    const legendItems = Array.from(usedCategories)
    
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
          {rawData.title || question.content_data?.y_axis_label || 'Gráfico de Barras'}
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

  // Usar las explicaciones de la base de datos en lugar de hardcodeadas
  const explanationSections = question.content_data?.explanation_sections ? (
    <>
      {question.content_data.explanation_sections.map((section, index) => (
        <div key={index} className="bg-white p-4 rounded-lg border-l-4 border-blue-500 mb-4">
          <h5 className="font-semibold text-blue-800 mb-2">{section.title}</h5>
          <div className="text-gray-700 text-sm whitespace-pre-line">
            {section.content}
          </div>
        </div>
      ))}
    </>
  ) : (
    // Fallback para preguntas sin explanation_sections
    <div className="bg-white p-4 rounded-lg border-l-4 border-gray-500">
      <h5 className="font-semibold text-gray-800 mb-2">📊 Análisis del Gráfico</h5>
      <p className="text-gray-700 text-sm">
        Analiza los datos presentados en el gráfico para responder la pregunta.
      </p>
    </div>
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