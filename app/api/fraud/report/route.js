// app/api/fraud/report/route.js
// Endpoint para reportar detección de bots y comportamiento sospechoso
import { NextResponse } from 'next/server'
import { headers } from 'next/headers'

import { getAdminDb } from '@/db/client'
import { fraudAlerts } from '@/db/schema'
import { and, eq, gte, arrayContains } from 'drizzle-orm'
import { withErrorLogging } from '@/lib/api/withErrorLogging'
import { markForcedChallenge } from '@/lib/security/challengePolicy/forceChallenge'
import { emitFireAndForget } from '@/lib/observability/emit'
import { verifyAuthOptional } from '@/lib/api/auth/verifyAuth'
import { sql } from 'drizzle-orm'
import { decideBotAlert, ABSOLVED_TTL_DAYS } from '@/lib/security/botAlertPolicy'

// getAdminDb() = Drizzle con DATABASE_URL, bypass RLS (equivalente al
// service_role). Agnóstico de proveedor.
const db = () => getAdminDb()

async function _POST(request) {
  try {
    const headersList = await headers()
    const body = await request.json()

    const {
      userId: userIdDelBody,
      alertType,
      botScore,
      behaviorScore,
      evidence,
      userAgent,
      screenResolution,
      timestamp,
      url
    } = body

    // 🔒 La identidad SIEMPRE sale del token, nunca del cuerpo (T-180, 27/07/2026).
    //
    // Hasta aquí este endpoint no tenía auth y se creía el `userId` que le
    // mandaran. Con eso, cualquiera podía (a) fabricar alertas de fraude contra
    // otra persona y ensuciarle el expediente, y (b) —lo peor— provocarle
    // CAPTCHAS: un score alto llama a `markForcedChallenge`, así que bastaba un
    // POST con el uuid de una clienta de pago para llenarle la sesión de retos.
    //
    // El hook cliente (`useBotDetection`) solo reporta con sesión iniciada, así
    // que exigirla no quita ninguna señal legítima.
    // `authUserId` (no `userId`) a propósito: el nombre dice que viene del TOKEN.
    // El guardarraíl C2 lo exige así porque `userId` a secas es ambiguo — en
    // endpoints públicos suele venir del query param, y ese fue el agujero de
    // theme-stats. Aquí es literalmente el punto de T-180.
    const auth = await verifyAuthOptional(request, '/api/fraud/report')
    const authUserId = auth?.userId ?? null

    if (!authUserId) {
      // Sin sesión no se acepta el reporte. El cliente es fire-and-forget y no
      // mira el status, así que esto no rompe ninguna experiencia.
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
    }

    if (!alertType) {
      return NextResponse.json(
        { error: 'alertType es requerido' },
        { status: 400 }
      )
    }

    // Un cuerpo que pide reportar sobre OTRO usuario es, por definición, un
    // intento de falsificación: el cliente legítimo manda siempre su propio id.
    // Se rechaza y se deja rastro — es justo la señal que antes no existía.
    if (userIdDelBody && userIdDelBody !== authUserId) {
      emitFireAndForget({
        source: 'vercel',
        severity: 'warn',
        eventType: 'fraud_report_identity_mismatch',
        endpoint: '/api/fraud/report',
        userId: authUserId,
        metadata: { intentoSobre: String(userIdDelBody).slice(0, 64), alertType },
      })
      return NextResponse.json(
        { error: 'El userId no coincide con la sesión' },
        { status: 403 }
      )
    }

    // Obtener IP del request
    const ip = headersList.get('x-forwarded-for')?.split(',')[0]?.trim() ||
               headersList.get('x-real-ip') ||
               'unknown'

    // ── DECISIÓN: ¿esta detección merece expediente? (T-185, 28/07/2026) ──────
    //
    // Antes se creaba una `fraud_alert` por CADA detección, con la confianza que
    // fuera. Medido sobre las ~400 acumuladas: 261 tenían la evidencia exacta que
    // el propio código documenta como falso positivo desde el 15/04, y 255 estaban
    // POR DEBAJO del score 90 en el que estamos dispuestos a actuar. De las 5
    // revisadas a fondo, 5 eran falsos positivos. El coste no es la alerta de más:
    // es que 500 alertas rancias hacen que el panel se deje de mirar.
    //
    // La política vive en `lib/security/botAlertPolicy.ts` (pura y testeada).
    const score = botScore || behaviorScore || 0

    // ¿Ya absolvimos a este sujeto por lo mismo hace poco? Un veredicto humano
    // manda sobre el detector: había usuarias legítimas con 9 y 12 alertas del
    // mismo patrón ya descartado.
    let recentlyDismissed = false
    try {
      const [absuelto] = await db()
        .select({ id: fraudAlerts.id })
        .from(fraudAlerts)
        .where(and(
          eq(fraudAlerts.alertType, alertType),
          eq(fraudAlerts.status, 'dismissed'),
          arrayContains(fraudAlerts.userIds, [authUserId]),
          gte(fraudAlerts.detectedAt, new Date(Date.now() - ABSOLVED_TTL_DAYS * 86400000).toISOString()),
        ))
        .limit(1)
      recentlyDismissed = Boolean(absuelto)
    } catch { /* si no se puede consultar, se decide sin ese dato */ }

    // Para el comportamiento, la verdad la tiene la BD, NO el cliente: un caso real
    // declaró correctRate 0 cuando la BD decía 28% (calculaba sobre respuestas aún
    // sin guardar). Se recalcula aquí sobre datos confirmados.
    let serverBehaviour = null
    if (alertType === 'suspicious_behavior') {
      try {
        const filas = await db().execute(sql`
          SELECT count(*)::int AS answers,
                 coalesce(percentile_disc(0.5) WITHIN GROUP (ORDER BY coalesce(time_spent_seconds,0)),0)::int AS median_seconds,
                 coalesce(avg(CASE WHEN is_correct THEN 1.0 ELSE 0.0 END),0)::float AS accuracy
            FROM test_questions
           WHERE user_id = ${authUserId}::uuid AND created_at > now() - interval '7 days'
             AND user_answer IS NOT NULL AND user_answer <> '' AND user_answer <> 'BLANK'`)
        const f = (Array.isArray(filas) ? filas : filas?.rows || [])[0]
        if (f) serverBehaviour = { answers: Number(f.answers), medianSeconds: Number(f.median_seconds), accuracy: Number(f.accuracy) }
      } catch { /* sin datos de servidor la política NO alerta, que es lo correcto */ }
    }

    const decision = decideBotAlert({ alertType, score, recentlyDismissed, server: serverBehaviour })
    const severity = decision.severity

    // Reto forzado: solo con la confianza con la que además abriríamos expediente.
    if (decision.forceChallenge) {
      const deviceId = headersList.get('x-device-id')
      const subjectKeys = [authUserId, deviceId ? `device:${deviceId}` : null].filter(Boolean)
      // La exención de las cuentas sintéticas la decide `markForcedChallenge` (punto de
      // escritura), no este llamante: ver el porqué en forceChallenge.ts. Aquí solo se deja
      // constancia de lo que hizo — una exención silenciosa no se distingue de un marcado
      // que nunca ocurrió, y fue así como un canary se quedó clavado en rojo.
      markForcedChallenge(subjectKeys, { userId: authUserId })
        .then((res) => {
          emitFireAndForget({
            source: 'vercel',
            severity: res.marcado ? 'warn' : 'info',
            eventType: res.marcado ? 'scraping_force_challenge_set' : 'scraping_force_challenge_exento',
            endpoint: '/api/fraud/report',
            userId: authUserId,
            metadata: { score, severity, deviceId: deviceId ?? null, subjectKeys, motivo: res.motivo ?? null },
          })
        })
        .catch(() => {})
    }

    // Lo que NO llega a expediente NO se pierde: queda como evento de
    // observabilidad para ver tendencia sin ensuciar la cola de revisión humana.
    if (!decision.createAlert) {
      emitFireAndForget({
        source: 'vercel', severity: 'info', eventType: 'bot_detection_below_bar',
        endpoint: '/api/fraud/report', userId: authUserId,
        metadata: { alertType, score, reason: decision.reason, evidence, server: serverBehaviour },
      })
      return NextResponse.json({ success: true, alerted: false, reason: decision.reason })
    }

    // Verificar si ya existe una alerta similar reciente (últimas 24h)
    // para evitar duplicados
    const [existingAlert] = await db()
      .select({ id: fraudAlerts.id })
      .from(fraudAlerts)
      .where(and(
        eq(fraudAlerts.alertType, alertType),
        arrayContains(fraudAlerts.userIds, [authUserId]),
        gte(fraudAlerts.detectedAt, new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()),
      ))
      .limit(1)

    if (existingAlert) {
      // Ya existe una alerta similar, actualizar detalles
      const [currentAlert] = await db()
        .select({ details: fraudAlerts.details })
        .from(fraudAlerts)
        .where(eq(fraudAlerts.id, existingAlert.id))
        .limit(1)

      const updatedDetails = {
        ...(currentAlert?.details || {}),
        lastDetection: timestamp,
        lastScore: score,
        lastUrl: url
      }

      await db()
        .update(fraudAlerts)
        .set({ details: updatedDetails })
        .where(eq(fraudAlerts.id, existingAlert.id))

      return NextResponse.json({
        success: true,
        message: 'Alerta existente actualizada',
        alertId: existingAlert.id
      })
    }

    // Crear nueva alerta
    const alertData = {
      alertType,
      severity,
      status: 'new',
      userIds: [authUserId],
      details: {
        botScore,
        behaviorScore,
        evidence,
        userAgent,
        screenResolution,
        ip,
        url,
        detectedAt: timestamp,
        // Información adicional útil para investigación
        detectionSource: 'client_side',
        browserInfo: {
          userAgent,
          screenResolution
        }
      },
      matchCriteria: alertType === 'bot_detected'
        ? `bot_score:${score}`
        : `behavior_score:${score}`,
      detectedAt: timestamp || new Date().toISOString()
    }

    let newAlert = null
    let insertError = null
    try {
      const [row] = await db()
        .insert(fraudAlerts)
        .values(alertData)
        .returning({ id: fraudAlerts.id })
      newAlert = row ?? null
    } catch (e) {
      insertError = e
    }

    if (insertError || !newAlert) {
      // Log detallado: postgres-js expone message/code/detail/hint (puede faltar alguno)
      console.error('Error insertando alerta de fraude:', {
        message: insertError?.message || 'Unknown error',
        code: insertError?.code,
        details: insertError?.detail ?? insertError?.details,
        hint: insertError?.hint,
        status: insertError?.status || 'N/A'
      })
      // Graceful degradation: no romper la experiencia del usuario
      // El sistema de fraude es secundario, no crítico
      return NextResponse.json(
        { success: false, message: 'Alerta no guardada (sistema en mantenimiento)' },
        { status: 200 } // 200 para no causar errores en el cliente
      )
    }

    // Si es severidad alta o crítica, podríamos enviar notificación
    if (severity === 'critical' || severity === 'high') {
      console.warn(`🚨 ALERTA DE FRAUDE ${severity.toUpperCase()}: ${alertType} para usuario ${authUserId}`)
      // TODO: Enviar notificación a admins (email, Telegram, etc.)
    }

    return NextResponse.json({
      success: true,
      message: 'Alerta registrada',
      alertId: newAlert.id,
      severity
    })

  } catch (error) {
    console.error('Error en /api/fraud/report:', error)
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    )
  }
}

export const POST = withErrorLogging('/api/fraud/report', _POST)
