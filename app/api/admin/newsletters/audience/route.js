// app/api/admin/newsletters/audience/route.js - Estadísticas de audiencia
import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

export async function GET() {
  try {
    console.log('📊 Obteniendo estadísticas de audiencia...')

    // Obtener conteos para cada tipo de audiencia
    const [
      { count: totalUsers },
      { data: activeUsers },
      { data: inactiveUsers }, 
      { data: premiumUsers },
      { data: freeUsers }
    ] = await Promise.all([
      supabase
        .from('user_profiles')
        .select('*', { count: 'exact', head: true })
        .not('email', 'is', null),
      
      supabase
        .from('admin_users_with_roles')
        .select('user_id')
        .eq('is_active_student', true),
        
      supabase
        .from('admin_users_with_roles')
        .select('user_id')
        .eq('is_active_student', false),
        
      supabase
        .from('admin_users_with_roles')
        .select('user_id')
        .eq('subscription_status', 'active'),
        
      supabase
        .from('admin_users_with_roles')
        .select('user_id')
        .neq('subscription_status', 'active')
    ])

    const audienceStats = {
      all: totalUsers || 0,
      active: activeUsers?.length || 0,
      inactive: inactiveUsers?.length || 0,
      premium: premiumUsers?.length || 0,
      free: freeUsers?.length || 0
    }

    console.log('📊 Estadísticas calculadas:', audienceStats)

    return NextResponse.json({
      success: true,
      audienceStats
    })

  } catch (error) {
    console.error('❌ Error obteniendo estadísticas de audiencia:', error)
    return NextResponse.json({
      success: false,
      error: 'Error obteniendo estadísticas',
      details: error.message
    }, { status: 500 })
  }
}