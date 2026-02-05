// app/api/fraud/report/route.js
// Endpoint para reportar detección de bots y comportamiento sospechoso
import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'
import { headers } from 'next/headers'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

export async function POST(request) {
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
    let severity = 'low'
    const score = botScore || behaviorScore || 0

    if (score >= 100) {
      severity = 'critical'
    } else if (score >= 70) {
      severity = 'high'
    } else if (score >= 40) {
      severity = 'medium'
    }

    // Verificar si ya existe una alerta similar reciente (últimas 24h)
    // para evitar duplicados
    const { data: existingAlert } = await supabase
      .from('fraud_alerts')
      .select('id')
      .eq('alert_type', alertType)
      .contains('user_ids', [userId])
      .gte('detected_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
      .limit(1)
      .single()

    if (existingAlert) {
      // Ya existe una alerta similar, actualizar detalles
      const { error: updateError } = await supabase
        .from('fraud_alerts')
        .update({
          details: supabase.sql`details || ${JSON.stringify({
            lastDetection: timestamp,
            lastScore: score,
            lastUrl: url
          })}::jsonb`
        })
        .eq('id', existingAlert.id)

      return NextResponse.json({
        success: true,
        message: 'Alerta existente actualizada',
        alertId: existingAlert.id
      })
    }

    // Crear nueva alerta
    const alertData = {
      alert_type: alertType,
      severity,
      status: 'new',
      user_ids: [userId],
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
      match_criteria: alertType === 'bot_detected'
        ? `bot_score:${score}`
        : `behavior_score:${score}`,
      detected_at: timestamp || new Date().toISOString()
    }

    const { data: newAlert, error: insertError } = await supabase
      .from('fraud_alerts')
      .insert(alertData)
      .select('id')
      .single()

    if (insertError) {
      // Log detallado: el objeto error de Supabase puede estar vacío
      console.error('Error insertando alerta de fraude:', {
        message: insertError.message || 'Unknown error',
        code: insertError.code,
        details: insertError.details,
        hint: insertError.hint,
        // Incluir status del response si el error está vacío
        status: insertError.status || 'N/A'
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
