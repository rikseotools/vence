// app/admin/fraudes/page.js - Panel de detección de fraudes y cuentas compartidas
'use client'
import { useState, useEffect } from 'react'
import { useAuth } from '@/contexts/AuthContext'

export default function FraudesPage() {
  const { supabase, user } = useAuth()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  // Datos de fraude
  const [sameIpGroups, setSameIpGroups] = useState([])
  const [sameDeviceGroups, setSameDeviceGroups] = useState([])
  const [suspiciousSessions, setSuspiciousSessions] = useState([])
  const [multiAccountUsers, setMultiAccountUsers] = useState([])
  const [confirmedFrauds, setConfirmedFrauds] = useState([]) // Fraudes confirmados por device_id

  // Alertas del sistema
  const [alerts, setAlerts] = useState([])
  const [alertStats, setAlertStats] = useState(null)
  const [alertFilter, setAlertFilter] = useState('new')

  // Filtros
  const [activeTab, setActiveTab] = useState('alertas')
  const [showOnlyPremium, setShowOnlyPremium] = useState(false)

  useEffect(() => {
    if (supabase) {
      loadFraudData()
      loadAlerts()
    }
  }, [supabase])

  useEffect(() => {
    if (supabase && activeTab === 'alertas') {
      loadAlerts()
    }
  }, [alertFilter])

  async function loadAlerts() {
    try {
      // Cargar alertas con filtro de estado
      const { data: alertsData, error: alertsError } = await supabase
        .from('fraud_alerts')
        .select('*')
        .eq('status', alertFilter)
        .order('detected_at', { ascending: false })
        .limit(50)

      if (alertsError) {
        // Solo loguear si es un error real (no tabla inexistente)
        if (alertsError.code && alertsError.code !== '42P01') {
          console.error('Error cargando alertas:', alertsError.message || alertsError)
        }
        // La tabla puede no existir aún - es esperado
        setAlerts([])
      } else {
        setAlerts(alertsData || [])
      }

      // Cargar estadísticas de alertas
      const { data: statsData } = await supabase
        .from('fraud_alerts')
        .select('status')

      if (statsData) {
        const stats = {
          new: statsData.filter(a => a.status === 'new').length,
          reviewed: statsData.filter(a => a.status === 'reviewed').length,
          dismissed: statsData.filter(a => a.status === 'dismissed').length,
          action_taken: statsData.filter(a => a.status === 'action_taken').length
        }
        setAlertStats(stats)
      }
    } catch (err) {
      console.error('Error en loadAlerts:', err)
    }
  }

  async function updateAlertStatus(alertId, newStatus, notes = '') {
    try {
      const { error } = await supabase
        .from('fraud_alerts')
        .update({
          status: newStatus,
          reviewed_at: new Date().toISOString(),
          reviewed_by: user?.id,
          notes: notes || null
        })
        .eq('id', alertId)

      if (error) throw error

      // Recargar alertas
      loadAlerts()
    } catch (err) {
      console.error('Error actualizando alerta:', err)
      alert('Error actualizando alerta: ' + err.message)
    }
  }

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

      // 2. Buscar sesiones sospechosas: MISMA IP + MISMO DISPOSITIVO + DIFERENTES USUARIOS
      const { data: sessions, error: sessError } = await supabase
        .from('user_sessions')
        .select('id, user_id, user_agent, ip_address, city, region, country_code, session_start, screen_resolution, color_depth, pixel_ratio')
        .not('user_agent', 'is', null)
        .order('session_start', { ascending: false })
        .limit(5000)

      if (sessError) throw sessError

      // Función para extraer OS del user_agent
      const getOS = (ua) => {
        if (!ua) return 'Other'
        if (ua.includes('Windows')) return 'Windows'
        if (ua.includes('Mac OS')) return 'Mac'
        if (ua.includes('iPhone')) return 'iPhone'
        if (ua.includes('iPad')) return 'iPad'
        if (ua.includes('Android')) return 'Android'
        if (ua.includes('Linux')) return 'Linux'
        return 'Other'
      }

      // Función para crear fingerprint MUY específico: resolución + colorDepth + pixelRatio + user_agent
      // Esto es extremadamente identificativo del dispositivo físico
      const getDeviceFingerprint = (session) => {
        const { user_agent, screen_resolution, color_depth, pixel_ratio } = session
        if (!screen_resolution || !user_agent) return null // Sin datos suficientes

        // Redondear pixel_ratio a 2 decimales para consistencia
        const pr = pixel_ratio ? Math.round(pixel_ratio * 100) / 100 : 'x'
        const cd = color_depth || 'x'

        // Fingerprint completo: resolución + colorDepth + pixelRatio + user_agent
        return `${screen_resolution}|${cd}|${pr}|${user_agent}`
      }

      // Versión corta del fingerprint para mostrar en UI
      const getShortFingerprint = (session) => {
        const { user_agent, screen_resolution, color_depth, pixel_ratio } = session
        if (!user_agent || !screen_resolution) return 'desconocido'

        // Extraer info clave: navegador/versión + OS
        let browser = 'Other'
        let version = ''
        const chromeMatch = user_agent.match(/Chrome\/([\d.]+)/)
        const firefoxMatch = user_agent.match(/Firefox\/([\d.]+)/)
        const safariMatch = user_agent.match(/Version\/([\d.]+).*Safari/)
        const edgeMatch = user_agent.match(/Edg\/([\d.]+)/)

        if (edgeMatch) { browser = 'Edge'; version = edgeMatch[1] }
        else if (chromeMatch) { browser = 'Chrome'; version = chromeMatch[1] }
        else if (firefoxMatch) { browser = 'Firefox'; version = firefoxMatch[1] }
        else if (safariMatch) { browser = 'Safari'; version = safariMatch[1] }

        const os = getOS(user_agent)
        const pr = pixel_ratio ? `@${Math.round(pixel_ratio * 100) / 100}x` : ''
        const cd = color_depth ? `${color_depth}bit` : ''

        return `${screen_resolution} ${cd} ${pr} ${browser}/${version.split('.')[0]} ${os}`.replace(/\s+/g, ' ').trim()
      }

      // Función simple para categoría genérica (para tab "mismo dispositivo")
      const getDeviceCategory = (ua) => {
        if (!ua) return 'unknown'
        let browser = 'Other'
        if (ua.includes('Chrome') && !ua.includes('Edg')) browser = 'Chrome'
        else if (ua.includes('Firefox')) browser = 'Firefox'
        else if (ua.includes('Safari') && !ua.includes('Chrome')) browser = 'Safari'
        else if (ua.includes('Edg')) browser = 'Edge'
        return `${browser}/${getOS(ua)}`
      }

      // Agrupar por IP + categoría de dispositivo (combinación más específica)
      const combinedGroupMap = {}
      sessions?.forEach(session => {
        const deviceCategory = getDeviceCategory(session.user_agent)
        const key = `${session.ip_address}|${deviceCategory}`

        if (!combinedGroupMap[key]) {
          combinedGroupMap[key] = {
            ip: session.ip_address,
            deviceCategory,
            users: new Map(),
            sessions: []
          }
        }

        const group = combinedGroupMap[key]
        group.sessions.push(session)

        if (!group.users.has(session.user_id)) {
          group.users.set(session.user_id, {
            user_id: session.user_id,
            firstSession: session.session_start,
            lastSession: session.session_start,
            sessionCount: 0
          })
        }

        const userData = group.users.get(session.user_id)
        userData.sessionCount++
        if (session.session_start > userData.lastSession) userData.lastSession = session.session_start
        if (session.session_start < userData.firstSession) userData.firstSession = session.session_start
      })

      // Filtrar grupos con múltiples usuarios Y calcular puntuación de sospecha
      const suspiciousDeviceGroups = []
      for (const [key, group] of Object.entries(combinedGroupMap)) {
        if (group.users.size > 1) {
          const userIds = Array.from(group.users.keys())

          // Obtener perfiles de estos usuarios
          const { data: profiles } = await supabase
            .from('user_profiles')
            .select('id, email, full_name, plan_type, created_at')
            .in('id', userIds)

          if (!profiles || profiles.length < 2) continue

          // Calcular si hay sesiones cercanas en tiempo (dentro de 48h)
          const userSessions = Array.from(group.users.values())
          let hasCloseTimeSessions = false
          for (let i = 0; i < userSessions.length; i++) {
            for (let j = i + 1; j < userSessions.length; j++) {
              const time1 = new Date(userSessions[i].lastSession).getTime()
              const time2 = new Date(userSessions[j].lastSession).getTime()
              const diffHours = Math.abs(time1 - time2) / (1000 * 60 * 60)
              if (diffHours < 48) hasCloseTimeSessions = true
            }
          }

          const hasPremium = profiles.some(u => ['premium', 'semestral', 'anual'].includes(u.plan_type))

          // Calcular puntuación de sospecha (0-100)
          let suspicionScore = 0
          suspicionScore += 30 // Base: misma IP + mismo tipo dispositivo
          if (hasPremium) suspicionScore += 30 // Premium compartido = muy sospechoso
          if (hasCloseTimeSessions) suspicionScore += 25 // Sesiones cercanas en tiempo
          if (group.users.size > 2) suspicionScore += 15 // Más de 2 usuarios = más sospechoso

          suspiciousDeviceGroups.push({
            ip: group.ip,
            deviceCategory: group.deviceCategory,
            users: profiles,
            userCount: group.users.size,
            hasPremium,
            hasCloseTimeSessions,
            suspicionScore,
            sessionDetails: Array.from(group.users.entries()).map(([id, data]) => ({
              user_id: id,
              ...data
            }))
          })
        }
      }

      // Ordenar por puntuación de sospecha (más alto primero)
      setSameDeviceGroups(suspiciousDeviceGroups.sort((a, b) => b.suspicionScore - a.suspicionScore))

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

      // 4. Detectar multi-cuentas: DOS MÉTODOS
      // A) Misma IP de registro
      // B) Mismo dispositivo pero IPs diferentes (VPN)
      const multiAccounts = []
      const processedUserPairs = new Set() // Evitar duplicados

      // 4A. Método 1: Misma IP de registro
      for (const ipGroup of suspiciousIpGroups) {
        if (ipGroup.users.length < 2) continue

        const users = ipGroup.users
        const reasons = [`Misma IP de registro (${ipGroup.ip})`]
        let suspicionScore = 30 // Base: misma IP de registro

        // Verificar si tienen mismo nombre
        const hasSameName = users.some((u, i, arr) =>
          arr.some((u2, j) => i !== j &&
            u.full_name?.toLowerCase().trim() === u2.full_name?.toLowerCase().trim() &&
            u.full_name?.trim().length > 0
          )
        )
        if (hasSameName) {
          reasons.push('Mismo nombre')
          suspicionScore += 25
        }

        // Verificar si alguno tiene premium (posible cuenta compartida)
        const hasPremium = users.some(u => ['premium', 'semestral', 'anual'].includes(u.plan_type))
        if (hasPremium) {
          reasons.push('Incluye cuenta premium')
          suspicionScore += 20
        }

        // Verificar si se registraron en fechas cercanas (mismo día o consecutivos)
        const sortedByDate = [...users].sort((a, b) => new Date(a.created_at) - new Date(b.created_at))
        let hasCloseRegistration = false
        for (let i = 1; i < sortedByDate.length; i++) {
          const diff = Math.abs(new Date(sortedByDate[i].created_at) - new Date(sortedByDate[i-1].created_at))
          const diffDays = diff / (1000 * 60 * 60 * 24)
          if (diffDays < 7) {
            hasCloseRegistration = true
            break
          }
        }
        if (hasCloseRegistration) {
          reasons.push('Registros cercanos en tiempo')
          suspicionScore += 15
        }

        // Verificar si también aparecen en grupos de sesiones sospechosas
        const usersInDeviceGroups = users.filter(u =>
          suspiciousDeviceGroups.some(dg => dg.users.some(du => du.id === u.id))
        )
        if (usersInDeviceGroups.length >= 2) {
          reasons.push('También comparten sesiones IP+dispositivo')
          suspicionScore += 25
        }

        // Calcular confianza
        let confidence = 'baja'
        if (suspicionScore >= 70) confidence = 'muy alta'
        else if (suspicionScore >= 50) confidence = 'alta'
        else if (suspicionScore >= 35) confidence = 'media'

        // Misma IP de registro = multicuenta (sin filtros adicionales)
        multiAccounts.push({
          ip: ipGroup.ip,
          users,
          hasPremium,
          hasSameName,
          hasCloseRegistration,
          confidence,
          suspicionScore,
          reasons,
          detectionMethod: 'same_ip'
        })

        // Marcar pares como procesados
        users.forEach(u1 => users.forEach(u2 => {
          if (u1.id !== u2.id) {
            processedUserPairs.add([u1.id, u2.id].sort().join('|'))
          }
        }))
      }

      // 4B. Método 2: Mismo dispositivo pero IPs diferentes (detecta VPN)
      // Usar fingerprint específico: resolución de pantalla + OS (mucho más identificativo)
      // Solo considerar sesiones CON screen_resolution para evitar falsos positivos

      const userFirstSessionsWithRes = {}
      for (const session of (sessions || [])) {
        // Solo sesiones con resolución de pantalla (más específico)
        if (!session.screen_resolution) continue

        if (!userFirstSessionsWithRes[session.user_id] ||
            new Date(session.session_start) < new Date(userFirstSessionsWithRes[session.user_id].session_start)) {
          userFirstSessionsWithRes[session.user_id] = session
        }
      }

      // Agrupar por fingerprint específico (resolución + colorDepth + pixelRatio + user_agent)
      const fingerprintGroups = {}
      for (const [userId, session] of Object.entries(userFirstSessionsWithRes)) {
        const fingerprint = getDeviceFingerprint(session)
        if (!fingerprint) continue // Skip si no hay fingerprint válido

        if (!fingerprintGroups[fingerprint]) {
          fingerprintGroups[fingerprint] = []
        }
        fingerprintGroups[fingerprint].push({
          userId,
          ip: session.ip_address,
          session, // Guardar sesión completa para obtener fingerprint legible
          sessionStart: session.session_start
        })
      }

      // Buscar grupos con mismo fingerprint pero IPs diferentes (VPN)
      for (const [fingerprint, deviceUsers] of Object.entries(fingerprintGroups)) {
        if (deviceUsers.length < 2) continue

        // Verificar que tengan IPs DIFERENTES (caso VPN)
        const uniqueIps = [...new Set(deviceUsers.map(u => u.ip).filter(Boolean))]
        if (uniqueIps.length < 2) continue // Si misma IP, ya detectado arriba

        // Obtener perfiles
        const userIds = deviceUsers.map(u => u.userId)
        const { data: profiles } = await supabase
          .from('user_profiles')
          .select('id, email, full_name, registration_ip, created_at, plan_type')
          .in('id', userIds)

        if (!profiles || profiles.length < 2) continue

        // CRÍTICO: Verificar si tienen sesiones el MISMO DÍA (indica abuso de límite)
        // Sin esto, podría ser coincidencia (ordenadores de biblioteca, familia, etc.)
        const { data: userSessionDates } = await supabase
          .from('user_sessions')
          .select('user_id, session_start')
          .in('user_id', userIds)
          .order('session_start', { ascending: false })
          .limit(500)

        // Agrupar sesiones por día para cada usuario
        const sessionDaysByUser = {}
        userSessionDates?.forEach(s => {
          const day = new Date(s.session_start).toISOString().split('T')[0]
          if (!sessionDaysByUser[s.user_id]) sessionDaysByUser[s.user_id] = new Set()
          sessionDaysByUser[s.user_id].add(day)
        })

        // Buscar días en que coinciden 2+ usuarios
        const allDays = new Set()
        Object.values(sessionDaysByUser).forEach(days => days.forEach(d => allDays.add(d)))

        const overlappingDays = []
        allDays.forEach(day => {
          const usersOnDay = Object.entries(sessionDaysByUser)
            .filter(([_, days]) => days.has(day))
            .map(([userId]) => userId)
          if (usersOnDay.length >= 2) {
            overlappingDays.push(day)
          }
        })

        // Si no tienen días con sesiones superpuestas, no es sospechoso
        if (overlappingDays.length === 0) continue

        // Verificar si este grupo ya fue procesado
        const pairKey = profiles.map(p => p.id).sort().join('|')
        if (processedUserPairs.has(pairKey)) continue

        // Obtener versión legible del fingerprint para mostrar
        const firstUser = deviceUsers[0]
        const shortFp = getShortFingerprint(firstUser.session)

        const reasons = [`Mismo dispositivo exacto (${shortFp}) con ${uniqueIps.length} IPs diferentes`]
        let suspicionScore = 50 // Base alta: mismo dispositivo + diferentes IPs + SESIONES MISMO DÍA

        // Añadir info de días superpuestos
        reasons.push(`${overlappingDays.length} días con sesiones de múltiples cuentas`)

        const hasSameName = profiles.some((u, i, arr) =>
          arr.some((u2, j) => i !== j &&
            u.full_name?.toLowerCase().trim() === u2.full_name?.toLowerCase().trim() &&
            u.full_name?.trim().length > 0
          )
        )
        if (hasSameName) {
          reasons.push('Mismo nombre')
          suspicionScore += 25
        }

        const hasPremium = profiles.some(u => ['premium', 'semestral', 'anual'].includes(u.plan_type))
        if (hasPremium) {
          reasons.push('Incluye cuenta premium')
          suspicionScore += 20
        }

        // Verificar registros cercanos
        const sortedByDate = [...profiles].sort((a, b) => new Date(a.created_at) - new Date(b.created_at))
        let hasCloseRegistration = false
        for (let i = 1; i < sortedByDate.length; i++) {
          const diff = Math.abs(new Date(sortedByDate[i].created_at) - new Date(sortedByDate[i-1].created_at))
          const diffDays = diff / (1000 * 60 * 60 * 24)
          if (diffDays < 7) {
            hasCloseRegistration = true
            break
          }
        }
        if (hasCloseRegistration) {
          reasons.push('Registros cercanos en tiempo')
          suspicionScore += 15
        }

        let confidence = 'baja'
        if (suspicionScore >= 70) confidence = 'muy alta'
        else if (suspicionScore >= 50) confidence = 'alta'
        else if (suspicionScore >= 35) confidence = 'media'

        multiAccounts.push({
          ip: `VPN (${uniqueIps.length} IPs)`,
          deviceFingerprint: shortFp,
          users: profiles,
          hasPremium,
          hasSameName,
          hasCloseRegistration,
          confidence,
          suspicionScore,
          reasons,
          detectionMethod: 'same_device_vpn',
          overlappingDays: overlappingDays.slice(0, 10).sort().reverse() // Últimos 10 días
        })
      }

      // Ordenar por puntuación de sospecha
      const sortedMultiAccounts = multiAccounts.sort((a, b) => b.suspicionScore - a.suspicionScore)
      setMultiAccountUsers(sortedMultiAccounts)

      // 5. Auto-guardar usuarios sospechosos en fraud_watch_list
      await autoSaveToWatchList(sortedMultiAccounts, supabase)

      // 6. Verificar fraudes confirmados por device_id
      await checkDeviceIdFraud(supabase)

    } catch (err) {
      console.error('Error cargando datos de fraude:', err)
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  // Auto-guardar usuarios sospechosos en fraud_watch_list
  async function autoSaveToWatchList(multiAccounts, supabase) {
    try {
      for (const group of multiAccounts) {
        // Solo guardar grupos con puntuación alta
        if (group.suspicionScore < 50) continue

        for (const user of group.users) {
          // Verificar si ya está en la lista
          const { data: existing } = await supabase
            .from('fraud_watch_list')
            .select('id')
            .eq('user_id', user.id)
            .maybeSingle()

          if (existing) continue // Ya está en la lista

          // Añadir a la lista de vigilancia
          const { error } = await supabase
            .from('fraud_watch_list')
            .insert({
              user_id: user.id,
              reason: group.detectionMethod || 'same_ip',
              detection_details: {
                ip: group.ip,
                fingerprint: group.deviceFingerprint,
                suspicionScore: group.suspicionScore,
                reasons: group.reasons,
                relatedEmails: group.users.map(u => u.email)
              },
              suspicion_score: group.suspicionScore,
              related_users: group.users.filter(u => u.id !== user.id).map(u => u.id)
            })

          if (error && error.code !== '23505') { // Ignorar duplicados
            console.warn('Error añadiendo a watch list:', error.message)
          }
        }
      }
      console.log('✅ Usuarios sospechosos guardados en fraud_watch_list')
    } catch (err) {
      console.warn('Error en autoSaveToWatchList:', err.message)
    }
  }

  // Verificar fraudes confirmados por device_id compartido
  async function checkDeviceIdFraud(supabase) {
    try {
      // Buscar device_ids que aparecen en múltiples usuarios
      const { data: sessions } = await supabase
        .from('user_sessions')
        .select('user_id, device_id')
        .not('device_id', 'is', null)

      if (!sessions || sessions.length === 0) return

      // Agrupar por device_id
      const deviceGroups = {}
      sessions.forEach(s => {
        if (!deviceGroups[s.device_id]) {
          deviceGroups[s.device_id] = new Set()
        }
        deviceGroups[s.device_id].add(s.user_id)
      })

      // Buscar device_ids con múltiples usuarios = fraude confirmado
      const confirmedFrauds = []
      for (const [deviceId, userIds] of Object.entries(deviceGroups)) {
        if (userIds.size > 1) {
          // Obtener perfiles de estos usuarios
          const { data: profiles } = await supabase
            .from('user_profiles')
            .select('id, email, full_name, plan_type, created_at')
            .in('id', Array.from(userIds))

          confirmedFrauds.push({
            deviceId,
            users: profiles || [],
            userCount: userIds.size
          })

          // Marcar como fraude confirmado en fraud_watch_list
          for (const userId of userIds) {
            await supabase
              .from('fraud_watch_list')
              .update({
                confirmed_fraud: true,
                confirmed_at: new Date().toISOString(),
                confirmed_device_id: deviceId
              })
              .eq('user_id', userId)
          }
        }
      }

      if (confirmedFrauds.length > 0) {
        console.log('🚨 Fraudes confirmados por device_id:', confirmedFrauds.length)
        setConfirmedFrauds(confirmedFrauds)
      }

    } catch (err) {
      console.warn('Error en checkDeviceIdFraud:', err.message)
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
            { id: 'confirmados', label: 'Confirmados', icon: '✅', count: confirmedFrauds.length, highlight: true },
            { id: 'alertas', label: 'Alertas Sistema', icon: '🚨', count: alertStats?.new || 0 },
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

        {/* Tab Fraudes Confirmados por device_id */}
        {activeTab === 'confirmados' && (
          <div className="divide-y divide-gray-200 dark:divide-gray-700">
            {/* Explicación */}
            <div className="p-4 bg-green-50 dark:bg-green-900/20 border-b border-green-200 dark:border-green-800">
              <p className="text-sm text-green-800 dark:text-green-200">
                <strong>Fraudes 100% confirmados:</strong> Múltiples cuentas detectadas usando el mismo dispositivo (device_id).
              </p>
              <p className="text-xs text-green-600 dark:text-green-400 mt-1">
                El device_id es un identificador único por navegador/dispositivo. Si aparece en varias cuentas, es la misma persona.
              </p>
            </div>

            {confirmedFrauds.length === 0 ? (
              <div className="p-8 text-center text-gray-500">
                <div className="text-4xl mb-3">🔍</div>
                <p>No hay fraudes confirmados por device_id todavía</p>
                <p className="text-xs mt-2">Los usuarios sospechosos están siendo vigilados. Cuando usen múltiples cuentas desde el mismo dispositivo, aparecerán aquí.</p>
              </div>
            ) : (
              confirmedFrauds.map((fraud, idx) => (
                <div key={idx} className="p-4">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <span className="text-xl">🚨</span>
                      <span className="font-bold text-red-600">{fraud.userCount} cuentas = misma persona</span>
                      <span className="px-2 py-0.5 bg-green-100 text-green-800 text-xs rounded-full font-medium">
                        CONFIRMADO
                      </span>
                    </div>
                  </div>

                  <div className="text-xs mb-3 p-2 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded">
                    <div className="font-semibold text-red-800 dark:text-red-200 mb-1">🔒 Device ID compartido:</div>
                    <div className="text-red-700 dark:text-red-300 font-mono text-[10px] break-all">{fraud.deviceId}</div>
                  </div>

                  <div className="space-y-2">
                    {fraud.users.map(user => (
                      <div key={user.id} className="flex items-center justify-between p-2 bg-gray-50 dark:bg-gray-700 rounded">
                        <div>
                          <div className="font-medium text-sm">{user.full_name || 'Sin nombre'}</div>
                          <div className="text-xs text-gray-500">{user.email}</div>
                          <div className="text-xs text-gray-400">
                            Registro: {formatDate(user.created_at)}
                          </div>
                        </div>
                        {getPlanBadge(user.plan_type)}
                      </div>
                    ))}
                  </div>

                  <div className="mt-3 flex gap-2">
                    <button className="px-3 py-1 bg-red-600 text-white text-xs rounded hover:bg-red-700">
                      Bloquear cuentas
                    </button>
                    <button className="px-3 py-1 bg-gray-200 text-gray-700 text-xs rounded hover:bg-gray-300">
                      Enviar advertencia
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {/* Tab Alertas del Sistema */}
        {activeTab === 'alertas' && (
          <div className="p-6">
            {/* Filtros de estado */}
            <div className="flex flex-wrap gap-2 mb-6">
              {[
                { id: 'new', label: 'Nuevas', count: alertStats?.new, color: 'red' },
                { id: 'reviewed', label: 'Revisadas', count: alertStats?.reviewed, color: 'yellow' },
                { id: 'dismissed', label: 'Descartadas', count: alertStats?.dismissed, color: 'gray' },
                { id: 'action_taken', label: 'Acción tomada', count: alertStats?.action_taken, color: 'green' },
              ].map(filter => (
                <button
                  key={filter.id}
                  onClick={() => setAlertFilter(filter.id)}
                  className={`px-4 py-2 rounded-lg flex items-center gap-2 transition-colors ${
                    alertFilter === filter.id
                      ? `bg-${filter.color}-100 text-${filter.color}-800 border-2 border-${filter.color}-400`
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  {filter.label}
                  {filter.count > 0 && (
                    <span className={`text-xs px-2 py-0.5 rounded-full ${
                      alertFilter === filter.id ? `bg-${filter.color}-200` : 'bg-gray-200'
                    }`}>
                      {filter.count}
                    </span>
                  )}
                </button>
              ))}
            </div>

            {/* Lista de alertas */}
            {alerts.length === 0 ? (
              <div className="text-center py-12">
                <span className="text-6xl">✅</span>
                <p className="text-gray-600 dark:text-gray-400 mt-4">
                  No hay alertas {alertFilter === 'new' ? 'nuevas' : alertFilter === 'reviewed' ? 'revisadas' : alertFilter === 'dismissed' ? 'descartadas' : 'con acción tomada'}
                </p>
                <p className="text-sm text-gray-500 mt-2">
                  El cron de detección se ejecuta periódicamente para buscar patrones sospechosos
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {alerts.map(alert => (
                  <div
                    key={alert.id}
                    className={`p-4 rounded-lg border-l-4 ${
                      alert.severity === 'critical' ? 'bg-red-50 border-red-500 dark:bg-red-900/20' :
                      alert.severity === 'high' ? 'bg-orange-50 border-orange-500 dark:bg-orange-900/20' :
                      alert.severity === 'medium' ? 'bg-yellow-50 border-yellow-500 dark:bg-yellow-900/20' :
                      'bg-blue-50 border-blue-500 dark:bg-blue-900/20'
                    }`}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <span className="text-xl">
                            {alert.alert_type === 'same_ip' ? '🌐' :
                             alert.alert_type === 'same_device' ? '📱' :
                             alert.alert_type === 'multi_account' ? '👥' :
                             alert.alert_type === 'suspicious_premium' ? '💳' : '⚠️'}
                          </span>
                          <span className="font-semibold capitalize">
                            {alert.alert_type?.replace(/_/g, ' ')}
                          </span>
                          <span className={`px-2 py-0.5 text-xs rounded-full ${
                            alert.severity === 'critical' ? 'bg-red-200 text-red-800' :
                            alert.severity === 'high' ? 'bg-orange-200 text-orange-800' :
                            alert.severity === 'medium' ? 'bg-yellow-200 text-yellow-800' :
                            'bg-blue-200 text-blue-800'
                          }`}>
                            {alert.severity}
                          </span>
                          {alert.details?.hasPremium && (
                            <span className="px-2 py-0.5 text-xs rounded-full bg-purple-200 text-purple-800">
                              PREMIUM
                            </span>
                          )}
                        </div>

                        <div className="text-sm text-gray-700 dark:text-gray-300 space-y-1">
                          {alert.details?.emails && (
                            <p><strong>Emails:</strong> {alert.details.emails.join(', ')}</p>
                          )}
                          {alert.details?.email && !alert.details?.emails && (
                            <p><strong>Email:</strong> {alert.details.email}</p>
                          )}
                          {alert.details?.names && (
                            <p><strong>Nombres:</strong> {alert.details.names.filter(Boolean).join(', ') || '-'}</p>
                          )}
                          {alert.details?.ips && (
                            <p><strong>IPs:</strong> {alert.details.ips.join(', ')}</p>
                          )}
                          {alert.details?.locations && (
                            <p><strong>Ubicaciones:</strong> {alert.details.locations.join(', ')}</p>
                          )}
                          {alert.match_criteria && (
                            <p><strong>Criterio:</strong> {alert.match_criteria}</p>
                          )}
                        </div>

                        <div className="mt-2 text-xs text-gray-500">
                          Detectado: {formatDate(alert.detected_at)}
                          {alert.reviewed_at && ` • Revisado: ${formatDate(alert.reviewed_at)}`}
                        </div>

                        {alert.notes && (
                          <div className="mt-2 p-2 bg-white/50 rounded text-sm">
                            <strong>Notas:</strong> {alert.notes}
                          </div>
                        )}
                      </div>

                      {/* Acciones */}
                      {alertFilter === 'new' && (
                        <div className="flex flex-col gap-2 ml-4">
                          <button
                            onClick={() => updateAlertStatus(alert.id, 'reviewed')}
                            className="px-3 py-1 text-sm bg-yellow-500 text-white rounded hover:bg-yellow-600"
                          >
                            Revisar
                          </button>
                          <button
                            onClick={() => updateAlertStatus(alert.id, 'dismissed')}
                            className="px-3 py-1 text-sm bg-gray-500 text-white rounded hover:bg-gray-600"
                          >
                            Descartar
                          </button>
                          <button
                            onClick={() => {
                              const notes = prompt('Notas sobre la acción tomada:')
                              if (notes !== null) {
                                updateAlertStatus(alert.id, 'action_taken', notes)
                              }
                            }}
                            className="px-3 py-1 text-sm bg-green-500 text-white rounded hover:bg-green-600"
                          >
                            Acción
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

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
            {/* Explicación */}
            <div className="p-4 bg-blue-50 dark:bg-blue-900/20 border-b border-blue-200 dark:border-blue-800">
              <p className="text-sm text-blue-800 dark:text-blue-200">
                <strong>Detección de multi-cuentas:</strong> Detecta usuarios que crean varias cuentas para saltarse el límite FREE.
              </p>
              <p className="text-xs text-blue-600 dark:text-blue-300 mt-1">
                • <strong>Misma IP:</strong> Varias cuentas registradas desde la misma IP<br/>
                • <strong>VPN:</strong> Mismo dispositivo/navegador pero IPs diferentes (usa VPN para ocultar)
              </p>
            </div>

            {(showOnlyPremium ? multiAccountUsers.filter(g => g.hasPremium) : multiAccountUsers).length === 0 ? (
              <div className="p-8 text-center text-gray-500">
                No se detectaron multi-cuentas{showOnlyPremium ? ' con premium' : ''}
              </div>
            ) : (
              (showOnlyPremium ? multiAccountUsers.filter(g => g.hasPremium) : multiAccountUsers).map((group, idx) => (
                <div key={idx} className="p-4">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <span className="text-xl">{group.detectionMethod === 'same_device_vpn' ? '🔀' : '👥'}</span>
                      <span className="font-medium">{group.users.length} cuentas relacionadas</span>
                      {group.detectionMethod === 'same_device_vpn' && (
                        <span className="px-2 py-0.5 bg-purple-100 text-purple-800 text-xs rounded-full font-medium">
                          VPN
                        </span>
                      )}
                      {group.hasPremium && (
                        <span className="px-2 py-0.5 bg-red-100 text-red-800 text-xs rounded-full font-medium">
                          🔴 PREMIUM
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      {group.suspicionScore && (
                        <span className={`px-2 py-1 rounded text-xs font-bold ${
                          group.suspicionScore >= 70 ? 'bg-red-100 text-red-800' :
                          group.suspicionScore >= 50 ? 'bg-orange-100 text-orange-800' :
                          'bg-yellow-100 text-yellow-800'
                        }`}>
                          {group.suspicionScore}%
                        </span>
                      )}
                      <span className={`px-2 py-1 rounded text-xs ${
                        group.confidence === 'muy alta' ? 'bg-red-100 text-red-800' :
                        group.confidence === 'alta' ? 'bg-orange-100 text-orange-800' :
                        'bg-yellow-100 text-yellow-800'
                      }`}>
                        {group.confidence}
                      </span>
                    </div>
                  </div>

                  <div className="text-xs text-gray-500 mb-3 space-y-1 bg-gray-50 dark:bg-gray-800 p-2 rounded">
                    {group.reasons.map((reason, i) => (
                      <div key={i}>✓ {reason}</div>
                    ))}
                  </div>

                  {/* Mostrar detalles del fingerprint para detección VPN */}
                  {group.detectionMethod === 'same_device_vpn' && group.deviceFingerprint && (
                    <div className="text-xs mb-3 p-2 bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-800 rounded">
                      <div className="font-semibold text-purple-800 dark:text-purple-200 mb-1">🖥️ Dispositivo idéntico detectado:</div>
                      <div className="text-purple-700 dark:text-purple-300 font-mono">{group.deviceFingerprint}</div>
                      <div className="text-purple-600 dark:text-purple-400 mt-1 text-[10px]">
                        Coincide: Resolución + Profundidad color + Escala pantalla + Navegador/versión + OS
                      </div>
                      {group.overlappingDays && group.overlappingDays.length > 0 && (
                        <div className="mt-2 pt-2 border-t border-purple-200 dark:border-purple-700">
                          <div className="font-semibold text-purple-800 dark:text-purple-200">📅 Días con sesiones de múltiples cuentas:</div>
                          <div className="text-purple-700 dark:text-purple-300 mt-1">
                            {group.overlappingDays.map(d => new Date(d).toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit' })).join(', ')}
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Mostrar IP para detección por misma IP */}
                  {group.detectionMethod === 'same_ip' && group.ip && (
                    <div className="text-xs mb-3 p-2 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded">
                      <div className="font-semibold text-blue-800 dark:text-blue-200 mb-1">🌐 IP de registro:</div>
                      <div className="text-blue-700 dark:text-blue-300 font-mono">{group.ip}</div>
                    </div>
                  )}

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
            {/* Explicación */}
            <div className="p-4 bg-blue-50 dark:bg-blue-900/20 border-b border-blue-200 dark:border-blue-800">
              <p className="text-sm text-blue-800 dark:text-blue-200">
                <strong>Usuarios FREE con múltiples cuentas</strong> para saltarse el límite de 25 preguntas/día.
              </p>
            </div>

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

        {/* Tab Mismo Dispositivo + IP (Combinado) */}
        {activeTab === 'mismo-dispositivo' && (
          <div className="divide-y divide-gray-200 dark:divide-gray-700">
            {/* Explicación del sistema */}
            <div className="p-4 bg-blue-50 dark:bg-blue-900/20 border-b border-blue-200 dark:border-blue-800">
              <p className="text-sm text-blue-800 dark:text-blue-200">
                <strong>Detección combinada:</strong> Muestra usuarios que comparten <strong>misma IP + mismo tipo de dispositivo</strong>.
                Puntuación basada en: IP+dispositivo (30pts), premium compartido (+30pts), sesiones cercanas en tiempo (+25pts), +2 usuarios (+15pts).
              </p>
            </div>

            {(showOnlyPremium ? sameDeviceGroups.filter(g => g.hasPremium) : sameDeviceGroups).length === 0 ? (
              <div className="p-8 text-center text-gray-500">
                No se encontraron grupos sospechosos{showOnlyPremium ? ' con premium' : ''}
              </div>
            ) : (
              (showOnlyPremium ? sameDeviceGroups.filter(g => g.hasPremium) : sameDeviceGroups).slice(0, 20).map((group, idx) => (
                <div key={idx} className="p-4">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-3">
                      {/* Puntuación de sospecha */}
                      <div className={`px-3 py-1 rounded-full text-sm font-bold ${
                        group.suspicionScore >= 70 ? 'bg-red-100 text-red-800' :
                        group.suspicionScore >= 50 ? 'bg-orange-100 text-orange-800' :
                        'bg-yellow-100 text-yellow-800'
                      }`}>
                        {group.suspicionScore}% sospecha
                      </div>
                      <span className="text-gray-500">({group.userCount} usuarios)</span>
                    </div>
                    <div className="flex items-center gap-2">
                      {group.hasPremium && (
                        <span className="px-2 py-0.5 bg-red-100 text-red-800 text-xs rounded-full font-medium">
                          🔴 PREMIUM
                        </span>
                      )}
                      {group.hasCloseTimeSessions && (
                        <span className="px-2 py-0.5 bg-orange-100 text-orange-800 text-xs rounded-full font-medium">
                          ⏱️ TIEMPO CERCANO
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Información de IP y dispositivo */}
                  <div className="grid grid-cols-2 gap-2 mb-3 text-xs">
                    <div className="bg-gray-100 dark:bg-gray-700 p-2 rounded">
                      <span className="text-gray-500">IP:</span>{' '}
                      <span className="font-mono font-medium">{group.ip}</span>
                    </div>
                    <div className="bg-gray-100 dark:bg-gray-700 p-2 rounded">
                      <span className="text-gray-500">Dispositivo:</span>{' '}
                      <span className="font-medium">{group.deviceCategory}</span>
                    </div>
                  </div>

                  {/* Lista de usuarios */}
                  <div className="space-y-2">
                    {group.users.map(user => {
                      const sessionInfo = group.sessionDetails?.find(s => s.user_id === user.id)
                      return (
                        <div key={user.id} className="flex items-center justify-between p-2 bg-gray-50 dark:bg-gray-700 rounded">
                          <div>
                            <div className="font-medium text-sm">{user.full_name || 'Sin nombre'}</div>
                            <div className="text-xs text-gray-500">{user.email}</div>
                            {sessionInfo && (
                              <div className="text-xs text-gray-400 mt-1">
                                {sessionInfo.sessionCount} sesiones • Última: {new Date(sessionInfo.lastSession).toLocaleDateString('es-ES')}
                              </div>
                            )}
                          </div>
                          {getPlanBadge(user.plan_type)}
                        </div>
                      )
                    })}
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
