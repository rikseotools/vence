// app/api/cron/renewal-reminders/route.ts
// Cron que envía recordatorios de renovación de suscripción
import { NextResponse, NextRequest } from 'next/server'
import {
  runRenewalReminderCampaign,
  safeParseRunReminderCampaign,
  type RunReminderCampaignResponse
} from '@/lib/api/renewal-reminders'
import { runCampanaFinSuscripcion, anularOfertasCaducadas } from '@/lib/api/premium/avisoFinSuscripcion'

import { withErrorLogging } from '@/lib/api/withErrorLogging'
import { emitFireAndForget } from '@/lib/observability/emit'
// GET: Ejecutar campaña de recordatorios (llamado por GitHub Actions)
async function _GET(request: NextRequest): Promise<NextResponse<RunReminderCampaignResponse>> {
  try {
    // Verificar authorization header
    const authHeader = request.headers.get('authorization')
    const expectedAuth = `Bearer ${process.env.CRON_SECRET}`

    if (authHeader !== expectedAuth) {
      console.error('❌ Unauthorized request to renewal-reminders cron')
      return NextResponse.json(
        { success: false, total: 0, sent: 0, skipped: 0, failed: 0, error: 'Unauthorized' },
        { status: 401 }
      )
    }

    console.log('🔔 Iniciando campañas de recordatorios de renovación (7d + 1d)...')

    // Campaña 1: 7 días antes
    const result7d = await runRenewalReminderCampaign({ daysBeforeRenewal: 7, dryRun: false })

    // Campaña 2: 1 día antes
    const result1d = await runRenewalReminderCampaign({ daysBeforeRenewal: 1, dryRun: false })

    // Campaña 3 (T-448): el COMPLEMENTARIO de las dos anteriores. Aquellas avisan de un cobro que
    // viene y excluyen `cancel_at_period_end = true`; ésta avisa a los excluidos, que son justo
    // los que van a PERDER el acceso (190 medidos el 01/08, 59 solo en agosto). Va en este mismo
    // cron a propósito: comparten cadencia diaria, heartbeat y el guardarraíl de «ticó y envió 0».
    // Nunca coinciden en la misma persona: las separa `cancel_at_period_end`.
    // Aislada en su propio try: si esta campaña falla, los recordatorios de cobro (que mueven
    // dinero) no pueden caerse con ella.
    let finSusc = { candidatos: 0, enviados: 0, omitidos: 0, fallidos: 0 }
    try {
      const r = await runCampanaFinSuscripcion({ diasAntes: 3, dryRun: false })
      finSusc = { candidatos: r.candidatos, enviados: r.enviados, omitidos: r.omitidos, fallidos: r.fallidos }
      console.log(`🔔 [T-448] fin de suscripción: ${r.enviados} avisos de ${r.candidatos} candidato(s)`)

      // Y lo que hace VERDAD ese aviso: el email dice «si no lo haces, lo perderás», así que
      // alguien tiene que quitarlo. Va aquí y no en un comando manual porque una condición que
      // depende de que una persona se acuerde no es una condición (misma lección que `pause
      // --tras-deploy` en el backlog). Usa la MISMA frontera que se prometió por correo y aborta
      // sin tocar nada si le tocara anular más de 50 de golpe: eso no sería un trámite, sería
      // señal de que el criterio se rompió.
      const anul = await anularOfertasCaducadas({ dryRun: false })
      if (anul.candidatas > 0) {
        console.log(`🔕 [T-448] precios de fidelidad caducados: ${anul.anuladas}/${anul.candidatas}${anul.abortado ? ' (ABORTADO por el tope)' : ''}`)
      }
    } catch (e) {
      console.error('❌ [T-448] campaña de fin de suscripción falló:', e)
    }

    // Agregar resultados de ambas campañas
    const result: RunReminderCampaignResponse = {
      success: result7d.success && result1d.success,
      total: (result7d.total || 0) + (result1d.total || 0),
      sent: (result7d.sent || 0) + (result1d.sent || 0),
      skipped: (result7d.skipped || 0) + (result1d.skipped || 0),
      failed: (result7d.failed || 0) + (result1d.failed || 0),
      results: [...(result7d.results || []), ...(result1d.results || [])],
    }

    console.log(`✅ Campañas completadas: ${result.sent} enviados, ${result.skipped} omitidos, ${result.failed} fallidos`)

    // GUARDRAIL del punto ciego "el cron ticó (2xx) pero envió 0": había renovaciones
    // próximas y NO salió NINGÚN recordatorio → fallo silencioso (query mala / dedup roto
    // / Resend caído). El heartbeat NO lo ve (el cron sí disparó). Emitir error a
    // observabilidad para que no pase inadvertido hasta que un usuario pida reembolso.
    if (result.total > 0 && result.sent === 0) {
      emitFireAndForget({
        source: 'vercel',
        severity: 'error',
        eventType: 'renewal_reminders_zero_sent',
        endpoint: '/api/cron/renewal-reminders',
        errorMessage: `${result.total} renovación(es) próxima(s) pero 0 recordatorios enviados (skipped:${result.skipped}, failed:${result.failed})`,
        metadata: { total: result.total, sent: result.sent, skipped: result.skipped, failed: result.failed },
      })
    }

    return NextResponse.json({ ...result, finSuscripcion: finSusc })

  } catch (error) {
    console.error('❌ Error en cron de recordatorios:', error)
    return NextResponse.json(
      {
        success: false,
        total: 0,
        sent: 0,
        skipped: 0,
        failed: 0,
        error: error instanceof Error ? error.message : 'Error desconocido'
      },
      { status: 500 }
    )
  }
}

// POST: Ejecutar con parámetros personalizados (para testing manual)
async function _POST(request: NextRequest): Promise<NextResponse<RunReminderCampaignResponse>> {
  try {
    // Verificar authorization header
    const authHeader = request.headers.get('authorization')
    const expectedAuth = `Bearer ${process.env.CRON_SECRET}`

    if (authHeader !== expectedAuth) {
      console.error('❌ Unauthorized request to renewal-reminders cron')
      return NextResponse.json(
        { success: false, total: 0, sent: 0, skipped: 0, failed: 0, error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const body = await request.json()

    // Validar parámetros
    const parseResult = safeParseRunReminderCampaign(body)
    if (!parseResult.success) {
      return NextResponse.json(
        {
          success: false,
          total: 0,
          sent: 0,
          skipped: 0,
          failed: 0,
          error: `Parámetros inválidos: ${parseResult.error.message}`
        },
        { status: 400 }
      )
    }

    const { daysBeforeRenewal, dryRun } = parseResult.data

    console.log(`🔔 Iniciando campaña de recordatorios (${daysBeforeRenewal} días)${dryRun ? ' [DRY RUN]' : ''}...`)

    const result = await runRenewalReminderCampaign({
      daysBeforeRenewal,
      dryRun,
    })

    console.log(`✅ Campaña completada: ${result.sent} enviados, ${result.skipped} omitidos, ${result.failed} fallidos`)

    return NextResponse.json(result)

  } catch (error) {
    console.error('❌ Error en cron de recordatorios:', error)
    return NextResponse.json(
      {
        success: false,
        total: 0,
        sent: 0,
        skipped: 0,
        failed: 0,
        error: error instanceof Error ? error.message : 'Error desconocido'
      },
      { status: 500 }
    )
  }
}

export const GET = withErrorLogging('/api/cron/renewal-reminders', _GET)
export const POST = withErrorLogging('/api/cron/renewal-reminders', _POST)
