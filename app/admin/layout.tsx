// app/admin/layout.tsx - Layout base para área administrativa
'use client'
import Link from 'next/link'
import { useState, useEffect, useCallback } from 'react'
import { adminFetch } from '@/lib/api/adminFetch'
import ProtectedRoute from '@/components/Admin/ProtectedRoute'
import { useAdminNotifications } from '@/hooks/useAdminNotifications'
import { useLawChanges } from '@/hooks/useLawChanges'
import { getAuthHeaders } from '@/lib/api/authHeaders'

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const adminNotifications = useAdminNotifications(true)
  const { hasUnreviewedChanges } = useLawChanges()
  const [oepSignals, setOepSignals] = useState({ pending: 0, critical: 0, discovered: 0 })
  const [competidorChanges, setCompetidorChanges] = useState(0)
  const [rolloverCount, setRolloverCount] = useState(0)
  const [radarContenido, setRadarContenido] = useState(0)
  const [contenidoAlerts, setContenidoAlerts] = useState(0)
  const [scopeVerifyAlerts, setScopeVerifyAlerts] = useState(0)

  const checkOepSignals = useCallback(async () => {
    try {
      const authHeaders = await getAuthHeaders()
      if (!authHeaders['Authorization']) return
      const res = await adminFetch('/api/admin/oep-signals/pending-count', {
        headers: authHeaders,
      })
      const json = await res.json()
      if (json.success) {
        setOepSignals({ pending: json.pendingCount ?? 0, critical: json.criticalCount ?? 0, discovered: json.discoveredCount ?? 0 })
      }
    } catch {}
  }, [])

  useEffect(() => {
    const delay = setTimeout(checkOepSignals, 10000)
    const interval = setInterval(checkOepSignals, 300000)
    return () => { clearTimeout(delay); clearInterval(interval) }
  }, [checkOepSignals])

  const checkCompetidorChanges = useCallback(async () => {
    try {
      const authHeaders = await getAuthHeaders()
      if (!authHeaders['Authorization']) return
      const res = await adminFetch('/api/admin/competidores/changes-count', { headers: authHeaders })
      const json = await res.json()
      if (json.success) setCompetidorChanges(json.changesCount ?? 0)
    } catch {}
  }, [])

  useEffect(() => {
    const delay = setTimeout(checkCompetidorChanges, 12000)
    const interval = setInterval(checkCompetidorChanges, 300000)
    return () => { clearTimeout(delay); clearInterval(interval) }
  }, [checkCompetidorChanges])

  const checkRadarContenido = useCallback(async () => {
    try {
      const authHeaders = await getAuthHeaders()
      if (!authHeaders['Authorization']) return
      const res = await adminFetch('/api/admin/radar-contenido/count', { headers: authHeaders })
      const json = await res.json()
      if (json.success) setRadarContenido(json.count ?? 0)
    } catch {}
  }, [])

  useEffect(() => {
    const delay = setTimeout(checkRadarContenido, 14000)
    const interval = setInterval(checkRadarContenido, 300000)
    return () => { clearTimeout(delay); clearInterval(interval) }
  }, [checkRadarContenido])

  const checkContenido = useCallback(async () => {
    try {
      const authHeaders = await getAuthHeaders()
      if (!authHeaders['Authorization']) return
      const res = await adminFetch('/api/admin/contenido/count', { headers: authHeaders })
      const json = await res.json()
      if (json.success) setContenidoAlerts(json.count ?? 0)
    } catch {}
  }, [])

  useEffect(() => {
    const delay = setTimeout(checkContenido, 16000)
    const interval = setInterval(checkContenido, 300000)
    return () => { clearTimeout(delay); clearInterval(interval) }
  }, [checkContenido])

  const checkScopeVerify = useCallback(async () => {
    try {
      const authHeaders = await getAuthHeaders()
      if (!authHeaders['Authorization']) return
      const res = await adminFetch('/api/admin/scope-verification/count', { headers: authHeaders })
      const json = await res.json()
      if (json.success) setScopeVerifyAlerts(json.count ?? 0)
    } catch {}
  }, [])

  useEffect(() => {
    const delay = setTimeout(checkScopeVerify, 18000)
    const interval = setInterval(checkScopeVerify, 300000)
    return () => { clearTimeout(delay); clearInterval(interval) }
  }, [checkScopeVerify])

  const checkRollover = useCallback(async () => {
    try {
      const authHeaders = await getAuthHeaders()
      if (!authHeaders['Authorization']) return
      const res = await adminFetch('/api/admin/oposiciones/rollover-pending', { headers: authHeaders })
      const json = await res.json()
      if (json.success) setRolloverCount(json.count ?? 0)
    } catch {}
  }, [])

  useEffect(() => {
    const delay = setTimeout(checkRollover, 14000)
    const interval = setInterval(checkRollover, 600000)
    return () => { clearTimeout(delay); clearInterval(interval) }
  }, [checkRollover])

  return (
    <ProtectedRoute>
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
        
        {/* Header administrativo - CORREGIDO */}
        <header className="bg-white dark:bg-gray-800 shadow-sm border-b border-gray-200 dark:border-gray-700">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex items-center justify-between h-16">
              
              {/* Logo y título - Responsive */}
              <div className="flex items-center space-x-3 min-w-0">
                <div className="w-8 h-8 bg-gradient-to-br from-blue-800 to-blue-900 rounded-lg flex items-center justify-center text-white font-bold text-sm flex-shrink-0">
                  👨‍💼
                </div>
                <div className="min-w-0">
                  <h1 className="text-lg sm:text-xl font-bold text-gray-900 dark:text-white truncate">
                    Panel de Administración
                  </h1>
                  <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400 hidden sm:block">
                    Gestión y analytics de Vence
                  </p>
                </div>
              </div>

              {/* Logo compacto solo en móvil */}
              <div className="sm:hidden">
                <h1 className="text-base font-bold text-gray-900 dark:text-white">Admin</h1>
              </div>
            </div>
          </div>
          
          {/* Navegación en dos filas */}
          <div className="bg-gray-50 dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
              <nav className="py-2">
                {/* Primera fila */}
                <div className="flex items-center justify-center flex-wrap gap-1 mb-2">
                  <Link 
                    href="/admin" 
                    className="text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white px-3 py-1.5 rounded-md text-sm font-medium flex items-center space-x-1"
                  >
                    <span>📊</span>
                    <span>Dashboard</span>
                  </Link>
                  <Link
                    href="/admin/engagement" 
                    className="text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white px-3 py-1.5 rounded-md text-sm font-medium flex items-center space-x-1"
                  >
                    <span>🎯</span>
                    <span>Engagement</span>
                  </Link>
                  <Link
                    href="/admin/notificaciones"
                    className="text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white px-3 py-1.5 rounded-md text-sm font-medium flex items-center space-x-1"
                  >
                    <span>🔔</span>
                    <span>Notificaciones</span>
                  </Link>
                </div>
                
                {/* Segunda fila */}
                <div className="flex items-center justify-center flex-wrap gap-1">
                  <Link
                    href="/admin/notificaciones/email"
                    className="text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white px-3 py-1.5 rounded-md text-sm font-medium flex items-center space-x-1"
                  >
                    <span>📧</span>
                    <span>Emails</span>
                  </Link>
                  <Link 
                    href="/admin/feedback" 
                    className={`text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white px-3 py-1.5 rounded-md text-sm font-medium flex items-center space-x-1 relative ${
                      adminNotifications?.feedback > 0 ? 'animate-pulse' : ''
                    }`}
                  >
                    <span>💬</span>
                    <span>Feedback</span>
                    {adminNotifications?.feedback > 0 && (
                      <span className="absolute -top-1 -right-1 flex space-x-0.5">
                        {adminNotifications.feedbackByType?.deletion > 0 && (
                          <span className="bg-black text-white text-xs rounded-full h-5 min-w-5 px-1.5 flex items-center justify-center gap-0.5 font-bold animate-pulse" title="Solicitud de eliminación de cuenta (RGPD)">
                            <span>🗑️</span>{adminNotifications.feedbackByType.deletion}
                          </span>
                        )}
                        {adminNotifications.feedbackByType?.bug > 0 && (
                          <span className="bg-amber-500 text-white text-xs rounded-full h-5 min-w-5 px-1 flex items-center justify-center font-bold" title="Bug reportado">
                            {adminNotifications.feedbackByType.bug}
                          </span>
                        )}
                        {adminNotifications.feedbackByType?.email > 0 && (
                          <span className="bg-indigo-500 text-white text-xs rounded-full h-5 min-w-5 px-1.5 flex items-center justify-center font-bold" title="Email recibido">
                            @{adminNotifications.feedbackByType.email}
                          </span>
                        )}
                        {adminNotifications.feedbackByType?.other > 0 && (
                          <span className="bg-blue-500 text-white text-xs rounded-full h-5 min-w-5 px-1 flex items-center justify-center font-bold" title="Otro feedback">
                            {adminNotifications.feedbackByType.other}
                          </span>
                        )}
                      </span>
                    )}
                  </Link>
                  <Link 
                    href="/admin/impugnaciones" 
                    className={`text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white px-3 py-1.5 rounded-md text-sm font-medium flex items-center space-x-1 relative ${
                      adminNotifications?.impugnaciones > 0 ? 'animate-pulse' : ''
                    }`}
                  >
                    <span>📋</span>
                    <span>Impugnaciones</span>
                    {adminNotifications?.impugnaciones > 0 && (
                      <span className="absolute -top-1 -right-1 flex space-x-0.5">
                        {adminNotifications.impugnacionesByType?.legislativas > 0 && (
                          <span className="bg-red-500 text-white text-xs rounded-full h-5 min-w-5 px-1 flex items-center justify-center font-bold animate-pulse" title="Legislativas">
                            {adminNotifications.impugnacionesByType.legislativas}
                          </span>
                        )}
                        {adminNotifications.impugnacionesByType?.psicotecnicas > 0 && (
                          <span className="bg-orange-500 text-white text-xs rounded-full h-5 min-w-5 px-1 flex items-center justify-center font-bold animate-pulse" title="Psicotécnicas">
                            {adminNotifications.impugnacionesByType.psicotecnicas}
                          </span>
                        )}
                      </span>
                    )}
                  </Link>
                  <Link 
                    href="/admin/newsletters" 
                    className="text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white px-3 py-1.5 rounded-md text-sm font-medium flex items-center space-x-1"
                  >
                    <span>📧</span>
                    <span>Newsletters</span>
                  </Link>
                  <Link
                    href="/admin/monitoreo"
                    className={`text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white px-3 py-1.5 rounded-md text-sm font-medium flex items-center space-x-1 relative ${
                      hasUnreviewedChanges ? 'animate-pulse' : ''
                    }`}
                  >
                    <span>🚨</span>
                    <span>Monitoreo</span>
                    {hasUnreviewedChanges && (
                      <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full h-5 w-5 flex items-center justify-center font-bold animate-pulse">
                        !
                      </span>
                    )}
                  </Link>
                  <Link
                    href="/admin/oep-signals"
                    className={`text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white px-3 py-1.5 rounded-md text-sm font-medium flex items-center space-x-1 relative ${
                      oepSignals.pending > 0 || oepSignals.discovered > 0 ? 'animate-pulse' : ''
                    }`}
                  >
                    <span>🎯</span>
                    <span>OEPs</span>
                    {(oepSignals.pending > 0 || oepSignals.discovered > 0) && (
                      <span className="absolute -top-1 -right-1 flex space-x-0.5">
                        {oepSignals.pending > 0 && (
                          <span className={`text-white text-xs rounded-full h-5 min-w-5 px-1 flex items-center justify-center font-bold animate-pulse ${
                            oepSignals.critical > 0 ? 'bg-red-500' : 'bg-orange-500'
                          }`} title="Cambios en seguimiento de oposiciones del catálogo">
                            {oepSignals.pending > 99 ? '99+' : oepSignals.pending}
                          </span>
                        )}
                        {oepSignals.discovered > 0 && (
                          <span className="bg-purple-500 text-white text-xs rounded-full h-5 min-w-5 px-1 flex items-center justify-center font-bold animate-pulse" title="Procesos descubiertos fuera del catálogo (regional_scan)">
                            {oepSignals.discovered > 99 ? '99+' : oepSignals.discovered}
                          </span>
                        )}
                      </span>
                    )}
                  </Link>
                  <Link
                    href="/admin/radar-salud"
                    className="text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white px-3 py-1.5 rounded-md text-sm font-medium flex items-center space-x-1"
                  >
                    <span>📡</span>
                    <span>Radar</span>
                  </Link>
                  <Link
                    href="/admin/competidores"
                    className={`text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white px-3 py-1.5 rounded-md text-sm font-medium flex items-center space-x-1 relative ${
                      competidorChanges > 0 ? 'animate-pulse' : ''
                    }`}
                  >
                    <span>🏫</span>
                    <span>Competidores</span>
                    {competidorChanges > 0 && (
                      <span
                        className="absolute -top-1 -right-1 bg-orange-500 text-white text-xs rounded-full h-5 min-w-5 px-1 flex items-center justify-center font-bold animate-pulse"
                        title="Cambios detectados en competidores (últimos 7 días)"
                      >
                        {competidorChanges > 99 ? '99+' : competidorChanges}
                      </span>
                    )}
                  </Link>
                  <Link
                    href="/admin/radar-contenido"
                    className={`text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white px-3 py-1.5 rounded-md text-sm font-medium flex items-center space-x-1 relative ${
                      radarContenido > 0 ? 'animate-pulse' : ''
                    }`}
                  >
                    <span>📡</span>
                    <span>Radar Contenido</span>
                    {radarContenido > 0 && (
                      <span
                        className="absolute -top-1 -right-1 bg-pink-500 text-white text-xs rounded-full h-5 min-w-5 px-1 flex items-center justify-center font-bold animate-pulse"
                        title="Recomendaciones de contenido nuevas sin ver"
                      >
                        {radarContenido > 99 ? '99+' : radarContenido}
                      </span>
                    )}
                  </Link>
                  <Link
                    href="/admin/contenido"
                    className={`text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white px-3 py-1.5 rounded-md text-sm font-medium flex items-center space-x-1 relative ${
                      contenidoAlerts > 0 ? 'animate-pulse' : ''
                    }`}
                  >
                    <span>📊</span>
                    <span>Contenido</span>
                    {contenidoAlerts > 0 && (
                      <span
                        className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full h-5 min-w-5 px-1 flex items-center justify-center font-bold animate-pulse"
                        title="Oposiciones con temas en desarrollo (0 preguntas)"
                      >
                        {contenidoAlerts > 99 ? '99+' : contenidoAlerts}
                      </span>
                    )}
                    {scopeVerifyAlerts > 0 && (
                      <span
                        className="absolute -bottom-1 -right-1 bg-amber-500 text-white text-xs rounded-full h-5 min-w-5 px-1 flex items-center justify-center font-bold"
                        title="Contenido a verificar: topic_scope (S1) + literalidad del epígrafe vs convocatoria (S2) sin verificar / cambiado / con issues"
                      >
                        {scopeVerifyAlerts > 99 ? '99+' : scopeVerifyAlerts}
                      </span>
                    )}
                  </Link>
                  <Link
                    href="/admin/revision-temas"
                    className="text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white px-3 py-1.5 rounded-md text-sm font-medium flex items-center space-x-1"
                  >
                    <span>📚</span>
                    <span>Revisión Temas</span>
                  </Link>
                  <Link
                    href="/admin/calidad"
                    className={`text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white px-3 py-1.5 rounded-md text-sm font-medium flex items-center space-x-1 relative ${
                      adminNotifications?.calidad > 0 ? 'animate-pulse' : ''
                    }`}
                  >
                    <span>🔍</span>
                    <span>Calidad</span>
                    {adminNotifications?.calidad > 0 && (
                      <span className="absolute -top-1 -right-1 bg-orange-500 text-white text-xs rounded-full h-5 w-5 flex items-center justify-center font-bold animate-pulse">
                        {adminNotifications.calidad > 99 ? '99+' : adminNotifications.calidad}
                      </span>
                    )}
                  </Link>
                  <Link
                    href="/admin/ai"
                    className="text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white px-3 py-1.5 rounded-md text-sm font-medium flex items-center space-x-1"
                  >
                    <span>🤖</span>
                    <span>IA</span>
                  </Link>
                  <Link
                    href="/admin/conversiones"
                    className="text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white px-3 py-1.5 rounded-md text-sm font-medium flex items-center space-x-1"
                  >
                    <span>💰</span>
                    <span>Conversiones</span>
                  </Link>
                  <Link
                    href="/admin/embajadores"
                    className="text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white px-3 py-1.5 rounded-md text-sm font-medium flex items-center space-x-1"
                  >
                    <span>🏅</span>
                    <span>Embajadores</span>
                  </Link>
                  <Link
                    href="/admin/ads"
                    className="text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white px-3 py-1.5 rounded-md text-sm font-medium flex items-center space-x-1"
                  >
                    <span>📣</span>
                    <span>Google Ads</span>
                  </Link>
                  <Link
                    href="/admin/fraudes"
                    className="relative text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white px-3 py-1.5 rounded-md text-sm font-medium flex items-center space-x-1"
                  >
                    <span>🚨</span>
                    <span>Fraudes</span>
                    {adminNotifications?.rateLimitHits > 0 && (
                      <span className="absolute -top-1 -right-1 bg-red-600 text-white text-xs rounded-full h-5 min-w-5 px-1 flex items-center justify-center font-bold animate-pulse">
                        {adminNotifications.rateLimitHits}
                      </span>
                    )}
                  </Link>
                  <Link
                    href="/admin/cobros"
                    className="text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white px-3 py-1.5 rounded-md text-sm font-medium flex items-center space-x-1"
                  >
                    <span>💳</span>
                    <span>Cobros</span>
                  </Link>
                  <Link
                    href="/admin/oposiciones?tab=rollover"
                    className={`text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white px-3 py-1.5 rounded-md text-sm font-medium flex items-center space-x-1 relative ${
                      rolloverCount > 0 ? 'animate-pulse' : ''
                    }`}
                  >
                    <span>🎓</span>
                    <span>Oposiciones</span>
                    {rolloverCount > 0 && (
                      <span
                        className="absolute -top-1 -right-1 bg-amber-500 text-white text-xs rounded-full h-5 min-w-5 px-1 flex items-center justify-center font-bold animate-pulse"
                        title="Oposiciones con examen pasado — hacer rollover (pivotar landing hacia delante)"
                      >
                        {rolloverCount > 99 ? '99+' : rolloverCount}
                      </span>
                    )}
                  </Link>
                  <Link
                    href="/admin/ayuda"
                    className="text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white px-3 py-1.5 rounded-md text-sm font-medium flex items-center space-x-1"
                  >
                    <span>📖</span>
                    <span>Ayuda</span>
                  </Link>
                  <Link
                    href="/admin/infraestructura"
                    className="text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white px-3 py-1.5 rounded-md text-sm font-medium flex items-center space-x-1"
                  >
                    <span>🖥️</span>
                    <span>Infra</span>
                  </Link>
                  <Link
                    href="/admin/errores-validacion"
                    className={`text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white px-3 py-1.5 rounded-md text-sm font-medium flex items-center space-x-1 relative ${
                      adminNotifications?.erroresApi > 0 ? 'animate-pulse' : ''
                    }`}
                  >
                    <span>🐕</span>
                    <span>Errores API</span>
                    {adminNotifications?.erroresApi > 0 && (
                      <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full h-5 w-5 flex items-center justify-center font-bold animate-pulse">
                        {adminNotifications.erroresApi > 99 ? '99+' : adminNotifications.erroresApi}
                      </span>
                    )}
                  </Link>
                  <Link
                    href="/admin/despliegues/articulos-problematicos"
                    className="text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white px-3 py-1.5 rounded-md text-sm font-medium flex items-center space-x-1"
                  >
                    <span>🚀</span>
                    <span>Despliegue</span>
                  </Link>
                </div>
              </nav>
            </div>
          </div>
        </header>

        {/* Contenido principal - CORREGIDO */}
        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-6">
          {children}
        </main>

        {/* Footer administrativo - CORREGIDO y más compacto */}
        <footer className="bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 mt-8">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3 sm:py-4">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between space-y-2 sm:space-y-0 text-xs sm:text-sm text-gray-500 dark:text-gray-400">
              <div className="flex items-center space-x-2 sm:space-x-4">
                <span className="flex items-center space-x-1">
                  <span>👨‍💼</span>
                  <span>Panel Administrativo Vence</span>
                </span>
                <span className="hidden sm:inline">•</span>
                <span className="hidden sm:inline">
                  Actualizado: {new Date().toLocaleDateString('es-ES')}
                </span>
              </div>
              <div className="flex items-center space-x-2 sm:space-x-4">
                <span>Versión: 2.0</span>
                <span>•</span>
                <span className="flex items-center space-x-1">
                  <span>🛡️</span>
                  <span>Área Protegida</span>
                </span>
              </div>
            </div>
          </div>
        </footer>

      </div>
    </ProtectedRoute>
  )
}