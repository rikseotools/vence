// app/api/admin/funnel-users/route.ts
import { NextResponse } from 'next/server'
import { funnelUsersQuerySchema } from '@/lib/api/admin-funnel-users/schemas'
import { getFunnelUsers } from '@/lib/api/admin-funnel-users'

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)

    const parsed = funnelUsersQuerySchema.safeParse({
      stage: searchParams.get('stage'),
      days: searchParams.get('days') || '7',
      limit: searchParams.get('limit') || '50'
    })

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Parámetros inválidos: ' + parsed.error.message },
        { status: 400 }
      )
    }

    const { stage, days, limit } = parsed.data
    const result = await getFunnelUsers(stage, days, limit)
    return NextResponse.json(result)

  } catch (error) {
    console.error('Error in funnel-users:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
