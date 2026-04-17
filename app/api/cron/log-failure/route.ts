import { NextRequest, NextResponse } from 'next/server'
import { logValidationError } from '@/lib/api/validation-error-log'
import { withErrorLogging } from '@/lib/api/withErrorLogging'

export const dynamic = 'force-dynamic'

async function _POST(request: NextRequest) {
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { endpoint, message, httpStatus } = await request.json()

  logValidationError({
    endpoint: endpoint || '/api/cron/unknown',
    errorType: 'timeout',
    errorMessage: message || 'Cron failed after all retries',
    severity: 'critical',
    httpStatus: httpStatus || 504,
  })

  return NextResponse.json({ ok: true })
}

export const POST = withErrorLogging('/api/cron/log-failure', _POST)
