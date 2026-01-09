// app/admin/fraudes/page.js - Panel de detección de fraudes y cuentas compartidas
'use client'
import { useState, useEffect } from 'react'
import { useAuth } from '@/contexts/AuthContext'

export default function FraudesPage() {
  const { supabase } = useAuth()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  // Datos de fraude
  const [sameIpGroups, setSameIpGroups] = useState([])
  const [sameDeviceGroups, setSameDeviceGroups] = useState([])
  const [suspiciousSessions, setSuspiciousSessions] = useState([])
  const [multiAccountUsers, setMultiAccountUsers] = useState([])

  // Filtros
  const [activeTab, setActiveTab] = useState('resumen')
  const [showOnlyPremium, setShowOnlyPremium] = useState(false)

  useEffect(() => {
    if (supabase) {
      loadFraudData()
    }
  }, [supabase])

  async function loadFraudData() {
    try {
      setLoading(true)
      setError(null)

      // 1. Buscar grupos de usuarios con misma IP de registro
      const { data: ipGroups, error: ipError } = await supabase
        .from('user_profiles')
        .select('id, email, full_name, registration_ip, created_at, plan_type')
        .not('registration_ip', 'is', null)
        .order('registration_ip')

      if (ipError) throw ipError

      // Agrupar por IP
      const ipGroupMap = {}
      ipGroups?.forEach(user => {
        const ip = user.registration_ip
        if (!ipGroupMap[ip]) {
          ipGroupMap[ip] = []
        }
        ipGroupMap[ip].push(user)
      })

      // Filtrar solo grupos con más de 1 usuario
      const suspiciousIpGroups = Object.entries(ipGroupMap)
        .filter(([_, users]) => users.length > 1)
        .map(([ip, users]) => ({
          ip,
          users,
          hasPremium: users.some(u => u.plan_type === 'premium' || u.plan_type === 'semestral' || u.plan_type === 'anual'),
          count: users.length
        }))
        .sort((a, b) => b.count - a.count)

      setSameIpGroups(suspiciousIpGroups)

      // 2. Buscar sesiones con mismos dispositivos (user_agent) en cuentas diferentes
      const { data: sessions, error: sessError } = await supabase
        .from('user_sessions')
        .select('id, user_id, user_agent, ip_address, city, region, country_code, session_start')
        .not('user_agent', 'is', null)
        .order('session_start', { ascending: false })
        .limit(5000)

      if (sessError) throw sessError

      // Agrupar por user_agent y filtrar los que tienen múltiples usuarios
      const deviceGroupMap = {}
      sessions?.forEach(session => {
        // Simplificar user_agent para agrupar mejor
        const ua = session.user_agent?.substring(0, 100) || 'unknown'
        if (!deviceGroupMap[ua]) {
          deviceGroupMap[ua] = new Map()
        }
        if (!deviceGroupMap[ua].has(session.user_id)) {
          deviceGroupMap[ua].set(session.user_id, {
            user_id: session.user_id,
            sessions: [],
            cities: new Set(),
            ips: new Set()
          })
        }
        const userData = deviceGroupMap[ua].get(session.user_id)
        userData.sessions.push(session)
        if (session.city) userData.cities.add(session.city)
        if (session.ip_address) userData.ips.add(session.ip_address)
      })

      // Filtrar dispositivos usados por múltiples usuarios
      const suspiciousDeviceGroups = []
      for (const [ua, usersMap] of Object.entries(deviceGroupMap)) {
        if (usersMap.size > 1) {
          const userIds = Array.from(usersMap.keys())

          // Obtener perfiles de estos usuarios
          const { data: profiles } = await supabase
            .from('user_profiles')
            .select('id, email, full_name, plan_type')
            .in('id', userIds)

          suspiciousDeviceGroups.push({
            userAgent: ua,
            users: profiles || [],
            userCount: usersMap.size,
            hasPremium: profiles?.some(u => u.plan_type === 'premium' || u.plan_type === 'semestral' || u.plan_type === 'anual')
          })
        }
      }

      setSameDeviceGroups(suspiciousDeviceGroups.sort((a, b) => b.userCount - a.userCount))

      // 3. Buscar cuentas premium usadas desde múltiples IPs/ciudades simultáneamente
      const { data: premiumUsers } = await supabase
        .from('user_profiles')
        .select('id, email, full_name, plan_type')
        .in('plan_type', ['premium', 'semestral', 'anual'])

      const suspiciousPremiumSessions = []

      for (const user of (premiumUsers || [])) {
        const { data: userSessions } = await supabase
          .from('user_sessions')
          .select('ip_address, city, region, country_code, session_start')
          .eq('user_id', user.id)
          .not('ip_address', 'is', null)
          .order('session_start', { ascending: false })
          .limit(50)

        if (userSessions && userSessions.length > 1) {
          const uniqueIps = [...new Set(userSessions.map(s => s.ip_address).filter(Boolean))]
          const uniqueCities = [...new Set(userSessions.map(s => s.city).filter(Boolean))]

          // Si tiene más de 3 IPs diferentes o más de 2 ciudades diferentes, es sospechoso
          if (uniqueIps.length > 3 || uniqueCities.length > 2) {
            suspiciousPremiumSessions.push({
              user,
              uniqueIps,
              uniqueCities,
              sessionCount: userSessions.length,
              recentSessions: userSessions.slice(0, 5)
            })
          }
        }
      }

      setSuspiciousSessions(suspiciousPremiumSessions)

      // 4. Detectar multi-cuentas probables (mismo nombre + dispositivo + IP)
      const multiAccounts = []

      // Combinar datos para encontrar patrones
      for (const ipGroup of suspiciousIpGroups) {
        for (const deviceGroup of suspiciousDeviceGroups) {
          // Buscar usuarios que aparecen en ambos grupos
          const commonUsers = ipGroup.users.filter(u1 =>
            deviceGroup.users.some(u2 => u1.id === u2.id)
          )

          if (commonUsers.length > 1 || (ipGroup.users.length > 1 && deviceGroup.users.some(u => ipGroup.users.some(iu => iu.id === u.id)))) {
            // Encontrar todos los usuarios relacionados
            const allRelatedUserIds = new Set([
              ...ipGroup.users.map(u => u.id),
              ...deviceGroup.users.map(u => u.id)
            ])

            const { data: relatedProfiles } = await supabase
              .from('user_profiles')
              .select('id, email, full_name, plan_type, registration_ip, created_at, ciudad, nickname')
              .in('id', Array.from(allRelatedUserIds))

            if (relatedProfiles && relatedProfiles.length > 1) {
              // Verificar si ya existe este grupo
              const existingGroup = multiAccounts.find(g =>
                g.users.some(u => relatedProfiles.some(rp => rp.id === u.id))
              )

              if (!existingGroup) {
                multiAccounts.push({
                  ip: ipGroup.ip,
                  device: deviceGroup.userAgent?.substring(0, 50) + '...',
                  users: relatedProfiles,
                  hasPremium: relatedProfiles.some(u => u.plan_type === 'premium' || u.plan_type === 'semestral' || u.plan_type === 'anual'),
                  confidence: 'alta',
                  reasons: [
                    `Misma IP de registro (${ipGroup.ip})`,
                    `Mismo dispositivo`,
                    relatedProfiles.some((u, i, arr) => arr.some((u2, j) => i !== j && u.full_name?.toLowerCase() === u2.full_name?.toLowerCase())) ? 'Mismo nombre' : null
                  ].filter(Boolean)
                })
              }
            }
          }
        }
      }

      setMultiAccountUsers(multiAccounts)

    } catch (err) {
      console.error('Error cargando datos de fraude:', err)
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  function formatDate(dateString) {
    return new Date(dateString).toLocaleDateString('es-ES', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  function getPlanBadge(planType) {
    if (planType === 'premium' || planType === 'semestral' || planType === 'anual') {
      return <span className="px-2 py-0.5 bg-yellow-100 text-yellow-800 text-xs rounded-full font-medium">PREMIUM</span>
    }
    return <span className="px-2 py-0.5 bg-gray-100 text-gray-600 text-xs rounded-full">free</span>
  }

  // Estadísticas resumen
  const stats = {
    totalIpGroups: sameIpGroups.length,
    ipGroupsWithPremium: sameIpGroups.filter(g => g.hasPremium).length,
    totalDeviceGroups: sameDeviceGroups.length,
    deviceGroupsWithPremium: sameDeviceGroups.filter(g => g.hasPremium).length,
    suspiciousPremium: suspiciousSessions.length,
    multiAccounts: multiAccountUsers.length,
    multiAccountsWithPremium: multiAccountUsers.filter(g => g.hasPremium).length
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-red-600 mx-auto mb-4"></div>
          <p className="text-gray-600 dark:text-gray-400">Analizando patrones de fraude...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-6">
        <h3 className="text-lg font-semibold text-red-800 dark:text-red-200 mb-2">Error</h3>
        <p className="text-red-600 dark:text-red-400">{error}</p>
        <button
          onClick={loadFraudData}
          className="mt-4 px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
        >
          Reintentar
        </button>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            🚨 Detección de Fraudes
          </h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">
            Cuentas compartidas, duplicadas y uso sospechoso
          </p>
        </div>
        <button
          onClick={loadFraudData}
          className="mt-4 sm:mt-0 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2"
        >
          <span>🔄</span> Actualizar
        </button>
      </div>

      {/* Resumen de alertas */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4 border border-red-200 dark:border-red-800">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-gray-600 dark:text-gray-400">Multi-cuentas</p>
              <p className="text-2xl font-bold text-red-600">{stats.multiAccounts}</p>
              <p className="text-xs text-red-500">{stats.multiAccountsWithPremium} con premium</p>
            </div>
            <span className="text-3xl">👥</span>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4 border border-orange-200 dark:border-orange-800">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-gray-600 dark:text-gray-400">Misma IP</p>
              <p className="text-2xl font-bold text-orange-600">{stats.totalIpGroups}</p>
              <p className="text-xs text-orange-500">{stats.ipGroupsWithPremium} con premium</p>
            </div>
            <span className="text-3xl">🌐</span>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4 border border-yellow-200 dark:border-yellow-800">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-gray-600 dark:text-gray-400">Mismo dispositivo</p>
              <p className="text-2xl font-bold text-yellow-600">{stats.totalDeviceGroups}</p>
              <p className="text-xs text-yellow-500">{stats.deviceGroupsWithPremium} con premium</p>
            </div>
            <span className="text-3xl">📱</span>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4 border border-purple-200 dark:border-purple-800">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-gray-600 dark:text-gray-400">Premium sospechoso</p>
              <p className="text-2xl font-bold text-purple-600">{stats.suspiciousPremium}</p>
              <p className="text-xs text-purple-500">múltiples ubicaciones</p>
            </div>
            <span className="text-3xl">⚠️</span>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200 dark:border-gray-700">
        <nav className="flex space-x-4 overflow-x-auto">
          {[
            { id: 'resumen', label: 'Resumen', icon: '📊' },
            { id: 'multicuentas', label: 'Multi-cuentas', icon: '👥', count: stats.multiAccounts },
            { id: 'misma-ip', label: 'Misma IP', icon: '🌐', count: stats.totalIpGroups },
            { id: 'mismo-dispositivo', label: 'Mismo Dispositivo', icon: '📱', count: stats.totalDeviceGroups },
            { id: 'premium-sospechoso', label: 'Premium Sospechoso', icon: '⚠️', count: stats.suspiciousPremium },
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-2 border-b-2 whitespace-nowrap ${
                activeTab === tab.id
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              <span>{tab.icon}</span>
              <span>{tab.label}</span>
              {tab.count !== undefined && tab.count > 0 && (
                <span className="bg-red-500 text-white text-xs px-2 py-0.5 rounded-full">{tab.count}</span>
              )}
            </button>
          ))}
        </nav>
      </div>

      {/* Filtro premium */}
      <div className="flex items-center gap-2">
        <input
          type="checkbox"
          id="showOnlyPremium"
          checked={showOnlyPremium}
          onChange={(e) => setShowOnlyPremium(e.target.checked)}
          className="rounded border-gray-300"
        />
        <label htmlFor="showOnlyPremium" className="text-sm text-gray-600 dark:text-gray-400">
          Mostrar solo casos con cuenta premium
        </label>
      </div>

      {/* Contenido según tab */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow border">

        {/* Tab Resumen */}
        {activeTab === 'resumen' && (
          <div className="p-6">
            <h3 className="text-lg font-semibold mb-4">Resumen de Alertas</h3>

            {stats.multiAccounts === 0 && stats.totalIpGroups === 0 && stats.suspiciousPremium === 0 ? (
              <div className="text-center py-8">
                <span className="text-6xl">✅</span>
                <p className="text-gray-600 dark:text-gray-400 mt-4">No se detectaron patrones de fraude</p>
              </div>
            ) : (
              <div className="space-y-4">
                {stats.multiAccountsWithPremium > 0 && (
                  <div className="p-4 bg-red-50 dark:bg-red-900/20 rounded-lg border border-red-200 dark:border-red-800">
                    <p className="font-medium text-red-800 dark:text-red-200">
                      🚨 {stats.multiAccountsWithPremium} grupos de multi-cuentas tienen cuenta PREMIUM
                    </p>
                    <p className="text-sm text-red-600 dark:text-red-400 mt-1">
                      Estos usuarios podrían estar compartiendo la suscripción premium entre múltiples cuentas
                    </p>
                  </div>
                )}

                {stats.suspiciousPremium > 0 && (
                  <div className="p-4 bg-purple-50 dark:bg-purple-900/20 rounded-lg border border-purple-200 dark:border-purple-800">
                    <p className="font-medium text-purple-800 dark:text-purple-200">
                      ⚠️ {stats.suspiciousPremium} cuentas premium usadas desde múltiples ubicaciones
                    </p>
                    <p className="text-sm text-purple-600 dark:text-purple-400 mt-1">
                      Podrían estar compartiendo credenciales con otras personas
                    </p>
                  </div>
                )}

                {stats.ipGroupsWithPremium > 0 && (
                  <div className="p-4 bg-orange-50 dark:bg-orange-900/20 rounded-lg border border-orange-200 dark:border-orange-800">
                    <p className="font-medium text-orange-800 dark:text-orange-200">
                      🌐 {stats.ipGroupsWithPremium} grupos de misma IP incluyen cuenta premium
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Tab Multi-cuentas */}
        {activeTab === 'multicuentas' && (
          <div className="divide-y divide-gray-200 dark:divide-gray-700">
            {(showOnlyPremium ? multiAccountUsers.filter(g => g.hasPremium) : multiAccountUsers).length === 0 ? (
              <div className="p-8 text-center text-gray-500">
                No se detectaron multi-cuentas{showOnlyPremium ? ' con premium' : ''}
              </div>
            ) : (
              (showOnlyPremium ? multiAccountUsers.filter(g => g.hasPremium) : multiAccountUsers).map((group, idx) => (
                <div key={idx} className="p-4">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <span className="text-xl">👥</span>
                      <span className="font-medium">{group.users.length} cuentas relacionadas</span>
                      {group.hasPremium && (
                        <span className="px-2 py-0.5 bg-red-100 text-red-800 text-xs rounded-full font-medium">
                          INCLUYE PREMIUM
                        </span>
                      )}
                    </div>
                    <span className={`px-2 py-1 rounded text-xs ${
                      group.confidence === 'alta' ? 'bg-red-100 text-red-800' : 'bg-yellow-100 text-yellow-800'
                    }`}>
                      Confianza: {group.confidence}
                    </span>
                  </div>

                  <div className="text-xs text-gray-500 mb-3 space-y-1">
                    {group.reasons.map((reason, i) => (
                      <div key={i}>• {reason}</div>
                    ))}
                  </div>

                  <div className="space-y-2">
                    {group.users.map(user => (
                      <div key={user.id} className="flex items-center justify-between p-2 bg-gray-50 dark:bg-gray-700 rounded">
                        <div>
                          <div className="font-medium text-sm">{user.full_name || 'Sin nombre'}</div>
                          <div className="text-xs text-gray-500">{user.email}</div>
                          <div className="text-xs text-gray-400">
                            {user.ciudad && `📍 ${user.ciudad}`} • Registro: {formatDate(user.created_at)}
                          </div>
                        </div>
                        {getPlanBadge(user.plan_type)}
                      </div>
                    ))}
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {/* Tab Misma IP */}
        {activeTab === 'misma-ip' && (
          <div className="divide-y divide-gray-200 dark:divide-gray-700">
            {(showOnlyPremium ? sameIpGroups.filter(g => g.hasPremium) : sameIpGroups).length === 0 ? (
              <div className="p-8 text-center text-gray-500">
                No se encontraron grupos con misma IP{showOnlyPremium ? ' con premium' : ''}
              </div>
            ) : (
              (showOnlyPremium ? sameIpGroups.filter(g => g.hasPremium) : sameIpGroups).map((group, idx) => (
                <div key={idx} className="p-4">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <span className="text-xl">🌐</span>
                      <span className="font-mono text-sm bg-gray-100 dark:bg-gray-700 px-2 py-1 rounded">
                        {group.ip}
                      </span>
                      <span className="text-gray-500">({group.count} cuentas)</span>
                      {group.hasPremium && (
                        <span className="px-2 py-0.5 bg-red-100 text-red-800 text-xs rounded-full font-medium">
                          INCLUYE PREMIUM
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="space-y-2">
                    {group.users.map(user => (
                      <div key={user.id} className="flex items-center justify-between p-2 bg-gray-50 dark:bg-gray-700 rounded">
                        <div>
                          <div className="font-medium text-sm">{user.full_name || 'Sin nombre'}</div>
                          <div className="text-xs text-gray-500">{user.email}</div>
                          <div className="text-xs text-gray-400">Registro: {formatDate(user.created_at)}</div>
                        </div>
                        {getPlanBadge(user.plan_type)}
                      </div>
                    ))}
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {/* Tab Mismo Dispositivo */}
        {activeTab === 'mismo-dispositivo' && (
          <div className="divide-y divide-gray-200 dark:divide-gray-700">
            {(showOnlyPremium ? sameDeviceGroups.filter(g => g.hasPremium) : sameDeviceGroups).length === 0 ? (
              <div className="p-8 text-center text-gray-500">
                No se encontraron grupos con mismo dispositivo{showOnlyPremium ? ' con premium' : ''}
              </div>
            ) : (
              (showOnlyPremium ? sameDeviceGroups.filter(g => g.hasPremium) : sameDeviceGroups).slice(0, 20).map((group, idx) => (
                <div key={idx} className="p-4">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <span className="text-xl">📱</span>
                      <span className="text-gray-500">({group.userCount} usuarios)</span>
                      {group.hasPremium && (
                        <span className="px-2 py-0.5 bg-red-100 text-red-800 text-xs rounded-full font-medium">
                          INCLUYE PREMIUM
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="text-xs text-gray-500 mb-3 font-mono bg-gray-100 dark:bg-gray-700 p-2 rounded truncate">
                    {group.userAgent}
                  </div>

                  <div className="space-y-2">
                    {group.users.map(user => (
                      <div key={user.id} className="flex items-center justify-between p-2 bg-gray-50 dark:bg-gray-700 rounded">
                        <div>
                          <div className="font-medium text-sm">{user.full_name || 'Sin nombre'}</div>
                          <div className="text-xs text-gray-500">{user.email}</div>
                        </div>
                        {getPlanBadge(user.plan_type)}
                      </div>
                    ))}
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {/* Tab Premium Sospechoso */}
        {activeTab === 'premium-sospechoso' && (
          <div className="divide-y divide-gray-200 dark:divide-gray-700">
            {suspiciousSessions.length === 0 ? (
              <div className="p-8 text-center text-gray-500">
                No se detectaron cuentas premium con uso sospechoso
              </div>
            ) : (
              suspiciousSessions.map((item, idx) => (
                <div key={idx} className="p-4">
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <div className="font-medium">{item.user.full_name || 'Sin nombre'}</div>
                      <div className="text-sm text-gray-500">{item.user.email}</div>
                    </div>
                    {getPlanBadge(item.user.plan_type)}
                  </div>

                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <p className="font-medium text-gray-700 dark:text-gray-300">IPs únicas ({item.uniqueIps.length})</p>
                      <div className="text-xs text-gray-500 space-y-1 mt-1">
                        {item.uniqueIps.slice(0, 5).map((ip, i) => (
                          <div key={i} className="font-mono bg-gray-100 dark:bg-gray-700 px-2 py-0.5 rounded inline-block mr-1">
                            {ip}
                          </div>
                        ))}
                        {item.uniqueIps.length > 5 && <span>+{item.uniqueIps.length - 5} más</span>}
                      </div>
                    </div>
                    <div>
                      <p className="font-medium text-gray-700 dark:text-gray-300">Ciudades ({item.uniqueCities.length})</p>
                      <div className="text-xs text-gray-500 mt-1">
                        {item.uniqueCities.join(', ')}
                      </div>
                    </div>
                  </div>

                  <div className="mt-3 text-xs text-gray-400">
                    {item.sessionCount} sesiones totales
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  )
}
