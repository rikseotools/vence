import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// Permitir hasta 60 segundos para procesar todos los usuarios
export const maxDuration = 60

export async function GET(request) {
  try {
    // Verificar authorization header
    const authHeader = request.headers.get('authorization')
    const expectedAuth = `Bearer ${process.env.CRON_SECRET}`

    if (authHeader !== expectedAuth) {
      console.error('❌ Unauthorized request to refresh-theme-cache cron')
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Usar service role key para ejecutar RPC
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    )

    console.log('🔄 Iniciando refresh de caché de rendimiento por tema...')
    const startTime = Date.now()

    // 1. Obtener usuarios activos (últimos 90 días con tests completados)
    const { data: activeUsers, error: usersError } = await supabase
      .from('tests')
      .select('user_id')
      .gte('created_at', new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString())
      .eq('is_completed', true)

    if (usersError) {
      console.error('❌ Error obteniendo usuarios activos:', usersError)
      return NextResponse.json({
        success: false,
        error: usersError.message
      }, { status: 500 })
    }

    // Obtener usuarios únicos
    const uniqueUserIds = [...new Set(activeUsers?.map(t => t.user_id) || [])]
    console.log(`📊 Procesando ${uniqueUserIds.length} usuarios activos...`)

    // 2. Procesar cada usuario individualmente (evita timeout del loop SQL)
    let usersProcessed = 0
    let totalTopics = 0
    const errors = []

    for (const userId of uniqueUserIds) {
      try {
        const { data: topicsCount, error: refreshError } = await supabase.rpc(
          'refresh_user_theme_performance_cache',
          { p_user_id: userId }
        )

        if (refreshError) {
          errors.push({ userId: userId.slice(0, 8), error: refreshError.message })
          console.warn(`⚠️ Error procesando usuario ${userId.slice(0, 8)}:`, refreshError.message)
        } else {
          usersProcessed++
          totalTopics += topicsCount || 0
        }
      } catch (err) {
        errors.push({ userId: userId.slice(0, 8), error: err.message })
      }
    }

    const duration = ((Date.now() - startTime) / 1000).toFixed(2)

    console.log(`✅ Caché de rendimiento por tema actualizado: ${usersProcessed}/${uniqueUserIds.length} usuarios, ${totalTopics} temas en ${duration}s`)

    if (errors.length > 0) {
      console.warn(`⚠️ ${errors.length} errores durante el procesamiento`)
    }

    return NextResponse.json({
      success: true,
      message: 'Caché de rendimiento por tema actualizado correctamente',
      stats: {
        usersProcessed,
        totalUsers: uniqueUserIds.length,
        totalTopics,
        durationSeconds: parseFloat(duration),
        errors: errors.length > 0 ? errors.slice(0, 5) : undefined
      },
      timestamp: new Date().toISOString()
    })

  } catch (error) {
    console.error('❌ Error inesperado:', error)
    return NextResponse.json({
      success: false,
      error: error.message
    }, { status: 500 })
  }
}
