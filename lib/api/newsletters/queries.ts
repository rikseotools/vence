// lib/api/newsletters/queries.ts - Queries tipadas para newsletters
import { getDb } from '@/db/client'
import { userProfiles, emailPreferences } from '@/db/schema'
import { eq, and, not, isNull, sql, gte, lt, notInArray } from 'drizzle-orm'
import type { AudienceType, EligibleUser, AudienceStats, NewsletterVariables } from './schemas'
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
