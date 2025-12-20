// components/admin/NotificationCharts.js - COMPONENTES DE GRÁFICOS PARA ADMIN
'use client'
import { useState, useEffect } from 'react'

// Componente de gráfico de barras simple (sin dependencias externas)
export function BarChart({ data, title, color = 'blue' }) {
  if (!data || data.length === 0) {
    return (
      <div className="bg-white p-6 rounded-lg shadow-sm border">
        <h3 className="text-lg font-semibold text-gray-800 mb-4">{title}</h3>
        <div className="text-gray-500 text-center py-8">No hay datos disponibles</div>
      </div>
    )
  }

  const maxValue = Math.max(...data.map(item => item.value))
  
  const colorClasses = {
    blue: 'bg-blue-500',
    green: 'bg-green-500',
    purple: 'bg-purple-500',
    red: 'bg-red-500',
    orange: 'bg-orange-500'
  }

  return (
    <div className="bg-white p-6 rounded-lg shadow-sm border">
      <h3 className="text-lg font-semibold text-gray-800 mb-4">{title}</h3>
      <div className="space-y-3">
        {data.map((item, index) => (
          <div key={index} className="flex items-center space-x-3">
            <div className="w-24 text-sm text-gray-600 truncate">
              {item.label}
            </div>
            <div className="flex-1 bg-gray-200 rounded-full h-4 relative">
              <div
                className={`h-4 rounded-full ${colorClasses[color]} transition-all duration-500`}
                style={{ width: `${(item.value / maxValue) * 100}%` }}
              />
              <span className="absolute right-2 top-0 text-xs text-gray-700 leading-4">
                {item.value}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

// Componente de gráfico de líneas simple
export function LineChart({ data, title, color = 'blue' }) {
  if (!data || data.length === 0) {
    return (
      <div className="bg-white p-6 rounded-lg shadow-sm border">
        <h3 className="text-lg font-semibold text-gray-800 mb-4">{title}</h3>
        <div className="text-gray-500 text-center py-8">No hay datos disponibles</div>
      </div>
    )
  }

  const maxValue = Math.max(...data.map(item => item.value))
  const minValue = Math.min(...data.map(item => item.value))
  const range = maxValue - minValue || 1

  const colorClasses = {
    blue: 'text-blue-500 border-blue-500',
    green: 'text-green-500 border-green-500',
    purple: 'text-purple-500 border-purple-500',
    red: 'text-red-500 border-red-500',
    orange: 'text-orange-500 border-orange-500'
  }

  return (
    <div className="bg-white p-6 rounded-lg shadow-sm border">
      <h3 className="text-lg font-semibold text-gray-800 mb-4">{title}</h3>
      <div className="relative h-64">
        <svg className="w-full h-full" viewBox="0 0 400 200">
          {/* Grid lines */}
          {[0, 1, 2, 3, 4].map(i => (
            <line
              key={i}
              x1="40"
              y1={20 + i * 40}
              x2="380"
              y2={20 + i * 40}
              stroke="#e5e7eb"
              strokeWidth="1"
            />
          ))}
          
          {/* Y-axis labels */}
          {[0, 1, 2, 3, 4].map(i => {
            const value = maxValue - (i * range / 4)
            return (
              <text
                key={i}
                x="35"
                y={25 + i * 40}
                className="text-xs fill-gray-500"
                textAnchor="end"
              >
                {Math.round(value)}
              </text>
            )
          })}
          
          {/* Line */}
          <polyline
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            className={colorClasses[color]}
            points={data.map((item, index) => {
              const x = 40 + (index * (340 / (data.length - 1)))
              const y = 180 - ((item.value - minValue) / range) * 160
              return `${x},${y}`
            }).join(' ')}
          />
          
          {/* Points */}
          {data.map((item, index) => {
            const x = 40 + (index * (340 / (data.length - 1)))
            const y = 180 - ((item.value - minValue) / range) * 160
            return (
              <circle
                key={index}
                cx={x}
                cy={y}
                r="4"
                className={colorClasses[color]}
                fill="currentColor"
              />
            )
          })}
        </svg>
        
        {/* X-axis labels */}
        <div className="flex justify-between mt-2 px-10">
          {data.map((item, index) => (
            <span key={index} className="text-xs text-gray-500">
              {item.label}
            </span>
          ))}
        </div>
      </div>
    </div>
  )
}

// Componente de gráfico de dona
export function DonutChart({ data, title, centerLabel }) {
  if (!data || data.length === 0) {
    return (
      <div className="bg-white p-6 rounded-lg shadow-sm border">
        <h3 className="text-lg font-semibold text-gray-800 mb-4">{title}</h3>
        <div className="text-gray-500 text-center py-8">No hay datos disponibles</div>
      </div>
    )
  }

  const total = data.reduce((sum, item) => sum + item.value, 0)
  const radius = 80
  const strokeWidth = 20
  const normalizedRadius = radius - strokeWidth * 2
  const circumference = normalizedRadius * 2 * Math.PI

  let cumulativePercentage = 0

  const colors = [
    '#3b82f6', // blue
    '#10b981', // green
    '#8b5cf6', // purple
    '#ef4444', // red
    '#f59e0b', // orange
    '#06b6d4', // cyan
    '#84cc16', // lime
    '#f97316'  // orange-500
  ]

  return (
    <div className="bg-white p-6 rounded-lg shadow-sm border">
      <h3 className="text-lg font-semibold text-gray-800 mb-4">{title}</h3>
      <div className="flex items-center justify-between">
        
        {/* Gráfico de dona */}
        <div className="relative">
          <svg
            height={radius * 2}
            width={radius * 2}
            className="transform -rotate-90"
          >
            {data.map((item, index) => {
              const percentage = (item.value / total) * 100
              const strokeDasharray = `${percentage * circumference / 100} ${circumference}`
              const strokeDashoffset = -cumulativePercentage * circumference / 100
              
              cumulativePercentage += percentage
              
              return (
                <circle
                  key={index}
                  stroke={colors[index % colors.length]}
                  fill="transparent"
                  strokeWidth={strokeWidth}
                  strokeDasharray={strokeDasharray}
                  strokeDashoffset={strokeDashoffset}
                  r={normalizedRadius}
                  cx={radius}
                  cy={radius}
                />
              )
            })}
          </svg>
          
          {/* Centro del gráfico */}
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="text-center">
              <div className="text-2xl font-bold text-gray-800">{total}</div>
              {centerLabel && (
                <div className="text-sm text-gray-500">{centerLabel}</div>
              )}
            </div>
          </div>
        </div>

        {/* Leyenda */}
        <div className="space-y-2 ml-6">
          {data.map((item, index) => (
            <div key={index} className="flex items-center space-x-2">
              <div
                className="w-3 h-3 rounded-full"
                style={{ backgroundColor: colors[index % colors.length] }}
              />
              <span className="text-sm text-gray-600">{item.label}</span>
              <span className="text-sm font-semibold text-gray-800">
                {item.value} ({((item.value / total) * 100).toFixed(1)}%)
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

// Componente de métricas con comparación
export function MetricCard({ 
  title, 
  value, 
  previousValue, 
  format = 'number',
  icon,
  color = 'blue' 
}) {
  const formatValue = (val) => {
    if (format === 'percentage') return `${val}%`
    if (format === 'currency') return `$${val}`
    return val?.toLocaleString() || 0
  }

  const calculateChange = () => {
    if (!previousValue || previousValue === 0) return null
    const change = ((value - previousValue) / previousValue) * 100
    return change
  }

  const change = calculateChange()
  const isPositive = change > 0
  const isNegative = change < 0

  const colorClasses = {
    blue: 'bg-blue-50 text-blue-600 border-blue-200',
    green: 'bg-green-50 text-green-600 border-green-200',
    purple: 'bg-purple-50 text-purple-600 border-purple-200',
    red: 'bg-red-50 text-red-600 border-red-200',
    orange: 'bg-orange-50 text-orange-600 border-orange-200'
  }

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
      <div className="flex items-center justify-between mb-4">
        {icon && (
          <div className={`p-3 rounded-lg ${colorClasses[color]}`}>
            <span className="text-2xl">{icon}</span>
          </div>
        )}
        {change !== null && (
          <div className={`flex items-center space-x-1 text-xs px-2 py-1 rounded-full ${
            isPositive ? 'bg-green-100 text-green-800' :
            isNegative ? 'bg-red-100 text-red-800' :
            'bg-gray-100 text-gray-800'
          }`}>
            <span>{isPositive ? '↗' : isNegative ? '↘' : '→'}</span>
            <span>{Math.abs(change).toFixed(1)}%</span>
          </div>
        )}
      </div>
      
      <div>
        <div className="text-3xl font-bold text-gray-900 mb-1">
          {formatValue(value)}
        </div>
        <div className="text-gray-600 font-medium mb-1">{title}</div>
        {previousValue && (
          <div className="text-sm text-gray-500">
            vs. {formatValue(previousValue)} anterior
          </div>
        )}
      </div>
    </div>
  )
}

// Componente de heatmap para horarios de actividad
export function ActivityHeatmap({ data, title }) {
  if (!data || data.length === 0) {
    return (
      <div className="bg-white p-6 rounded-lg shadow-sm border">
        <h3 className="text-lg font-semibold text-gray-800 mb-4">{title}</h3>
        <div className="text-gray-500 text-center py-8">No hay datos disponibles</div>
      </div>
    )
  }

  const days = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb']
  const hours = Array.from({ length: 24 }, (_, i) => i)
  
  const maxValue = Math.max(...data.map(item => item.value))

  const getIntensity = (value) => {
    if (!value || maxValue === 0) return 0
    return Math.min(4, Math.ceil((value / maxValue) * 4))
  }

  const intensityColors = [
    'bg-gray-100',     // 0 - sin actividad
    'bg-blue-200',     // 1 - baja
    'bg-blue-400',     // 2 - media
    'bg-blue-600',     // 3 - alta
    'bg-blue-800'      // 4 - muy alta
  ]

  return (
    <div className="bg-white p-6 rounded-lg shadow-sm border">
      <h3 className="text-lg font-semibold text-gray-800 mb-4">{title}</h3>
      
      <div className="overflow-x-auto">
        <div className="grid grid-cols-25 gap-1 text-xs">
          {/* Header con horas */}
          <div></div>
          {hours.map(hour => (
            <div key={hour} className="text-center text-gray-500 font-medium">
              {hour}
            </div>
          ))}
          
          {/* Filas por día */}
          {days.map((day, dayIndex) => (
            <React.Fragment key={day}>
              <div className="text-gray-500 font-medium py-1">
                {day}
              </div>
              {hours.map(hour => {
                const dataPoint = data.find(d => d.day === dayIndex && d.hour === hour)
                const intensity = getIntensity(dataPoint?.value)
                
                return (
                  <div
                    key={`${dayIndex}-${hour}`}
                    className={`w-4 h-4 rounded-sm ${intensityColors[intensity]} cursor-pointer`}
                    title={`${day} ${hour}:00 - ${dataPoint?.value || 0} eventos`}
                  />
                )
              })}
            </React.Fragment>
          ))}
        </div>
        
        {/* Leyenda */}
        <div className="flex items-center space-x-2 mt-4 text-xs text-gray-500">
          <span>Menos</span>
          {intensityColors.map((color, index) => (
            <div key={index} className={`w-3 h-3 rounded-sm ${color}`} />
          ))}
          <span>Más</span>
        </div>
      </div>
    </div>
  )
}

export default {
  BarChart,
  LineChart,
  DonutChart,
  MetricCard,
  ActivityHeatmap
}