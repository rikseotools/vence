// lib/api/newsletters/queries.ts - Queries tipadas para newsletters
import { getDb } from '@/db/client'
import { userProfiles, emailPreferences, emailEvents, adminUsersWithRoles } from '@/db/schema'
import { eq, and, not, isNull, sql, gte, lt, notInArray, desc, or, ilike, ne } from 'drizzle-orm'
import type {
  AudienceType, EligibleUser, AudienceStats, NewsletterVariables,
  TemplateStatsResponse, TemplateStat,
  NewsletterUsersResponse, NewsletterUser
} from './schemas'
import { oposicionTypes, oposicionDisplayNames } from './schemas'

// ============================================
// OBTENER USUARIOS ELEGIBLES PARA NEWSLETTER
// ============================================
// Esta función respeta email_preferences.unsubscribedAll

export async function getNewsletterAudience(
  audienceType: AudienceType
): Promise<EligibleUser[]> {
  const db = getDb()

  // Subquery para usuarios que se han dado de baja de todos los emails
  const unsubscribedUsersSubquery = db
    .select({ userId: emailPreferences.userId })
    .from(emailPreferences)
    .where(eq(emailPreferences.unsubscribedAll, true))

  // Base conditions: excluir usuarios sin email y usuarios dados de baja
  const baseConditions = [
    not(isNull(userProfiles.email)),
  ]

  // Verificar si es un tipo de oposición
  const isOposicionType = (oposicionTypes as readonly string[]).includes(audienceType)

  if (isOposicionType) {
    // Filtro por oposición específica
    baseConditions.push(eq(userProfiles.targetOposicion, audienceType))
  } else {
    // Filtros generales según audienceType
    const thirtyDaysAgo = new Date()
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

    switch (audienceType) {
      case 'active':
        baseConditions.push(eq(userProfiles.isActiveStudent, true))
        break
      case 'inactive':
        baseConditions.push(eq(userProfiles.isActiveStudent, false))
        break
      case 'premium':
        baseConditions.push(eq(userProfiles.planType, 'premium'))
        break
      case 'free':
        baseConditions.push(
          sql`(${userProfiles.planType} IS NULL OR ${userProfiles.planType} != 'premium')`
        )
        break
      // 'all' no añade filtros adicionales
    }
  }

  // Query principal: obtener usuarios y excluir los que están en unsubscribed
  const users = await db
    .select({
      id: userProfiles.id,
      email: userProfiles.email,
      fullName: userProfiles.fullName,
      targetOposicion: userProfiles.targetOposicion,
    })
    .from(userProfiles)
    .where(and(...baseConditions))

  // Obtener lista de usuarios dados de baja
  const unsubscribedUsers = await db
    .select({ userId: emailPreferences.userId })
    .from(emailPreferences)
    .where(eq(emailPreferences.unsubscribedAll, true))

  const unsubscribedIds = new Set(unsubscribedUsers.map(u => u.userId))

  // Filtrar usuarios que no están dados de baja y tienen email válido
  return users
    .filter(u => u.email && !unsubscribedIds.has(u.id))
    .map(u => ({
      id: u.id,
      email: u.email!,
      fullName: u.fullName,
      targetOposicion: u.targetOposicion
    }))
}

// ============================================
// OBTENER ESTADÍSTICAS DE AUDIENCIA
// ============================================

export async function getAudienceStats(): Promise<AudienceStats> {
  // Obtener conteos para cada tipo de audiencia
  const audienceTypes: AudienceType[] = [
    'all', 'active', 'inactive', 'premium', 'free',
    ...oposicionTypes
  ]

  const counts: Record<string, number> = {}

  for (const type of audienceTypes) {
    const audience = await getNewsletterAudience(type)
    counts[type] = audience.length
  }

  return {
    general: {
      all: counts.all || 0,
      active: counts.active || 0,
      inactive: counts.inactive || 0,
      premium: counts.premium || 0,
      free: counts.free || 0
    },
    byOposicion: oposicionTypes.map(key => ({
      key,
      name: oposicionDisplayNames[key],
      count: counts[key] || 0
    }))
  }
}

// ============================================
// REEMPLAZAR VARIABLES EN CONTENIDO
// ============================================

