// lib/api/fraud/queries.ts - Queries tipadas para alertas de fraude
import { getDb } from '@/db/client'
import { fraudAlerts } from '@/db/schema'
import { eq, and, desc, sql, count, gte } from 'drizzle-orm'
import type {
  CreateFraudAlertRequest,
  CreateFraudAlertResponse,
  GetFraudAlertsRequest,
  GetFraudAlertsResponse,
  UpdateAlertStatusRequest,
  UpdateAlertStatusResponse,
  GetFraudStatsResponse,
  AlertType,
  Severity,
  AlertStatus,
} from './schemas'

// ============================================
// CREAR ALERTA DE FRAUDE
// ============================================

export async function createFraudAlert(
  params: CreateFraudAlertRequest
): Promise<CreateFraudAlertResponse> {
  try {
    const db = getDb()

    // Verificar si ya existe una alerta similar activa (mismos usuarios, mismo tipo)
    const existing = await db
      .select({ id: fraudAlerts.id })
      .from(fraudAlerts)
      .where(and(
        eq(fraudAlerts.alertType, params.alertType),
        eq(fraudAlerts.status, 'new'),
        sql`${fraudAlerts.userIds} @> ${params.userIds}::uuid[]`
      ))
      .limit(1)

    if (existing.length > 0) {
      // Ya existe una alerta similar, no crear duplicada
      return {
        success: true,
        alertId: existing[0].id,
      }
    }

    const result = await db
      .insert(fraudAlerts)
      .values({
        alertType: params.alertType,
        severity: params.severity,
        status: 'new',
        userIds: params.userIds,
        details: params.details,
        matchCriteria: params.matchCriteria,
      })
      .returning({ id: fraudAlerts.id })

    return {
      success: true,
      alertId: result[0].id,
    }
  } catch (error) {
    console.error('Error creando alerta de fraude:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Error desconocido',
    }
  }
}

// ============================================
// OBTENER ALERTAS
// ============================================

export async function getFraudAlerts(
  params: Partial<GetFraudAlertsRequest> = {}
): Promise<GetFraudAlertsResponse> {
  try {
    const db = getDb()
    const { status, alertType, severity, limit = 50, offset = 0 } = params

    // Construir condiciones dinámicas
    const conditions = []
    if (status) conditions.push(eq(fraudAlerts.status, status))
    if (alertType) conditions.push(eq(fraudAlerts.alertType, alertType))
    if (severity) conditions.push(eq(fraudAlerts.severity, severity))

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined

    // Obtener alertas
    const alerts = await db
      .select()
      .from(fraudAlerts)
      .where(whereClause)
      .orderBy(desc(fraudAlerts.detectedAt))
      .limit(limit)
      .offset(offset)

    // Contar total
    const totalResult = await db
      .select({ count: count() })
      .from(fraudAlerts)
      .where(whereClause)

    return {
      success: true,
      alerts: alerts.map(a => ({
        id: a.id,
        alertType: a.alertType as AlertType,
        severity: a.severity as Severity,
        status: a.status as AlertStatus,
        userIds: a.userIds,
        details: a.details as Record<string, unknown>,
        matchCriteria: a.matchCriteria,
        detectedAt: a.detectedAt ?? new Date().toISOString(),
        reviewedAt: a.reviewedAt,
        reviewedBy: a.reviewedBy,
        notes: a.notes,
        createdAt: a.createdAt ?? new Date().toISOString(),
      })),
      total: totalResult[0]?.count ?? 0,
    }
  } catch (error) {
    console.error('Error obteniendo alertas:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Error desconocido',
    }
  }
}

// ============================================
// ACTUALIZAR ESTADO DE ALERTA
// ============================================

export async function updateAlertStatus(
  params: UpdateAlertStatusRequest
): Promise<UpdateAlertStatusResponse> {
  try {
    const db = getDb()

    await db
      .update(fraudAlerts)
      .set({
        status: params.status,
        notes: params.notes,
        reviewedBy: params.reviewedBy,
        reviewedAt: new Date().toISOString(),
      })
      .where(eq(fraudAlerts.id, params.alertId))

    return { success: true }
  } catch (error) {
    console.error('Error actualizando alerta:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Error desconocido',
    }
  }
}

// ============================================
// ESTADÍSTICAS DE FRAUDE
// ============================================

export async function getFraudStats(): Promise<GetFraudStatsResponse> {
  try {
    const db = getDb()

    // Contar por estado
    const byStatus = await db
      .select({
        status: fraudAlerts.status,
        count: count(),
      })
      .from(fraudAlerts)
      .groupBy(fraudAlerts.status)

    // Contar por tipo
    const byType = await db
      .select({
        alertType: fraudAlerts.alertType,
        count: count(),
      })
      .from(fraudAlerts)
      .where(eq(fraudAlerts.status, 'new'))
      .groupBy(fraudAlerts.alertType)

    // Contar por severidad
    const bySeverity = await db
      .select({
        severity: fraudAlerts.severity,
        count: count(),
      })
      .from(fraudAlerts)
      .where(eq(fraudAlerts.status, 'new'))
      .groupBy(fraudAlerts.severity)

    // Últimas 24h
    const last24h = await db
      .select({ count: count() })
      .from(fraudAlerts)
      .where(gte(fraudAlerts.detectedAt, sql`now() - interval '24 hours'`))

    // Últimos 7 días
    const last7d = await db
      .select({ count: count() })
      .from(fraudAlerts)
      .where(gte(fraudAlerts.detectedAt, sql`now() - interval '7 days'`))

    // Procesar resultados
    const statusMap: Record<string, number> = {}
    byStatus.forEach(s => { statusMap[s.status] = s.count })

    const typeMap: Record<string, number> = {}
    byType.forEach(t => { typeMap[t.alertType] = t.count })

    const severityMap: Record<string, number> = {}
    bySeverity.forEach(s => { severityMap[s.severity] = s.count })

    return {
      success: true,
      stats: {
        totalNew: statusMap['new'] ?? 0,
        totalReviewed: statusMap['reviewed'] ?? 0,
        totalDismissed: statusMap['dismissed'] ?? 0,
        totalActionTaken: statusMap['action_taken'] ?? 0,
        byType: typeMap,
        bySeverity: severityMap,
        last24h: last24h[0]?.count ?? 0,
        last7d: last7d[0]?.count ?? 0,
      },
    }
  } catch (error) {
    console.error('Error obteniendo estadísticas:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Error desconocido',
    }
  }
}

// ============================================
// VERIFICAR SI USUARIOS YA TIENEN ALERTA
// ============================================

export async function hasActiveAlert(
  userIds: string[],
  alertType: AlertType
): Promise<boolean> {
  try {
    const db = getDb()

    const result = await db
      .select({ id: fraudAlerts.id })
      .from(fraudAlerts)
      .where(and(
        eq(fraudAlerts.alertType, alertType),
        eq(fraudAlerts.status, 'new'),
        sql`${fraudAlerts.userIds} && ${userIds}::uuid[]`
      ))
      .limit(1)

    return result.length > 0
  } catch (error) {
    console.error('Error verificando alerta activa:', error)
    return false
  }
}
