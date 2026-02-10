// app/api/admin/newsletters/history/route.js
import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

const getSupabaseAdmin = () => createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url)
    const limit = parseInt(searchParams.get('limit') || '50')
    const offset = parseInt(searchParams.get('offset') || '0')

    // Parámetros para obtener usuarios de una campaña específica
    const templateId = searchParams.get('templateId')
    const date = searchParams.get('date') // YYYY-MM-DD
    const eventType = searchParams.get('eventType') // 'sent', 'opened', 'clicked'

    // Si se solicita lista de usuarios de una campaña específica
    if (templateId && date && eventType) {
      return getCampaignUsers(templateId, date, eventType)
    }

    console.log('📊 Obteniendo historial de newsletters...')

    // Obtener todos los eventos de newsletters
    const { data: events, error } = await getSupabaseAdmin()
      .from('email_events')
      .select('*')
      .eq('email_type', 'newsletter')
      .order('created_at', { ascending: false })

    if (error) {
      console.error('❌ Error obteniendo eventos:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    if (!events || events.length === 0) {
      return NextResponse.json({
        success: true,
        newsletters: [],
        total: 0,
        pagination: { limit, offset, hasMore: false }
      })
    }

    // ESTRATEGIA DE AGRUPACIÓN:
    // 1. Agrupar por SUBJECT + FECHA (para emails antiguos con campaign_id único por email)
    // 2. Los nuevos envíos (a partir de hoy) usarán campaign_id compartido automáticamente
    const newsletterMap = new Map()

    events.forEach(event => {
      // ESTRATEGIA: Agrupar por template_id + fecha (para contar opens)
      // pero usar el subject del primer "sent" para identificar el newsletter
      const eventDate = new Date(event.created_at)
      const dateKey = `${eventDate.getFullYear()}-${String(eventDate.getMonth() + 1).padStart(2, '0')}-${String(eventDate.getDate()).padStart(2, '0')}`
      const groupKey = `${event.template_id}_${dateKey}`

      if (!newsletterMap.has(groupKey)) {
        newsletterMap.set(groupKey, {
          campaignId: event.campaign_id || groupKey,
          subject: null, // Se llenará con el primer subject válido
          templateId: event.template_id,
          emailContent: event.email_content_preview,
          sentAt: event.created_at,
          stats: {
            sent: new Set(), // Usar Sets para contar usuarios únicos
            opened: new Set(),
            clicked: new Set(),
            bounced: new Set()
          },
          recipients: new Set()
        })
      }

      const newsletter = newsletterMap.get(groupKey)
      newsletter.recipients.add(event.user_id)

      // Guardar el subject del primer evento "sent" con subject válido
      if (!newsletter.subject && event.event_type === 'sent' && event.subject &&
          !event.subject.includes('Email - Opened') && !event.subject.includes('Email - Clicked')) {
        newsletter.subject = event.subject
        newsletter.sentAt = event.created_at // Usar la fecha del primer sent
        newsletter.emailContent = event.email_content_preview
      }

      // Contar usuarios únicos por tipo de evento
      if (event.event_type === 'sent') {
        newsletter.stats.sent.add(event.user_id)
      } else if (event.event_type === 'opened') {
        newsletter.stats.opened.add(event.user_id)
      } else if (event.event_type === 'clicked') {
        newsletter.stats.clicked.add(event.user_id)
      } else if (event.event_type === 'bounced') {
        newsletter.stats.bounced.add(event.user_id)
      }
    })

    // Obtener información de actividad de todos los usuarios únicos
    const allUserIds = [...new Set(events.map(e => e.user_id))]
    const { data: userActivity, error: activityError } = await getSupabaseAdmin()
      .from('admin_users_with_roles')
      .select('user_id, last_test_date')
      .in('user_id', allUserIds)

    // Crear mapa de actividad por usuario
    const userActivityMap = new Map()
    if (!activityError && userActivity) {
      const now = Date.now()
      userActivity.forEach(u => {
        const daysSinceLastTest = u.last_test_date
          ? Math.floor((now - new Date(u.last_test_date).getTime()) / (1000 * 60 * 60 * 24))
          : null

        let activityLevel = 'dormant'
        if (daysSinceLastTest !== null) {
          if (daysSinceLastTest <= 30) activityLevel = 'very_active'
          else if (daysSinceLastTest <= 90) activityLevel = 'active'
        }

        userActivityMap.set(u.user_id, activityLevel)
      })
    }

    // Convertir a array y calcular métricas
    const newsletters = Array.from(newsletterMap.values())
      .filter(newsletter => newsletter.stats.sent.size > 0) // SOLO mostrar envíos reales (con al menos 1 sent)
      .map(newsletter => {
        // Fallback para subject si no se encontró ninguno válido
        if (!newsletter.subject) {
          newsletter.subject = `Newsletter - ${newsletter.templateId}`
        }
        const sentCount = newsletter.stats.sent.size
        const openedCount = newsletter.stats.opened.size
        const clickedCount = newsletter.stats.clicked.size
        const bouncedCount = newsletter.stats.bounced.size

        // Calcular usuarios activos que abrieron
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
            veryActiveOpened: veryActiveOpened,
            activeOpened: activeOpened,
            totalActiveOpened: totalActiveOpened,
            activeOpenRate: openedCount > 0 ? ((totalActiveOpened / openedCount) * 100).toFixed(1) : '0.0'
          },
          recipientCount: newsletter.recipients.size
        }
      })

    // Ordenar por fecha (más reciente primero)
    newsletters.sort((a, b) => new Date(b.sentAt) - new Date(a.sentAt))

    // Paginar
    const paginatedNewsletters = newsletters.slice(offset, offset + limit)
    const hasMore = (offset + limit) < newsletters.length

    console.log(`✅ Historial obtenido: ${newsletters.length} envíos únicos`)

    return NextResponse.json({
      success: true,
      newsletters: paginatedNewsletters,
      total: newsletters.length,
      pagination: {
        limit,
        offset,
        hasMore
      }
    })

  } catch (error) {
    console.error('❌ Error en history API:', error)
    return NextResponse.json({
      error: 'Error interno del servidor',
      details: error.message
    }, { status: 500 })
  }
}

