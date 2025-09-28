// app/api/adaptive-difficulty/route.js
import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { adaptiveDifficultyService } from '@/lib/services/adaptiveDifficulty'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url)
    const userId = searchParams.get('userId')
    const action = searchParams.get('action')
    const questionId = searchParams.get('questionId')

    if (!userId) {
      return NextResponse.json({ error: 'userId is required' }, { status: 400 })
    }

    switch (action) {
      case 'personal_difficulty':
        if (!questionId) {
          return NextResponse.json({ error: 'questionId is required for personal_difficulty' }, { status: 400 })
        }
        const personalDifficulty = await adaptiveDifficultyService.getPersonalDifficulty(userId, questionId)
        return NextResponse.json(personalDifficulty)

      case 'metrics':
        const metrics = await adaptiveDifficultyService.getUserDifficultyMetrics(userId)
        return NextResponse.json(metrics)

      case 'breakdown':
        const breakdown = await adaptiveDifficultyService.getPersonalDifficultyBreakdown(userId)
        return NextResponse.json(breakdown)

      case 'history':
        const difficulty = searchParams.get('difficulty')
        const trend = searchParams.get('trend')
        const limit = searchParams.get('limit') ? parseInt(searchParams.get('limit')) : undefined
        
        const history = await adaptiveDifficultyService.getUserDifficultyHistory(userId, {
          difficulty,
          trend,
          limit
        })
        return NextResponse.json(history)

      case 'struggling':
        const limitStruggling = searchParams.get('limit') ? parseInt(searchParams.get('limit')) : 10
        const struggling = await adaptiveDifficultyService.getStrugglingQuestions(userId, limitStruggling)
        return NextResponse.json(struggling)

      case 'mastered':
        const limitMastered = searchParams.get('limit') ? parseInt(searchParams.get('limit')) : 10
        const mastered = await adaptiveDifficultyService.getMasteredQuestions(userId, limitMastered)
        return NextResponse.json(mastered)

      case 'trends':
        const trends = await adaptiveDifficultyService.getUserProgressTrends(userId)
        return NextResponse.json(trends)

      case 'recommendations':
        const recommendations = await adaptiveDifficultyService.getPersonalizedRecommendations(userId)
        return NextResponse.json(recommendations)

      case 'questions_by_difficulty':
        const targetDifficulty = searchParams.get('difficulty')
        const targetTrend = searchParams.get('trend')
        const limitQuestions = searchParams.get('limit') ? parseInt(searchParams.get('limit')) : undefined
        
        if (!targetDifficulty) {
          return NextResponse.json({ error: 'difficulty parameter is required' }, { status: 400 })
        }

        const questions = await adaptiveDifficultyService.getQuestionsByPersonalDifficulty(userId, targetDifficulty, {
          trend: targetTrend,
          limit: limitQuestions
        })
        return NextResponse.json(questions)

      default:
        return NextResponse.json({ error: 'Invalid action parameter' }, { status: 400 })
    }

  } catch (error) {
    console.error('Adaptive difficulty API error:', error)
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    )
  }
}

export async function POST(request) {
  try {
    const body = await request.json()
    const { action, userId } = body

    if (!userId) {
      return NextResponse.json({ error: 'userId is required' }, { status: 400 })
    }

    switch (action) {
      case 'migrate_data':
        const migrationResult = await adaptiveDifficultyService.runDataMigration()
        return NextResponse.json(migrationResult)

      case 'create_initial_metrics':
        const metrics = await adaptiveDifficultyService.createInitialUserMetrics(userId)
        return NextResponse.json(metrics)

      case 'recalculate_metrics':
        // Recalcular métricas de usuario desde cero
        const { data, error } = await supabase
          .rpc('recalculate_user_metrics', { p_user_id: userId })

        if (error) throw error

        return NextResponse.json({ success: true, data })

      default:
        return NextResponse.json({ error: 'Invalid action parameter' }, { status: 400 })
    }

  } catch (error) {
    console.error('Adaptive difficulty POST API error:', error)
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    )
  }
}