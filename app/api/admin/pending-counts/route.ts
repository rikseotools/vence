// app/api/admin/pending-counts/route.ts
// API para obtener conteo de elementos pendientes para admins

import { NextResponse } from 'next/server'
import { getPendingDisputeCounts } from '@/lib/api/admin-pending-counts'

export const maxDuration = 15

export async function GET() {
  try {
    const result = await getPendingDisputeCounts()
    return NextResponse.json(result)
  } catch (error) {
    console.error('❌ [API/admin/pending-counts] Error:', error)
    return NextResponse.json(
      { success: false, error: 'Error interno', impugnaciones: 0 },
      { status: 500 }
    )
  }
}
