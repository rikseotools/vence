// components/Statistics/DetailedCharts.js
'use client'

import { useState } from 'react'

const formatTime = (seconds) => {
  if (!seconds) return '0m'
  const hours = Math.floor(seconds / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  if (hours > 0) return `${hours}h ${minutes}m`
  return minutes > 0 ? `${minutes}m` : '0m'
}

const getScoreColor = (percentage) => {
  if (percentage >= 85) return '#10b981' // green-500
  if (percentage >= 70) return '#3b82f6' // blue-500
  if (percentage >= 50) return '#f59e0b' // amber-500
  return '#ef4444' // red-500
}

const getBarColor = (percentage) => {
  if (percentage >= 85) return 'bg-green-500'
  if (percentage >= 70) return 'bg-blue-500'
  if (percentage >= 50) return 'bg-amber-500'
  return 'bg-red-500'
}

// Componente para gráfico de barras vertical (temas, etc.)
const SimpleBarChart = ({ data, title, icon, color = 'purple', valueFormatter = (v) => v }) => {
  if (!data || data.length === 0) return null

  const maxValue = Math.max(...data.map(item => item.value))

  return (
    <div className="bg-white rounded-xl shadow-lg p-6">
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-lg font-bold text-gray-800">
          <span className="mr-2">{icon}</span>
          {title}
        </h3>
      </div>

      <div className="relative">
        {/* Eje Y con valores */}
        <div className="absolute left-0 top-0 h-56 w-12 flex flex-col justify-between text-xs text-gray-500 z-10">
          <span>{valueFormatter(maxValue)}</span>
          <span>{valueFormatter(Math.round(maxValue * 0.75))}</span>
          <span>{valueFormatter(Math.round(maxValue * 0.5))}</span>
          <span>{valueFormatter(Math.round(maxValue * 0.25))}</span>
          <span>0</span>
        </div>

        {/* Contenedor del gráfico con más altura */}
        <div className="ml-16">
          {/* Líneas de referencia */}
          <div className="absolute inset-0 h-56">
            {[0, 25, 50, 75, 100].map((percentage, index) => (
              <div 
                key={index}
                className="absolute w-full border-t border-gray-200"
                style={{ bottom: `${percentage * 2.24}px` }}
              ></div>
            ))}
          </div>

          {/* Área del gráfico con más altura para evitar superposición */}
          <div className="h-56 mb-6 relative z-10">
            <div className="flex items-end justify-center space-x-4 h-full">
              {data.map((item, index) => {
                const height = maxValue > 0 ? (item.value / maxValue) * 140 + 12 : 12
                
                return (
                  <div key={index} className="flex flex-col justify-end items-center h-full">
                    {/* Valor sobre la barra con más espacio arriba */}
                    <div className="text-sm font-bold text-gray-700 mb-4 bg-white px-3 py-2 rounded-lg shadow-md border">
                      {valueFormatter(item.value)}
                    </div>
                    
                    {/* Barra */}
                    <div 
                      className={`w-14 rounded-t-lg transition-all duration-500 hover:opacity-80 shadow-md ${
                        color === 'accuracy' ? getBarColor(item.value) : 
                        color === 'purple' ? 'bg-purple-500' :
                        color === 'blue' ? 'bg-blue-500' :
                        color === 'green' ? 'bg-green-500' :
                        'bg-gray-500'
                      }`}
                      style={{ height: `${height}px` }}
                    ></div>
                    
                    {/* Label */}
                    <div className="text-xs font-medium text-gray-700 text-center w-16 mt-3 bg-gray-50 px-2 py-2 rounded-lg border">
                      {item.label}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Eje X */}
          <div className="border-t-2 border-gray-400"></div>
        </div>

        {/* Etiquetas de ejes */}
        <div className="mt-4 text-center">
          <div className="text-sm font-medium text-gray-600">
            📊 Categorías
          </div>
        </div>
      </div>
    </div>
  )
}

// Componente para gráfico de barras horizontal (mobile friendly)
const HorizontalBarChart = ({ data, title, icon, color = 'blue', valueFormatter = (v) => v }) => {
  if (!data || data.length === 0) return null

  const maxValue = Math.max(...data.map(item => item.value))

  return (
    <div className="bg-white rounded-xl shadow-lg p-6">
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-lg font-bold text-gray-800">
          <span className="mr-2">{icon}</span>
          {title}
        </h3>
      </div>

      <div className="space-y-4">
        {data.map((item, index) => {
          const width = maxValue > 0 ? (item.value / maxValue) * 100 : 0
          
          return (
            <div key={index} className="flex items-center space-x-3">
              {/* Label de semana - responsive width */}
              <div className="w-24 sm:w-28 text-xs sm:text-sm font-medium text-gray-700 text-right bg-gray-50 px-2 py-2 rounded border">
                {item.label}
              </div>
              
              {/* Barra horizontal */}
              <div className="flex-1 relative">
                <div className="bg-gray-200 rounded-full h-8 relative overflow-hidden">
                  <div 
                    className={`h-full rounded-full transition-all duration-700 ${
                      color === 'blue' ? 'bg-blue-500' :
                      color === 'green' ? 'bg-green-500' :
                      color === 'purple' ? 'bg-purple-500' :
                      'bg-gray-500'
                    }`}
                    style={{ width: `${width}%` }}
                  ></div>
                  
                  {/* Valor dentro de la barra */}
                  <div className="absolute inset-0 flex items-center justify-center">
                    <span className="text-xs sm:text-sm font-bold text-white drop-shadow-lg">
                      {valueFormatter(item.value)}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {/* Etiquetas de ejes */}
      <div className="mt-4 text-center">
        <div className="text-sm font-medium text-gray-600">
          📊 {title.includes('Actividad') ? 'Actividad por semana' : 'Evolución semanal'}
        </div>
      </div>
    </div>
  )
}

// Componente para gráfico de barras verticales (para evolución de precisión)
const VerticalBarChart = ({ data, title, icon, color = 'green', valueFormatter = (v) => `${v}%` }) => {
  if (!data || data.length === 0) return null

  const maxValue = Math.max(...data.map(item => item.value))
  const minValue = Math.min(...data.map(item => item.value))

  return (
    <div className="bg-white rounded-xl shadow-lg p-6">
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-lg font-bold text-gray-800">
          <span className="mr-2">{icon}</span>
          {title}
        </h3>
      </div>

      <div className="relative">
        {/* Eje Y con valores */}
        <div className="absolute left-0 top-0 h-56 w-12 flex flex-col justify-between text-xs text-gray-500 z-10">
          <span>{valueFormatter(maxValue)}</span>
          <span>{valueFormatter(Math.round(maxValue * 0.75))}</span>
          <span>{valueFormatter(Math.round(maxValue * 0.5))}</span>
          <span>{valueFormatter(Math.round(maxValue * 0.25))}</span>
          <span>0%</span>
        </div>

        {/* Contenedor del gráfico */}
        <div className="ml-16">
          {/* Líneas de referencia */}
          <div className="absolute inset-0 h-56">
            {[0, 25, 50, 75, 100].map((percentage, index) => (
              <div 
                key={index}
                className="absolute w-full border-t border-gray-200"
                style={{ bottom: `${percentage * 2.24}px` }}
              ></div>
            ))}
          </div>

          {/* Área del gráfico */}
          <div className="h-56 mb-6 relative z-10">
            <div className="flex items-end justify-center space-x-6 h-full">
              {data.map((item, index) => {
                const height = maxValue > 0 ? (item.value / maxValue) * 140 + 12 : 12
                
                return (
                  <div key={index} className="flex flex-col justify-end items-center h-full">
                    {/* Valor sobre la barra */}
                    <div className="text-sm font-bold text-gray-700 mb-4 bg-white px-3 py-2 rounded-lg shadow-md border">
                      {valueFormatter(item.value)}
                    </div>
                    
                    {/* Barra con gradiente según precisión */}
                    <div 
                      className={`w-16 rounded-t-lg transition-all duration-500 hover:opacity-80 shadow-md ${
                        color === 'accuracy' ? getBarColor(item.value) : 
                        color === 'green' ? 'bg-green-500' :
                        color === 'blue' ? 'bg-blue-500' :
                        'bg-purple-500'
                      }`}
                      style={{ height: `${height}px` }}
                    ></div>
                    
                    {/* Label de semana */}
                    <div className="text-xs font-medium text-gray-700 text-center w-20 mt-3 bg-gray-50 px-2 py-2 rounded-lg border">
                      {item.label}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Eje X */}
          <div className="border-t-2 border-gray-400"></div>
        </div>

        {/* Etiquetas de ejes */}
        <div className="mt-4 text-center">
          <div className="text-sm font-medium text-gray-600">
            📅 Semanas (cronológico)
          </div>
        </div>
        <div className="absolute left-0 top-1/2 transform -rotate-90 text-sm font-medium text-gray-600">
          📈 % Precisión
        </div>
      </div>
    </div>
  )
}

// Gráfico de líneas: precisión últimos 7d vs 7d anteriores vs hace 1 mes
const AccuracyLineChart = ({ weeklyProgress }) => {
  if (!weeklyProgress || weeklyProgress.length === 0) return null

  const dayLabelsOrdered = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom']
  const now = new Date()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())

  // Encontrar el lunes de esta semana (si hoy es domingo, retroceder 6 días)
  const dayOfWeek = today.getDay() // 0=Dom, 1=Lun, ...
  const mondayOffset = dayOfWeek === 0 ? 6 : dayOfWeek - 1
  const monday = new Date(today.getTime() - mondayOffset * 86400000)

  // Generar Lun→Dom de la semana actual
  const buildDays = () => {
    const days = []
    for (let i = 0; i < 7; i++) {
      const d = new Date(monday.getTime() + i * 86400000)
      days.push({
        date: d.toISOString().split('T')[0],
        label: dayLabelsOrdered[i],
        isToday: d.getTime() === today.getTime(),
      })
    }
    return days
  }

  const days = buildDays()

  // Buscar precisión para un día específico en weeklyProgress
  const findAccuracy = (dateStr) => {
    const match = weeklyProgress.find(d => d.date === dateStr)
    return match && match.questions > 0 ? match.accuracy : null
  }

  // Esta semana (Lun→Dom)
  const last7 = days.map(d => findAccuracy(d.date))

  // Semana anterior (mismo Lun→Dom pero -7 días)
  const prevMonday = new Date(monday.getTime() - 7 * 86400000)
  const prev7 = days.map((_, i) => {
    const targetDate = new Date(prevMonday.getTime() + i * 86400000)
    return findAccuracy(targetDate.toISOString().split('T')[0])
  })

  // Hace 1 mes (misma semana pero -28 días)
  const monthMonday = new Date(monday.getTime() - 28 * 86400000)
  const month = days.map((_, i) => {
    const targetDate = new Date(monthMonday.getTime() + i * 86400000)
    return findAccuracy(targetDate.toISOString().split('T')[0])
  })

  // Promedios
  const avg = (arr) => {
    const valid = arr.filter(v => v !== null)
    return valid.length > 0 ? Math.round(valid.reduce((s, v) => s + v, 0) / valid.length) : null
  }
  const avgLast7 = avg(last7)
  const avgPrev7 = avg(prev7)
  const avgMonth = avg(month)

  // SVG dimensions
  const W = 340, H = 180, PAD_L = 38, PAD_R = 15, PAD_T = 15, PAD_B = 30
  const chartW = W - PAD_L - PAD_R
  const chartH = H - PAD_T - PAD_B

  // Y axis range
  const allVals = [...last7, ...prev7, ...month].filter(v => v !== null)
  const minY = allVals.length > 0 ? Math.max(0, Math.min(...allVals) - 10) : 0
  const maxY = allVals.length > 0 ? Math.min(100, Math.max(...allVals) + 10) : 100
  const rangeY = maxY - minY || 1

  const toX = (i) => PAD_L + (i / 6) * chartW
  const toY = (v) => PAD_T + chartH - ((v - minY) / rangeY) * chartH

  const makePath = (data, color, dashed = false) => {
    const points = data
      .map((v, i) => v !== null ? { x: toX(i), y: toY(v) } : null)
      .filter(Boolean)
    if (points.length < 2) return null
    const d = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ')
    return (
      <>
        <path d={d} fill="none" stroke={color} strokeWidth={dashed ? '1.5' : '2.5'} strokeLinecap="round" strokeLinejoin="round" strokeDasharray={dashed ? '6 4' : 'none'} opacity={dashed ? 0.6 : 1} />
        {points.map((p, i) => (
          <circle key={i} cx={p.x} cy={p.y} r={dashed ? '2.5' : '3.5'} fill={color} stroke="white" strokeWidth="1.5" opacity={dashed ? 0.7 : 1} />
        ))}
      </>
    )
  }

  const periods = [
    { label: 'Esta semana', avg: avgLast7, color: '#10b981' },
    { label: 'Semana anterior', avg: avgPrev7, color: '#3b82f6' },
    { label: 'Hace 4 semanas', avg: avgMonth, color: '#a855f7' },
  ]

  return (
    <div className="bg-white rounded-xl shadow-lg p-6">
      <h3 className="text-lg font-bold text-gray-800 mb-4">
        <span className="mr-2">📈</span>
        Evolución de tu Precisión
      </h3>

      {/* Leyenda con promedios */}
      <div className="flex flex-wrap gap-3 mb-4">
        {periods.map((p, i) => (
          <div key={i} className="flex items-center gap-1.5 text-xs">
            <div className="w-3 h-3 rounded-full" style={{ backgroundColor: p.color }} />
            <span className="text-gray-600">{p.label}</span>
            {p.avg !== null && (
              <span className="font-bold" style={{ color: p.color }}>{p.avg}%</span>
            )}
          </div>
        ))}
      </div>

      {/* SVG Chart */}
      <div className="w-full overflow-hidden">
        <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto">
          {/* Grid lines */}
          {[0, 0.25, 0.5, 0.75, 1].map((pct, i) => {
            const y = PAD_T + chartH * (1 - pct)
            const val = Math.round(minY + rangeY * pct)
            return (
              <g key={i}>
                <line x1={PAD_L} y1={y} x2={W - PAD_R} y2={y} stroke="#e5e7eb" strokeWidth="1" />
                <text x={PAD_L - 5} y={y + 4} textAnchor="end" fontSize="9" fill="#9ca3af">{val}%</text>
              </g>
            )
          })}

          {/* X labels: días de la semana */}
          {days.map((day, i) => (
            <g key={i}>
              <text
                x={toX(i)}
                y={H - 8}
                textAnchor="middle"
                fontSize="9"
                fill={day.isToday ? '#10b981' : '#6b7280'}
                fontWeight={day.isToday ? 'bold' : 'normal'}
              >
                {day.label}
              </text>
              {day.isToday && (
                <text x={toX(i)} y={H} textAnchor="middle" fontSize="7" fill="#10b981">hoy</text>
              )}
            </g>
          ))}

          {/* Lines: mes primero (detrás), luego prev7, luego last7 (delante) */}
          {makePath(month, '#a855f7', true)}
          {makePath(prev7, '#3b82f6', true)}
          {makePath(last7, '#10b981', false)}
        </svg>
      </div>

      {/* Trend indicator */}
      {avgLast7 !== null && avgPrev7 !== null && (
        <div className="mt-3 text-center text-sm">
          {avgLast7 > avgPrev7 ? (
            <span className="text-green-600 font-medium">↑ +{avgLast7 - avgPrev7}% vs semana anterior</span>
          ) : avgLast7 < avgPrev7 ? (
            <span className="text-red-500 font-medium">↓ {avgLast7 - avgPrev7}% vs semana anterior</span>
          ) : (
            <span className="text-gray-500 font-medium">= Igual que la semana anterior</span>
          )}
        </div>
      )}
    </div>
  )
}

export default function DetailedCharts({ weeklyProgress, difficultyBreakdown, themePerformance }) {
  const [showInfo, setShowInfo] = useState(false)

  // Preparar datos para gráfico de actividad semanal (preguntas respondidas)
  const weeklyActivityData = weeklyProgress?.slice(-7).map(item => {
    // Soporte para formato antiguo (week) y nuevo (day/date de la API)
    let label = item.week || item.day || ''
    if (label.includes?.('Esta semana')) {
      label = 'Esta semana'
    } else if (label.includes?.('Semana pasada')) {
      label = 'Semana pasada'
    } else if (label.includes?.('Hace 2')) {
      label = 'Hace 2 semanas'
    } else if (label.includes?.('Hace 3')) {
      label = 'Hace 3 semanas'
    }

    return {
      label: label,
      value: item.questionsAnswered || item.questions || 0
    }
  }) || []

  // Usar datos reales de precisión por día/semana
  const difficultyEvolutionData = weeklyProgress?.slice(-7).map((item) => {
    const accuracy = item.accuracy || 0

    // Soporte para formato antiguo (week) y nuevo (day de la API)
    let label = item.week || item.day || ''
    if (label.includes?.('Esta semana')) {
      label = 'Esta semana'
    } else if (label.includes?.('Semana pasada')) {
      label = 'Semana pasada'
    } else if (label.includes?.('Hace 2')) {
      label = 'Hace 2 semanas'
    } else if (label.includes?.('Hace 3')) {
      label = 'Hace 3 semanas'
    }

    return {
      label: label,
      value: accuracy
    }
  }) || []

  // Formatear nombre de tema (101 → "B2-T1", 1 → "B1-T1")
  const formatThemeLabel = (num) => {
    if (num >= 101 && num <= 112) return `B2-T${num - 100}`
    if (num >= 1 && num <= 16) return `B1-T${num}`
    return `T${num}`
  }

  // Preparar datos para top 5 temas
  const topThemes = themePerformance?.slice(0, 5).map(theme => ({
    label: formatThemeLabel(theme.theme),
    value: theme.accuracy
  })) || []

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-gray-800">📊 Gráficos Detallados</h2>
        <button 
          onClick={() => setShowInfo(!showInfo)}
          className="text-blue-600 hover:text-blue-800 transition-colors"
        >
          <span className="text-lg">ℹ️</span>
        </button>
      </div>

      {showInfo && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-sm">
          <p><strong>Gráficos evolutivos:</strong> Cada gráfico mide algo diferente para darte una visión completa:</p>
          <ul className="mt-2 ml-4 space-y-1">
            <li>• <strong>Actividad Semanal:</strong> Cuántas preguntas respondes cada semana</li>
            <li>• <strong>Evolución de Precisión:</strong> Tu % de aciertos mejorando con el tiempo</li>
            <li>• <strong>Top 5 Temas:</strong> Tus temas más fuertes para mantener el nivel</li>
          </ul>
          <p className="mt-2 text-xs text-blue-600">💡 Todos con barras horizontales optimizadas para móviles</p>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Gráfico de actividad semanal - BARRAS HORIZONTALES */}
        {weeklyActivityData.length > 0 && (
          <div>
            <HorizontalBarChart
              data={weeklyActivityData}
              title="Actividad Semanal"
              icon="📊"
              color="blue"
              valueFormatter={(v) => `${v} preguntas`}
            />
            <div className="mt-2 text-center">
              <p className="text-sm text-gray-600">
                📊 <strong>Total esta semana:</strong> {weeklyActivityData[weeklyActivityData.length-1]?.value || 0} preguntas respondidas
              </p>
            </div>
          </div>
        )}

        {/* Gráfico de líneas: Evolución de Precisión (3 períodos) */}
        {weeklyProgress?.length > 0 && (
          <AccuracyLineChart weeklyProgress={weeklyProgress} />
        )}

        {/* Gráfico de temas - optimizado para móviles */}
        {topThemes.length > 0 && (
          <div className="lg:col-span-2">
            <HorizontalBarChart
              data={topThemes}
              title="Top 5 Temas"
              icon="📚"
              color="purple"
              valueFormatter={(v) => `${v}%`}
            />
          </div>
        )}
      </div>
    </div>
  )
}