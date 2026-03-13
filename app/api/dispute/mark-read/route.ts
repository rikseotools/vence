import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

import { withErrorLogging } from '@/lib/api/withErrorLogging'
function getSupabase() {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error('Variables de entorno de Supabase no configuradas')
  }
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  )
}

async function _POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { disputeId, userId, isPsychometric } = body

    if (!disputeId || !userId) {
      return NextResponse.json(
        { success: false, error: 'disputeId y userId son requeridos' },
        { status: 400 }
      )
    }

    const supabase = getSupabase()
    const tableName = isPsychometric ? 'psychometric_question_disputes' : 'question_disputes'

    console.log(`📖 Marcando disputa como leída:`, { disputeId, userId, isPsychometric, tableName })

    const { data, error } = await supabase
      .from(tableName)
      .update({ is_read: true })
      .eq('id', disputeId)
      .eq('user_id', userId)
      .select()

    if (error) {
      console.error('❌ Error marcando como leída:', error)
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 500 }
      )
    }

    if (!data || data.length === 0) {
      console.warn('⚠️ No se encontró la disputa:', { disputeId, userId, tableName })
      return NextResponse.json(
        { success: false, error: 'Disputa no encontrada' },
        { status: 404 }
      )
    }

    console.log(`✅ Disputa marcada como leída:`, disputeId)

    return NextResponse.json({
      success: true,
      disputeId,
      is_read: true
    })

  } catch (error) {
    console.error('❌ Error en mark-read:', error)
    return NextResponse.json(
      { success: false, error: 'Error interno del servidor' },
      { status: 500 }
    )
  }
}

export const POST = withErrorLogging('/api/dispute/mark-read', _POST)
