// app/api/debug/question/test/route.ts - Test básico de conexión a DB
import { getDb } from '@/db/client'
import { psychometricQuestions } from '@/db/schema'
import { eq } from 'drizzle-orm'

import { withErrorLogging } from '@/lib/api/withErrorLogging'
async function _GET() {
  try {
    const db = getDb()

    console.log('🔍 Testing Supabase connection...')
    console.log('URL:', process.env.NEXT_PUBLIC_SUPABASE_URL)
    console.log('Service key exists:', !!process.env.SUPABASE_SERVICE_ROLE_KEY)

    // Test básico de conexión
    const test = await db
      .select({
        id: psychometricQuestions.id,
        questionText: psychometricQuestions.questionText,
        questionSubtype: psychometricQuestions.questionSubtype,
      })
      .from(psychometricQuestions)
      .limit(3)

    console.log('✅ Found questions:', test?.length)

    // Buscar la pregunta específica
    const questionId = '588c79ed-05fa-421a-8f32-23e4038b700b'
    const specific = await db
      .select({
        id: psychometricQuestions.id,
        questionText: psychometricQuestions.questionText,
        questionSubtype: psychometricQuestions.questionSubtype,
      })
      .from(psychometricQuestions)
      .where(eq(psychometricQuestions.id, questionId))

    console.log('🎯 Specific question found:', specific?.length)

    return Response.json({
      success: true,
      test_query: test,
      specific_query: specific,
      connection: 'OK',
    })
  } catch (error) {
    console.error('❌ API Error:', error)
    return Response.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}

export const GET = withErrorLogging('/api/debug/question/test', _GET)
