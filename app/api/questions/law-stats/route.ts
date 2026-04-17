// app/api/questions/law-stats/route.ts
// Endpoint para obtener estadísticas de preguntas por ley (conteo total + oficiales).
// Usado por LawTestConfigurator y page.tsx de leyes.
// Usa Drizzle ORM (DATABASE_URL), no Supabase client → no afectado por RLS.

import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/db/client'
import { questions, articles, laws } from '@/db/schema'
import { eq, and, sql, isNull } from 'drizzle-orm'
import { withErrorLogging } from '@/lib/api/withErrorLogging'

export const dynamic = 'force-dynamic'
export const revalidate = 0

async function _GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const lawShortName = searchParams.get('lawShortName')

    if (!lawShortName) {
      return NextResponse.json(
        { success: false, error: 'Falta parámetro lawShortName' },
        { status: 400 }
      )
    }

    const db = getDb()
    const startTime = Date.now()

    // Conteo total + oficiales en una sola query
    const [result] = await db
      .select({
        total: sql<number>`count(*)`.as('total'),
        official: sql<number>`count(*) filter (where ${questions.isOfficialExam} = true)`.as('official'),
      })
      .from(questions)
      .innerJoin(articles, eq(questions.primaryArticleId, articles.id))
      .innerJoin(laws, eq(articles.lawId, laws.id))
      .where(and(
        eq(questions.isActive, true),
        isNull(questions.examCaseId),
        eq(laws.shortName, lawShortName)
      ))

    const queryMs = Date.now() - startTime
    if (queryMs > 2000) {
      console.warn(`⚠️ [API/law-stats] Query lenta: ${queryMs}ms para ${lawShortName}`)
    }

    const total = Number(result?.total ?? 0)
    const official = Number(result?.official ?? 0)
    const adjustedTotal = Math.max(total, official)

    console.log(`📊 [API/law-stats] ${lawShortName}: ${adjustedTotal} total, ${official} oficiales (${queryMs}ms)`)

    return NextResponse.json({
      success: true,
      lawShortName,
      totalQuestions: adjustedTotal,
      officialQuestions: official,
      regularQuestions: Math.max(0, adjustedTotal - official),
      hasQuestions: adjustedTotal > 0,
      hasOfficialQuestions: official > 0,
    })
  } catch (error) {
    console.error('❌ [API/law-stats] Error:', error)
    return NextResponse.json(
      { success: false, error: 'Error interno del servidor' },
      { status: 500 }
    )
  }
}

export const GET = withErrorLogging('/api/questions/law-stats', _GET)
