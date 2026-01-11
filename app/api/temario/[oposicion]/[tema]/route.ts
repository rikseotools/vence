// app/api/temario/[oposicion]/[tema]/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getTopicContent } from '@/lib/api/temario/queries'
import { OPOSICIONES, type OposicionSlug } from '@/lib/api/temario/schemas'

export const dynamic = 'force-dynamic'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ oposicion: string; tema: string }> }
) {
  try {
    const { oposicion, tema } = await params

    // Validar oposición
    if (!OPOSICIONES[oposicion as OposicionSlug]) {
      return NextResponse.json(
        {
          success: false,
          error: `Oposición no válida: ${oposicion}. Válidas: ${Object.keys(OPOSICIONES).join(', ')}`,
        },
        { status: 400 }
      )
    }

    // Validar número de tema
    const topicNumber = parseInt(tema)
    if (isNaN(topicNumber) || topicNumber < 1) {
      return NextResponse.json(
        { success: false, error: 'Número de tema no válido' },
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

    // Obtener contenido del tema
    const topicContent = await getTopicContent(
      oposicion as OposicionSlug,
      topicNumber,
      userId
    )

    if (!topicContent) {
      return NextResponse.json(
        { success: false, error: `Tema ${topicNumber} no encontrado para ${oposicion}` },
        { status: 404 }
      )
    }

    return NextResponse.json({
      success: true,
      data: topicContent,
    })
  } catch (error) {
    console.error('Error en API temario:', error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Error desconocido',
      },
      { status: 500 }
    )
  }
}
