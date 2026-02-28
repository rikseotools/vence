// app/api/admin/newsletters/history/route.ts
// API para obtener historial de newsletters con estadísticas
import { NextResponse } from 'next/server'
import {
  getNewsletterHistory,
  getUserActivity,
  getCampaignEvents,
  getCampaignUserProfiles,
} from '@/lib/api/admin-newsletters-history'

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const limit = parseInt(searchParams.get('limit') || '50')
    const offset = parseInt(searchParams.get('offset') || '0')

    // Parámetros para obtener usuarios de una campaña específica
    const templateId = searchParams.get('templateId')
    const date = searchParams.get('date')
    const eventType = searchParams.get('eventType')

    // Si se solicita lista de usuarios de una campaña específica
    if (templateId && date && eventType) {
      return handleCampaignUsers(templateId, date, eventType)
    }

    console.log('📊 Obteniendo historial de newsletters...')

    const events = await getNewsletterHistory()

    if (!events || events.length === 0) {
      return NextResponse.json({
        success: true,
        newsletters: [],
        total: 0,
        pagination: { limit, offset, hasMore: false },
      })
    }

    // Agrupar por template_id + fecha
    const newsletterMap = new Map<string, {
      campaignId: string
      subject: string | null
      templateId: string | null
      emailContent: string | null
      sentAt: string | null
      stats: {
        sent: Set<string>
        opened: Set<string>
        clicked: Set<string>
        bounced: Set<string>
      }
      recipients: Set<string>
    }>()

    events.forEach(event => {
      const eventDate = new Date(event.createdAt!)
      const dateKey = `${eventDate.getFullYear()}-${String(eventDate.getMonth() + 1).padStart(2, '0')}-${String(eventDate.getDate()).padStart(2, '0')}`
      const groupKey = `${event.templateId}_${dateKey}`

      if (!newsletterMap.has(groupKey)) {
        newsletterMap.set(groupKey, {
          campaignId: event.campaignId || groupKey,
          subject: null,
          templateId: event.templateId,
          emailContent: event.emailContentPreview,
          sentAt: event.createdAt,
          stats: {
            sent: new Set(),
            opened: new Set(),
            clicked: new Set(),
            bounced: new Set(),
          },
          recipients: new Set(),
        })
      }

      const newsletter = newsletterMap.get(groupKey)!
      if (event.userId) newsletter.recipients.add(event.userId)

      if (!newsletter.subject && event.eventType === 'sent' && event.subject &&
          !event.subject.includes('Email - Opened') && !event.subject.includes('Email - Clicked')) {
        newsletter.subject = event.subject
        newsletter.sentAt = event.createdAt
        newsletter.emailContent = event.emailContentPreview
      }

      if (event.userId) {
        if (event.eventType === 'sent') newsletter.stats.sent.add(event.userId)
        else if (event.eventType === 'opened') newsletter.stats.opened.add(event.userId)
        else if (event.eventType === 'clicked') newsletter.stats.clicked.add(event.userId)
        else if (event.eventType === 'bounced') newsletter.stats.bounced.add(event.userId)
      }
    })

    // Obtener información de actividad de todos los usuarios únicos
    const allUserIds = [...new Set(events.map(e => e.userId).filter(Boolean))] as string[]
    const userActivity = await getUserActivity(allUserIds)

    // Crear mapa de actividad por usuario
    const userActivityMap = new Map<string, string>()
    const now = Date.now()
    userActivity.forEach(u => {
      if (!u.userId) return
      const daysSinceLastTest = u.lastTestDate
        ? Math.floor((now - new Date(u.lastTestDate).getTime()) / (1000 * 60 * 60 * 24))
        : null

      let activityLevel = 'dormant'
      if (daysSinceLastTest !== null) {
        if (daysSinceLastTest <= 30) activityLevel = 'very_active'
        else if (daysSinceLastTest <= 90) activityLevel = 'active'
      }

      userActivityMap.set(u.userId, activityLevel)
    })

    // Convertir a array y calcular métricas
    const newsletters = Array.from(newsletterMap.values())
      .filter(newsletter => newsletter.stats.sent.size > 0)
      .map(newsletter => {
        if (!newsletter.subject) {
          newsletter.subject = `Newsletter - ${newsletter.templateId}`
        }
        const sentCount = newsletter.stats.sent.size
        const openedCount = newsletter.stats.opened.size
        const clickedCount = newsletter.stats.clicked.size
        const bouncedCount = newsletter.stats.bounced.size

        const openedUsers = Array.from(newsletter.stats.opened)
        const veryActiveOpened = openedUsers.filter(userId => userActivityMap.get(userId) === 'very_active').length
        const activeOpened = openedUsers.filter(userId => userActivityMap.get(userId) === 'active').length
        const totalActiveOpened = veryActiveOpened + activeOpened

        return {
          campaignId: newsletter.campaignId,
          subject: newsletter.subject,
          templateId: newsletter.templateId,
          emailContent: newsletter.emailContent,
          sentAt: newsletter.sentAt,
          stats: {
            sent: sentCount,
            opened: openedCount,
            clicked: clickedCount,
            bounced: bouncedCount,
            openRate: sentCount > 0 ? ((openedCount / sentCount) * 100).toFixed(1) : '0.0',
            clickRate: sentCount > 0 ? ((clickedCount / sentCount) * 100).toFixed(1) : '0.0',
            veryActiveOpened,
            activeOpened,
            totalActiveOpened,
            activeOpenRate: openedCount > 0 ? ((totalActiveOpened / openedCount) * 100).toFixed(1) : '0.0',
          },
          recipientCount: newsletter.recipients.size,
        }
      })

    newsletters.sort((a, b) => new Date(b.sentAt!).getTime() - new Date(a.sentAt!).getTime())

    const paginatedNewsletters = newsletters.slice(offset, offset + limit)
    const hasMore = (offset + limit) < newsletters.length

    console.log(`✅ Historial obtenido: ${newsletters.length} envíos únicos`)

    return NextResponse.json({
      success: true,
      newsletters: paginatedNewsletters,
      total: newsletters.length,
      pagination: { limit, offset, hasMore },
    })
  } catch (error) {
    console.error('❌ [API/admin/newsletters/history] Error:', error)
    return NextResponse.json(
      { error: 'Error interno del servidor', details: (error as Error).message },
      { status: 500 }
    )
  }
}

