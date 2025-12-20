// components/Admin/PWAStatsReal.js - ESTADÍSTICAS PWA REALES (nuevo archivo)
'use client'
import { useState, useEffect } from 'react'
import { useAuth } from '@/contexts/AuthContext'

export default function PWAStatsReal() {
  const { supabase } = useAuth()
  const [stats, setStats] = useState({
    loading: true,
    tablesExist: false,
    error: null
  })

  useEffect(() => {
    if (supabase) {
      checkPWATables()
    }
  }, [supabase])

  const checkPWATables = async () => {
    try {
      // Intentar acceder a la tabla pwa_events
      const { data, error } = await supabase
        .from('pwa_events')
        .select('count')
        .limit(1)

      if (error) {
        if (error.message?.includes('relation') && error.message?.includes('does not exist')) {
          setStats({
            loading: false,
            tablesExist: false,
            error: null
          })
        } else {
          setStats({
            loading: false,
            tablesExist: false,
            error: error.message
          })
        }
      } else {
        // Las tablas existen, cargar estadísticas reales
        loadRealStats()
      }
    } catch (error) {
      setStats({
        loading: false,
        tablesExist: false,
        error: error.message
      })
    }
  }

  const loadRealStats = async () => {
    try {
      console.log('📱 Cargando estadísticas PWA reales...')
      
      // Consultas paralelas para estadísticas PWA reales
      const [
        installsResult,
        promptsResult, 
        sessionsResult,
        activePWAResult
      ] = await Promise.all([
        // Total instalaciones PWA
        supabase
          .from('pwa_events')
          .select('id, created_at')
          .eq('event_type', 'pwa_installed'),

        // Prompts de instalación mostrados
        supabase
          .from('pwa_events')
          .select('id')
          .eq('event_type', 'install_prompt_shown'),

        // Sesiones recientes (últimos 7 días)
        supabase
          .from('pwa_sessions')
          .select('session_duration_minutes, is_standalone, user_id')
          .gte('session_start', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()),

        // Usuarios únicos que han usado PWA (últimos 30 días)
        supabase
          .from('pwa_sessions')
          .select('user_id')
          .eq('is_standalone', true)
          .gte('session_start', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString())
      ])

      // Verificar si tenemos datos reales o necesitamos mostrar datos sintéticos
      const hasRealData = installsResult.data && installsResult.data.length > 0

      if (hasRealData) {
        // Procesar resultados reales
        const totalInstalls = installsResult.data?.length || 0
        const totalPrompts = promptsResult.data?.length || 0
        const conversionRate = totalPrompts > 0 ? ((totalInstalls / totalPrompts) * 100).toFixed(1) : '0'

        const sessions = sessionsResult.data || []
        const recentSessions = sessions.length
        
        // Calcular duración promedio
        const sessionsWithDuration = sessions.filter(s => s.session_duration_minutes && s.session_duration_minutes > 0)
        const avgDuration = sessionsWithDuration.length > 0 
          ? (sessionsWithDuration.reduce((sum, s) => sum + s.session_duration_minutes, 0) / sessionsWithDuration.length).toFixed(1)
          : '0'

        // Sesiones PWA vs Web
        const standaloneSessions = sessions.filter(s => s.is_standalone).length
        const webSessions = sessions.filter(s => !s.is_standalone).length

        // Usuarios únicos con PWA
        const uniquePWAUsers = new Set(activePWAResult.data?.map(s => s.user_id) || []).size

        // Fecha de primera instalación
        const firstInstall = installsResult.data?.length > 0 
          ? new Date(Math.min(...installsResult.data.map(i => new Date(i.created_at))))
          : null

        console.log('📊 Estadísticas PWA reales cargadas:', {
          totalInstalls,
          totalPrompts, 
          conversionRate,
          recentSessions,
          avgDuration,
          uniquePWAUsers
        })

        setStats({
          loading: false,
          tablesExist: true,
          error: null,
          totalInstalls,
          activePWAUsers: uniquePWAUsers,
          installPrompts: totalPrompts,
          conversionRate: `${conversionRate}%`,
          recentSessions,
          avgSessionDuration: `${avgDuration} min`,
          standaloneUsage: standaloneSessions,
          webUsage: webSessions,
          firstInstallDate: firstInstall ? firstInstall.toLocaleDateString('es-ES') : 'N/A'
        })
      } else {
        // No hay datos reales todavía
        console.log('📊 No hay datos PWA reales todavía')
        
        setStats({
          loading: false,
          tablesExist: true,
          error: null,
          totalInstalls: 0,
          activePWAUsers: 0,
          installPrompts: 0,
          conversionRate: '0%',
          recentSessions: 0,
          avgSessionDuration: '0 min',
          standaloneUsage: 0,
          webUsage: 0,
          firstInstallDate: 'N/A',
          noDataYet: true // Flag para indicar que no hay datos
        })
      }
    } catch (error) {
      console.error('Error loading PWA stats:', error)
      setStats({
        loading: false,
        tablesExist: true,
        error: error.message
      })
    }
  }

  if (stats.loading) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
        <div className="flex items-center space-x-2">
          <span className="text-2xl">📱</span>
          <h3 className="text-lg font-bold text-gray-900 dark:text-white">
            PWA Statistics (Real Data)
          </h3>
          <div className="animate-spin h-4 w-4 border-2 border-blue-500 border-t-transparent rounded-full"></div>
        </div>
      </div>
    )
  }

  if (!stats.tablesExist) {
    return (
      <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-6">
        <div className="flex items-center space-x-2 mb-4">
          <span className="text-2xl">⚠️</span>
          <h3 className="text-lg font-bold text-amber-800 dark:text-amber-200">
            PWA Tracking Not Set Up
          </h3>
        </div>
        <div className="space-y-2 text-sm">
          <p className="text-amber-700 dark:text-amber-300">
            Para ver estadísticas PWA reales, necesitas crear las tablas de tracking:
          </p>
          <div className="bg-amber-100 dark:bg-amber-800/50 p-3 rounded font-mono text-xs">
            <p><strong>1.</strong> Ir a Supabase SQL Editor</p>
            <p><strong>2.</strong> Ejecutar: <code>database/migrations/create_pwa_tracking_tables.sql</code></p>
            <p><strong>3.</strong> Recargar esta página</p>
          </div>
          <div className="mt-4 p-3 bg-blue-50 dark:bg-blue-900/20 rounded text-xs">
            <p className="font-medium text-blue-800 dark:text-blue-200">📋 Mientras tanto:</p>
            <p className="text-blue-700 dark:text-blue-300">
              El tracking PWA ya está implementado y funcionando. Solo necesitas crear las tablas 
              para ver los datos reales en lugar de estimaciones.
            </p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow">
      <div className="p-6">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center space-x-2">
            <span className="text-2xl">📱</span>
            <h3 className="text-lg font-bold text-gray-900 dark:text-white">
              PWA Statistics (Real Data)
            </h3>
          </div>
          <button
            onClick={checkPWATables}
            className="text-sm px-3 py-1 bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 rounded hover:bg-blue-200 dark:hover:bg-blue-800"
          >
            🔄 Refresh
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          {/* Instalaciones Totales */}
          <div className="bg-green-50 dark:bg-green-900/20 p-4 rounded-lg">
            <div className="text-green-800 dark:text-green-200">
              <h4 className="text-sm font-medium">Total PWA Installs</h4>
              <p className="text-2xl font-bold">{stats.totalInstalls}</p>
              <p className="text-xs opacity-75">Since {stats.firstInstallDate}</p>
            </div>
          </div>

          {/* Usuarios PWA Activos */}
          <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg">
            <div className="text-blue-800 dark:text-blue-200">
              <h4 className="text-sm font-medium">Active PWA Users</h4>
              <p className="text-2xl font-bold">{stats.activePWAUsers}</p>
              <p className="text-xs opacity-75">Last 30 days</p>
            </div>
          </div>

          {/* Tasa de Conversión */}
          <div className="bg-purple-50 dark:bg-purple-900/20 p-4 rounded-lg">
            <div className="text-purple-800 dark:text-purple-200">
              <h4 className="text-sm font-medium">Install Conversion</h4>
              <p className="text-2xl font-bold">{stats.conversionRate}</p>
              <p className="text-xs opacity-75">{stats.installPrompts} prompts shown</p>
            </div>
          </div>

          {/* Sesiones Recientes */}
          <div className="bg-orange-50 dark:bg-orange-900/20 p-4 rounded-lg">
            <div className="text-orange-800 dark:text-orange-200">
              <h4 className="text-sm font-medium">Recent Sessions</h4>
              <p className="text-2xl font-bold">{stats.recentSessions}</p>
              <p className="text-xs opacity-75">Last 7 days</p>
            </div>
          </div>
        </div>

        {/* Métricas de Uso */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-gray-50 dark:bg-gray-700 p-4 rounded-lg">
            <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Avg Session Duration
            </h4>
            <p className="text-xl font-bold text-gray-900 dark:text-white">
              {stats.avgSessionDuration}
            </p>
          </div>

          <div className="bg-gray-50 dark:bg-gray-700 p-4 rounded-lg">
            <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              PWA Sessions
            </h4>
            <p className="text-xl font-bold text-gray-900 dark:text-white">
              {stats.standaloneUsage}
            </p>
          </div>

          <div className="bg-gray-50 dark:bg-gray-700 p-4 rounded-lg">
            <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Web Sessions
            </h4>
            <p className="text-xl font-bold text-gray-900 dark:text-white">
              {stats.webUsage}
            </p>
          </div>
        </div>

        {stats.error && (
          <div className="mt-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded">
            <p className="text-red-800 dark:text-red-200 text-sm">
              Error: {stats.error}
            </p>
          </div>
        )}
        
        {stats.noDataYet ? (
          <div className="mt-4 p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded">
            <p className="text-blue-800 dark:text-blue-200 text-sm">
              📊 <strong>No hay datos todavía:</strong> El tracking está activo. Los datos aparecerán cuando los usuarios instalen y usen la PWA.
            </p>
          </div>
        ) : (
          <div className="mt-4 p-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded">
            <p className="text-green-800 dark:text-green-200 text-sm">
              ✅ <strong>PWA Tracking Active:</strong> Mostrando datos reales de la base de datos
            </p>
          </div>
        )}
      </div>
    </div>
  )
}