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

    // 1. Obtener usuarios que completaron tests HOY (no necesitamos refrescar los demás)
    const { data: activeUsers, error: usersError } = await supabase
      .from('tests')
      .select('user_id')
      .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
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

    // 2. Procesar en batches paralelos de 5
    const BATCH_SIZE = 5
    let usersProcessed = 0
    let totalTopics = 0
    const errors = []

    for (let i = 0; i < uniqueUserIds.length; i += BATCH_SIZE) {
      const batch = uniqueUserIds.slice(i, i + BATCH_SIZE)

      const results = await Promise.allSettled(
        batch.map(userId =>
          supabase.rpc('refresh_user_theme_performance_cache', { p_user_id: userId })
            .then(({ data: topicsCount, error: refreshError }) => {
              if (refreshError) throw new Error(refreshError.message)
              return { userId, topicsCount: topicsCount || 0 }
            })
        )
      )

      for (const result of results) {
        if (result.status === 'fulfilled') {
          usersProcessed++
          totalTopics += result.value.topicsCount
        } else {
          errors.push({ error: result.reason.message })
        }
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
