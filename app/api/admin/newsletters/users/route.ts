// app/api/admin/newsletters/users/route.ts
import { NextResponse } from 'next/server'
import { newsletterUsersQuerySchema } from '@/lib/api/newsletters/schemas'
import { getNewsletterUsers } from '@/lib/api/newsletters'

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)

    const parsed = newsletterUsersQuerySchema.safeParse({
      audienceType: searchParams.get('audienceType') || 'all',
      search: searchParams.get('search') || '',
      page: searchParams.get('page') || '1',
      limit: searchParams.get('limit') || '50'
    })

    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: 'Parámetros inválidos: ' + parsed.error.message },
        { status: 400 }
      )
    }

    const { audienceType, search, page, limit } = parsed.data
    const result = await getNewsletterUsers(audienceType, search, page, limit)
    return NextResponse.json(result)

  } catch (error) {
    console.error('❌ Error en endpoint de usuarios:', error)
    return NextResponse.json(
      { success: false, error: 'Error interno del servidor' },
      { status: 500 }
    )
  }
}
