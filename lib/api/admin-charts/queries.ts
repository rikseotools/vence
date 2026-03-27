// lib/api/admin-charts/queries.ts - Drizzle queries para charts de admin
// Reemplaza 28 queries secuenciales del cliente por 2 queries SQL server-side
import { getAdminDb as getDb } from '@/db/client'
import { sql } from 'drizzle-orm'
import type { ActivityChartResponse, RegistrationsChartResponse } from './schemas'

// -- Helper de fechas (zona horaria Madrid) --

// Extract YYYY-MM-DD from a Date whose values represent Madrid local time
function toMadridDateKey(date: Date): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

function getMadridDayRange(daysAgo: number): { start: Date; end: Date; label: string; weekday: string; dateKey: string } {
  const nowMadrid = new Date(new Date().toLocaleString('en-US', { timeZone: 'Europe/Madrid' }))
  const date = new Date(nowMadrid)
  date.setDate(date.getDate() - daysAgo)
  date.setHours(0, 0, 0, 0)

  const nextDay = new Date(date)
  nextDay.setDate(nextDay.getDate() + 1)

  return {
    start: date,
    end: nextDay,
    label: date.toLocaleDateString('es-ES', { weekday: 'short', day: 'numeric' }),
    weekday: date.toLocaleDateString('es-ES', { weekday: 'short' }),
    dateKey: toMadridDateKey(date),
  }
}

// ============================================
// Activity Chart - Usuarios activos por día
// 1 query SQL con COUNT(DISTINCT) + GROUP BY en vez de 28 queries
// ============================================

export async function getActivityChartData(days = 14): Promise<ActivityChartResponse> {
  const db = getDb()

  // Calcular rango: últimos N días + N días anteriores
  const nowMadrid = new Date(new Date().toLocaleString('en-US', { timeZone: 'Europe/Madrid' }))
  const startCurrent = new Date(nowMadrid)
  startCurrent.setDate(startCurrent.getDate() - (days - 1))
  startCurrent.setHours(0, 0, 0, 0)

  const startPrevious = new Date(startCurrent)
  startPrevious.setDate(startPrevious.getDate() - days)

  // Una sola query: contar usuarios únicos por día en los últimos 28 días
  const rows = await db.execute(sql`
    select
      (started_at at time zone 'Europe/Madrid')::date as day,
      count(distinct user_id)::int as unique_users
    from tests
    where started_at >= ${startPrevious.toISOString()}::timestamptz
      and started_at < ${new Date(nowMadrid.getFullYear(), nowMadrid.getMonth(), nowMadrid.getDate() + 1).toISOString()}::timestamptz
      and user_id is not null
    group by (started_at at time zone 'Europe/Madrid')::date
    order by day
  `)

  // Indexar resultados por fecha
  const byDay = new Map<string, number>()
  for (const row of rows as any[]) {
    // row.day es una Date o string dependiendo del driver
    const dateStr = row.day instanceof Date
      ? row.day.toISOString().split('T')[0]
      : String(row.day).split('T')[0]
    byDay.set(dateStr, Number(row.unique_users))
  }

  // Construir array de datos para el chart
  const data = []
  for (let i = days - 1; i >= 0; i--) {
    const current = getMadridDayRange(i)
    const previous = getMadridDayRange(i + days)

    const currentKey = current.dateKey
    const previousKey = previous.dateKey

    data.push({
      dia: current.label,
      weekday: current.weekday,
      actual: byDay.get(currentKey) || 0,
      anterior: byDay.get(previousKey) || 0,
    })
  }

  return { data }
}

// ============================================
// Registrations Chart - Registros por día y fuente
// 1 query SQL con COUNT + FILTER en vez de cargar toda la tabla
// ============================================

export async function getRegistrationsChartData(days = 14): Promise<RegistrationsChartResponse> {
  const db = getDb()

  const nowMadrid = new Date(new Date().toLocaleString('en-US', { timeZone: 'Europe/Madrid' }))
  const startDate = new Date(nowMadrid)
  startDate.setDate(startDate.getDate() - (days - 1))
  startDate.setHours(0, 0, 0, 0)

  // Una sola query: contar registros por día y fuente
  const rows = await db.execute(sql`
    select
      (created_at at time zone 'Europe/Madrid')::date as day,
      count(*)::int as total,
      count(*) filter (where registration_source = 'organic')::int as organic,
      count(*) filter (where registration_source = 'google_ads')::int as google,
      count(*) filter (where registration_source = 'meta_ads')::int as meta,
      count(*) filter (where registration_source is null or registration_source = 'unknown')::int as other
    from user_profiles
    where created_at >= ${startDate.toISOString()}::timestamptz
    group by (created_at at time zone 'Europe/Madrid')::date
    order by day
  `)

  // Indexar resultados por fecha
  const byDay = new Map<string, { total: number; organic: number; google: number; meta: number; other: number }>()
  for (const row of rows as any[]) {
    const dateStr = row.day instanceof Date
      ? row.day.toISOString().split('T')[0]
      : String(row.day).split('T')[0]
    byDay.set(dateStr, {
      total: Number(row.total),
      organic: Number(row.organic),
      google: Number(row.google),
      meta: Number(row.meta),
      other: Number(row.other),
    })
  }

  // Construir array de datos para el chart
  const data = []
  for (let i = days - 1; i >= 0; i--) {
    const dayInfo = getMadridDayRange(i)
    const key = dayInfo.dateKey
    const stats = byDay.get(key) || { total: 0, organic: 0, google: 0, meta: 0, other: 0 }

    data.push({
      dia: dayInfo.label,
      isToday: i === 0,
      ...stats,
    })
  }

  return { data }
}
