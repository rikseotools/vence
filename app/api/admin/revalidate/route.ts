import { NextRequest, NextResponse } from 'next/server'
import { revalidateTag } from 'next/cache'
import { withErrorLogging } from '@/lib/api/withErrorLogging'

const VALID_TAGS = ['temario', 'teoria', 'laws', 'landing', 'test-counts', 'medals', 'profile', 'questions']

async function _POST(request: NextRequest) {
  const secret = request.headers.get('x-cron-secret')
  if (secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { tag } = await request.json()

  if (!VALID_TAGS.includes(tag)) {
    return NextResponse.json(
      { error: `Tag no válido. Válidos: ${VALID_TAGS.join(', ')}` },
      { status: 400 }
    )
  }

  revalidateTag(tag, 'max')

  return NextResponse.json({
    success: true,
    revalidated: tag,
    timestamp: new Date().toISOString(),
  })
}

export const POST = withErrorLogging('/api/admin/revalidate', _POST)
