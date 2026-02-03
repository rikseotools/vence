// app/api/v2/official-exams/review/route.ts
// API to get all questions from a completed official exam for review

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getOfficialExamReview } from '@/lib/api/official-exams/queries'
import { safeParseGetOfficialExamReview } from '@/lib/api/official-exams/schemas'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

export async function GET(request: NextRequest) {
  try {
    // Get auth token
    const authHeader = request.headers.get('Authorization')
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json(
        { success: false, error: 'No autorizado' },
        { status: 401 }
      )
    }

    const token = authHeader.slice(7)

    // Verify token with Supabase
    const supabase = createClient(supabaseUrl, supabaseServiceKey)
    const { data: { user }, error: authError } = await supabase.auth.getUser(token)

    if (authError || !user) {
      return NextResponse.json(
        { success: false, error: 'Token inválido' },
        { status: 401 }
      )
    }

    // Get query params
    const { searchParams } = new URL(request.url)
    const examDate = searchParams.get('examDate')
    const oposicion = searchParams.get('oposicion')
    const parte = searchParams.get('parte') as 'primera' | 'segunda' | null

    // Validate request
    const validation = safeParseGetOfficialExamReview({
      userId: user.id,
      examDate,
      oposicion,
      parte: parte || undefined,
    })

    if (!validation.success) {
      return NextResponse.json(
        { success: false, error: 'Parámetros inválidos', details: validation.error.errors },
        { status: 400 }
      )
    }

    // Get review data
    const result = await getOfficialExamReview(validation.data)

    if (!result.success) {
      return NextResponse.json(
        { success: false, error: result.error },
        { status: 404 }
      )
    }

    return NextResponse.json(result)
  } catch (error) {
    console.error('❌ [API/official-exams/review] Error:', error)
    return NextResponse.json(
      { success: false, error: 'Error interno del servidor' },
      { status: 500 }
    )
  }
}
