// app/api/admin/check-all-push-status/route.ts
import { NextResponse } from 'next/server'
import { checkAllPushStatus } from '@/lib/api/admin-check-push-status'

import { withErrorLogging } from '@/lib/api/withErrorLogging'
async function _POST() {
  try {
    const result = await checkAllPushStatus()
    return NextResponse.json(result)

  } catch (error) {
    console.error('❌ Error en verificación masiva:', error)
    return NextResponse.json(
      { error: 'Error interno: ' + (error instanceof Error ? error.message : 'Unknown') },
      { status: 500 }
    )
  }
}

export const POST = withErrorLogging('/api/admin/check-all-push-status', _POST)
