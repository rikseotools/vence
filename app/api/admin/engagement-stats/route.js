import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

// Esta API route maneja las consultas que requieren service role key
// para evitar exponer la key en el cliente
export async function GET(request) {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

    if (!supabaseUrl || !supabaseServiceKey) {
      console.error('Missing environment variables:', {
        hasUrl: !!supabaseUrl,
        hasServiceKey: !!supabaseServiceKey
      })
      return NextResponse.json(
        { error: 'Missing environment variables' },
        { status: 500 }
      )
    }

    // Crear cliente con service role key (solo en el servidor)
    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    })

    // Obtener usuarios activos en los últimos 30 días a través de tests completados
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()

    const { data: activeTests, error: activeError } = await supabase
      .from('tests')
      .select('user_id')
      .eq('is_completed', true)
      .gte('completed_at', thirtyDaysAgo)

    if (activeError) {
      console.error('Error fetching active users:', activeError)
      return NextResponse.json(
        { error: 'Failed to fetch active users' },
        { status: 500 }
      )
    }

    // Obtener usuarios únicos activos
    const activeUserIds = new Set(activeTests?.map(t => t.user_id) || [])
    const activeUsersCount = activeUserIds.size

    // Obtener total de usuarios (sin límite)
    const { count: totalUsers, error: totalError } = await supabase
      .from('user_profiles')
      .select('*', { count: 'exact', head: true })

    if (totalError) {
      console.error('Error fetching total users:', totalError)
      return NextResponse.json(
        { error: 'Failed to fetch total users' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      activeUsers: activeUsersCount,
      totalUsers: totalUsers || 0,
      mauPercentage: totalUsers > 0
        ? Math.round(activeUsersCount / totalUsers * 100)
        : 0
    })

  } catch (error) {
    console.error('API error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}