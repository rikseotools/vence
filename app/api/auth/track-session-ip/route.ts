// app/api/auth/track-session-ip/route.ts
// Guarda la IP y localidad en la sesión del usuario para detectar cuentas compartidas
import { NextResponse } from 'next/server'
import { getDb } from '@/db/client'
import { userSessions } from '@/db/schema'
import { eq, isNull, desc, and } from 'drizzle-orm'
import { z } from 'zod/v3'

import { withErrorLogging } from '@/lib/api/withErrorLogging'
const trackSessionIpSchema = z.object({
  userId: z.string().uuid(),
  sessionId: z.string().uuid().nullish(),
  deviceId: z.string().nullish(),
})

interface GeoLocation {
  country_code: string
  region: string
  city: string
  isp: string
  lat: number
  lon: number
}

async function getGeoLocation(ip: string): Promise<GeoLocation | null> {
  try {
    if (!ip || ip === 'unknown' || ip.startsWith('192.168.') || ip.startsWith('10.') || ip === '127.0.0.1' || ip === '::1') {
      return null
    }

    const response = await fetch(
      `http://ip-api.com/json/${ip}?fields=status,country,countryCode,region,regionName,city,lat,lon,isp`,
      { signal: AbortSignal.timeout(3000) }
    )

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
      lon: data.lon,
    }
  } catch (error) {
    console.warn('⚠️ [GeoIP] Error obteniendo localidad:', error instanceof Error ? error.message : 'Unknown error')
    return null
  }
}

async function _POST(request: Request) {
  try {
    const body = await request.json()
    const parsed = trackSessionIpSchema.safeParse(body)

    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: parsed.error.issues[0]?.message || 'Datos inválidos' },
        { status: 400 }
      )
    }

    const { userId, sessionId, deviceId } = parsed.data

    // Obtener IP del request
    const forwardedFor = request.headers.get('x-forwarded-for')
    const realIp = request.headers.get('x-real-ip')
    const ip = forwardedFor?.split(',')[0]?.trim() ?? realIp ?? 'unknown'

    console.log('📍 [SessionIP] Tracking IP de sesión:', {
      userId: userId.substring(0, 8) + '...',
      ip,
      hasDeviceId: !!deviceId,
    })

    // Obtener geolocalización (async, con timeout)
    const geo = await getGeoLocation(ip)

    const db = getDb()

    // Preparar datos de actualización
    const updateData: Record<string, unknown> = {
      ipAddress: ip,
    }

    if (deviceId) {
      updateData.deviceFingerprint = deviceId
      console.log('🔒 [SessionIP] Device ID tracking:', deviceId.substring(0, 8) + '...')
    }

    if (geo) {
      updateData.countryCode = geo.country_code
      updateData.region = geo.region
      updateData.city = geo.city
      updateData.isp = geo.isp
      if (geo.lat && geo.lon) {
        updateData.coordinates = `(${geo.lon},${geo.lat})`
      }
      console.log('📍 [SessionIP] Localidad:', geo.city, geo.region, geo.country_code)
    }

    if (sessionId) {
      // Actualizar sesión específica
      await db
        .update(userSessions)
        .set(updateData)
        .where(eq(userSessions.id, sessionId))
    } else {
      // Sin sessionId: actualizar la sesión más reciente sin IP
      // Drizzle no soporta .update().order().limit(), usamos select + update por ID
      const recentSession = await db
        .select({ id: userSessions.id })
        .from(userSessions)
        .where(
          and(
            eq(userSessions.userId, userId),
            isNull(userSessions.ipAddress)
          )
        )
        .orderBy(desc(userSessions.sessionStart))
        .limit(1)

      if (recentSession.length > 0) {
        await db
          .update(userSessions)
          .set(updateData)
          .where(eq(userSessions.id, recentSession[0].id))
      }
    }

    console.log('✅ [SessionIP] IP y localidad guardadas')

    return NextResponse.json({
      success: true,
      ip,
      geo: geo ? { city: geo.city, region: geo.region, country: geo.country_code } : null,
    })
  } catch (error) {
    console.error('❌ [SessionIP] Error inesperado:', error)
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}

export const POST = withErrorLogging('/api/auth/track-session-ip', _POST)
