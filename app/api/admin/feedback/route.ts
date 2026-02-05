// app/api/admin/feedback/route.ts
// API para cargar feedbacks y conversaciones (admin)
// Usa Drizzle + Zod para tipado robusto

import { NextRequest, NextResponse } from 'next/server'
import {
  getAllFeedbacks,
  getConversationsWithMessages,
  getFeedbackStats,
  getUserProfiles,
  safeParseGetFeedbacksQuery,
  type FilterType
} from '@/lib/api/admin-feedback'

// ============================================
// GET - Cargar feedbacks, conversaciones y stats
// ============================================

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)

    // Parse query params
    const queryValidation = safeParseGetFeedbacksQuery({
      filter: searchParams.get('filter') || 'all',
      limit: searchParams.get('limit') || 50,
      offset: searchParams.get('offset') || 0
    })

    if (!queryValidation.success) {
      return NextResponse.json(
        {
          success: false,
          error: 'Parámetros inválidos',
          details: queryValidation.error.flatten()
        },
        { status: 400 }
      )
    }

    const { filter, limit, offset } = queryValidation.data

    // Check what data is requested
    const includeConversations = searchParams.get('conversations') === 'true'
    const includeStats = searchParams.get('stats') !== 'false' // Default true
    const includeProfiles = searchParams.get('profiles') === 'true'

    // Fetch data in parallel
    const promises: Promise<unknown>[] = [
      getAllFeedbacks(filter as FilterType, limit, offset)
    ]

    if (includeConversations) {
      promises.push(getConversationsWithMessages(limit, offset))
    }

    if (includeStats) {
      promises.push(getFeedbackStats())
    }

    const results = await Promise.all(promises)

    let feedbacksResult = results[0] as Awaited<ReturnType<typeof getAllFeedbacks>>
    let conversationsResult: Awaited<ReturnType<typeof getConversationsWithMessages>> | null = null
    let statsResult: Awaited<ReturnType<typeof getFeedbackStats>> | null = null

    let resultIndex = 1
    if (includeConversations) {
      conversationsResult = results[resultIndex] as Awaited<ReturnType<typeof getConversationsWithMessages>>
      resultIndex++
    }
    if (includeStats) {
      statsResult = results[resultIndex] as Awaited<ReturnType<typeof getFeedbackStats>>
    }

    // Get user profiles if requested and there are feedbacks
    let profilesResult: Awaited<ReturnType<typeof getUserProfiles>> | null = null
    if (includeProfiles && feedbacksResult.success && feedbacksResult.data) {
      const userIds = feedbacksResult.data
        .map(f => f.userId)
        .filter((id): id is string => id !== null)
      const uniqueUserIds = [...new Set(userIds)]

      if (uniqueUserIds.length > 0) {
        profilesResult = await getUserProfiles(uniqueUserIds)
      }
    }

    // Build response
    const response: Record<string, unknown> = {
      success: true,
      feedbacks: feedbacksResult.data || [],
      total: feedbacksResult.total || 0,
      offset,
      limit
    }

    if (conversationsResult) {
      response.conversations = conversationsResult.data || []
    }

    if (statsResult && statsResult.stats) {
      response.stats = statsResult.stats
    }

    if (profilesResult) {
      response.profiles = profilesResult.data || []
    }

    console.log('✅ [API/admin/feedback] GET success:', {
      feedbacksCount: (feedbacksResult.data || []).length,
      conversationsCount: (conversationsResult?.data || []).length,
      hasStats: !!statsResult?.stats
    })

    return NextResponse.json(response)

  } catch (error) {
    console.error('❌ [API/admin/feedback] Error:', error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Error interno del servidor'
      },
      { status: 500 }
    )
  }
}
