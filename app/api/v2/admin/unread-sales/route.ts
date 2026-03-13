// app/api/v2/admin/unread-sales/route.ts - Badge de ventas no leídas
import { NextResponse } from 'next/server'
import { getUnreadSalesCount, markSalesAsRead } from '@/lib/api/admin/salesBadge'

export const maxDuration = 15

export async function GET() {
  try {
    const count = await getUnreadSalesCount()
    return NextResponse.json({ count })
  } catch (error) {
    console.error('❌ [API/unread-sales] GET error:', error)
    return NextResponse.json({ count: 0 }, { status: 500 })
  }
}

/**
 * POST /api/v2/admin/unread-sales
 * Marca ventas como leídas (actualiza last_read_at).
 */
export async function POST() {
  try {
    await markSalesAsRead()
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('❌ [API/unread-sales] POST error:', error)
    return NextResponse.json({ success: false }, { status: 500 })
  }
}