// Función helper para obtener usuarios de una campaña específica
async function getCampaignUsers(templateId, date, eventType) {
  try {
    console.log(`📋 Obteniendo usuarios que ${eventType} la campaña ${templateId} del ${date}`)

    // Buscar eventos por template_id + fecha (día completo)
    const startDate = new Date(`${date}T00:00:00Z`)
    const endDate = new Date(`${date}T23:59:59Z`)

    const { data: events, error } = await getSupabaseAdmin()
      .from('email_events')
      .select('user_id, email_address, created_at')
      .eq('email_type', 'newsletter')
      .eq('template_id', templateId)
      .eq('event_type', eventType)
      .gte('created_at', startDate.toISOString())
      .lte('created_at', endDate.toISOString())
      .order('created_at', { ascending: false })

    if (error) {
      console.error('❌ Error obteniendo usuarios:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // Obtener información adicional de los usuarios
    const userIds = [...new Set(events.map(e => e.user_id))]

    const { data: userStats, error: profileError } = await getSupabaseAdmin()
      .from('admin_users_with_roles')
      .select('user_id, email, full_name, avg_score_30d, user_created_at, last_test_date')
      .in('user_id', userIds)

    if (profileError) {
      console.error('❌ Error obteniendo perfiles:', profileError)
    }

    // Crear mapa de perfiles para lookup rápido
    const profileMap = new Map()
    userStats?.forEach(p => profileMap.set(p.user_id, p))

    // Combinar datos y calcular nivel de actividad
    const now = Date.now()
    const users = events.map(event => {
      const profile = profileMap.get(event.user_id)
      const accountAge = profile?.user_created_at
        ? Math.floor((now - new Date(profile.user_created_at).getTime()) / (1000 * 60 * 60 * 24))
        : null

      // Calcular días desde último test
      const daysSinceLastTest = profile?.last_test_date
        ? Math.floor((now - new Date(profile.last_test_date).getTime()) / (1000 * 60 * 60 * 24))
        : null

      // Clasificar nivel de actividad
      let activityLevel = 'dormant' // Por defecto: dormido
      if (daysSinceLastTest !== null) {
        if (daysSinceLastTest <= 30) activityLevel = 'very_active' // Muy activo: último mes
        else if (daysSinceLastTest <= 90) activityLevel = 'active' // Activo: último trimestre
      }

      return {
        userId: event.user_id,
        email: event.email_address,
        fullName: profile?.full_name || null,
        timestamp: event.created_at,
        avgScore: profile?.avg_score_30d || 0,
        accountAgeDays: accountAge,
        lastTestDate: profile?.last_test_date || null,
        activityLevel: activityLevel,
        daysSinceLastTest: daysSinceLastTest
      }
    })

    // Deduplicar por user_id (tomar solo la primera ocurrencia)
    const uniqueUsers = []
    const seenIds = new Set()

    users.forEach(user => {
      if (!seenIds.has(user.userId)) {
        seenIds.add(user.userId)
        uniqueUsers.push(user)
      }
    })

    // Calcular métricas de actividad
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
        totalActive: totalActive,
        veryActivePercentage: uniqueUsers.length > 0 ? ((veryActiveCount / uniqueUsers.length) * 100).toFixed(1) : '0.0',
        activePercentage: uniqueUsers.length > 0 ? ((totalActive / uniqueUsers.length) * 100).toFixed(1) : '0.0'
      },
      templateId,
      date,
      eventType
    })

  } catch (error) {
    console.error('❌ Error en getCampaignUsers:', error)
    return NextResponse.json({
      error: 'Error obteniendo usuarios',
      details: error.message
    }, { status: 500 })
  }
}
