// app/api/admin/load-users-with-push/route.ts
import { NextResponse } from 'next/server'
import { loadUsersWithPush } from '@/lib/api/admin-load-users-with-push'

import { withErrorLogging } from '@/lib/api/withErrorLogging'
async function _POST() {
  try {
    const result = await loadUsersWithPush()
    return NextResponse.json(result)

  } catch (error) {
    console.error('❌ Error cargando usuarios:', error)
    return NextResponse.json(
      { error: 'Error interno del servidor: ' + (error instanceof Error ? error.message : 'Unknown') },
      { status: 500 }
    )
  }
}

export const POST = withErrorLogging('/api/admin/load-users-with-push', _POST)
