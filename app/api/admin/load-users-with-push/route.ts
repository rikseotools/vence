// app/api/admin/load-users-with-push/route.ts
import { NextResponse } from 'next/server'
import { loadUsersWithPush } from '@/lib/api/admin-load-users-with-push'

export async function POST() {
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
