// app/api/admin/users-count/route.ts - API para obtener conteo real de usuarios
import { NextResponse } from 'next/server'
import { getUsersCount } from '@/lib/api/admin-users-count'

import { withErrorLogging } from '@/lib/api/withErrorLogging'
async function _GET() {
  try {
    const result = await getUsersCount()
    return NextResponse.json(result)
  } catch (error) {
    console.error('❌ [API/admin/users-count] Error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export const GET = withErrorLogging('/api/admin/users-count', _GET)
