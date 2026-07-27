// app/api/auth/store-registration-ip/route.ts
// Guarda la IP de registro del usuario para detectar multicuentas
import { NextResponse } from 'next/server'
import { getDb } from '@/db/client'
import { userProfiles } from '@/db/schema'
import { eq } from 'drizzle-orm'
import { z } from 'zod/v3'

import { withErrorLogging } from '@/lib/api/withErrorLogging'
import { resolveClientIp } from '@/lib/api/clientIp'
import { emitFireAndForget } from '@/lib/observability/emit'
const storeIpSchema = z.object({
  userId: z.string().uuid(),
})

async function _POST(request: Request) {
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

    // IP del request, con VEREDICTO de confianza. Esta IP alimenta el antifraude
    // (multi_account_reg_ip), asi que importa de donde salio: una cabecera de borde
    // no es falsificable, x-forwarded-for si.
    const { ip, trust, source } = resolveClientIp(request.headers)

    // OBSERVABILIDAD DEL PROPIO FALLO (27/07): si algun dia cambiamos de CDN y la
    // cabecera de confianza desaparece, esto degradaria en SILENCIO a una IP que el
    // cliente puede falsificar. Emitirlo hace visible esa degradacion en vez de
    // dejarla enterrada. Volumen bajo: solo en registros, no en cada peticion.
    if (trust !== 'trusted') {
      emitFireAndForget({
        source: 'vercel',
        severity: 'warn',
        eventType: 'client_ip_untrusted',
        endpoint: '/api/auth/store-registration-ip',
        errorMessage: `IP de registro obtenida de una fuente ${trust} (${source}): el antifraude por IP pierde garantias`,
        metadata: { trust, ipSource: source, userId },
      })
    }

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

export const POST = withErrorLogging('/api/auth/store-registration-ip', _POST)
