import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getFailedQuestionsByTopic } from '@/lib/api/user-failed-questions'
import { getFailedByTopicRequestSchema } from '@/lib/api/user-failed-questions/schemas'
import { withErrorLogging } from '@/lib/api/withErrorLogging'

async function getOptionalUserId(request: NextRequest): Promise<string | null> {
  try {
    const authHeader = request.headers.get('authorization')
    if (!authHeader?.startsWith('Bearer ')) return null
    const token = authHeader.split(' ')[1]
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { global: { headers: { Authorization: `Bearer ${token}` } } },
    )
    const { data: { user } } = await supabase.auth.getUser()
    return user?.id ?? null
  } catch {
    return null
  }
}

async function _GET(request: NextRequest) {
  try {
    const userId = await getOptionalUserId(request)
    if (!userId) {
      return NextResponse.json({ success: false, error: 'No autenticado' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    // positionType OBLIGATORIO: sin él el SQL no puede distinguir entre
    // oposiciones con el mismo topic_number y devolvería títulos mezclados.
    const parsed = getFailedByTopicRequestSchema.safeParse({
      positionType: searchParams.get('positionType') ?? '',
    })

    if (!parsed.success) {
      return NextResponse.json({
        success: false,
        error: 'positionType es obligatorio y debe ser un identificador válido',
        details: parsed.error.flatten(),
      }, { status: 400 })
    }

    const result = await getFailedQuestionsByTopic(userId, parsed.data.positionType)

    if (!result.success) {
      return NextResponse.json({ success: false, error: result.error }, { status: 400 })
    }

    return NextResponse.json({ success: true, topics: result.topics })
  } catch (error) {
    console.error('Error en API /questions/failed-by-topic:', error)
    return NextResponse.json({ success: false, error: 'Error interno' }, { status: 500 })
  }
}

export const GET = withErrorLogging('/api/questions/failed-by-topic', _GET)
