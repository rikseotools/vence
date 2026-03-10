// components/AdminActivityChart.tsx - Gráfico de usuarios activos por día (v2 API)
'use client'
import { useState, useEffect } from 'react'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts'

interface ActivityDay {
  dia: string
  weekday: string
  actual: number
  anterior: number
}

interface TooltipProps {
  active?: boolean
  payload?: Array<{ payload: ActivityDay }>
}

interface AdminActivityChartProps {
  data?: ActivityDay[] | null
}

export default function AdminActivityChart({ data: externalData }: AdminActivityChartProps) {
  const [chartData, setChartData] = useState<ActivityDay[]>([])
  const [loading, setLoading] = useState(!externalData)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (externalData) {
      setChartData(externalData)
      setLoading(false)
      return
    }

    // Fallback: fetch directo si no se pasan datos
    async function load() {
      try {
        const res = await fetch('/api/v2/admin/charts?days=14')
        if (!res.ok) throw new Error(`Error ${res.status}`)
        const json = await res.json()
        setChartData(json.activity?.data || [])
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err))
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [externalData])

  const CustomTooltip = ({ active, payload }: TooltipProps) => {
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
              {diff >= 0 ? '\u2191' : '\u2193'} {Math.abs(diff)} ({diff >= 0 ? '+' : ''}{diffPercent}%)
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
          Usuarios Activos por Dia
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
          Usuarios Activos por Dia
        </h3>
        <div className="flex items-center justify-center h-64">
          <div className="text-center text-red-600 dark:text-red-400">
            <p className="text-sm">Error: {error}</p>
          </div>
        </div>
      </div>
    )
  }

  const totalActual = chartData.reduce((sum, d) => sum + d.actual, 0)
  const totalAnterior = chartData.reduce((sum, d) => sum + d.anterior, 0)
  const trend = totalAnterior > 0 ? Math.round(((totalActual - totalAnterior) / totalAnterior) * 100) : 0
  const avgDaily = chartData.length > 0 ? Math.round(totalActual / chartData.length) : 0

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow border p-4 sm:p-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-4">
        <h3 className="text-base sm:text-lg font-semibold text-gray-900 dark:text-white">
          Usuarios Activos por Dia
        </h3>
        <div className="flex items-center gap-3 mt-1 sm:mt-0">
          <span className="text-xs text-gray-500">Ultimos 14 dias</span>
          <span className={`text-xs font-medium px-2 py-1 rounded ${
            trend > 0 ? 'bg-green-100 text-green-700' :
            trend < 0 ? 'bg-red-100 text-red-700' :
            'bg-gray-100 text-gray-700'
          }`}>
            {trend > 0 ? '\u2191' : trend < 0 ? '\u2193' : '\u2192'} {Math.abs(trend)}%
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
              name="14 dias anteriores"
            />
            <Line
              type="monotone"
              dataKey="actual"
              stroke="#3B82F6"
              strokeWidth={2}
              dot={{ fill: '#3B82F6', r: 4 }}
              name="Ultimos 14 dias"
              label={{ position: 'top', fill: '#3B82F6', fontSize: 10 }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>

      <div className="mt-4 flex items-center justify-center gap-6 text-sm">
        <div className="text-center">
          <div className="font-bold text-blue-600 text-lg">{avgDaily}</div>
          <div className="text-gray-500 text-xs">promedio/dia</div>
        </div>
        <div className="text-center">
          <div className="font-bold text-green-600 text-lg">{chartData[chartData.length - 1]?.actual || 0}</div>
          <div className="text-gray-500 text-xs">hoy</div>
        </div>
        <div className="text-center">
          <div className="font-bold text-purple-600 text-lg">{Math.max(...chartData.map(d => d.actual), 0)}</div>
          <div className="text-gray-500 text-xs">maximo</div>
        </div>
      </div>
    </div>
  )
}
