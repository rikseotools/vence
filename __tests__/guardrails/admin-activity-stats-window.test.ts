import { readFileSync } from 'fs'
import { join } from 'path'

// GUARDRAIL (20/06): el panel "Usuarios Activos por Día" mostraba "promedio" (en realidad
// 14d) y "máximo" (solo de la quincena) SIN declarar la ventana → engañaba. Este test
// falla si se revierte: las etiquetas DEBEN declarar su ventana y los stats venir del
// server (avg7d / max90d / deltas), no recalculados a ojo sobre 14 días.

const ROOT = join(__dirname, '..', '..')
const read = (p: string) => readFileSync(join(ROOT, p), 'utf8')

describe('GUARDRAIL: stats de actividad con ventana explícita', () => {
  it('el componente etiqueta las ventanas (7d / 90d), no "promedio"/"máximo" a secas', () => {
    const c = read('components/AdminActivityChart.tsx')
    expect(c).toMatch(/promedio\/día \(7d\)/)
    expect(c).toMatch(/máximo \(90d\)/)
    // comparativa de horizonte largo presente
    expect(c).toMatch(/vs hace 30d/)
    expect(c).toMatch(/vs hace 90d/)
  })

  it('los stats vienen del server (función pura computeActivityStats), no a ojo', () => {
    const q = read('lib/api/admin-charts/queries.ts')
    expect(q).toMatch(/computeActivityStats/)
    const s = read('lib/api/admin-charts/schemas.ts')
    expect(s).toMatch(/avg7d/)
    expect(s).toMatch(/max90d/)
    expect(s).toMatch(/delta30dPct/)
    expect(s).toMatch(/delta90dPct/)
  })
})
