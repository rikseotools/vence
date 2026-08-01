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
    const dispositivo = await checkDeviceDailyUsage(
      getDeviceIdFromRequest(request),
      getHwFingerprintFromRequest(request),
    )
    estado.questions_today = conteoEfectivoConDispositivo(
      Number(estado.questions_today ?? 0),
      estado.is_premium === true,
      dispositivo?.deviceTotal,
    )

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
