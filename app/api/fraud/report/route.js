// app/api/fraud/report/route.js
// Endpoint para reportar detección de bots y comportamiento sospechoso
import { NextResponse } from 'next/server'
import { headers } from 'next/headers'

import { getAdminDb } from '@/db/client'
import { fraudAlerts } from '@/db/schema'
import { and, eq, gte, arrayContains } from 'drizzle-orm'
import { withErrorLogging } from '@/lib/api/withErrorLogging'

// getAdminDb() = Drizzle con DATABASE_URL, bypass RLS (equivalente al
// service_role). Agnóstico de proveedor.
const db = () => getAdminDb()

async function _POST(request) {
  try {
    const headersList = await headers()
    const body = await request.json()

    const {
      userId,
      alertType,
      botScore,
      behaviorScore,
      evidence,
      userAgent,
      screenResolution,
      timestamp,
      url
    } = body

    // Validación básica
    if (!userId || !alertType) {
      return NextResponse.json(
        { error: 'userId y alertType son requeridos' },
        { status: 400 }
      )
    }

    // Obtener IP del request
    const ip = headersList.get('x-forwarded-for')?.split(',')[0]?.trim() ||
               headersList.get('x-real-ip') ||
               'unknown'

    // Determinar severidad basada en scores
    // Umbrales revisados 2026-04-15 tras auditoría de falsos positivos:
    // usuarios Chrome legítimos con BotD activando 'headless_chrome' (60)
    // + cualquier señal pequeña adicional disparaban HIGH=70.
    // Subimos HIGH a 90 para exigir señales confirmativas (webdriver,
    // puppeteer, etc.) además de la heurística de BotD.
    let severity = 'low'
    const score = botScore || behaviorScore || 0

    if (score >= 120) {
      severity = 'critical'
    } else if (score >= 90) {
      severity = 'high'
    } else if (score >= 50) {
      severity = 'medium'
    }

    // Verificar si ya existe una alerta similar reciente (últimas 24h)
    // para evitar duplicados
    const [existingAlert] = await db()
      .select({ id: fraudAlerts.id })
      .from(fraudAlerts)
      .where(and(
        eq(fraudAlerts.alertType, alertType),
        arrayContains(fraudAlerts.userIds, [userId]),
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
      userIds: [userId],
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
      console.warn(`🚨 ALERTA DE FRAUDE ${severity.toUpperCase()}: ${alertType} para usuario ${userId}`)
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
