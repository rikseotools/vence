// app/api/auth/track-session-ip/route.js
// Guarda la IP y localidad en la sesión del usuario para detectar cuentas compartidas
import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const getServiceSupabase = () => {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  )
}

// Obtener geolocalización de IP usando ip-api.com (gratis, ~50ms)
async function getGeoLocation(ip) {
  try {
    // No geolocalizar IPs locales/privadas
    if (!ip || ip === 'unknown' || ip.startsWith('192.168.') || ip.startsWith('10.') || ip === '127.0.0.1' || ip === '::1') {
      return null
    }

    const response = await fetch(`http://ip-api.com/json/${ip}?fields=status,country,countryCode,region,regionName,city,lat,lon,isp`, {
      signal: AbortSignal.timeout(3000) // Timeout de 3 segundos
    })

    if (!response.ok) {
      console.warn('⚠️ [GeoIP] Error en respuesta:', response.status)
      return null
    }

    const data = await response.json()

    if (data.status !== 'success') {
      console.warn('⚠️ [GeoIP] IP no localizable:', ip)
      return null
    }

    return {
      country_code: data.countryCode,
      region: data.regionName,
      city: data.city,
      isp: data.isp,
      lat: data.lat,
      lon: data.lon
    }
  } catch (error) {
    // Si falla la geolocalización, no es crítico - seguimos guardando la IP
    console.warn('⚠️ [GeoIP] Error obteniendo localidad:', error.message)
    return null
  }
}

export async function POST(request) {
  try {
    const { userId, sessionId } = await request.json()

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

    console.log('📍 [SessionIP] Tracking IP de sesión:', { userId: userId.substring(0, 8) + '...', ip })

    // Obtener geolocalización (async, con timeout)
    const geo = await getGeoLocation(ip)

    const supabase = getServiceSupabase()

    // Preparar datos de actualización
    const updateData = {
      ip_address: ip
    }

    // Añadir geolocalización si está disponible
    if (geo) {
      updateData.country_code = geo.country_code
      updateData.region = geo.region
      updateData.city = geo.city
      updateData.isp = geo.isp
      // PostgreSQL point format: (lon,lat)
      if (geo.lat && geo.lon) {
        updateData.coordinates = `(${geo.lon},${geo.lat})`
      }
      console.log('📍 [SessionIP] Localidad:', geo.city, geo.region, geo.country_code)
    }

    // Si tenemos sessionId específico, actualizar esa sesión
    if (sessionId) {
      const { error } = await supabase
        .from('user_sessions')
        .update(updateData)
        .eq('id', sessionId)

      if (error) {
        console.error('❌ [SessionIP] Error actualizando sesión:', error)
        return NextResponse.json(
          { success: false, error: error.message },
          { status: 500 }
        )
      }
    } else {
      // Si no hay sessionId, actualizar la sesión más reciente del usuario que no tenga IP
      const { error } = await supabase
        .from('user_sessions')
        .update(updateData)
        .eq('user_id', userId)
        .is('ip_address', null)
        .order('session_start', { ascending: false })
        .limit(1)

      if (error) {
        console.error('❌ [SessionIP] Error actualizando sesión reciente:', error)
        return NextResponse.json(
          { success: false, error: error.message },
          { status: 500 }
        )
      }
    }

    console.log('✅ [SessionIP] IP y localidad guardadas')

    return NextResponse.json({
      success: true,
      ip,
      geo: geo ? { city: geo.city, region: geo.region, country: geo.country_code } : null
    })

  } catch (error) {
    console.error('❌ [SessionIP] Error inesperado:', error)
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    )
  }
}
