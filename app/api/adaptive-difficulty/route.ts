// app/api/adaptive-difficulty/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient } from '@supabase/supabase-js'
import { withErrorLogging } from '@/lib/api/withErrorLogging'
import { AdaptiveDifficultyService } from '@/lib/services/adaptiveDifficulty'

const userIdSchema = z.string().uuid()

// Lazy-init: instanciar al primer GET y NO al importar el módulo. Sin esto
// `next build` (Vercel/Docker) revienta porque `SUPABASE_SERVICE_ROLE_KEY`
// no está disponible durante la fase de "collect page data". Es además mejor
// runtime — no abre conexión hasta que llega la primera petición.
const getSupabase = () => createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

let cachedService: AdaptiveDifficultyService | null = null
function getService(): AdaptiveDifficultyService {
  if (!cachedService) cachedService = new AdaptiveDifficultyService(getSupabase())
  return cachedService
}

async function _GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const userId = searchParams.get('userId')
    const action = searchParams.get('action')
    const questionId = searchParams.get('questionId')

    if (!userId || !userIdSchema.safeParse(userId).success) {
      return NextResponse.json({ error: 'userId inválido o faltante (debe ser UUID)' }, { status: 400 })
    }

    switch (action) {
      case 'personal_difficulty': {
        if (!questionId) {
          return NextResponse.json({ error: 'questionId is required for personal_difficulty' }, { status: 400 })
        }
        const personalDifficulty = await getService().getPersonalDifficulty(userId, questionId)
        return NextResponse.json(personalDifficulty)
      }

      case 'metrics': {
        const metrics = await getService().getUserDifficultyMetrics(userId)
        return NextResponse.json(metrics)
      }

      case 'breakdown': {
        const breakdown = await getService().getPersonalDifficultyBreakdown(userId)
        return NextResponse.json(breakdown)
      }

      case 'history': {
        const difficulty = searchParams.get('difficulty')
        const trend = searchParams.get('trend')
        const limit = searchParams.get('limit') ? parseInt(searchParams.get('limit')!) : undefined

        const history = await getService().getUserDifficultyHistory(userId, {
          difficulty,
          trend,
          limit
        })
        return NextResponse.json(history)
      }

      case 'struggling': {
        const limitStruggling = searchParams.get('limit') ? parseInt(searchParams.get('limit')!) : 10
        const struggling = await getService().getStrugglingQuestions(userId, limitStruggling)
        return NextResponse.json(struggling)
      }

      case 'mastered': {
        const limitMastered = searchParams.get('limit') ? parseInt(searchParams.get('limit')!) : 10
        const mastered = await getService().getMasteredQuestions(userId, limitMastered)
        return NextResponse.json(mastered)
      }

      case 'trends': {
        const trends = await getService().getUserProgressTrends(userId)
        return NextResponse.json(trends)
      }

      case 'recommendations': {
        const recommendations = await getService().getPersonalizedRecommendations(userId)
        return NextResponse.json(recommendations)
      }

      case 'questions_by_difficulty': {
        const targetDifficulty = searchParams.get('difficulty')
        const targetTrend = searchParams.get('trend')
        const limitQuestions = searchParams.get('limit') ? parseInt(searchParams.get('limit')!) : undefined

        if (!targetDifficulty) {
          return NextResponse.json({ error: 'difficulty parameter is required' }, { status: 400 })
        }

        const questions = await getService().getQuestionsByPersonalDifficulty(userId, targetDifficulty, {
          trend: targetTrend,
          limit: limitQuestions
        })
        return NextResponse.json(questions)
      }

      default:
        return NextResponse.json({ error: 'Invalid action parameter' }, { status: 400 })
    }

  } catch (error) {
    console.error('❌ [API/adaptive-difficulty] GET error:', error)
    return NextResponse.json(
      { error: 'Internal server error', details: (error as Error).message },
      { status: 500 }
    )
  }
}

async function _POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { action, userId } = body

    if (!userId || !userIdSchema.safeParse(userId).success) {
      return NextResponse.json({ error: 'userId inválido o faltante (debe ser UUID)' }, { status: 400 })
    }

    switch (action) {
      case 'migrate_data': {
        const migrationResult = await getService().runDataMigration()
        return NextResponse.json(migrationResult)
      }

      case 'create_initial_metrics': {
        const metrics = await getService().createInitialUserMetrics(userId)
        return NextResponse.json(metrics)
      }

      case 'recalculate_metrics': {
        const { data, error } = await getSupabase()
          .rpc('recalculate_user_metrics', { p_user_id: userId })

        if (error) throw error

        return NextResponse.json({ success: true, data })
      }

      default:
        return NextResponse.json({ error: 'Invalid action parameter' }, { status: 400 })
    }

  } catch (error) {
    console.error('❌ [API/adaptive-difficulty] POST error:', error)
    return NextResponse.json(
      { error: 'Internal server error', details: (error as Error).message },
      { status: 500 }
    )
  }
}

export const GET = withErrorLogging('/api/adaptive-difficulty', _GET)
export const POST = withErrorLogging('/api/adaptive-difficulty', _POST)