async function handleCampaignUsers(templateId: string, date: string, eventType: string) {
  try {
    console.log(`📋 Obteniendo usuarios que ${eventType} la campaña ${templateId} del ${date}`)

    const startDate = new Date(`${date}T00:00:00Z`).toISOString()
    const endDate = new Date(`${date}T23:59:59Z`).toISOString()

    const events = await getCampaignEvents(templateId, startDate, endDate, eventType)

    const userIds = [...new Set(events.map(e => e.userId).filter(Boolean))] as string[]
    const profiles = await getCampaignUserProfiles(userIds)

    const profileMap = new Map(profiles.map(p => [p.userId, p]))

    const now = Date.now()
    const users = events.map(event => {
      const profile = event.userId ? profileMap.get(event.userId) : undefined
      const accountAge = profile?.userCreatedAt
        ? Math.floor((now - new Date(profile.userCreatedAt).getTime()) / (1000 * 60 * 60 * 24))
        : null

      const daysSinceLastTest = profile?.lastTestDate
        ? Math.floor((now - new Date(profile.lastTestDate).getTime()) / (1000 * 60 * 60 * 24))
        : null

      let activityLevel: 'very_active' | 'active' | 'dormant' = 'dormant'
      if (daysSinceLastTest !== null) {
        if (daysSinceLastTest <= 30) activityLevel = 'very_active'
        else if (daysSinceLastTest <= 90) activityLevel = 'active'
      }

      return {
        userId: event.userId ?? '',
        email: event.emailAddress,
        fullName: profile?.fullName || null,
        timestamp: event.createdAt ?? '',
        avgScore: profile?.avgScore30D || 0,
        accountAgeDays: accountAge,
        lastTestDate: profile?.lastTestDate || null,
        activityLevel,
        daysSinceLastTest,
      }
    })

    // Deduplicar por userId
    const uniqueUsers: typeof users = []
    const seenIds = new Set<string>()
    users.forEach(user => {
      if (!seenIds.has(user.userId)) {
        seenIds.add(user.userId)
        uniqueUsers.push(user)
      }
    })

    const veryActiveCount = uniqueUsers.filter(u => u.activityLevel === 'very_active').length
    const activeCount = uniqueUsers.filter(u => u.activityLevel === 'active').length
    const totalActive = veryActiveCount + activeCount

    console.log(`✅ Encontrados ${uniqueUsers.length} usuarios únicos (${veryActiveCount} muy activos, ${activeCount} activos)`)

    return NextResponse.json({
      success: true,
      users: uniqueUsers,
      total: uniqueUsers.length,
      metrics: {
        veryActive: veryActiveCount,
        active: activeCount,
        totalActive,
        veryActivePercentage: uniqueUsers.length > 0 ? ((veryActiveCount / uniqueUsers.length) * 100).toFixed(1) : '0.0',
        activePercentage: uniqueUsers.length > 0 ? ((totalActive / uniqueUsers.length) * 100).toFixed(1) : '0.0',
      },
      templateId,
      date,
      eventType,
    })
  } catch (error) {
    console.error('❌ [API/admin/newsletters/history] Error en getCampaignUsers:', error)
    return NextResponse.json(
      { error: 'Error obteniendo usuarios', details: (error as Error).message },
      { status: 500 }
    )
  }
}
