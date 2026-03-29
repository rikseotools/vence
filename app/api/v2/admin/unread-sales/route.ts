// app/api/v2/admin/unread-sales/route.ts - Badge de ventas no leídas
import { NextResponse } from 'next/server'
import { getUnreadSalesCount, markSalesAsRead } from '@/lib/api/admin/salesBadge'

import { withErrorLogging } from '@/lib/api/withErrorLogging'
export const maxDuration = 15

async function _GET() {
  try {
    const { count, totalAmount } = await getUnreadSalesCount()
    return NextResponse.json({ count, totalAmount })
  } catch (error) {
    console.error('❌ [API/unread-sales] GET error:', error)
    return NextResponse.json({ count: 0 }, { status: 500 })
  }
}

/**
 * POST /api/v2/admin/unread-sales
 * Marca ventas como leídas (actualiza last_read_at).
 */
async function _POST() {
  try {
    await markSalesAsRead()
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('❌ [API/unread-sales] POST error:', error)
    return NextResponse.json({ success: false }, { status: 500 })
  }
}

export const GET = withErrorLogging('/api/v2/admin/unread-sales', _GET)
export const POST = withErrorLogging('/api/v2/admin/unread-sales', _POST)
