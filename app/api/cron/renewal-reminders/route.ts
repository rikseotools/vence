// app/api/cron/renewal-reminders/route.ts
// Cron que envía recordatorios de renovación de suscripción
import { NextResponse, NextRequest } from 'next/server'
import {
  runRenewalReminderCampaign,
  safeParseRunReminderCampaign,
  type RunReminderCampaignResponse
} from '@/lib/api/renewal-reminders'

import { withErrorLogging } from '@/lib/api/withErrorLogging'
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
