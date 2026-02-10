// app/api/admin/newsletters/users/route.js - Lista de usuarios para newsletters
import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const getSupabase = () => createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url)
    const audienceType = searchParams.get('audienceType') || 'all'
    const search = searchParams.get('search') || ''
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '50')
    const offset = (page - 1) * limit

    console.log(`📋 Obteniendo usuarios para audiencia: ${audienceType}`)

    let query
    let users = []

    // Base query dependiendo del tipo de audiencia
    switch (audienceType) {
      case 'all':
        query = getSupabase()
          .from('user_profiles')
          .select('id, email, full_name, created_at')
          .not('email', 'is', null)
        break

      case 'active':
        query = getSupabase()
          .from('admin_users_with_roles')
          .select('user_id, email, full_name, created_at')
          .eq('is_active_student', true)
        break

      case 'inactive':
        query = getSupabase()
          .from('admin_users_with_roles')
          .select('user_id, email, full_name, created_at')
          .eq('is_active_student', false)
        break

      case 'premium':
        query = getSupabase()
          .from('admin_users_with_roles')
          .select('user_id, email, full_name, created_at')
          .eq('subscription_status', 'active')
        break

      case 'free':
        query = getSupabase()
          .from('admin_users_with_roles')
          .select('user_id, email, full_name, created_at')
          .neq('subscription_status', 'active')
        break

      default:
        return NextResponse.json({
          success: false,
          error: 'Tipo de audiencia no válido'
        }, { status: 400 })
    }

    // Añadir filtro de búsqueda si existe
    if (search.trim()) {
      query = query.or(`email.ilike.%${search}%,full_name.ilike.%${search}%`)
    }

    // Ejecutar query con paginación
    const { data, error, count } = await query
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1)
      .select('*', { count: 'exact' })

    if (error) {
      console.error('❌ Error obteniendo usuarios:', error)
      return NextResponse.json({
        success: false,
        error: 'Error obteniendo usuarios',
        details: error.message
      }, { status: 500 })
    }

    // Normalizar datos dependiendo de la fuente
    if (audienceType === 'all') {
      users = data || []
    } else {
      users = (data || []).map(u => ({
        id: u.user_id,
        email: u.email,
        full_name: u.full_name,
        created_at: u.created_at
      }))
    }

    return NextResponse.json({
      success: true,
      users,
      pagination: {
        page,
        limit,
        total: count || 0,
        totalPages: Math.ceil((count || 0) / limit),
        hasMore: offset + limit < (count || 0)
      },
      audienceType,
      search
    })

  } catch (error) {
    console.error('❌ Error en endpoint de usuarios:', error)
    return NextResponse.json({
      success: false,
      error: 'Error interno del servidor',
      details: error.message
    }, { status: 500 })
  }
}