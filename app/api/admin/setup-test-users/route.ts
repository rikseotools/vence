// app/api/admin/setup-test-users/route.ts
import { NextResponse } from 'next/server'
import { setupTestUsersRequestSchema } from '@/lib/api/admin-setup-test-users/schemas'
import { setupTestUsers } from '@/lib/api/admin-setup-test-users'

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const parsed = setupTestUsersRequestSchema.safeParse(body)

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Datos inválidos: ' + parsed.error.message },
        { status: 400 }
      )
    }

    // Solo permitir al administrador principal
    if (parsed.data.adminEmail !== 'manueltrader@gmail.com') {
      return NextResponse.json(
        { error: 'Solo permitido para el administrador principal' },
        { status: 403 }
      )
    }

    const result = await setupTestUsers()
    return NextResponse.json(result)

  } catch (error) {
    console.error('❌ Error configurando usuarios de prueba:', error)
    return NextResponse.json(
      { error: 'Error interno: ' + (error instanceof Error ? error.message : 'Unknown') },
      { status: 500 }
    )
  }
}