export function replaceNewsletterVariables(
  content: string,
  variables: NewsletterVariables
): string {
  let result = content

  // Reemplazar {nombre} - usar primer nombre o "Opositor/a"
  const firstName = variables.nombre?.split(' ')[0] || 'Opositor/a'
  result = result.replace(/\{nombre\}/gi, firstName)

  // Reemplazar {user_name} - compatibilidad con sistema anterior
  result = result.replace(/\{user_name\}/gi, firstName)

  // Reemplazar {oposicion} - usar nombre legible
  let oposicionName = 'tu oposición'
  if (variables.oposicion && variables.oposicion in oposicionDisplayNames) {
    oposicionName = oposicionDisplayNames[variables.oposicion as keyof typeof oposicionDisplayNames]
  } else if (variables.oposicion) {
    oposicionName = variables.oposicion
  }
  result = result.replace(/\{oposicion\}/gi, oposicionName)

  // Reemplazar {email}
  result = result.replace(/\{email\}/gi, variables.email)

  return result
}

// ============================================
// CONTAR USUARIOS DADOS DE BAJA
// ============================================

export async function getUnsubscribedCount(): Promise<number> {
  const db = getDb()

  const result = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(emailPreferences)
    .where(eq(emailPreferences.unsubscribedAll, true))

  return result[0]?.count || 0
}

// ============================================
// VERIFICAR SI USUARIO ESTÁ DADO DE BAJA
// ============================================

export async function isUserUnsubscribed(userId: string): Promise<boolean> {
  const db = getDb()

  const result = await db
    .select({ unsubscribedAll: emailPreferences.unsubscribedAll })
    .from(emailPreferences)
    .where(eq(emailPreferences.userId, userId))
    .limit(1)

  return result[0]?.unsubscribedAll === true
}

// ============================================
// ESTADÍSTICAS DE PLANTILLAS DE EMAIL
// ============================================

export async function getTemplateStats(): Promise<TemplateStatsResponse> {
  const db = getDb()

  const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString()

  const statsData = await db
    .select({
      templateId: emailEvents.templateId,
      emailType: emailEvents.emailType,
      eventType: emailEvents.eventType,
      createdAt: emailEvents.createdAt,
      subject: emailEvents.subject,
      userId: emailEvents.userId
    })
    .from(emailEvents)
    .where(gte(emailEvents.createdAt, ninetyDaysAgo))

  // Procesar estadísticas por plantilla
  const templateStats: Record<string, TemplateStat & { _openers: Set<string>; _clickers: Set<string> }> = {}

  for (const event of statsData) {
    const templateId = event.templateId || event.emailType

    if (!templateStats[templateId]) {
      templateStats[templateId] = {
        templateId,
        emailType: event.emailType,
        lastSubject: event.subject,
        totalSent: 0,
        totalDelivered: 0,
        totalOpened: 0,
        totalClicked: 0,
        totalBounced: 0,
        totalComplained: 0,
        totalUnsubscribed: 0,
        openRate: 0,
        clickRate: 0,
        bounceRate: 0,
        complaintRate: 0,
        lastSent: null,
        uniqueOpeners: 0,
        uniqueClickers: 0,
        _openers: new Set(),
        _clickers: new Set()
      }
    }

    const stat = templateStats[templateId]

    switch (event.eventType) {
      case 'sent':
        stat.totalSent++
        if (!stat.lastSent || (event.createdAt && new Date(event.createdAt) > new Date(stat.lastSent))) {
          stat.lastSent = event.createdAt
          stat.lastSubject = event.subject
        }
        break
      case 'delivered':
        stat.totalDelivered++
        break
      case 'opened':
        stat.totalOpened++
        if (event.userId) stat._openers.add(event.userId)
        break
      case 'clicked':
        stat.totalClicked++
        if (event.userId) stat._clickers.add(event.userId)
        break
      case 'bounced':
        stat.totalBounced++
        break
      case 'complained':
        stat.totalComplained++
        break
      case 'unsubscribed':
        stat.totalUnsubscribed++
        break
    }
  }

  // Calcular tasas y limpiar Sets internos
  const result: Record<string, TemplateStat> = {}
  for (const [key, stat] of Object.entries(templateStats)) {
    const openRate = stat.totalSent > 0 ? (stat._openers.size / stat.totalSent * 100) : 0
    const clickRate = stat.totalOpened > 0 ? (stat._clickers.size / stat.totalOpened * 100) : 0
    const bounceRate = stat.totalSent > 0 ? (stat.totalBounced / stat.totalSent * 100) : 0
    const complaintRate = stat.totalSent > 0 ? (stat.totalComplained / stat.totalSent * 100) : 0

    result[key] = {
      templateId: stat.templateId,
      emailType: stat.emailType,
      lastSubject: stat.lastSubject,
      totalSent: stat.totalSent,
      totalDelivered: stat.totalDelivered,
      totalOpened: stat.totalOpened,
      totalClicked: stat.totalClicked,
      totalBounced: stat.totalBounced,
      totalComplained: stat.totalComplained,
      totalUnsubscribed: stat.totalUnsubscribed,
      openRate,
      clickRate,
      bounceRate,
      complaintRate,
      lastSent: stat.lastSent,
      uniqueOpeners: stat._openers.size,
      uniqueClickers: stat._clickers.size
    }
  }

  return {
    success: true,
    templateStats: result
  }
}

