import { createClient } from '@supabase/supabase-js'

export async function GET(request) {
  try {
    // Verificar authorization header
    const authHeader = request.headers.get('authorization')
    const expectedAuth = `Bearer ${process.env.CRON_SECRET}`

    if (authHeader !== expectedAuth) {
      console.error('❌ Unauthorized request to update-streaks cron')
      return new Response('Unauthorized', { status: 401 })
    }

    // Usar service role key para ejecutar RPC
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    )

    console.log('🔄 Ejecutando batch_update_user_streaks...')
    const { error } = await supabase.rpc('batch_update_user_streaks')

    if (error) {
      console.error('❌ Error actualizando rachas:', error)
      return Response.json({
        success: false,
        error: error.message
      }, { status: 500 })
    }

    console.log('✅ Rachas actualizadas correctamente')
    return Response.json({
      success: true,
      message: 'Rachas actualizadas correctamente',
      timestamp: new Date().toISOString()
    })

  } catch (error) {
    console.error('❌ Error inesperado:', error)
    return Response.json({
      success: false,
      error: error.message
    }, { status: 500 })
  }
}
# Force redeploy sábado, 13 de diciembre de 2025, 13:05:41 CET
