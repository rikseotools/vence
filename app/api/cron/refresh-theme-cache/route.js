import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

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

    console.log('🔄 Ejecutando refresh_all_theme_performance_cache...')
    const startTime = Date.now()

    const { data, error } = await supabase.rpc('refresh_all_theme_performance_cache')

    if (error) {
      console.error('❌ Error actualizando caché de rendimiento por tema:', error)
      return NextResponse.json({
        success: false,
        error: error.message
      }, { status: 500 })
    }

    const duration = ((Date.now() - startTime) / 1000).toFixed(2)
    const usersProcessed = data?.length || 0
    const totalTopics = data?.reduce((sum, row) => sum + (row.topics_cached || 0), 0) || 0

    console.log(`✅ Caché de rendimiento por tema actualizado: ${usersProcessed} usuarios, ${totalTopics} temas en ${duration}s`)

    return NextResponse.json({
      success: true,
      message: 'Caché de rendimiento por tema actualizado correctamente',
      stats: {
        usersProcessed,
        totalTopics,
        durationSeconds: parseFloat(duration)
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
