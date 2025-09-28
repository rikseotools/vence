// components/AdminActivityChart.js - Gráfico de actividad temporal para admin
'use client'
import { useState, useEffect } from 'react'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts'
import { useAuth } from '../contexts/AuthContext'

// Componente de ayuda para explicar las métricas
function MetricHelpTooltip({ metric, children }) {
  const [showTooltip, setShowTooltip] = useState(false)
  
  const explanations = {
    'usuariosTotales': {
      title: 'Usuarios totales',
      description: 'Número total de usuarios registrados hasta esa fecha. Crece acumulativamente.',
      color: 'text-blue-600'
    },
    'usuariosActivos': {
      title: 'Usuarios activos',
      description: 'Usuarios que completaron al menos 1 test durante esa semana específica.',
      color: 'text-green-600'
    },
    'tasaActividad': {
      title: '% Actividad',
      description: 'Porcentaje de usuarios activos sobre el total. Indica qué tan comprometidos están tus usuarios.',
      color: 'text-orange-600'
    },
    'engagement': {
      title: 'Tests por usuario activo',
      description: 'Cuántos tests hace cada usuario activo en promedio. Más alto = mayor compromiso y retención.',
      color: 'text-purple-600'
    }
  }

  const info = explanations[metric]
  if (!info) return children

  return (
    <div className="relative inline-block">
      <div
        onMouseEnter={() => setShowTooltip(true)}
        onMouseLeave={() => setShowTooltip(false)}
        className="cursor-help"
      >
        {children}
      </div>
      {showTooltip && (
        <div className="absolute z-50 w-64 p-3 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-xl -top-2 left-full ml-2">
          <div className={`font-medium ${info.color} mb-1`}>
            {info.title}
          </div>
          <div className="text-xs text-gray-600 dark:text-gray-400 leading-relaxed">
            {info.description}
          </div>
          <div className="absolute top-3 -left-1 w-2 h-2 bg-white dark:bg-gray-800 border-l border-t border-gray-200 dark:border-gray-700 transform rotate-45"></div>
        </div>
      )}
    </div>
  )
}

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
      console.log('📊 Cargando datos para gráfico de actividad...')

      // Generar últimas 4 semanas
      const weeks = []
      for (let i = 3; i >= 0; i--) {
        const endDate = new Date()
        endDate.setDate(endDate.getDate() - (i * 7))
        const startDate = new Date(endDate)
        startDate.setDate(startDate.getDate() - 6)
        
        weeks.push({
          label: `S${4-i}`,
          fullLabel: `${startDate.toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit' })} - ${endDate.toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit' })}`,
          startDate: startDate.toISOString(),
          endDate: endDate.toISOString()
        })
      }

      const data = []

      for (const week of weeks) {
        // 1. Total de usuarios registrados hasta esa fecha
        const { count: totalUsers, error: usersError } = await supabase
          .from('admin_users_with_roles')
          .select('user_id', { count: 'exact', head: true })
          .lte('user_created_at', week.endDate)

        if (usersError) throw usersError

        // 2. Usuarios activos en esa semana (que completaron al menos 1 test)
        const { data: activeTests, error: testsError } = await supabase
          .from('tests')
          .select('user_id')
          .eq('is_completed', true)
          .gte('completed_at', week.startDate)
          .lte('completed_at', week.endDate)

        if (testsError) throw testsError

        // Usuarios únicos que completaron tests
        const activeUsers = new Set(activeTests?.map(t => t.user_id) || []).size

        // 3. Calcular porcentajes
        const activityRate = totalUsers > 0 ? Math.round((activeUsers / totalUsers) * 100) : 0

        // 4. Tests completados en la semana
        const testsCompleted = activeTests?.length || 0


        data.push({
          semana: week.label,
          fecha: week.fullLabel,
          usuariosTotales: totalUsers || 0,
          usuariosActivos: activeUsers,
          tasaActividad: activityRate,
          testsCompletados: testsCompleted,
          // Métrica original: tests por usuario activo
          testsPorUsuario: activeUsers > 0 ? Math.round((testsCompleted / activeUsers) * 10) / 10 : 0
        })
      }

      console.log('📊 Datos del gráfico procesados:', data)
      setChartData(data)

    } catch (err) {
      console.error('❌ Error cargando datos del gráfico:', err)
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const CustomTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload
      return (
        <div className="bg-white dark:bg-gray-800 p-3 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg">
          <p className="text-sm font-medium text-gray-900 dark:text-white mb-2">{data.fecha}</p>
          <div className="space-y-1 text-xs">
            <p className="flex items-center">
              <span className="w-3 h-3 bg-blue-500 rounded-full mr-2"></span>
              Total: {data.usuariosTotales} usuarios
            </p>
            <p className="flex items-center">
              <span className="w-3 h-3 bg-green-500 rounded-full mr-2"></span>
              Activos: {data.usuariosActivos} usuarios
            </p>
            <p className="flex items-center">
              <span className="w-3 h-3 bg-orange-500 rounded-full mr-2"></span>
              Actividad: {data.tasaActividad}%
            </p>
            <p className="flex items-center">
              <span className="w-3 h-3 bg-purple-500 rounded-full mr-2"></span>
              Tests: {data.testsCompletados}
            </p>
            <p className="text-gray-600 dark:text-gray-400 pt-1 border-t border-gray-200 dark:border-gray-600">
              {data.testsPorUsuario} tests/usuario activo
            </p>
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
          📊 Evolución de Actividad
        </h3>
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-2"></div>
            <p className="text-gray-600 dark:text-gray-400 text-sm">Cargando gráfico...</p>
          </div>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow border p-4 sm:p-6">
        <h3 className="text-base sm:text-lg font-semibold text-gray-900 dark:text-white mb-4">
          📊 Evolución de Actividad
        </h3>
        <div className="flex items-center justify-center h-64">
          <div className="text-center text-red-600 dark:text-red-400">
            <div className="text-3xl mb-2">❌</div>
            <p className="text-sm">Error cargando gráfico</p>
            <p className="text-xs mt-1">{error}</p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow border p-4 sm:p-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-4">
        <h3 className="text-base sm:text-lg font-semibold text-gray-900 dark:text-white">
          📊 Evolución de Actividad
        </h3>
        <div className="text-xs text-gray-500 dark:text-gray-400 mt-1 sm:mt-0">
          Últimas 4 semanas
        </div>
      </div>
      
      <div className="h-80">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={chartData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#374151" opacity={0.3} />
            <XAxis 
              dataKey="semana" 
              tick={{ fontSize: 12, fill: '#6B7280' }}
              axisLine={false}
              tickLine={false}
            />
            <YAxis 
              yAxisId="left"
              orientation="left"
              tick={{ fontSize: 12, fill: '#6B7280' }}
              axisLine={false}
              tickLine={false}
            />
            <YAxis 
              yAxisId="right" 
              orientation="right"
              tick={{ fontSize: 12, fill: '#6B7280' }}
              axisLine={false}
              tickLine={false}
              domain={[0, 100]}
              tickFormatter={(value) => `${value}%`}
            />
            <Tooltip content={<CustomTooltip />} />
            <Legend 
              wrapperStyle={{ fontSize: '12px', paddingTop: '10px' }}
              iconType="circle"
            />
            
            {/* Líneas principales */}
            <Line
              yAxisId="left"
              type="monotone"
              dataKey="usuariosTotales"
              stroke="#3B82F6"
              strokeWidth={2}
              dot={{ fill: '#3B82F6', strokeWidth: 0, r: 4 }}
              name="Usuarios totales"
            />
            <Line
              yAxisId="left"
              type="monotone"
              dataKey="usuariosActivos"
              stroke="#10B981"
              strokeWidth={2}
              dot={{ fill: '#10B981', strokeWidth: 0, r: 4 }}
              name="Usuarios activos"
            />
            <Line
              yAxisId="right"
              type="monotone"
              dataKey="tasaActividad"
              stroke="#F59E0B"
              strokeWidth={2}
              dot={{ fill: '#F59E0B', strokeWidth: 0, r: 4 }}
              name="% Actividad"
              strokeDasharray="5 5"
            />
            <Line
              yAxisId="left"
              type="monotone"
              dataKey="testsPorUsuario"
              stroke="#8B5CF6"
              strokeWidth={2}
              dot={{ fill: '#8B5CF6', strokeWidth: 0, r: 4 }}
              name="Tests/usuario"
              strokeDasharray="3 3"
            />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Resumen rápido con ayuda */}
      <div className="mt-4 p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-medium text-gray-700 dark:text-gray-300">Resumen actual:</span>
          <span className="text-xs text-gray-500 dark:text-gray-400">Pasa el cursor sobre ? para ayuda</span>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
          <div className="text-center">
            <div className="font-semibold text-blue-600">
              {chartData[chartData.length - 1]?.usuariosTotales || 0}
            </div>
            <div className="text-gray-600 dark:text-gray-400 flex items-center justify-center gap-1">
              Total usuarios
              <MetricHelpTooltip metric="usuariosTotales">
                <span className="w-3 h-3 bg-blue-100 dark:bg-blue-900 text-blue-600 dark:text-blue-400 rounded-full text-xs flex items-center justify-center font-bold cursor-help">?</span>
              </MetricHelpTooltip>
            </div>
          </div>
          <div className="text-center">
            <div className="font-semibold text-green-600">
              {chartData[chartData.length - 1]?.usuariosActivos || 0}
            </div>
            <div className="text-gray-600 dark:text-gray-400 flex items-center justify-center gap-1">
              Activos S4
              <MetricHelpTooltip metric="usuariosActivos">
                <span className="w-3 h-3 bg-green-100 dark:bg-green-900 text-green-600 dark:text-green-400 rounded-full text-xs flex items-center justify-center font-bold cursor-help">?</span>
              </MetricHelpTooltip>
            </div>
          </div>
          <div className="text-center">
            <div className="font-semibold text-orange-600">
              {chartData[chartData.length - 1]?.tasaActividad || 0}%
            </div>
            <div className="text-gray-600 dark:text-gray-400 flex items-center justify-center gap-1">
              % Actividad
              <MetricHelpTooltip metric="tasaActividad">
                <span className="w-3 h-3 bg-orange-100 dark:bg-orange-900 text-orange-600 dark:text-orange-400 rounded-full text-xs flex items-center justify-center font-bold cursor-help">?</span>
              </MetricHelpTooltip>
            </div>
          </div>
          <div className="text-center">
            <div className="font-semibold text-purple-600">
              {chartData[chartData.length - 1]?.testsPorUsuario || 0}
            </div>
            <div className="text-gray-600 dark:text-gray-400 flex items-center justify-center gap-1">
              Tests/usuario
              <MetricHelpTooltip metric="engagement">
                <span className="w-3 h-3 bg-purple-100 dark:bg-purple-900 text-purple-600 dark:text-purple-400 rounded-full text-xs flex items-center justify-center font-bold cursor-help">?</span>
              </MetricHelpTooltip>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}