// lib/api/admin-charts/activityStats.ts
//
// Cálculo PURO de los stats del gráfico "Usuarios Activos por Día" (20/06).
//
// Antes el panel mostraba "promedio" (en realidad media de 14d) y "máximo" (solo de la
// quincena visible) SIN declarar la ventana → engañaba. Ahora:
//   - avg7d   = ritmo reciente (media diaria de los últimos 7 días)
//   - max90d  = récord real (pico diario en 90 días, no de 14)
//   - deltas  = avg7d actual vs el avg7d de hace ~30 y ~90 días (like-for-like, ventana
//               de 7 días contra ventana de 7 días) → "¿crezco vs hace un mes/trimestre?"
//
// Pura para testearla sin BD. Entrada: conteos diarios MÁS RECIENTE PRIMERO
// (índice 0 = hoy, 1 = ayer, …); los días sin actividad deben venir como 0.

import type { ActivityStats } from './schemas'

const avg = (arr: number[]): number =>
  arr.length ? Math.round(arr.reduce((a, b) => a + b, 0) / arr.length) : 0

const pct = (now: number, then: number): number | null =>
  then > 0 ? Math.round(((now - then) / then) * 100) : null

export function computeActivityStats(countsMostRecentFirst: number[]): ActivityStats {
  const avg7d = avg(countsMostRecentFirst.slice(0, 7))
  const max90d = countsMostRecentFirst.slice(0, 90).reduce((m, v) => Math.max(m, v), 0)
  // Ventana de 7 días que TERMINA hace ~30 / ~90 días → comparación homogénea con avg7d.
  const avg7d_30ago = avg(countsMostRecentFirst.slice(30, 37))
  const avg7d_90ago = avg(countsMostRecentFirst.slice(90, 97))
  return {
    avg7d,
    max90d,
    delta30dPct: pct(avg7d, avg7d_30ago),
    delta90dPct: pct(avg7d, avg7d_90ago),
  }
}
