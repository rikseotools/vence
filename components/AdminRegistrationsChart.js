// components/AdminRegistrationsChart.js - Gráfico de registros por día
'use client'
import { useState, useEffect } from 'react'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, Cell } from 'recharts'
import { useAuth } from '../contexts/AuthContext'

export default function AdminRegistrationsChart() {
  const { supabase } = useAuth()
  const [chartData, setChartData] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    if (supabase) {
      loadRegistrationData()
    }
  }, [supabase])

  const loadRegistrationData = async () => {
    try {
      setLoading(true)
      console.log('📊 Cargando registros por día...')

      // Obtener todos los usuarios con su fecha de registro y fuente
      const { data: users, error: usersError } = await supabase
        .from('admin_users_with_roles')
        .select('user_id, user_created_at, registration_source')

      if (usersError) throw usersError

      // Generar últimos 14 días (hora Madrid)
      const days = []
      for (let i = 13; i >= 0; i--) {
        const date = new Date()
        // Convertir a Madrid
        const madridDate = new Date(date.toLocaleString('en-US', { timeZone: 'Europe/Madrid' }))
        madridDate.setDate(madridDate.getDate() - i)
        madridDate.setHours(0, 0, 0, 0)

        const nextDay = new Date(madridDate)
        nextDay.setDate(nextDay.getDate() + 1)

        days.push({
          label: madridDate.toLocaleDateString('es-ES', { weekday: 'short', day: 'numeric' }),
          startDate: madridDate,
          endDate: nextDay,
          isToday: i === 0
        })
      }

      // Contar registros por día y fuente
      const data = days.map(day => {
        const dayUsers = users?.filter(u => {
          const userDate = new Date(u.user_created_at)
          return userDate >= day.startDate && userDate < day.endDate
        }) || []

        const organic = dayUsers.filter(u => u.registration_source === 'organic').length
        const google = dayUsers.filter(u => u.registration_source === 'google_ads').length
        const meta = dayUsers.filter(u => u.registration_source === 'meta_ads').length
        const other = dayUsers.filter(u => !u.registration_source || u.registration_source === 'unknown').length

        return {
          dia: day.label,
          total: dayUsers.length,
          organic,
          google,
          meta,
          other,
          isToday: day.isToday
        }
      })

      console.log('📊 Registros procesados:', data)
      setChartData(data)

    } catch (err) {
      console.error('❌ Error cargando registros:', err)
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const CustomTooltip = ({ active, payload }) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload
      return (
        <div className="bg-white dark:bg-gray-800 p-3 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg">
          <p className="text-sm font-medium text-gray-900 dark:text-white mb-2">{data.dia}</p>
          <p className="text-sm font-bold text-yellow-600 mb-1">{data.total} registros</p>
          <div className="text-xs space-y-0.5">
            <p><span className="text-green-600">🌱 {data.organic}</span> Orgánico</p>
            <p><span className="text-blue-600">💰 {data.google}</span> Google</p>
            <p><span className="text-purple-600">📘 {data.meta}</span> Meta</p>
            {data.other > 0 && <p><span className="text-gray-500">❓ {data.other}</span> Otros</p>}
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
          📝 Registros por Día
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
          📝 Registros por Día
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

  // Calcular estadísticas
  const totalRegistros = chartData.reduce((sum, d) => sum + d.total, 0)
  const avgDaily = chartData.length > 0 ? (totalRegistros / chartData.length).toFixed(1) : 0
  const maxDay = Math.max(...chartData.map(d => d.total), 0)
  const todayRegistros = chartData[chartData.length - 1]?.total || 0

  // Totales por fuente
  const totalOrganic = chartData.reduce((sum, d) => sum + d.organic, 0)
  const totalGoogle = chartData.reduce((sum, d) => sum + d.google, 0)
  const totalMeta = chartData.reduce((sum, d) => sum + d.meta, 0)

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow border p-4 sm:p-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-4">
        <h3 className="text-base sm:text-lg font-semibold text-gray-900 dark:text-white">
          📝 Registros por Día
        </h3>
        <div className="flex items-center gap-2 mt-1 sm:mt-0 text-xs">
          <span className="text-gray-500">Últimos 14 días</span>
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

      {/* Resumen */}
      <div className="mt-4 flex flex-wrap items-center justify-center gap-4 sm:gap-6 text-sm">
        <div className="text-center">
          <div className="font-bold text-yellow-600 text-lg">{avgDaily}</div>
          <div className="text-gray-500 text-xs">promedio/día</div>
        </div>
        <div className="text-center">
          <div className="font-bold text-orange-600 text-lg">{todayRegistros}</div>
          <div className="text-gray-500 text-xs">hoy</div>
        </div>
        <div className="text-center">
          <div className="font-bold text-amber-600 text-lg">{maxDay}</div>
          <div className="text-gray-500 text-xs">máximo</div>
        </div>
        <div className="h-8 w-px bg-gray-200 dark:bg-gray-700 hidden sm:block"></div>
        <div className="text-center">
          <div className="font-bold text-green-600">{totalOrganic}</div>
          <div className="text-gray-500 text-xs">🌱 orgánico</div>
        </div>
        <div className="text-center">
          <div className="font-bold text-blue-600">{totalGoogle}</div>
          <div className="text-gray-500 text-xs">💰 google</div>
        </div>
        <div className="text-center">
          <div className="font-bold text-purple-600">{totalMeta}</div>
          <div className="text-gray-500 text-xs">📘 meta</div>
        </div>
      </div>
    </div>
  )
}
