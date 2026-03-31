// lib/notifications/urlGenerator.ts
// Funciones para generar URLs de acciones de notificaciones

interface ArticleItem {
  article_number: string
  [key: string]: unknown
}

interface NotificationInput {
  id: string
  type: string
  campaign?: string
  disputeId?: string
  law_short_name?: string
  articlesList?: ArticleItem[]
  articlesCount?: number
  context_data?: { conversation_id?: string; [key: string]: unknown }
  data?: { conversation_id?: string; [key: string]: unknown }
}

const specialCases: Record<string, string> = {
  'Ley 19/2013': 'ley-19-2013',
  'Ley 50/1997': 'ley-50-1997',
  'Ley 40/2015': 'ley-40-2015',
  'LRJSP': 'ley-40-2015',
  'Ley 7/1985': 'ley-7-1985',
  'Ley 2/2014': 'ley-2-2014',
  'Ley 25/2014': 'ley-25-2014',
  'Ley 38/2015': 'ley-38-2015',
  'LPAC': 'ley-39-2015',
  'CE': 'ce',
  'Constitución Española': 'ce',
  'TUE': 'tue',
  'TFUE': 'tfue'
}

export async function generateLawSlug(lawName: string | undefined): Promise<string> {
  if (!lawName) return 'unknown'

  if (specialCases[lawName]) {
    return specialCases[lawName]
  }

  // Intentar resolver desde BD
  try {
    const { getCanonicalSlugAsync } = await import('@/lib/api/laws/queries')
    return await getCanonicalSlugAsync(lawName)
  } catch {
    // Fallback: generación determinista
    return lawName
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/\s+/g, '-')
      .replace(/[^a-z0-9\-]/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '')
  }
}

export async function generateNotificationActionUrl(notification: NotificationInput, actionType: string): Promise<string> {
  const baseParams = new URLSearchParams({
    utm_source: 'notification',
    utm_campaign: notification.campaign || 'general',
    notification_id: notification.id
  })

  try {
    switch (notification.type) {
      case 'problematic_articles':
        if (actionType === 'intensive_test') {
          const articles = notification.articlesList?.map(a => a.article_number).join(',') || ''
          const lawSlug = await generateLawSlug(notification.law_short_name)

          baseParams.append('articles', articles)
          baseParams.append('mode', 'intensive')
          baseParams.append('n', Math.min((notification.articlesCount || 1) * 2, 10).toString())
          if (notification.law_short_name) {
            baseParams.append('law_short_name', notification.law_short_name)
          }
          baseParams.append('law', lawSlug)
          return `/test/rapido?${baseParams.toString()}`
        } else if (actionType === 'view_theory') {
          const lawSlug = await generateLawSlug(notification.law_short_name)
          return `/teoria/${lawSlug}?${baseParams.toString()}`
        }
        break

      case 'level_regression':
        if (actionType === 'directed_test') {
          baseParams.append('mode', 'recovery')
          baseParams.append('n', '15')
          if (notification.law_short_name) {
            baseParams.append('law_short_name', notification.law_short_name)
          }
          const lawSlug = await generateLawSlug(notification.law_short_name)
          baseParams.append('law', lawSlug)
          baseParams.append('_t', Date.now().toString())
          return `/test/rapido?${baseParams.toString()}`
        } else if (actionType === 'view_theory') {
          const lawSlug = await generateLawSlug(notification.law_short_name)
          return `/teoria/${lawSlug}?${baseParams.toString()}`
        }
        break

      case 'study_streak':
        if (actionType === 'maintain_streak') {
          baseParams.append('mode', 'streak')
          baseParams.append('n', '5')
          return `/test/mantener-racha?${baseParams.toString()}`
        } else if (actionType === 'view_streak_stats') {
          return `/mis-estadisticas?${baseParams.toString()}`
        }
        break

      case 'achievement':
      case 'improvement':
        if (actionType === 'next_challenge' || actionType === 'consolidate_improvement') {
          baseParams.append('mode', 'celebration')
          baseParams.append('n', '8')
          return `/test/rapido?${baseParams.toString()}`
        } else if (actionType === 'view_achievements' || actionType === 'view_progress') {
          return `/mis-estadisticas?${baseParams.toString()}`
        }
        break

      case 'streak_broken':
        if (actionType === 'quick_test') {
          baseParams.append('mode', 'recovery')
          baseParams.append('n', '5')
          return `/test/rapido?${baseParams.toString()}`
        } else if (actionType === 'view_stats') {
          return `/mis-estadisticas?${baseParams.toString()}`
        }
        break

      case 'progress_update':
        if (actionType === 'advanced_test') {
          return `/test/rapido?${baseParams.toString()}`
        } else if (actionType === 'view_details') {
          return `/mis-estadisticas?${baseParams.toString()}`
        }
        break

      case 'dispute_update':
        // IMPORTANTE: Para disputas, el actionType DEBE ser 'view_dispute'
        // Si se pasa otro tipo (como 'view_corrected_question'), se cae al default
        if (actionType === 'view_dispute') {
          const disputeId = notification.disputeId || notification.id.replace('dispute-', '') || notification.id
          return `/soporte?tab=impugnaciones&dispute_id=${disputeId}&${baseParams.toString()}`
        }
        break

      case 'feedback_response':
        if (actionType === 'open_chat') {
          const conversationId = notification.context_data?.conversation_id || notification.data?.conversation_id
          return `/soporte?conversation_id=${conversationId}`
        }
        break

      default:
        return `/test/rapido?${baseParams.toString()}`
    }
  } catch (error) {
    console.warn('⚠️ Error in generateNotificationActionUrl:', error)
    return `/test/rapido?${baseParams.toString()}`
  }

  // Default fallback
  return `/test/rapido?${baseParams.toString()}`
}
