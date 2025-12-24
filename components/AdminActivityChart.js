// components/AdminActivityChart.js - Gráfico de usuarios activos por día
'use client'
import { useState, useEffect } from 'react'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts'
import { useAuth } from '../contexts/AuthContext'

export default function AdminActivityChart() {
  const { supabase } = useAuth()
  const [chartData, setChartData] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    if (supabase) {
      loadActivityData()
    }
  }, [supabase])

  const loadActivityData = async () => {
    try {
      setLoading(true)
      console.log('📊 Cargando usuarios activos por día...')

      // Generar últimos 14 días + 14 días anteriores para comparar
      const currentDays = []
      const previousDays = []

      for (let i = 13; i >= 0; i--) {
        // Período actual
        const currentDate = new Date()
        currentDate.setDate(currentDate.getDate() - i)
        currentDate.setHours(0, 0, 0, 0)
        const currentNextDay = new Date(currentDate)
        currentNextDay.setDate(currentNextDay.getDate() + 1)

        // Período anterior (14 días antes)
        const previousDate = new Date()
        previousDate.setDate(previousDate.getDate() - i - 14)
        previousDate.setHours(0, 0, 0, 0)
        const previousNextDay = new Date(previousDate)
        previousNextDay.setDate(previousNextDay.getDate() + 1)

        currentDays.push({
          label: currentDate.toLocaleDateString('es-ES', { weekday: 'short', day: 'numeric' }),
          weekday: currentDate.toLocaleDateString('es-ES', { weekday: 'short' }),
          startDate: currentDate.toISOString(),
          endDate: currentNextDay.toISOString()
        })

        previousDays.push({
          startDate: previousDate.toISOString(),
          endDate: previousNextDay.toISOString()
        })
      }

      const data = []

      for (let i = 0; i < currentDays.length; i++) {
        // Usuarios período actual
        const { data: currentTests, error: currentError } = await supabase
          .from('tests')
          .select('user_id')
          .gte('started_at', currentDays[i].startDate)
          .lt('started_at', currentDays[i].endDate)

        if (currentError) throw currentError

        // Usuarios período anterior
        const { data: previousTests, error: previousError } = await supabase
          .from('tests')
          .select('user_id')
          .gte('started_at', previousDays[i].startDate)
          .lt('started_at', previousDays[i].endDate)

        if (previousError) throw previousError

        const currentUsers = new Set(currentTests?.map(t => t.user_id) || []).size
        const previousUsers = new Set(previousTests?.map(t => t.user_id) || []).size

        data.push({
          dia: currentDays[i].label,
          weekday: currentDays[i].weekday,
          actual: currentUsers,
          anterior: previousUsers
        })
      }

      console.log('📊 Datos procesados:', data)
      setChartData(data)

    } catch (err) {
      console.error('❌ Error cargando datos:', err)
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const CustomTooltip = ({ active, payload }) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload
      const diff = data.actual - data.anterior
      const diffPercent = data.anterior > 0 ? Math.round((diff / data.anterior) * 100) : 0
      return (
        <div className="bg-white dark:bg-gray-800 p-3 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg">
          <p className="text-sm font-medium text-gray-900 dark:text-white mb-2">{data.dia}</p>
          <p className="text-sm"><span className="text-blue-600 font-bold">{data.actual}</span> usuarios (actual)</p>
          <p className="text-sm"><span className="text-gray-400 font-bold">{data.anterior}</span> usuarios (anterior)</p>
          {data.anterior > 0 && (
            <p className={`text-xs mt-1 ${diff >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              {diff >= 0 ? '↑' : '↓'} {Math.abs(diff)} ({diff >= 0 ? '+' : ''}{diffPercent}%)
            </p>
          )}
        </div>
      )
    }
    return null
  }

  if (loading) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow border p-4 sm:p-6">
        <h3 className="text-base sm:text-lg font-semibold text-gray-900 dark:text-white mb-4">
          👤 Usuarios Activos por Día
        </h3>
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-2"></div>
            <p className="text-gray-600 dark:text-gray-400 text-sm">Cargando...</p>
          </div>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow border p-4 sm:p-6">
        <h3 className="text-base sm:text-lg font-semibold text-gray-900 dark:text-white mb-4">
          👤 Usuarios Activos por Día
        </h3>
        <div className="flex items-center justify-center h-64">
          <div className="text-center text-red-600 dark:text-red-400">
            <div className="text-3xl mb-2">❌</div>
            <p className="text-sm">Error: {error}</p>
          </div>
        </div>
      </div>
    )
  }

  // Calcular tendencia (actual vs anterior)
  const totalActual = chartData.reduce((sum, d) => sum + d.actual, 0)
  const totalAnterior = chartData.reduce((sum, d) => sum + d.anterior, 0)
  const trend = totalAnterior > 0 ? Math.round(((totalActual - totalAnterior) / totalAnterior) * 100) : 0
  const avgDaily = chartData.length > 0 ? Math.round(totalActual / chartData.length) : 0

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow border p-4 sm:p-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-4">
        <h3 className="text-base sm:text-lg font-semibold text-gray-900 dark:text-white">
          👤 Usuarios Activos por Día
        </h3>
        <div className="flex items-center gap-3 mt-1 sm:mt-0">
          <span className="text-xs text-gray-500">Últimos 14 días</span>
          <span className={`text-xs font-medium px-2 py-1 rounded ${
            trend > 0 ? 'bg-green-100 text-green-700' :
            trend < 0 ? 'bg-red-100 text-red-700' :
            'bg-gray-100 text-gray-700'
          }`}>
            {trend > 0 ? '↑' : trend < 0 ? '↓' : '→'} {Math.abs(trend)}%
          </span>
        </div>
      </div>

      <div className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={chartData} margin={{ top: 20, right: 10, left: 0, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#374151" opacity={0.2} vertical={false} />
            <XAxis
              dataKey="dia"
              tick={{ fontSize: 10, fill: '#6B7280' }}
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              tick={{ fontSize: 11, fill: '#6B7280' }}
              axisLine={false}
              tickLine={false}
              allowDecimals={false}
            />
            <Tooltip content={<CustomTooltip />} />
            <Legend
              wrapperStyle={{ fontSize: '11px' }}
              iconType="line"
            />
            <Line
              type="monotone"
              dataKey="anterior"
              stroke="#D1D5DB"
              strokeWidth={2}
              strokeDasharray="5 5"
              dot={{ fill: '#D1D5DB', r: 3 }}
              name="14 días anteriores"
            />
            <Line
              type="monotone"
              dataKey="actual"
              stroke="#3B82F6"
              strokeWidth={2}
              dot={{ fill: '#3B82F6', r: 4 }}
              name="Últimos 14 días"
              label={{ position: 'top', fill: '#3B82F6', fontSize: 10 }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Resumen */}
      <div className="mt-4 flex items-center justify-center gap-6 text-sm">
        <div className="text-center">
          <div className="font-bold text-blue-600 text-lg">{avgDaily}</div>
          <div className="text-gray-500 text-xs">promedio/día</div>
        </div>
        <div className="text-center">
          <div className="font-bold text-green-600 text-lg">{chartData[chartData.length - 1]?.actual || 0}</div>
          <div className="text-gray-500 text-xs">hoy</div>
        </div>
        <div className="text-center">
          <div className="font-bold text-purple-600 text-lg">{Math.max(...chartData.map(d => d.actual), 0)}</div>
          <div className="text-gray-500 text-xs">máximo</div>
        </div>
      </div>
    </div>
  )
}
