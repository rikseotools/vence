// app/api/cron/renewal-reminders/route.ts
// Cron que envía recordatorios de renovación de suscripción
import { NextResponse, NextRequest } from 'next/server'
import {
  runRenewalReminderCampaign,
  safeParseRunReminderCampaign,
  type RunReminderCampaignResponse
} from '@/lib/api/renewal-reminders'

// GET: Ejecutar campaña de recordatorios (llamado por GitHub Actions)
export async function GET(request: NextRequest): Promise<NextResponse<RunReminderCampaignResponse>> {
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

    console.log('🔔 Iniciando campaña de recordatorios de renovación...')

    // Por defecto, 7 días antes
    const result = await runRenewalReminderCampaign({
      daysBeforeRenewal: 7,
      dryRun: false,
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

// POST: Ejecutar con parámetros personalizados (para testing manual)
export async function POST(request: NextRequest): Promise<NextResponse<RunReminderCampaignResponse>> {
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
