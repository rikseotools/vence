// app/api/temario/[oposicion]/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getTopicList } from '@/lib/api/temario/queries'
import { OPOSICIONES, type OposicionSlug } from '@/lib/api/temario/schemas'

export const dynamic = 'force-dynamic'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ oposicion: string }> }
) {
  try {
    const { oposicion } = await params

    // Validar oposición
    const oposicionConfig = OPOSICIONES[oposicion as OposicionSlug]
    if (!oposicionConfig) {
      return NextResponse.json(
        {
          success: false,
          error: `Oposición no válida: ${oposicion}. Válidas: ${Object.keys(OPOSICIONES).join(', ')}`,
        },
        { status: 400 }
      )
    }

    // Obtener userId si está autenticado
    let userId: string | undefined

    const authHeader = request.headers.get('authorization')
    if (authHeader?.startsWith('Bearer ')) {
      const token = authHeader.substring(7)

      const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
      )

      const { data: { user } } = await supabase.auth.getUser(token)
      userId = user?.id
    }

    // Obtener lista de temas
    const topics = await getTopicList(oposicion as OposicionSlug, userId)

    return NextResponse.json({
      success: true,
      oposicion,
      oposicionName: oposicionConfig.name,
      totalTopics: topics.length,
      topics,
    })
  } catch (error) {
    console.error('Error en API temario lista:', error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Error desconocido',
      },
      { status: 500 }
    )
  }
}
