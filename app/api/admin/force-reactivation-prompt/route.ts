// app/api/admin/force-reactivation-prompt/route.ts
import { NextResponse } from 'next/server'
import { forceReactivationRequestSchema } from '@/lib/api/admin-force-reactivation/schemas'
import { forceReactivationPrompt } from '@/lib/api/admin-force-reactivation'

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const parsed = forceReactivationRequestSchema.safeParse(body)

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'userId y userEmail son obligatorios' },
        { status: 400 }
      )
    }

    const { userId, userEmail, forcedBy } = parsed.data
    const result = await forceReactivationPrompt(userId, userEmail, forcedBy)
    return NextResponse.json(result)

  } catch (error) {
    if (error instanceof Error && error.message === 'USER_NOT_FOUND') {
      return NextResponse.json(
        { error: 'Usuario no encontrado' },
        { status: 404 }
      )
    }
    console.error('❌ Error forzando prompt de reactivación:', error)
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    )
  }
}
