// app/api/soporte/route.ts
// GET — carga todos los datos del usuario para la página de soporte
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import {
  getUserFeedbacksWithConversations,
  getUserDisputes,
} from '@/lib/api/soporte'

const getSupabase = () => createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function GET(request: NextRequest) {
  try {
    // Auth
    const authHeader = request.headers.get('authorization')
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json(
        { success: false, error: 'No autorizado' },
        { status: 401 }
      )
    }

    const token = authHeader.split(' ')[1]
    const { data: { user }, error: authError } = await getSupabase().auth.getUser(token)

    if (authError || !user) {
      return NextResponse.json(
        { success: false, error: 'Token inválido' },
        { status: 401 }
      )
    }

    // Cargar feedbacks + conversaciones y disputes en paralelo
    const [feedbacks, disputes] = await Promise.all([
      getUserFeedbacksWithConversations(user.id),
      getUserDisputes(user.id),
    ])

    return NextResponse.json({
      success: true,
      feedbacks,
      disputes,
    })

  } catch (error) {
    console.error('❌ [API/soporte] Error:', error)
    return NextResponse.json(
      { success: false, error: 'Error interno del servidor' },
      { status: 500 }
    )
  }
}