// ============================================
// OBTENER USUARIOS PARA NEWSLETTERS (PAGINADO)
// ============================================

export async function getNewsletterUsers(
  audienceType: string,
  search: string,
  page: number,
  limit: number
): Promise<NewsletterUsersResponse> {
  const db = getDb()
  const offset = (page - 1) * limit

  let users: NewsletterUser[] = []
  let total = 0

  if (audienceType === 'all') {
    // Query directa a user_profiles
    const baseConditions = [not(isNull(userProfiles.email))]

    if (search.trim()) {
      baseConditions.push(
        or(
          ilike(userProfiles.email, `%${search}%`),
          ilike(userProfiles.fullName, `%${search}%`)
        )!
      )
    }

    const [countResult] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(userProfiles)
      .where(and(...baseConditions))

    total = countResult?.count || 0

    const rows = await db
      .select({
        id: userProfiles.id,
        email: userProfiles.email,
        fullName: userProfiles.fullName,
        createdAt: userProfiles.createdAt
      })
      .from(userProfiles)
      .where(and(...baseConditions))
      .orderBy(desc(userProfiles.createdAt))
      .limit(limit)
      .offset(offset)

    users = rows
  } else {
    // Usar admin_users_with_roles view
    const baseConditions: ReturnType<typeof eq>[] = []

    switch (audienceType) {
      case 'active':
        baseConditions.push(eq(adminUsersWithRoles.isActiveStudent, true))
        break
      case 'inactive':
        baseConditions.push(eq(adminUsersWithRoles.isActiveStudent, false))
        break
      case 'premium':
        baseConditions.push(eq(adminUsersWithRoles.planType, 'premium'))
        break
      case 'free':
        baseConditions.push(ne(adminUsersWithRoles.planType, 'premium'))
        break
    }

    if (search.trim()) {
      baseConditions.push(
        or(
          ilike(adminUsersWithRoles.email, `%${search}%`),
          ilike(adminUsersWithRoles.fullName, `%${search}%`)
        )! as any
      )
    }

    const whereClause = baseConditions.length > 0 ? and(...baseConditions) : undefined

    const [countResult] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(adminUsersWithRoles)
      .where(whereClause)

    total = countResult?.count || 0

    const rows = await db
      .select({
        userId: adminUsersWithRoles.userId,
        email: adminUsersWithRoles.email,
        fullName: adminUsersWithRoles.fullName,
        userCreatedAt: adminUsersWithRoles.userCreatedAt
      })
      .from(adminUsersWithRoles)
      .where(whereClause)
      .orderBy(desc(adminUsersWithRoles.userCreatedAt))
      .limit(limit)
      .offset(offset)

    users = rows.map(u => ({
      id: u.userId!,
      email: u.email,
      fullName: u.fullName,
      createdAt: u.userCreatedAt
    }))
  }

  const totalPages = Math.ceil(total / limit)

  return {
    success: true,
    users,
    pagination: {
      page,
      limit,
      total,
      totalPages,
      hasMore: offset + limit < total
    },
    audienceType,
    search
  }
}
