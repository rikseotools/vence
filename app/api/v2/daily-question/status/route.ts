// app/api/v2/daily-question/status/route.ts
// Estado del límite diario de preguntas del usuario AUTENTICADO (useDailyQuestionLimit).
//
// AGNÓSTICO (Fase C1): sustituye supabase.rpc('get_daily_question_status') por la
// MISMA función plpgsql vía Drizzle. p_user_id sale SIEMPRE del TOKEN.
import { NextRequest, NextResponse } from 'next/server'
import { sql } from 'drizzle-orm'
import { verifyAuth } from '@/lib/api/auth/verifyAuth'
import { withErrorLogging } from '@/lib/api/withErrorLogging'
import { getAdminDb } from '@/db/client'
import { checkDeviceDailyUsage, conteoEfectivoConDispositivo } from '@/lib/api/dailyLimit'
import { getDeviceIdFromRequest, getHwFingerprintFromRequest, contarCuentasFreeEnDispositivo } from '@/lib/api/deviceLimit'
import { currentDeviceLimitMode, cuentaElCupoDelDispositivo } from '@/lib/security/deviceLimitMode'
import { esFraudeConfirmado } from '@/lib/api/fraud/esConfirmado'
import { emit } from '@/lib/observability/emit'
import { ipDeConfianza } from '@/lib/api/clientIp'

export const maxDuration = 15

async function _GET(request: NextRequest): Promise<NextResponse> {
  const auth = await verifyAuth(request, '/api/v2/daily-question/status')
  if (!auth.success) {
    return NextResponse.json({ success: false, error: 'unauthorized' }, { status: auth.status })
  }

  const res = await getAdminDb().execute(sql`SELECT * FROM get_daily_question_status(${auth.userId}::uuid)`)
  const rows = Array.isArray(res) ? res : (res as { rows?: unknown[] }).rows || []
  const estado = (rows[0] ?? null) as {
    questions_today?: number
    is_premium?: boolean
    multi_cuenta_dispositivo?: boolean
    cuentas_en_dispositivo?: number
  } | null

  // El cupo del DISPOSITIVO también cuenta ([T-418]). Este endpoint es lo ÚNICO que mira el
  // cliente para decidir si levanta el muro, así que si aquí no entra el conteo del aparato, la
  // UI deja contestar y el servidor tira cada respuesta con un 403 mudo (27 usuarios, 1.471
  // respuestas perdidas en 14 días). Las cabeceras ya viajan en `getAuthHeaders()`, no hay que
  // pedirle nada nuevo al cliente.
  if (estado) {
    const deviceId = getDeviceIdFromRequest(request)
    const hwFingerprint = getHwFingerprintFromRequest(request)

    // MISMO criterio que el servidor ([T-657]): en sombra no se levanta muro a nadie salvo a los
    // confirmados a mano. Antes esto se aplicaba SIEMPRE aquí y NUNCA allí — la pantalla cortaba a
    // quien el servidor dejaba pasar, que es la peor de las dos incoherencias posibles.
    const modo = currentDeviceLimitMode()
    const confirmado = await esFraudeConfirmado({
      userId: auth.userId,
      deviceId,
      fingerprint: hwFingerprint,
    }).catch(() => false)

    const propias = Number(estado.questions_today ?? 0)

    if (cuentaElCupoDelDispositivo(modo, confirmado)) {
      const dispositivo = await checkDeviceDailyUsage(deviceId, hwFingerprint, ipDeConfianza(request))
      estado.questions_today = conteoEfectivoConDispositivo(
        propias,
        estado.is_premium === true,
        dispositivo?.deviceTotal,
      )

      // OBSERVABLE A PROPÓSITO ([T-657]). Este es el bloqueo que de verdad para al usuario: sale
      // ANTES de contestar, así que nunca llega a `/api/v2/answer-and-save` y su evento
      // (`device_daily_limit_blocked`) no se emite. Sin esto, alguien deja de poder estudiar y no
      // queda ni una fila que lo cuente — que es exactamente como se pasaron 9 días hasta que un
      // usuario escribió.
      if (estado.is_premium !== true && estado.questions_today > propias) {
        await emit({
          source: 'vercel',
          severity: 'warn',
          eventType: 'device_daily_limit_muro',
          endpoint: '/api/v2/daily-question/status',
          userId: auth.userId,
          errorMessage: `Muro por cupo del dispositivo: ${estado.questions_today} del aparato frente a ${propias} suyas`,
          metadata: {
            propias,
            deviceTotal: estado.questions_today,
            anchor: hwFingerprint?.startsWith('fp2_') ? 'fingerprint_v2' : 'device_id',
            mode: modo,
            dirigido: confirmado,
          },
        }).catch(() => {})
      }
    }

    // Aviso de multicuenta: que sepa que lo hemos visto, y que cuando le salga el muro haciendo
    // un test ya sepa por qué. Solo para FREE (a un premium no se le limita nada, así que
    // avisarle sería acusarle sin consecuencia). Se reusa `getAccountsOnDevice`, que ya existía.
    if (estado.is_premium !== true) {
      // Solo cuentan las FREE: mucha gente que paga tiene además una cuenta gratuita, y
      // avisarle de multicuenta por su propia cuenta premium sería molestar a quien paga.
      const cuentasFree = await contarCuentasFreeEnDispositivo(getDeviceIdFromRequest(request))
      estado.multi_cuenta_dispositivo = cuentasFree >= 2
      estado.cuentas_en_dispositivo = cuentasFree
    }
  }

  return NextResponse.json({ success: true, status: estado })
}

export const GET = withErrorLogging('/api/v2/daily-question/status', _GET)
