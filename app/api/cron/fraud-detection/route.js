// app/api/cron/fraud-detection/route.js
// Endpoint para detección automática de fraudes - llamado por GitHub Action
import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

export async function GET(request) {
  // Verificar autorización
  const authHeader = request.headers.get('authorization')
  const expectedToken = `Bearer ${process.env.CRON_SECRET}`

  if (authHeader !== expectedToken) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    console.log('🔍 Iniciando detección de fraudes...')
    const alerts = []

    // 1. Detectar múltiples cuentas con misma IP de registro
    const ipAlerts = await detectSameIPAccounts()
    alerts.push(...ipAlerts)

    // 2. Detectar sesiones sospechosas (mismo dispositivo en múltiples cuentas)
    const deviceAlerts = await detectSharedDevices()
    alerts.push(...deviceAlerts)

    // 3. Detectar respuestas sospechosamente rápidas (posible bot)
    const botAlerts = await detectBotBehavior()
    alerts.push(...botAlerts)

    // 4. Detectar cuentas premium compartidas
    const premiumAlerts = await detectSharedPremium()
    alerts.push(...premiumAlerts)

    // Guardar alertas nuevas (evitar duplicados)
    let savedCount = 0
    for (const alert of alerts) {
      // Verificar si ya existe una alerta similar reciente (últimas 24h)
      const { data: existing } = await supabase
        .from('fraud_alerts')
        .select('id')
        .eq('alert_type', alert.alert_type)
        .eq('affected_user_ids', alert.affected_user_ids)
        .gte('detected_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
        .limit(1)

      if (!existing || existing.length === 0) {
        const { error } = await supabase
          .from('fraud_alerts')
          .insert(alert)

        if (!error) savedCount++
      }
    }

    console.log(`✅ Detección completada: ${alerts.length} alertas encontradas, ${savedCount} nuevas guardadas`)

    return NextResponse.json({
      success: true,
      alertsFound: alerts.length,
      alertsSaved: savedCount,
      timestamp: new Date().toISOString()
    })

  } catch (error) {
    console.error('❌ Error en detección de fraudes:', error)
    return NextResponse.json({
      success: false,
      error: error.message
    }, { status: 500 })
  }
}

// Detectar múltiples cuentas desde la misma IP
async function detectSameIPAccounts() {
  const alerts = []

  const { data: profiles } = await supabase
    .from('user_profiles')
    .select('id, email, registration_ip, created_at, plan_type')
    .not('registration_ip', 'is', null)

  if (!profiles) return alerts

  // Agrupar por IP
  const ipGroups = {}
  profiles.forEach(user => {
    const ip = user.registration_ip
    if (!ipGroups[ip]) ipGroups[ip] = []
    ipGroups[ip].push(user)
  })

  // Crear alertas para IPs con más de 2 cuentas
  for (const [ip, users] of Object.entries(ipGroups)) {
    if (users.length >= 3) {
      const hasPremium = users.some(u => ['premium', 'semestral', 'anual'].includes(u.plan_type))

      alerts.push({
        alert_type: 'same_ip_multiple_accounts',
        severity: hasPremium ? 'high' : 'medium',
        description: `${users.length} cuentas registradas desde la misma IP: ${ip}`,
        affected_user_ids: users.map(u => u.id),
        metadata: {
          ip,
          users: users.map(u => ({ id: u.id, email: u.email, created_at: u.created_at })),
          hasPremium
        },
        status: 'new',
        detected_at: new Date().toISOString()
      })
    }
  }

  return alerts
}

// Detectar dispositivos compartidos entre cuentas
async function detectSharedDevices() {
  const alerts = []

  // Obtener sesiones recientes (últimos 7 días)
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()

  const { data: sessions } = await supabase
    .from('user_sessions')
    .select('user_id, user_agent, ip_address')
    .gte('session_start', sevenDaysAgo)
    .not('user_agent', 'is', null)

  if (!sessions) return alerts

  // Agrupar por user_agent
  const deviceGroups = {}
  sessions.forEach(s => {
    const ua = s.user_agent?.substring(0, 150) || 'unknown'
    if (!deviceGroups[ua]) deviceGroups[ua] = new Set()
    deviceGroups[ua].add(s.user_id)
  })

  // Alertar si un dispositivo se usa en más de 3 cuentas
  for (const [ua, userIds] of Object.entries(deviceGroups)) {
    const uniqueUsers = Array.from(userIds)
    if (uniqueUsers.length >= 3 && ua !== 'unknown') {
      alerts.push({
        alert_type: 'shared_device',
        severity: 'medium',
        description: `Dispositivo compartido entre ${uniqueUsers.length} cuentas`,
        affected_user_ids: uniqueUsers,
        metadata: {
          user_agent: ua,
          userCount: uniqueUsers.length
        },
        status: 'new',
        detected_at: new Date().toISOString()
      })
    }
  }

  return alerts
}

