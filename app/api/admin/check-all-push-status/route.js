import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export async function POST(request) {
  try {
    console.log('🔍 Iniciando verificación masiva de estado push...')

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    )

    // Obtener todos los usuarios con sus configuraciones de notificaciones
    const { data: usersData, error: usersError } = await supabase
      .from('user_profiles')
      .select(`
        id,
        email,
        full_name,
        created_at
      `)
      .order('created_at', { ascending: false })

    if (usersError) {
      console.error('❌ Error obteniendo usuarios:', usersError)
      return NextResponse.json(
        { error: 'Error obteniendo usuarios' },
        { status: 500 }
      )
    }

    console.log(`📊 Analizando ${usersData?.length || 0} usuarios...`)

    // Obtener configuraciones de notificaciones por separado
    const { data: notificationSettings, error: settingsError } = await supabase
      .from('user_notification_settings')
      .select('user_id, push_enabled, push_subscription, created_at, updated_at, disabled_reason')

    if (settingsError) {
      console.error('❌ Error obteniendo configuraciones:', settingsError)
      return NextResponse.json(
        { error: 'Error obteniendo configuraciones de notificaciones' },
        { status: 500 }
      )
    }

    const stats = {
      totalUsers: usersData?.length || 0,
      activeUsers: 0,
      inactiveUsers: 0,
      expiredUsers: 0,
      neverConfigured: 0,
      details: []
    }

    const userDetails = []

    // Analizar cada usuario
    for (const user of usersData || []) {
      const userSettings = notificationSettings?.find(ns => ns.user_id === user.id)
      
      let status = 'never_configured'
      let statusLabel = '❌ Nunca configurado'
      let details = 'Usuario nunca ha configurado notificaciones'

      if (userSettings) {
        if (userSettings.push_enabled && userSettings.push_subscription) {
          // Verificar si es una suscripción fake o real
          try {
            const subscription = JSON.parse(userSettings.push_subscription)
            const isFakeSubscription = subscription.endpoint?.includes('FAKE_ENDPOINT_FOR_TESTING')
            
            if (isFakeSubscription) {
              status = 'test_user'
              statusLabel = '🧪 Usuario de prueba'
              details = 'Configurado con suscripción fake para testing'
            } else {
              status = 'active'
              statusLabel = '🟢 Activo'
              details = 'Push notifications habilitadas con suscripción real'
            }
          } catch (parseError) {
            status = 'invalid_subscription'
            statusLabel = '⚠️ Suscripción inválida'
            details = 'Configuración corrupta, necesita reconfiguración'
          }
        } else if (userSettings.disabled_reason) {
          status = 'disabled'
          statusLabel = '🔴 Desactivado'
          details = `Desactivado: ${userSettings.disabled_reason}`
        } else {
          status = 'inactive'
          statusLabel = '🔴 Inactivo'
          details = 'Configuración existente pero push deshabilitado'
        }
      }

      // Contar por categorías
      switch (status) {
        case 'active':
          stats.activeUsers++
          break
        case 'inactive':
        case 'disabled':
          stats.inactiveUsers++
          break
        case 'invalid_subscription':
          stats.expiredUsers++
          break
        case 'never_configured':
          stats.neverConfigured++
          break
      }

      userDetails.push({
        id: user.id,
        email: user.email,
        name: user.full_name || 'Sin nombre',
        status,
        statusLabel,
        details,
        created: user.created_at?.substring(0, 10),
        lastUpdate: userSettings?.updated_at?.substring(0, 10) || 'Nunca'
      })
    }

    // Tomar muestra de usuarios para mostrar en detalles
    stats.details = userDetails.slice(0, 10) // Primeros 10 usuarios como muestra

    console.log('📊 Estadísticas finales:', {
      total: stats.totalUsers,
      active: stats.activeUsers,
      inactive: stats.inactiveUsers,
      expired: stats.expiredUsers,
      never: stats.neverConfigured
    })

    return NextResponse.json({
      success: true,
      message: 'Verificación de estado completada exitosamente',
      stats,
      timestamp: new Date().toISOString(),
      summary: `${stats.activeUsers} activos de ${stats.totalUsers} usuarios totales`
    })

  } catch (error) {
    console.error('❌ Error en verificación masiva:', error)
    return NextResponse.json(
      { error: 'Error interno: ' + error.message },
      { status: 500 }
    )
  }
}