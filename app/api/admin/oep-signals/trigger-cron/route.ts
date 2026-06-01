// app/api/admin/oep-signals/trigger-cron/route.ts
// Permite al admin disparar los crons manualmente desde el panel.
import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/api/shared/auth'
import { withErrorLogging } from '@/lib/api/withErrorLogging'

export const maxDuration = 300

// detect-regional-oeps retirado 01/06/2026 (scraper autónomo descartado, descubrimiento on-demand por Claude)
const ALLOWED_CRONS = ['detect-oep-llm', 'detect-timeline-silence'] as const
type AllowedCron = typeof ALLOWED_CRONS[number]

async function _POST(request: NextRequest) {
  const admin = await requireAdmin(request)
  if (!admin.ok) return admin.response

  try {
    const { searchParams } = new URL(request.url)
    const cron = searchParams.get('cron') as AllowedCron | null

    if (!cron || !ALLOWED_CRONS.includes(cron)) {
      return NextResponse.json(
        { success: false, error: 'Cron inválido. Permitidos: ' + ALLOWED_CRONS.join(', ') },
        { status: 400 }
      )
    }

    // Llamar al endpoint cron internamente con el secret
    const origin = request.nextUrl.origin
    const url = `${origin}/api/cron/${cron}`

    const res = await fetch(url, {
      headers: { 'Authorization': `Bearer ${process.env.CRON_SECRET}` },
    })
    const json = await res.json()

    return NextResponse.json({
      success: res.ok && json.success,
      cron,
      result: json,
    })
  } catch (err) {
    console.error('❌ [API/admin/oep-signals/trigger-cron] Error:', err)
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : 'Error interno' },
      { status: 500 }
    )
  }
}

export const POST = withErrorLogging('/api/admin/oep-signals/trigger-cron', _POST)
