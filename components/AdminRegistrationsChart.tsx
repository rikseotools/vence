// components/AdminRegistrationsChart.tsx - Gráfico de registros por día (v2 API)
'use client'
import { useState, useEffect } from 'react'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts'

interface RegistrationDay {
  dia: string
  total: number
  organic: number
  google: number
  meta: number
  other: number
  isToday: boolean
}

interface TooltipProps {
  active?: boolean
  payload?: Array<{ payload: RegistrationDay }>
}

interface AdminRegistrationsChartProps {
  data?: RegistrationDay[] | null
}

export default function AdminRegistrationsChart({ data: externalData }: AdminRegistrationsChartProps) {
  const [chartData, setChartData] = useState<RegistrationDay[]>([])
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
        setChartData(json.registrations?.data || [])
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
      return (
        <div className="bg-white dark:bg-gray-800 p-3 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg">
          <p className="text-sm font-medium text-gray-900 dark:text-white mb-2">{data.dia}</p>
          <p className="text-sm font-bold text-yellow-600 mb-1">{data.total} registros</p>
          <div className="text-xs space-y-0.5">
            <p><span className="text-green-600">{data.organic}</span> Organico</p>
            <p><span className="text-blue-600">{data.google}</span> Google</p>
            <p><span className="text-purple-600">{data.meta}</span> Meta</p>
            {data.other > 0 && <p><span className="text-gray-500">{data.other}</span> Otros</p>}
          </div>
        </div>
      )
    }
    return null
  }

  if (loading) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow border p-4 sm:p-6">
        <h3 className="text-base sm:text-lg font-semibold text-gray-900 dark:text-white mb-4">
          Registros por Dia
        </h3>
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-yellow-600 mx-auto mb-2"></div>
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
          Registros por Dia
        </h3>
        <div className="flex items-center justify-center h-64">
          <div className="text-center text-red-600 dark:text-red-400">
            <p className="text-sm">Error: {error}</p>
          </div>
        </div>
      </div>
    )
  }

  const totalRegistros = chartData.reduce((sum, d) => sum + d.total, 0)
  const avgDaily = chartData.length > 0 ? (totalRegistros / chartData.length).toFixed(1) : '0'
  const maxDay = Math.max(...chartData.map(d => d.total), 0)
  const todayRegistros = chartData[chartData.length - 1]?.total || 0

  const totalOrganic = chartData.reduce((sum, d) => sum + d.organic, 0)
  const totalGoogle = chartData.reduce((sum, d) => sum + d.google, 0)
  const totalMeta = chartData.reduce((sum, d) => sum + d.meta, 0)

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow border p-4 sm:p-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-4">
        <h3 className="text-base sm:text-lg font-semibold text-gray-900 dark:text-white">
          Registros por Dia
        </h3>
        <div className="flex items-center gap-2 mt-1 sm:mt-0 text-xs">
          <span className="text-gray-500">Ultimos 14 dias</span>
          <span className="px-2 py-1 rounded bg-yellow-100 text-yellow-700 font-medium">
            {totalRegistros} total
          </span>
        </div>
      </div>

      <div className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={chartData} margin={{ top: 20, right: 10, left: 0, bottom: 5 }}>
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
            <Bar
              dataKey="total"
              radius={[4, 4, 0, 0]}
              maxBarSize={40}
            >
              {chartData.map((entry, index) => (
                <Cell
                  key={`cell-${index}`}
                  fill={entry.isToday ? '#F59E0B' : '#FCD34D'}
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="mt-4 flex flex-wrap items-center justify-center gap-4 sm:gap-6 text-sm">
        <div className="text-center">
          <div className="font-bold text-yellow-600 text-lg">{avgDaily}</div>
          <div className="text-gray-500 text-xs">promedio/dia</div>
        </div>
        <div className="text-center">
          <div className="font-bold text-orange-600 text-lg">{todayRegistros}</div>
          <div className="text-gray-500 text-xs">hoy</div>
        </div>
        <div className="text-center">
          <div className="font-bold text-amber-600 text-lg">{maxDay}</div>
          <div className="text-gray-500 text-xs">maximo</div>
        </div>
        <div className="h-8 w-px bg-gray-200 dark:bg-gray-700 hidden sm:block"></div>
        <div className="text-center">
          <div className="font-bold text-green-600">{totalOrganic}</div>
          <div className="text-gray-500 text-xs">organico</div>
        </div>
        <div className="text-center">
          <div className="font-bold text-blue-600">{totalGoogle}</div>
          <div className="text-gray-500 text-xs">google</div>
        </div>
        <div className="text-center">
          <div className="font-bold text-purple-600">{totalMeta}</div>
          <div className="text-gray-500 text-xs">meta</div>
        </div>
      </div>
    </div>
  )
}