// Detectar comportamiento de bot (respuestas muy rápidas)
async function detectBotBehavior() {
  const alerts = []

  // Buscar tests donde el tiempo promedio por pregunta es menor a 3 segundos
  const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()

  const { data: tests } = await supabase
    .from('tests')
    .select('id, user_id, total_questions, total_time_seconds, completed_at')
    .eq('is_completed', true)
    .gte('completed_at', oneDayAgo)
    .gt('total_questions', 5)
    .gt('total_time_seconds', 0)

  if (!tests) return alerts

  // Calcular tiempo promedio por pregunta
  const suspiciousUsers = {}
  tests.forEach(test => {
    const avgTimePerQuestion = test.total_time_seconds / test.total_questions

    // Menos de 3 segundos por pregunta es muy sospechoso
    if (avgTimePerQuestion < 3) {
      if (!suspiciousUsers[test.user_id]) {
        suspiciousUsers[test.user_id] = { tests: [], avgTimes: [] }
      }
      suspiciousUsers[test.user_id].tests.push(test.id)
      suspiciousUsers[test.user_id].avgTimes.push(avgTimePerQuestion)
    }
  })

  // Crear alertas para usuarios con múltiples tests sospechosos
  for (const [userId, data] of Object.entries(suspiciousUsers)) {
    if (data.tests.length >= 2) {
      const avgTime = data.avgTimes.reduce((a, b) => a + b, 0) / data.avgTimes.length

      alerts.push({
        alert_type: 'bot_behavior',
        severity: 'high',
        description: `Posible bot: ${data.tests.length} tests con promedio de ${avgTime.toFixed(1)}s por pregunta`,
        affected_user_ids: [userId],
        metadata: {
          testIds: data.tests,
          avgTimePerQuestion: avgTime,
          suspiciousTestCount: data.tests.length
        },
        status: 'new',
        detected_at: new Date().toISOString()
      })
    }
  }

  return alerts
}

// Detectar cuentas premium posiblemente compartidas
async function detectSharedPremium() {
  const alerts = []

  // Buscar cuentas premium con sesiones desde múltiples IPs en poco tiempo
  const { data: premiumUsers } = await supabase
    .from('user_profiles')
    .select('id, email, plan_type')
    .in('plan_type', ['premium', 'semestral', 'anual'])

  if (!premiumUsers) return alerts

  const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()

  for (const user of premiumUsers) {
    // Obtener IPs únicas de las últimas 24h
    const { data: sessions } = await supabase
      .from('user_sessions')
      .select('ip_address, city, region')
      .eq('user_id', user.id)
      .gte('session_start', oneDayAgo)
      .not('ip_address', 'is', null)

    if (!sessions) continue

    const uniqueIps = new Set(sessions.map(s => s.ip_address))
    const uniqueLocations = new Set(sessions.map(s => `${s.city}-${s.region}`))

    // Más de 3 IPs diferentes y más de 2 ubicaciones distintas es sospechoso
    if (uniqueIps.size >= 4 && uniqueLocations.size >= 3) {
      alerts.push({
        alert_type: 'shared_premium_account',
        severity: 'critical',
        description: `Cuenta premium usada desde ${uniqueIps.size} IPs y ${uniqueLocations.size} ubicaciones en 24h`,
        affected_user_ids: [user.id],
        metadata: {
          email: user.email,
          uniqueIps: uniqueIps.size,
          uniqueLocations: uniqueLocations.size,
          locations: Array.from(uniqueLocations)
        },
        status: 'new',
        detected_at: new Date().toISOString()
      })
    }
  }

  return alerts
}
