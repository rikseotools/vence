'use client'
import React, { useState, useEffect } from 'react'
import ChartQuestion from './ChartQuestion'
import { type ChartBasedQuestionProps } from './psychometric-types'

export default function LineChartQuestion({
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

  useEffect(() => {
    generateLineChart()
  }, [question])

  // Dark mode desactivado para gráficos psicotécnicos

  const generateLineChart = () => {
    if (!question.content_data?.age_groups) return

    const data = question.content_data
    const chartWidth = 700
    const chartHeight = 450
    const margin = { top: 120, right: 60, bottom: 80, left: 60 }
    const plotWidth = chartWidth - margin.left - margin.right
    const plotHeight = chartHeight - margin.top - margin.bottom

    // Preparar datos para el gráfico
    const categories: string[] = data.categories || ['Centros salud', 'Hospitales', 'Centros especialidades', 'Clínicas privadas']
    const ageGroups: any[] = data.age_groups

    // Encontrar valor máximo para escalado
    let maxValue = 0
    ageGroups.forEach((group: any) => {
      group.values.forEach((value: number) => {
        maxValue = Math.max(maxValue, value)
      })
    })

    // Configuración del gráfico
    const categorySpacing = plotWidth / (categories.length - 1)

    let elements: React.ReactNode[] = []

    // Colores dinámicos para cada grupo de edad
    const defaultColors = ['#4CAF50', '#FF9800', '#424242', '#E91E63', '#2196F3', '#9C27B0']
    const colors: Record<string, string> = {}
    ageGroups.forEach((ageGroup: any, index: number) => {
      colors[ageGroup.label] = defaultColors[index % defaultColors.length]
    })

    // Primero dibujar todas las líneas y puntos
    const allPoints: { x: number; y: number; value: number; groupIndex: number; categoryIndex: number; color: string }[] = []
    const allTextPositions: { x: number; y: number }[] = []

    ageGroups.forEach((ageGroup: any, groupIndex: number) => {
      const pathData: string[] = []

      ageGroup.values.forEach((value: number, categoryIndex: number) => {
        const x = margin.left + (categoryIndex * categorySpacing)
        const y = margin.top + plotHeight - ((value / maxValue) * plotHeight)
        
        allPoints.push({ x, y, value, groupIndex, categoryIndex, color: colors[ageGroup.label] })
        
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

    // Función para verificar si una posición está libre
    const isPositionFree = (x: number, y: number, minDistance = 20) => {
      // Verificar distancia con otros textos
      for (let pos of allTextPositions) {
        const distance = Math.sqrt(Math.pow(x - pos.x, 2) + Math.pow(y - pos.y, 2))
        if (distance < minDistance) return false
      }
      
      // Verificar distancia con líneas (puntos)
      for (let point of allPoints) {
        const distance = Math.sqrt(Math.pow(x - point.x, 2) + Math.pow(y - point.y, 2))
        if (distance < 15) return false // Más cerca de puntos no está permitido
      }
      
      return true
    }

    // Función para encontrar la mejor posición para el texto
    const findBestTextPosition = (pointX: number, pointY: number) => {
      const candidates = [
        { x: pointX, y: pointY - 15 },     // Arriba
        { x: pointX + 15, y: pointY - 8 }, // Derecha arriba
        { x: pointX - 15, y: pointY - 8 }, // Izquierda arriba
        { x: pointX + 20, y: pointY },     // Derecha
        { x: pointX - 20, y: pointY },     // Izquierda
        { x: pointX, y: pointY - 25 },     // Más arriba
        { x: pointX + 10, y: pointY - 20 }, // Diagonal derecha
        { x: pointX - 10, y: pointY - 20 }  // Diagonal izquierda
      ]
      
      for (let candidate of candidates) {
        if (isPositionFree(candidate.x, candidate.y)) {
          return candidate
        }
      }
      
      // Si no encuentra posición libre, usar la primera opción
      return candidates[0]
    }

    // Ahora colocar los textos en posiciones libres
    allPoints.forEach((point) => {
      const bestPos = findBestTextPosition(point.x, point.y)
      allTextPositions.push(bestPos)
      
      elements.push(
        <text
          key={`value-${point.groupIndex}-${point.categoryIndex}`}
          x={bestPos.x}
          y={bestPos.y}
          textAnchor="middle"
          fontSize="10"
          fill={point.color}
          fontWeight="bold"
          stroke="white"
          strokeWidth="2"
          paintOrder="stroke"
        >
          {point.value}
        </text>
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
          fill={isDarkMode ? "#f7fafc" : "#333"}
          fontWeight="bold"
        >
          {category}
        </text>
      )
    })

    // Leyenda
    ageGroups.forEach((ageGroup: any, index: number) => {
      const legendX = 60 + (index * 140)
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
          fill={isDarkMode ? "#f7fafc" : "#333"}
        >
          {question.content_data?.chart_title || 'Gráfico de líneas'}
        </text>
        
        {/* Subtítulo */}
        <text
          x={chartWidth / 2}
          y={35}
          textAnchor="middle"
          fontSize="10"
          fill={isDarkMode ? "#cbd5e0" : "#666"}
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
          fill={isDarkMode ? "#cbd5e0" : "#666"}
          transform={`rotate(-90, 20, ${chartHeight / 2})`}
        >
          {question.content_data?.y_axis_label || 'Número de personas'}
        </text>
      </svg>
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