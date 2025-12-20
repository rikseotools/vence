import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export async function POST(request) {
  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    )

    console.log('🔍 Cargando usuarios con configuraciones de push...')

    // Cargar usuarios
    const { data: usersData, error } = await supabase
      .from('user_profiles')
      .select(`
        id,
        email,
        full_name,
        created_at
      `)
      .order('created_at', { ascending: false })
      .limit(500)

    if (error) throw error

    console.log(`👥 ${usersData?.length || 0} usuarios cargados`)

    // Cargar configuraciones de notificación
    const userIds = usersData?.map(u => u.id) || []
    
    if (userIds.length === 0) {
      return NextResponse.json({
        success: true,
        users: [],
        message: 'No hay usuarios en el sistema'
      })
    }

    console.log(`🔍 Buscando configuraciones para ${userIds.length} usuarios...`)
    console.log('📋 Primeros 3 user IDs:', userIds.slice(0, 3))

    const { data: notificationSettings, error: nsError } = await supabase
      .from('user_notification_settings')
      .select('user_id, push_enabled, push_subscription, created_at, updated_at')
      .in('user_id', userIds)

    if (nsError) {
      console.error('❌ Error loading notification settings:', nsError)
      // Continuar sin configuraciones
    } else {
      console.log(`✅ ${notificationSettings?.length || 0} configuraciones encontradas`)
      
      // Debuggear configuraciones encontradas
      notificationSettings?.forEach(ns => {
        console.log(`📋 Config encontrada: ${ns.user_id} - enabled:${ns.push_enabled} - subscription:${!!ns.push_subscription}`)
      })
    }

    console.log(`⚙️ ${notificationSettings?.length || 0} configuraciones de notificación cargadas`)

    // Combinar datos y filtrar solo usuarios con push habilitado
    const usersWithPush = usersData?.filter(user => {
      const userSettings = notificationSettings?.find(ns => ns.user_id === user.id)
      return userSettings && 
             userSettings.push_enabled && 
             userSettings.push_subscription
    }).map(user => {
      const userSettings = notificationSettings?.find(ns => ns.user_id === user.id)
      return {
        ...user,
        user_notification_settings: userSettings
      }
    }) || []

    console.log(`🎯 ${usersWithPush.length} usuarios con push habilitado filtrados`)

    return NextResponse.json({
      success: true,
      users: usersWithPush,
      stats: {
        totalUsers: usersData?.length || 0,
        usersWithSettings: notificationSettings?.length || 0,
        usersWithPushEnabled: usersWithPush.length
      },
      message: `${usersWithPush.length} usuarios con push habilitado cargados exitosamente`
    })

  } catch (error) {
    console.error('❌ Error cargando usuarios:', error)
    return NextResponse.json(
      { error: 'Error interno del servidor: ' + error.message },
      { status: 500 }
    )
  }
}