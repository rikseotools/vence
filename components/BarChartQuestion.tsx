'use client'
import React, { useState, useEffect } from 'react'
import ChartQuestion from './ChartQuestion'
import { type ChartBasedQuestionProps } from './psychometric-types'

export default function BarChartQuestion({
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
  const [scale, setScale] = useState<number>(1)
  const [position, setPosition] = useState<{ x: number; y: number }>({ x: 0, y: 0 })
  const [lastTouchDistance, setLastTouchDistance] = useState<number>(0)
  const [isDragging, setIsDragging] = useState<boolean>(false)
  const [dragStart, setDragStart] = useState<{ x: number; y: number }>({ x: 0, y: 0 })
  // Dark mode desactivado para psicotécnicos
  const isDarkMode = false
  
  // Constantes del gráfico
  const chartWidth = 1200
  const chartHeight = 700

  useEffect(() => {
    generateBarChart()
  }, [question])

  // Dark mode desactivado para gráficos psicotécnicos

  // Funciones para gestos táctiles en el modal
  const getTouchDistance = (touch1: React.Touch, touch2: React.Touch): number => {
    return Math.sqrt(
      Math.pow(touch2.clientX - touch1.clientX, 2) + 
      Math.pow(touch2.clientY - touch1.clientY, 2)
    )
  }

  const handleTouchStart = (e: React.TouchEvent<HTMLDivElement>): void => {
    e.preventDefault()
    if (e.touches.length === 2) {
      // Pinch to zoom
      const distance = getTouchDistance(e.touches[0], e.touches[1])
      setLastTouchDistance(distance)
    } else if (e.touches.length === 1) {
      // Pan
      setIsDragging(true)
      setDragStart({
        x: e.touches[0].clientX - position.x,
        y: e.touches[0].clientY - position.y
      })
    }
  }

  const handleTouchMove = (e: React.TouchEvent<HTMLDivElement>): void => {
    e.preventDefault()
    if (e.touches.length === 2 && lastTouchDistance > 0) {
      // Pinch to zoom
      const distance = getTouchDistance(e.touches[0], e.touches[1])
      const scaleChange = distance / lastTouchDistance
      const newScale = Math.min(Math.max(scale * scaleChange, 0.5), 3)
      setScale(newScale)
      setLastTouchDistance(distance)
    } else if (e.touches.length === 1 && isDragging) {
      // Pan
      setPosition({
        x: e.touches[0].clientX - dragStart.x,
        y: e.touches[0].clientY - dragStart.y
      })
    }
  }

  const handleTouchEnd = (e: React.TouchEvent<HTMLDivElement>): void => {
    e.preventDefault()
    setIsDragging(false)
    setLastTouchDistance(0)
  }

  const generateBarChart = (): void => {
    if (!question.content_data?.chart_data) return

    const rawData = question.content_data.chart_data as any
    let data: any[] = []
    
    // Detectar estructura y normalizar datos
    if (rawData.quarters && Array.isArray(rawData.quarters)) {
      // Detectar automáticamente las claves de datos del primer quarter
      const firstQuarter = rawData.quarters[0]
      const dataKeys = Object.keys(firstQuarter).filter(key => key !== 'name')
      
      // Crear estructura normalizada dinámicamente
      data = rawData.quarters.map((quarter: any) => ({
        year: quarter.name,
        categories: dataKeys.map((key: string) => ({
          name: rawData.legend?.[key] || key, // Usar leyenda o clave directamente
          value: quarter[key] || 0
        }))
      }))
    } else if (Array.isArray(rawData) || (typeof rawData === 'object' && Object.keys(rawData).every((k: string) => !isNaN(Number(k))))) {
      // Estructura antigua (frutas): array o objeto con índices numéricos
      const dataArray = Array.isArray(rawData) ? rawData : Object.values(rawData)
      data = dataArray
    } else {
      console.error('❌ Estructura de datos no reconocida:', rawData)
      return
    }

    // Márgenes responsivos: mobile vs desktop
    const isMobile = typeof window !== 'undefined' && window.innerWidth < 768
    const margin = isMobile 
      ? { top: 90, right: 5, bottom: 8, left: 35 }    // Mobile: máximo espacio arriba
      : { top: 180, right: 30, bottom: 50, left: 60 } // Desktop: máximo espacio arriba
    const plotWidth = chartWidth - margin.left - margin.right
    const plotHeight = chartHeight - margin.top - margin.bottom

    // Encontrar valores máximos para escalado
    let maxValue = 0
    data.forEach((yearData: any) => {
      if (yearData.categories && Array.isArray(yearData.categories)) {
        yearData.categories.forEach((category: any) => {
          maxValue = Math.max(maxValue, category.value)
        })
      }
    })

    const groupCount = data.length
    const categoriesPerGroup = data[0]?.categories?.length || 2
    const groupSpacing = 60  // Más espacio entre grupos
    const barSpacing = 12    // Más espacio entre barras del mismo grupo
    
    const availableWidth = plotWidth - (groupSpacing * (groupCount - 1))
    const groupWidth = availableWidth / groupCount
    const barWidth = (groupWidth - (barSpacing * (categoriesPerGroup - 1))) / categoriesPerGroup

    let bars: React.ReactNode[] = []
    let labels: React.ReactNode[] = []
    let legend: React.ReactNode[] = []

    // Extraer colores directamente de los datos
    let categoryColors: Record<string, string> = {}
    
    // Construir mapeo de colores desde los datos
    data.forEach((yearData: any) => {
      if (yearData.categories) {
        yearData.categories.forEach((category: any) => {
          if (category.color && category.label) {
            categoryColors[category.label] = category.color
          } else if (category.color && category.name) {
            categoryColors[category.name] = category.color
          }
        })
      }
    })
    
    // Fallback para casos sin colores definidos - Sistema de colores adaptativos
    if (Object.keys(categoryColors).length === 0) {
      // Paleta de colores predefinida para gráficos de barras
      const defaultColors = ['#ff9800', '#2196f3', '#4caf50', '#f44336', '#9c27b0', '#ff5722']
      
      // Obtener todas las categorías únicas de los datos
      const allCategories = new Set<string>()
      data.forEach((yearData: any) => {
        if (yearData.categories) {
          yearData.categories.forEach((cat: any) => allCategories.add(cat.name))
        }
      })
      
      // Asignar colores automáticamente
      const categoriesArray = Array.from(allCategories) as string[]
      categoriesArray.forEach((category: string, index: number) => {
        categoryColors[category] = defaultColors[index % defaultColors.length]
      })
      
      // Si no hay categorías detectadas, usar fallback específico por título
      if (categoriesArray.length === 0) {
        if (rawData.title?.includes('COCHES')) {
          categoryColors = { 'Modelo A': '#ff9800', 'Modelo B': '#2196f3' }
        } else if (rawData.title?.includes('CHOCOLATINAS')) {
          categoryColors = { 'AÑO 2022': '#ff9800', 'AÑO 2023': '#2196f3' }
        } else {
          categoryColors = { 'Serie A': '#ff9800', 'Serie B': '#2196f3' }
        }
      }
    }

    // Generar barras
    data.forEach((yearData: any, yearIndex: number) => {
      const groupX = margin.left + (yearIndex * (groupWidth + groupSpacing))

      yearData.categories.forEach((category: any, catIndex: number) => {
        const barHeight = (category.value / maxValue) * plotHeight
        const barX = groupX + (catIndex * (barWidth + barSpacing))
        const barY = margin.top + plotHeight - barHeight

        // Gradiente y sombra para las barras
        bars.push(
          <defs key={`defs-${yearIndex}-${catIndex}`}>
            <linearGradient id={`gradient-${yearIndex}-${catIndex}`} x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor={categoryColors[category.label || category.name] || '#333333'} stopOpacity="1"/>
              <stop offset="100%" stopColor={categoryColors[category.label || category.name] || '#333333'} stopOpacity="0.7"/>
            </linearGradient>
            <filter id={`shadow-${yearIndex}-${catIndex}`}>
              <feDropShadow dx="2" dy="2" stdDeviation="2" floodOpacity="0.3"/>
            </filter>
          </defs>
        )

        bars.push(
          <rect
            key={`${yearIndex}-${catIndex}`}
            x={barX}
            y={barY}
            width={barWidth}
            height={barHeight}
            fill={`url(#gradient-${yearIndex}-${catIndex})`}
            filter={`url(#shadow-${yearIndex}-${catIndex})`}
            stroke="rgba(255,255,255,0.5)"
            strokeWidth="1"
            rx="3"
            ry="3"
          />
        )

        // Valores en las barras con mejor posicionamiento
        bars.push(
          <text
            key={`text-${yearIndex}-${catIndex}`}
            x={barX + barWidth / 2}
            y={barY - 8}
            textAnchor="middle"
            fontSize="18"
            fill="#333"
            fontWeight="600"
          >
            {category.value}
          </text>
        )
      })

      // Etiquetas de años con mejor posicionamiento
      labels.push(
        <text
          key={`year-${yearIndex}`}
          x={groupX + groupWidth / 2}
          y={margin.top + plotHeight + 25}
          textAnchor="middle"
          fontSize="16"
          fill="#444"
          fontWeight="600"
        >
          {yearData.year}
        </text>
      )
    })

    // Leyenda profesional centrada
    const usedCategories = new Set<string>()
    data.forEach((yearData: any) => {
      if (yearData.categories) {
        yearData.categories.forEach((cat: any) => usedCategories.add(cat.label || cat.name))
      }
    })
    const legendItems = Array.from(usedCategories) as string[]
    
    // Calcular ancho total de la leyenda para centrarla
    const legendItemWidth = 150  // Más espacio entre elementos
    const legendTotalWidth = legendItems.length * legendItemWidth
    const legendStartX = (chartWidth - legendTotalWidth) / 2
    
    legendItems.forEach((item: string, index: number) => {
      const legendX = legendStartX + (index * legendItemWidth)
      legend.push(
        <g key={`legend-${index}`}>
          <rect
            x={legendX}
            y={isMobile ? 65 : 85}
            width={20}
            height={20}
            fill={categoryColors[item]}
            rx="2"
            ry="2"
            stroke="rgba(0,0,0,0.1)"
            strokeWidth="1"
          />
          <text
            x={legendX + 26}
            y={isMobile ? 77 : 97}
            fontSize="20"
            fill="#444"
            fontWeight="500"
          >
            {item}
          </text>
        </g>
      )
    })

    // Eje Y con valores y grid lines
    let yAxisTicks: React.ReactNode[] = []
    const tickCount = 5
    for (let i = 0; i <= tickCount; i++) {
      const value = (maxValue / tickCount) * i
      const y = margin.top + plotHeight - (i / tickCount) * plotHeight
      
      yAxisTicks.push(
        <g key={`y-tick-${i}`}>
          {/* Grid line horizontal */}
          <line
            x1={margin.left}
            y1={y}
            x2={margin.left + plotWidth}
            y2={y}
            stroke="rgba(0,0,0,0.1)"
            strokeWidth="1"
            strokeDasharray={i === 0 ? "none" : "2,2"}
          />
          {/* Tick mark */}
          <line
            x1={margin.left - 6}
            y1={y}
            x2={margin.left}
            y2={y}
            stroke="#666"
            strokeWidth="1"
          />
          {/* Value label */}
          <text
            x={margin.left - 12}
            y={y + 4}
            textAnchor="end"
            fontSize="18"
            fill="#666"
          >
            {Math.round(value)}
          </text>
        </g>
      )
    }

    setChartSvg(
      <div
        className={`w-full ${isMobile ? 'touch-pan-x touch-pan-y' : ''}`}
        onTouchStart={isMobile ? handleTouchStart : undefined}
        onTouchMove={isMobile ? handleTouchMove : undefined}
        onTouchEnd={isMobile ? handleTouchEnd : undefined}
        style={{ touchAction: isMobile ? 'pan-x pan-y pinch-zoom' : 'auto' }}
      >
        <svg 
          width={chartWidth} 
          height={chartHeight} 
          className="w-full h-auto"
          viewBox={`0 0 ${chartWidth} ${chartHeight}`}
          preserveAspectRatio="xMidYMid meet"
          style={{ 
            width: '100%', 
            height: 'auto', 
            minHeight: isMobile ? '400px' : '600px',
            maxHeight: isMobile ? '70vh' : '95vh',
            transform: isMobile ? `translate(${position.x}px, ${position.y}px) scale(${scale})` : 'none',
            transformOrigin: 'center center',
            transition: isDragging ? 'none' : 'transform 0.1s ease-out'
          }}
        >
          {/* Definiciones para gradientes de barras */}
          <defs>
          </defs>
          
          {/* Título del gráfico profesional */}
          <text
            x={chartWidth / 2}
            y={isMobile ? 15 : 35}
            textAnchor="middle"
            fontSize="28"
            fontWeight="600"
            fill="#2d3748"
          >
            {rawData.title || question.content_data?.chart_title || 'Gráfico de Barras'}
          </text>
          
          {/* Leyenda */}
          {legend}
          
          {/* Grid y ejes */}
          {yAxisTicks}
          
          {/* Ejes principales */}
          <line
            x1={margin.left}
            y1={margin.top}
            x2={margin.left}
            y2={margin.top + plotHeight}
            stroke="#4a5568"
            strokeWidth="2"
          />
          <line
            x1={margin.left}
            y1={margin.top + plotHeight}
            x2={margin.left + plotWidth}
            y2={margin.top + plotHeight}
            stroke="#4a5568"
            strokeWidth="2"
          />
          
          {/* Barras */}
          {bars}
          
          {/* Etiquetas de años */}
          {labels}
          
          {/* Etiqueta del eje Y */}
          <text
            x={isMobile ? 12 : 30}
            y={margin.top + plotHeight / 2}
            textAnchor="middle"
            fontSize="20"
            fill="#666"
            transform={`rotate(-90, ${isMobile ? 12 : 30}, ${margin.top + plotHeight / 2})`}
          >
            {question.content_data?.y_axis_label || 'Kg/mes'}
          </text>
          
          {/* Etiqueta del eje X */}
          <text
            x={chartWidth / 2}
            y={chartHeight - (isMobile ? 2 : 20)}
            textAnchor="middle"
            fontSize="20"
            fill="#666"
            fontWeight="500"
          >
            {question.content_data?.x_axis_label || 'Años'}
          </text>
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
  ) : null

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