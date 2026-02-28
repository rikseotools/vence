// app/api/auth/store-registration-ip/route.ts
// Guarda la IP de registro del usuario para detectar multicuentas
import { NextResponse } from 'next/server'
import { getDb } from '@/db/client'
import { userProfiles } from '@/db/schema'
import { eq } from 'drizzle-orm'
import { z } from 'zod/v3'

const storeIpSchema = z.object({
  userId: z.string().uuid(),
})

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const parsed = storeIpSchema.safeParse(body)

    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: 'userId requerido' },
        { status: 400 }
      )
    }

    const { userId } = parsed.data

    // Obtener IP del request
    const forwardedFor = request.headers.get('x-forwarded-for')
    const realIp = request.headers.get('x-real-ip')
    const ip = forwardedFor?.split(',')[0]?.trim() ?? realIp ?? 'unknown'

    console.log('📍 [IP] Guardando IP de registro:', { userId, ip })

    const db = getDb()

    // Solo actualizar si no tiene IP ya (evitar sobrescribir en logins posteriores)
    const existing = await db
      .select({ registrationIp: userProfiles.registrationIp })
      .from(userProfiles)
      .where(eq(userProfiles.id, userId))
      .limit(1)

    if (existing[0]?.registrationIp) {
      console.log('📍 [IP] Usuario ya tiene IP registrada, no se sobrescribe')
      return NextResponse.json({
        success: true,
        message: 'IP ya registrada previamente',
        ip: existing[0].registrationIp,
      })
    }

    // Guardar IP
    await db
      .update(userProfiles)
      .set({ registrationIp: ip })
      .where(eq(userProfiles.id, userId))

    console.log('✅ [IP] IP de registro guardada:', ip)

    return NextResponse.json({ success: true, ip })
  } catch (error) {
    console.error('❌ [IP] Error inesperado:', error)
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
