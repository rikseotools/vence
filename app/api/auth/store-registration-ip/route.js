// app/api/auth/store-registration-ip/route.js
// Guarda la IP de registro del usuario para detectar multicuentas
import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const getServiceSupabase = () => {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  )
}

export async function POST(request) {
  try {
    const { userId } = await request.json()

    if (!userId) {
      return NextResponse.json(
        { success: false, error: 'userId requerido' },
        { status: 400 }
      )
    }

    // Obtener IP del request
    const forwardedFor = request.headers.get('x-forwarded-for')
    const realIp = request.headers.get('x-real-ip')
    const ip = forwardedFor?.split(',')[0]?.trim() || realIp || 'unknown'

    console.log('📍 [IP] Guardando IP de registro:', { userId, ip })

    const supabase = getServiceSupabase()

    // Solo actualizar si no tiene IP ya (evitar sobrescribir en logins posteriores)
    const { data: existing } = await supabase
      .from('user_profiles')
      .select('registration_ip')
      .eq('id', userId)
      .single()

    if (existing?.registration_ip) {
      console.log('📍 [IP] Usuario ya tiene IP registrada, no se sobrescribe')
      return NextResponse.json({
        success: true,
        message: 'IP ya registrada previamente',
        ip: existing.registration_ip
      })
    }

    // Guardar IP
    const { error } = await supabase
      .from('user_profiles')
      .update({ registration_ip: ip })
      .eq('id', userId)

    if (error) {
      console.error('❌ [IP] Error guardando IP:', error)
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 500 }
      )
    }

    console.log('✅ [IP] IP de registro guardada:', ip)

    return NextResponse.json({
      success: true,
      ip
    })

  } catch (error) {
    console.error('❌ [IP] Error inesperado:', error)
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    )
  }
}
