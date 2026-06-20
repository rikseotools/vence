import { computeActivityStats } from '@/lib/api/admin-charts/activityStats'

// counts MÁS RECIENTE PRIMERO: índice 0 = hoy, 1 = ayer, …
describe('computeActivityStats — ventanas explícitas del panel de actividad', () => {
  it('avg7d = media de los últimos 7 días (no 14)', () => {
    const counts = [10, 20, 30, 40, 50, 60, 70, /* 8º en adelante NO cuenta */ 1000, 1000]
    // media de 10..70 = 40
    expect(computeActivityStats(counts).avg7d).toBe(40)
  })

  it('max90d = pico en 90 días (ignora lo de >90)', () => {
    const counts = Array(120).fill(5)
    counts[80] = 999 // dentro de 90
    counts[95] = 5000 // fuera de 90 → no debe contar
    expect(computeActivityStats(counts).max90d).toBe(999)
  })

  it('delta30dPct = avg7d actual vs avg7d de hace ~30 días', () => {
    const counts = Array(100).fill(0)
    for (let i = 0; i < 7; i++) counts[i] = 120 // avg7d actual = 120
    for (let i = 30; i < 37; i++) counts[i] = 100 // avg7d hace 30d = 100
    expect(computeActivityStats(counts).delta30dPct).toBe(20) // +20%
  })

  it('delta90dPct = avg7d actual vs avg7d de hace ~90 días', () => {
    const counts = Array(100).fill(0)
    for (let i = 0; i < 7; i++) counts[i] = 80
    for (let i = 90; i < 97; i++) counts[i] = 100
    expect(computeActivityStats(counts).delta90dPct).toBe(-20) // -20%
  })

  it('delta null si no hay base (división por cero) — no muestra chip falso', () => {
    const counts = Array(100).fill(0)
    for (let i = 0; i < 7; i++) counts[i] = 50 // hay actividad ahora, cero hace 30/90d
    const s = computeActivityStats(counts)
    expect(s.delta30dPct).toBeNull()
    expect(s.delta90dPct).toBeNull()
  })

  it('array vacío → ceros y deltas null (sin crash)', () => {
    expect(computeActivityStats([])).toEqual({ avg7d: 0, max90d: 0, delta30dPct: null, delta90dPct: null })
  })
})
