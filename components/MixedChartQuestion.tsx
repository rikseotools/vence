'use client'
import React, { useState, useEffect } from 'react'
import ChartQuestion from './ChartQuestion'
import { type ChartBasedQuestionProps } from './psychometric-types'

export default function MixedChartQuestion({
  question,
  onAnswer,
  selectedAnswer,
  showResult,
  isAnswering,
  attemptCount = 0,
  verifiedCorrectAnswer = null,
  verifiedExplanation = null,
  hideAIChat = false
}: ChartBasedQuestionProps) {
  const [chartSvg, setChartSvg] = useState<React.ReactNode>(null)
  // Dark mode desactivado para psicotécnicos
  const isDarkMode = false
  
  // Constantes del gráfico
  const chartWidth = 1200
  const chartHeight = 800

  useEffect(() => {
    generateMixedChart()
  }, [question])

  // Dark mode desactivado para gráficos psicotécnicos

  const generateBarChart = (data: any, startX: number, startY: number, width: number, height: number) => {
    const margin = { top: 50, right: 60, bottom: 60, left: 100 }
    const plotWidth = width - margin.left - margin.right
    const plotHeight = height - margin.top - margin.bottom

    // Encontrar valor máximo
    let maxValue = 0
    data.bars.forEach((bar: any) => {
      bar.categories.forEach((cat: any) => {
        maxValue = Math.max(maxValue, cat.value)
      })
    })

    const barGroupWidth = plotWidth / data.bars.length
    const barWidth = barGroupWidth / (data.bars[0].categories.length + 1) // Ancho de cada barra individual
    const bars: React.ReactNode[] = []
    const labels: React.ReactNode[] = []
    const legendItems: React.ReactNode[] = []

    // Crear leyenda si hay múltiples categorías
    if (data.bars[0].categories.length > 1) {
      data.bars[0].categories.forEach((category: any, catIndex: number) => {
        legendItems.push(
          <g key={`legend-${catIndex}`}>
            <rect
              x={startX + margin.left + catIndex * 120}
              y={startY + 20}
              width={12}
              height={12}
              fill={category.color}
            />
            <text
              x={startX + margin.left + catIndex * 120 + 20}
              y={startY + 31}
              fontSize="12"
              fill="#444"
            >
              {category.name}
            </text>
          </g>
        )
      })
    }

    data.bars.forEach((bar: any, index: number) => {
      const groupX = startX + margin.left + index * barGroupWidth

      bar.categories.forEach((category: any, catIndex: number) => {
        const barX = groupX + (catIndex + 0.5) * barWidth
        const barHeight = (category.value / maxValue) * plotHeight
        const barY = startY + margin.top + plotHeight - barHeight

        // Barra individual
        bars.push(
          <rect
            key={`bar-${index}-${catIndex}`}
            x={barX}
            y={barY}
            width={barWidth * 0.8}
            height={barHeight}
            fill={category.color || '#ff9800'}
            rx="2"
            ry="2"
          />
        )

        // Valor encima de la barra
        bars.push(
          <text
            key={`text-${index}-${catIndex}`}
            x={barX + (barWidth * 0.8) / 2}
            y={barY - 4}
            textAnchor="middle"
            fontSize="11"
            fill="#333"
            fontWeight="600"
          >
            {category.value}
          </text>
        )
      })

      // Etiqueta del trimestre (centrada en el grupo)
      labels.push(
        <text
          key={`label-${index}`}
          x={groupX + barGroupWidth / 2}
          y={startY + height - 15}
          textAnchor="middle"
          fontSize="12"
          fill="#444"
          fontWeight="500"
        >
          {bar.name}
        </text>
      )
    })

    // Añadir eje Y con etiquetas
    const yAxisSteps = 5
    for (let i = 0; i <= yAxisSteps; i++) {
      const value = (maxValue / yAxisSteps) * i
      const y = startY + margin.top + plotHeight - (value / maxValue) * plotHeight
      
      labels.push(
        <text
          key={`y-axis-${i}`}
          x={startX + margin.left - 10}
          y={y + 4}
          textAnchor="end"
          fontSize="11"
          fill="#666"
        >
          {Math.round(value)}
        </text>
      )
    }

    return { bars: [...bars, ...legendItems], labels }
  }

  const generatePieChart = (data: any, centerX: number, centerY: number, radius: number, chartIndex = 0) => {
    const total = data.sectors.reduce((sum: number, sector: any) => sum + sector.value, 0)
    let currentAngle = -Math.PI / 2 // Empezar arriba
    const sectors: React.ReactNode[] = []
    const labels: React.ReactNode[] = []

    data.sectors.forEach((sector: any, index: number) => {
      const angle = (sector.value / total) * 2 * Math.PI
      const endAngle = currentAngle + angle

      // Calcular puntos del arco
      const x1 = centerX + radius * Math.cos(currentAngle)
      const y1 = centerY + radius * Math.sin(currentAngle)
      const x2 = centerX + radius * Math.cos(endAngle)
      const y2 = centerY + radius * Math.sin(endAngle)

      const largeArcFlag = angle > Math.PI ? 1 : 0

      const pathData = [
        `M ${centerX} ${centerY}`,
        `L ${x1} ${y1}`,
        `A ${radius} ${radius} 0 ${largeArcFlag} 1 ${x2} ${y2}`,
        'Z'
      ].join(' ')

      sectors.push(
        <path
          key={`sector-${chartIndex}-${index}`}
          d={pathData}
          fill={sector.color}
          stroke="#fff"
          strokeWidth="2"
        />
      )

      // Etiqueta del porcentaje
      const labelAngle = currentAngle + angle / 2
      const labelRadius = radius * 0.7
      const labelX = centerX + labelRadius * Math.cos(labelAngle)
      const labelY = centerY + labelRadius * Math.sin(labelAngle)

      labels.push(
        <text
          key={`label-${chartIndex}-${index}`}
          x={labelX}
          y={labelY}
          textAnchor="middle"
          fontSize="12"
          fill="#fff"
          fontWeight="600"
        >
          {sector.percentage}%
        </text>
      )

      currentAngle = endAngle
    })

    return { sectors, labels }
  }

  const generateMixedChart = () => {
    if (!question.content_data?.chart_data) return

    const data = question.content_data.chart_data

    const elements: React.ReactNode[] = []

    // Título principal
    elements.push(
      <text
        key="main-title"
        x={chartWidth / 2}
        y={40}
        textAnchor="middle"
        fontSize="22"
        fontWeight="600"
        fill="#2d3748"
      >
        {data.title || 'Ventas de coches'}
      </text>
    )

    // Gráfico de barras (parte superior)
    if (data.bar_chart) {
      const barChart = generateBarChart(data.bar_chart, 0, 100, chartWidth, 320)
      elements.push(...barChart.bars)
      elements.push(...barChart.labels)

      // Título del gráfico de barras
      elements.push(
        <text
          key="bar-title"
          x={chartWidth / 2}
          y={125}
          textAnchor="middle"
          fontSize="16"
          fontWeight="500"
          fill="#444"
        >
          {data.bar_chart.title}
        </text>
      )
    }

    // Gráficos de sectores (parte inferior)
    if (data.pie_charts) {
      data.pie_charts.forEach((pieData: any, index: number) => {
        const pieX = (index + 1) * (chartWidth / (data.pie_charts.length + 1))
        const pieY = 550
        const pieRadius = 80

        const pieChart = generatePieChart(pieData, pieX, pieY, pieRadius, index)
        elements.push(...pieChart.sectors)
        elements.push(...pieChart.labels)

        // Título del pie chart
        elements.push(
          <text
            key={`pie-title-${index}`}
            x={pieX}
            y={pieY - pieRadius - 15}
            textAnchor="middle"
            fontSize="13"
            fontWeight="500"
            fill="#444"
          >
            {pieData.title}
          </text>
        )

        // Leyenda del pie chart
        pieData.sectors.forEach((sector: any, sIndex: number) => {
          const legendY = pieY + pieRadius + 25 + (sIndex * 18)
          elements.push(
            <g key={`legend-${index}-${sIndex}`}>
              <rect
                x={pieX - 50}
                y={legendY - 6}
                width={10}
                height={10}
                fill={sector.color}
              />
              <text
                x={pieX - 35}
                y={legendY + 2}
                fontSize="11"
                fill="#444"
              >
                {sector.label}
              </text>
            </g>
          )
        })
      })
    }

    setChartSvg(
      <div className="w-full">
        <svg 
          width={chartWidth} 
          height={chartHeight} 
          className="w-full h-auto"
          viewBox={`0 0 ${chartWidth} ${chartHeight}`}
          preserveAspectRatio="xMidYMid meet"
          style={{ 
            width: '100%', 
            height: 'auto', 
            minHeight: '600px',
            maxHeight: '95vh'
          }}
        >
          {elements}
        </svg>
      </div>
    )
  }

  // Usar las explicaciones de la base de datos
  // Si hay explanation_sections, usarlas. Si no, dejar que ChartQuestion use verifiedExplanation
  const explanationSections = question.content_data?.explanation_sections ? (
    <>
      {question.content_data.explanation_sections.map((section: any, index: number) => (
        <div key={index} className="bg-white p-4 rounded-lg border-l-4 border-blue-500 mb-4">
          <h5 className="font-semibold text-blue-800 mb-2">{section.title}</h5>
          <div className="text-gray-700 text-sm whitespace-pre-line">
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
      chartComponent={chartSvg}
      explanationSections={explanationSections}
      attemptCount={attemptCount}
      verifiedCorrectAnswer={verifiedCorrectAnswer}
      verifiedExplanation={verifiedExplanation}
      hideAIChat={hideAIChat}
    />
  )
}