// app/api/admin/pending-counts/route.ts
// API para obtener conteo de elementos pendientes para admins (usa service role para bypass RLS)

import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

export async function GET() {
  try {
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // Ejecutar todas las queries en paralelo
    const [normalDisputesResult, psychoDisputesResult] = await Promise.all([
      // Impugnaciones normales pendientes
      supabase
        .from('question_disputes')
        .select('id', { count: 'exact', head: true })
        .eq('status', 'pending'),

      // Impugnaciones psicotécnicas pendientes
      supabase
        .from('psychometric_question_disputes')
        .select('id', { count: 'exact', head: true })
        .eq('status', 'pending'),
    ])

    const normalCount = normalDisputesResult.count || 0
    const psychoCount = psychoDisputesResult.count || 0

    return NextResponse.json({
      success: true,
      impugnaciones: normalCount + psychoCount,
      detail: {
        normal: normalCount,
        psychometric: psychoCount
      }
    })
  } catch (error) {
    console.error('❌ [API/admin/pending-counts] Error:', error)
    return NextResponse.json(
      { success: false, error: 'Error interno', impugnaciones: 0 },
      { status: 500 }
    )
  }
}
