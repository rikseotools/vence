// lib/notifications/urlGenerator.js
// Funciones para generar URLs de acciones de notificaciones

/**
 * Genera un slug de ley a partir del nombre
 * @param {string|undefined} lawName - Nombre de la ley
 * @returns {string} - Slug de la ley
 */
function generateLawSlug(lawName) {
  if (!lawName) return 'unknown'

  const specialCases = {
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

  if (specialCases[lawName]) {
    return specialCases[lawName]
  }

  return lawName
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9\-]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
}

/**
 * Genera la URL de acción para una notificación
 * @param {Object} notification - Los datos de la notificación
 * @param {string} notification.id - ID de la notificación
 * @param {string} notification.type - Tipo de notificación
 * @param {string} [notification.campaign] - Campaña de la notificación
 * @param {string} [notification.disputeId] - ID de la disputa (para dispute_update)
 * @param {string} [notification.law_short_name] - Nombre corto de la ley
 * @param {Array} [notification.articlesList] - Lista de artículos
 * @param {number} [notification.articlesCount] - Número de artículos
 * @param {Object} [notification.context_data] - Datos de contexto
 * @param {Object} [notification.data] - Datos adicionales
 * @param {string} actionType - El tipo de acción (view_dispute, directed_test, etc.)
 * @returns {string} - La URL generada
 */
function generateNotificationActionUrl(notification, actionType) {
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
          const lawSlug = generateLawSlug(notification.law_short_name)

          baseParams.append('articles', articles)
          baseParams.append('mode', 'intensive')
          baseParams.append('n', Math.min((notification.articlesCount || 1) * 2, 10).toString())
          baseParams.append('law', lawSlug)
          return `/test/rapido?${baseParams.toString()}`
        } else if (actionType === 'view_theory') {
          const lawSlug = generateLawSlug(notification.law_short_name)
          return `/teoria/${lawSlug}?${baseParams.toString()}`
        }
        break

      case 'level_regression':
        if (actionType === 'directed_test') {
          baseParams.append('mode', 'recovery')
          baseParams.append('n', '15')
          const lawSlug = generateLawSlug(notification.law_short_name)
          baseParams.append('law', lawSlug)
          baseParams.append('_t', Date.now().toString())
          return `/test/rapido?${baseParams.toString()}`
        } else if (actionType === 'view_theory') {
          const lawSlug = generateLawSlug(notification.law_short_name)
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

module.exports = {
  generateLawSlug,
  generateNotificationActionUrl
}
